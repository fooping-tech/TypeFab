import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../worker/src/app.js";
import { memoryStore, memoryBucket } from "../worker/src/store.js";
import { signStripePayload, verifyStripeSignature, formEncode } from "../worker/src/stripe.js";
import worker, { configFromEnv, validateConfig, configWarnings } from "../worker/src/index.js";
import { customerPaidMail, adminPaidMail } from "../worker/src/mail.js";
import { makeAccessTestKit, createAccessVerifier } from "../worker/src/access.js";
import { quote } from "../src/pricing.js";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="82.3mm" height="142mm" viewBox="0 0 82.3 142"><path d="M10 10 L60 10 L60 60 L10 60 Z"/><circle cx="40" cy="100" r="20"/></svg>';
const PX_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect x="10" y="10" width="100" height="50"/></svg>';
const ORIGIN = "https://fooping-tech.github.io";
const base = {
  svg: SVG,
  fileName: "terminal-bookmark.svg",
  material: "kraft-black",
  thicknessMm: 0.3,
  quantity: 2,
  deliveryType: "NORMAL",
  totalPrice: 1, // must be ignored by the server
  customer: { name: "山田 太郎", email: "taro@example.com" },
  shipping: { postalCode: "100-0001", prefecture: "東京都", address1: "千代田区1-1", address2: "", phone: "0300000000" },
};
function setup(overrides = {}, { certs = null } = {}) {
  const store = memoryStore(), bucket = memoryBucket();
  const stripeCalls = [], mailCalls = [], certCalls = [], logs = [];
  let stripeFails = false, mailFails = false, receiptMissing = false, sessionCounter = 0;
  const fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes("/cdn-cgi/access/certs")) {
      certCalls.push(u);
      return new Response(JSON.stringify(certs ?? { keys: [] }), { status: 200 });
    }
    if (u.includes("/emails")) {
      mailCalls.push({ url: u, body: JSON.parse(init.body), headers: init.headers });
      if (mailFails) return new Response(JSON.stringify({ message: "mail boom" }), { status: 500 });
      return new Response(JSON.stringify({ id: `email_${mailCalls.length}` }), { status: 200 });
    }
    if (u.includes("/v1/payment_intents/")) {
      stripeCalls.push({ url: u, init });
      if (stripeFails) return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
      const id = /payment_intents\/([^?]+)/.exec(u)[1];
      return new Response(JSON.stringify({ id, object: "payment_intent", latest_charge: receiptMissing ? null : { id: `ch_${id}`, receipt_url: `https://pay.stripe.test/receipts/${id}` } }), { status: 200 });
    }
    stripeCalls.push({ url: u, init });
    if (stripeFails) return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
    const id = `cs_test_${++sessionCounter}`;
    return new Response(JSON.stringify({ id, url: `https://checkout.stripe.test/${id}` }), { status: 200 });
  };
  let clock = new Date("2026-09-14T03:00:00.000Z");
  const config = {
    appEnv: "development",
    stripeSecretKey: "sk_test_1",
    stripeWebhookSecret: "whsec_test",
    adminToken: "admin-secret",
    siteUrl: "https://fooping-tech.github.io/TypeFab/",
    allowedOrigins: [ORIGIN, "http://127.0.0.1:5173"],
    adminAllowedOrigins: ["http://127.0.0.1:5173"],
    contactUrl: "https://example.com/contact",
    mailApiKey: "re_test",
    mailApiBase: "https://mail.test",
    mailFrom: "TypeFab <orders@typefab.test>",
    adminNotificationEmail: "owner@typefab.test",
    adminUrl: "https://typefab-orders.test/admin/",
    ...overrides,
  };
  const mailConsole = [];
  const app = createApp({ store, bucket, config, fetch, now: () => clock, makeOrderId: () => `TF-${String(store.orders.size + 1).padStart(5, "0")}`, log: (m) => logs.push(m), mailConsole: (m) => mailConsole.push(m) });
  const call = (path, { method = "GET", body, headers = {}, raw } = {}) =>
    app(new Request(`https://api.test${path}`, { method, headers: { Origin: ORIGIN, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) }));
  const admin = (path, opts = {}) => call(path, { ...opts, headers: { Authorization: "Bearer admin-secret", ...(opts.headers ?? {}) } });
  const webhook = async (event, { secret = "whsec_test", t } = {}) => {
    const payload = JSON.stringify(event);
    return call("/api/stripe/webhook", { method: "POST", raw: payload, headers: { "Stripe-Signature": await signStripePayload(payload, secret, t ?? Math.floor(clock.getTime() / 1000)) } });
  };
  return {
    store, bucket, app, call, admin, webhook, stripeCalls, mailCalls, certCalls, logs, mailConsole,
    setStripeFails: (v) => (stripeFails = v),
    setMailFails: (v) => (mailFails = v),
    setReceiptMissing: (v) => (receiptMissing = v),
    tick: (ms) => (clock = new Date(clock.getTime() + ms)),
    now: () => clock,
  };
}
const DAY = 86400000;
const paidEvent = (orderId, sessionId, amount, id = "evt_1", type = "checkout.session.completed") => ({
  id, type, data: { object: { id: sessionId, object: "checkout.session", payment_status: "paid", amount_total: amount, payment_intent: "pi_1", metadata: { orderId }, client_reference_id: orderId } },
});

test("config and quote endpoints expose the catalogue and server-side pricing with CORS", async () => {
  const { call } = setup();
  const res = await call("/api/config");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const cfg = await res.json();
  assert.equal(cfg.stripeConfigured, true);
  assert.equal(cfg.catalog.bulkThreshold, 10);
  const q = await (await call("/api/quote", { method: "POST", body: { material: "kraft-black", thicknessMm: 0.3, quantity: 1, deliveryType: "EXPRESS", widthMm: 50, heightMm: 50, cutLengthMm: 500, pathCount: 2 } })).json();
  assert.equal(q.quote.deliveryMultiplier, 2);
  const preflight = await call("/api/orders", { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  const other = await createApp({ store: memoryStore(), bucket: memoryBucket(), config: { allowedOrigins: [ORIGIN] } })(new Request("https://api.test/api/health", { headers: { Origin: "https://evil.example" } }));
  assert.equal(other.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(other.headers.get("Access-Control-Allow-Methods"), null, "no CORS grant at all for unknown origins");
  const cfgBody = await (await call("/api/config")).json();
  assert.equal(cfgBody.privacyUrl, "https://fooping-tech.github.io/TypeFab/privacy/");
  assert.equal(cfgBody.personalDataRetentionDays, 90);
});

test("CORS: public and admin endpoints use separate origin lists and never '*'", async () => {
  const { call } = setup();
  // The public site origin may call public endpoints but not admin ones.
  const pub = await call("/api/orders", { method: "OPTIONS" });
  assert.equal(pub.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(pub.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  const adminFromSite = await call("/api/admin/orders", { method: "OPTIONS" });
  assert.equal(adminFromSite.status, 204);
  assert.equal(adminFromSite.headers.get("Access-Control-Allow-Origin"), null);
  const adminGet = await call("/api/admin/orders", { headers: { Authorization: "Bearer admin-secret" } });
  assert.equal(adminGet.headers.get("Access-Control-Allow-Origin"), null, "admin responses carry no CORS grant for the public site");
  // The configured admin dev origin may call admin endpoints.
  const dev = await call("/api/admin/orders", { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:5173" } });
  assert.equal(dev.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:5173");
  assert.equal(dev.headers.get("Access-Control-Allow-Headers"), "Content-Type, Authorization");
  assert.equal(dev.headers.get("Access-Control-Expose-Headers"), "Content-Disposition");
  // Production default: no admin origins at all.
  const prod = setup({ adminAllowedOrigins: [] });
  const none = await prod.call("/api/admin/orders", { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:5173" } });
  assert.equal(none.headers.get("Access-Control-Allow-Origin"), null);
  for (const r of [pub, adminFromSite, dev, none]) assert.notEqual(r.headers.get("Access-Control-Allow-Origin"), "*");
});

test("order creation: SVG validated, price recomputed on the server, SVG stored in the bucket, Checkout Session created", async () => {
  const { call, store, bucket, stripeCalls } = setup();
  const res = await call("/api/orders", { method: "POST", body: base });
  const text = await res.text();
  assert.equal(res.status, 201, text);
  const out = JSON.parse(text);
  assert.equal(out.orderId, "TF-00001");
  assert.match(out.checkoutUrl, /^https:\/\/checkout\.stripe\.test\/cs_test_1$/);
  const expected = quote({ material: "kraft-black", thicknessMm: 0.3, quantity: 2, deliveryType: "NORMAL", widthMm: 82.3, heightMm: 142, cutLengthMm: out.order.widthMm ? out.quote.cutLengthMm : 0, pathCount: 2 });
  assert.equal(out.quote.totalPrice, expected.totalPrice);
  assert.notEqual(out.quote.totalPrice, 1, "client total ignored");
  const order = await store.getOrder("TF-00001");
  assert.equal(order.status, "PAYMENT_PENDING");
  assert.equal(order.totalPrice, expected.totalPrice);
  assert.equal(order.stripeCheckoutSessionId, "cs_test_1");
  assert.ok(order.cutLengthMm > 300);
  assert.equal(order.pathCount, 2);
  assert.equal(order.shippingPostalCode, "1000001");
  // SVG lives in R2 under a generated key, not the user's file name
  assert.match(order.svgObjectKey, /^orders\/TF-00001\/[0-9a-f]{16}\.svg$/);
  assert.equal((await bucket.get(order.svgObjectKey)).body, SVG);
  assert.ok(!order.svgObjectKey.includes("terminal-bookmark"));
  // Stripe received the server total in yen and the order id
  const form = new URLSearchParams(stripeCalls[0].init.body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), String(expected.totalPrice));
  assert.equal(form.get("line_items[0][price_data][currency]"), "jpy");
  assert.equal(form.get("client_reference_id"), "TF-00001");
  assert.match(form.get("success_url"), /order\/\?order=TF-00001&token=[0-9a-f]{32}&result=success&session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.equal(stripeCalls[0].init.headers.Authorization, "Bearer sk_test_1");
  // customer view with the access token, hidden without it
  const view = await (await call(`/api/orders/TF-00001?token=${out.accessToken}`)).json();
  assert.equal(view.order.status, "PAYMENT_PENDING");
  assert.equal(view.order.accessToken, undefined);
  assert.equal(view.order.receiptUrl, null, "no receipt before payment");
  for (const k of ["customerEmail", "customerName", "shippingAddress1", "shippingPhone", "stripePaymentIntentId"]) assert.equal(k in view.order, false, k);
  assert.equal((await call("/api/orders/TF-00001?token=nope")).status, 404);
  // Stripe sends its own receipt to the customer (#10).
  assert.equal(form.get("payment_intent_data[receipt_email]"), "taro@example.com");
});

test("order creation rejects bad SVG, bulk quantities, missing address and unconfigured Stripe", async () => {
  const { call, store } = setup();
  const bad = await call("/api/orders", { method: "POST", body: { ...base, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm"><script>1</script><rect width="5" height="5"/></svg>' } });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).details[0], /script/);
  const px = await call("/api/orders", { method: "POST", body: { ...base, svg: PX_SVG } });
  assert.equal(px.status, 400);
  assert.match((await px.json()).details[0], /実寸/);
  const confirmed = await call("/api/orders", { method: "POST", body: { ...base, svg: PX_SVG, confirmedWidthMm: 80 } });
  assert.equal(confirmed.status, 201);
  const o = await store.getOrder("TF-00001");
  assert.deepEqual([o.widthMm, o.heightMm], [80, 40]);
  const bulk = await call("/api/orders", { method: "POST", body: { ...base, quantity: 10 } });
  assert.equal(bulk.status, 400);
  const bulkBody = await bulk.json();
  assert.equal(bulkBody.inquiryRequired, true);
  assert.equal(bulkBody.contactUrl, "https://example.com/contact");
  const nine = await call("/api/orders", { method: "POST", body: { ...base, quantity: 9 } });
  assert.equal(nine.status, 201);
  const addr = await call("/api/orders", { method: "POST", body: { ...base, shipping: { postalCode: "12", prefecture: "", address1: "" } } });
  assert.equal(addr.status, 400);
  assert.equal((await addr.json()).details.length, 3);
  assert.equal((await call("/api/orders", { method: "POST", raw: "{oops" })).status, 400);
  const noStripe = setup({ stripeSecretKey: "" });
  assert.equal((await noStripe.call("/api/orders", { method: "POST", body: base })).status, 503);
  assert.equal(noStripe.store.orders.size, 0, "nothing stored when payment is unavailable");
});

test("Checkout Session failure cancels the pending order and reports 502", async () => {
  const s = setup();
  s.setStripeFails(true);
  const res = await s.call("/api/orders", { method: "POST", body: base });
  assert.equal(res.status, 502);
  assert.equal((await s.store.getOrder("TF-00001")).status, "CANCELLED");
});

test("webhook: signature required, PAID with ship-by date, duplicates ignored, expiry cancels", async () => {
  const s = setup();
  const created = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  const order = await s.store.getOrder(created.orderId);
  // wrong secret / stale timestamp / no header
  assert.equal((await s.webhook(paidEvent(order.id, "cs_test_1", order.totalPrice), { secret: "other" })).status, 400);
  assert.equal((await s.webhook(paidEvent(order.id, "cs_test_1", order.totalPrice), { t: Math.floor(Date.now() / 1000) - 100000 })).status, 400);
  assert.equal((await s.call("/api/stripe/webhook", { method: "POST", raw: "{}" })).status, 400);
  assert.equal((await s.store.getOrder(order.id)).status, "PAYMENT_PENDING");
  // valid
  const ok = await s.webhook(paidEvent(order.id, "cs_test_1", order.totalPrice));
  assert.equal(ok.status, 200);
  const paid = await s.store.getOrder(order.id);
  assert.equal(paid.status, "PAID");
  assert.equal(paid.paidAt, "2026-09-14T03:00:00.000Z");
  assert.equal(paid.shipBy, "2026-09-21T03:00:00.000Z");
  assert.equal(paid.stripePaymentIntentId, "pi_1");
  // duplicate delivery of the same event: no second transition
  const dup = await s.webhook(paidEvent(order.id, "cs_test_1", order.totalPrice));
  assert.deepEqual(await dup.json(), { received: true, duplicate: true });
  assert.equal(s.store.log.filter((e) => e.toStatus === "PAID").length, 1);
  // a different completed event for an already paid order is a no-op
  await s.webhook(paidEvent(order.id, "cs_test_1", order.totalPrice, "evt_2"));
  assert.equal(s.store.log.filter((e) => e.toStatus === "PAID").length, 1);
  // unknown order is acknowledged
  assert.match(JSON.stringify(await (await s.webhook(paidEvent("TF-NOPE", "cs_x", 1, "evt_3"))).json()), /unknown order/);
  // express ship-by is 3 days; expiry cancels only pending orders
  const ex = await (await s.call("/api/orders", { method: "POST", body: { ...base, deliveryType: "EXPRESS" } })).json();
  await s.webhook(paidEvent(ex.orderId, "cs_test_2", ex.quote.totalPrice, "evt_4"));
  assert.equal((await s.store.getOrder(ex.orderId)).shipBy, "2026-09-17T03:00:00.000Z");
  await s.webhook({ id: "evt_5", type: "checkout.session.expired", data: { object: { id: "cs_test_2", metadata: { orderId: ex.orderId } } } });
  assert.equal((await s.store.getOrder(ex.orderId)).status, "PAID", "expiry after payment is ignored");
  const pending = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  await s.webhook({ id: "evt_6", type: "checkout.session.expired", data: { object: { id: "cs_test_3", metadata: { orderId: pending.orderId } } } });
  assert.equal((await s.store.getOrder(pending.orderId)).status, "CANCELLED");
  // amount mismatch is recorded in notes
  const m = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  await s.webhook(paidEvent(m.orderId, "cs_test_4", 1, "evt_7"));
  assert.match((await s.store.getOrder(m.orderId)).notes, /amount mismatch/);
});

test("admin: token required, filters, SVG download and status transitions with tracking number", async () => {
  const s = setup();
  const a = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  await s.webhook(paidEvent(a.orderId, "cs_test_1", a.quote.totalPrice, "evt_a"));
  const b = await (await s.call("/api/orders", { method: "POST", body: { ...base, deliveryType: "EXPRESS" } })).json();
  assert.equal((await s.call("/api/admin/orders")).status, 401);
  assert.equal((await s.call("/api/admin/orders", { headers: { Authorization: "Bearer wrong" } })).status, 401);
  const all = await (await s.admin("/api/admin/orders")).json();
  assert.equal(all.orders.length, 2);
  assert.equal(all.orders[0].accessToken, undefined);
  const open = await (await s.admin("/api/admin/orders?status=open")).json();
  assert.deepEqual(open.orders.map((o) => o.id), [a.orderId]);
  const pending = await (await s.admin("/api/admin/orders?status=PAYMENT_PENDING")).json();
  assert.deepEqual(pending.orders.map((o) => o.id), [b.orderId]);
  for (const o of all.orders) for (const k of ["customerEmail", "shippingAddress1", "shippingPostalCode", "shippingPhone", "accessToken"]) assert.equal(k in o, false, `list omits ${k}`);
  assert.equal(all.orders[1].customerName, "山田 太郎");
  const detail = await (await s.admin(`/api/admin/orders/${a.orderId}`)).json();
  assert.equal(detail.order.shippingVisible, true);
  assert.equal(detail.order.customerEmail, "taro@example.com");
  assert.equal(detail.order.shippingAddress1, "千代田区1-1");
  assert.equal(detail.order.accessToken, undefined);
  assert.equal(detail.events.at(-1).toStatus, "PAID");
  assert.equal(detail.notifications.length, 2);
  // Unpaid orders never show the address either.
  const pendingDetail = await (await s.admin(`/api/admin/orders/${b.orderId}`)).json();
  assert.equal(pendingDetail.order.shippingVisible, false);
  assert.equal(pendingDetail.order.customerEmail, undefined);
  const svg = await s.admin(`/api/admin/orders/${a.orderId}/svg`);
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get("Content-Type"), /image\/svg\+xml/);
  assert.match(svg.headers.get("Content-Disposition"), /attachment; filename="TF-00001-terminal-bookmark\.svg"/);
  assert.equal(svg.headers.get("Access-Control-Expose-Headers"), null, "public site origin gets no admin CORS grant");
  assert.equal(await svg.text(), SVG);
  const svgDev = await s.admin(`/api/admin/orders/${a.orderId}/svg`, { headers: { Origin: "http://127.0.0.1:5173" } });
  assert.equal(svgDev.headers.get("Access-Control-Expose-Headers"), "Content-Disposition");
  const step = (status, extra = {}) => s.admin(`/api/admin/orders/${a.orderId}/status`, { method: "POST", body: { status, ...extra } });
  assert.equal((await step("SHIPPED")).status, 409, "PAID → SHIPPED is not allowed");
  assert.equal((await step("PROCESSING")).status, 200);
  assert.equal((await step("READY")).status, 200);
  const shipped = await (await step("SHIPPED", { trackingNumber: "1234-5678-9012", carrier: "ヤマト運輸" })).json();
  assert.equal(shipped.order.status, "SHIPPED");
  assert.equal(shipped.order.shippingTrackingNumber, "1234-5678-9012");
  assert.equal(shipped.order.shippingCarrier, "ヤマト運輸");
  assert.equal((await step("COMPLETED")).status, 200);
  assert.equal((await step("PROCESSING")).status, 409);
  // After COMPLETED the admin API stops returning personal data (#8 §5).
  const done = await (await s.admin(`/api/admin/orders/${a.orderId}`)).json();
  assert.equal(done.order.status, "COMPLETED");
  assert.equal(done.order.shippingVisible, false);
  for (const k of ["customerEmail", "shippingAddress1", "shippingPhone"]) assert.equal(k in done.order, false, k);
  assert.equal(done.order.customerName, null);
  assert.equal(done.order.receiptUrl, "https://pay.stripe.test/receipts/pi_1", "receipt stays available to the admin");
  assert.equal((await s.admin(`/api/admin/orders/${b.orderId}/status`, { method: "POST", body: { status: "CANCELLED" } })).status, 200);
  assert.equal((await s.admin("/api/admin/orders/TF-NOPE")).status, 404);
  const view = await (await s.call(`/api/orders/${a.orderId}?token=${a.accessToken}`)).json();
  assert.equal(view.order.trackingNumber, "1234-5678-9012");
});

test("stripe helpers: form encoding, signature round trip and env config", async () => {
  assert.equal(formEncode({ a: { b: [{ c: 1 }] }, d: "x", e: null }).toString(), "a%5Bb%5D%5B0%5D%5Bc%5D=1&d=x");
  const header = await signStripePayload("{}", "s", 1000);
  assert.ok(await verifyStripeSignature("{}", header, "s", { now: 1100 }));
  assert.ok(!(await verifyStripeSignature("{}", header, "s", { now: 2000 })));
  assert.ok(!(await verifyStripeSignature("{ }", header, "s", { now: 1100 })));
  assert.ok(!(await verifyStripeSignature("{}", "t=1000,v1=00", "s", { now: 1100 })));
  const cfg = configFromEnv({ STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh", ADMIN_TOKEN: "a", BULK_THRESHOLD: "5", ALLOWED_ORIGINS: "https://a.example, https://b.example", ADMIN_ALLOWED_ORIGINS: "", PERSONAL_DATA_RETENTION_DAYS: "30", MAIL_API_KEY: "re", MAIL_FROM: "x <x@y.z>", ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com", ACCESS_AUD: "aud" });
  assert.deepEqual(cfg.allowedOrigins, ["https://a.example", "https://b.example"]);
  assert.deepEqual(cfg.adminAllowedOrigins, []);
  assert.equal(cfg.personalDataRetentionDays, 30);
  assert.equal(cfg.mailApiKey, "re");
  assert.equal(cfg.accessAud, "aud");
  assert.equal(cfg.bulkThreshold, 5);
  assert.equal(cfg.siteUrl, "https://fooping-tech.github.io/TypeFab/");
  assert.equal(cfg.appEnv, "production", "APP_ENV defaults to production");
  assert.equal(cfg.mailMode, "resend", "MAIL_MODE defaults to resend");
  assert.equal(configFromEnv({ APP_ENV: " Development ", MAIL_MODE: "Console" }).appEnv, "development");
  assert.equal(configFromEnv({ APP_ENV: "development", MAIL_MODE: "Console" }).mailMode, "console");
  const app = createApp({ store: memoryStore(), bucket: memoryBucket(), config: cfg });
  const q = await (await app(new Request("https://x/api/quote", { method: "POST", body: JSON.stringify({ material: "kraft-black", thicknessMm: 0.3, quantity: 5, deliveryType: "NORMAL", widthMm: 50, heightMm: 50 }) }))).json();
  assert.equal(q.quote.inquiryRequired, true, "env bulk threshold applies");
});

test("notifications (#9): one customer mail and one admin mail on the first PAID, none on duplicates, expiry or failure", async () => {
  const s = setup();
  const created = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  assert.equal(s.mailCalls.length, 0, "nothing sent at order creation");
  const res = await s.webhook(paidEvent(created.orderId, "cs_test_1", created.quote.totalPrice));
  const body = await res.json();
  assert.equal(body.notifications.customer_paid.status, "sent");
  assert.equal(body.notifications.admin_paid.status, "sent");
  assert.equal(s.mailCalls.length, 2);
  const [customer, admin] = s.mailCalls;
  assert.equal(customer.headers.Authorization, "Bearer re_test");
  assert.deepEqual(customer.body.to, ["taro@example.com"]);
  assert.equal(customer.body.from, "TypeFab <orders@typefab.test>");
  assert.match(customer.body.subject, /ご注文を承りました（TF-00001）/);
  assert.match(customer.body.text, /注文番号: TF-00001/);
  assert.match(customer.body.text, /合計（お支払い済み）: ¥/);
  assert.match(customer.body.text, /発送予定: 2026-09-21 まで/);
  assert.match(customer.body.text, new RegExp(`order/\\?order=TF-00001&token=${created.accessToken}`));
  assert.match(customer.body.text, /https:\/\/example\.com\/contact/);
  assert.match(customer.body.text, /黒クラフトペーパー 0\.3 mm[\s\S]*数量: 2[\s\S]*納期: 通常/);
  for (const pii of ["千代田区", "1000001", "0300000000", "東京都"]) assert.ok(!customer.body.text.includes(pii), `customer mail must not contain ${pii}`);
  assert.deepEqual(admin.body.to, ["owner@typefab.test"]);
  assert.match(admin.body.subject, /^新規注文 TF-00001 ¥/);
  assert.match(admin.body.text, /購入者: 山田 太郎/);
  assert.match(admin.body.text, /https:\/\/typefab-orders\.test\/admin\//);
  for (const pii of ["千代田区", "1000001", "0300000000", "taro@example.com"]) assert.ok(!admin.body.text.includes(pii), `admin mail must not contain ${pii}`);
  // Recorded per type; duplicate and repeated events do not resend.
  const notes = await s.store.listNotifications(created.orderId);
  assert.deepEqual(notes.map((n) => [n.type, Boolean(n.sentAt), n.providerId, n.attempts]).sort(), [["admin_paid", true, "email_2", 1], ["customer_paid", true, "email_1", 1]]);
  await s.webhook(paidEvent(created.orderId, "cs_test_1", created.quote.totalPrice));
  await s.webhook(paidEvent(created.orderId, "cs_test_1", created.quote.totalPrice, "evt_again", "checkout.session.async_payment_succeeded"));
  assert.equal(s.mailCalls.length, 2, "webhook redelivery does not resend");
  const resend = await (await s.admin(`/api/admin/orders/${created.orderId}/notify`, { method: "POST", body: {} })).json();
  assert.equal(resend.results.customer_paid.status, "already-sent");
  assert.equal(s.mailCalls.length, 2, "manual resend skips sent notifications");
  // Express orders are flagged in the admin subject.
  const ex = await (await s.call("/api/orders", { method: "POST", body: { ...base, deliveryType: "EXPRESS" } })).json();
  await s.webhook(paidEvent(ex.orderId, "cs_test_2", ex.quote.totalPrice, "evt_ex"));
  assert.match(s.mailCalls.at(-1).body.subject, /^【特急】新規注文/);
  assert.match(s.mailCalls.at(-1).body.text, /特急注文です/);
  // Expired / failed / unpaid sessions never notify.
  const pending = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  await s.webhook({ id: "evt_exp", type: "checkout.session.expired", data: { object: { id: "cs_test_3", metadata: { orderId: pending.orderId } } } });
  await s.webhook({ id: "evt_fail", type: "checkout.session.async_payment_failed", data: { object: { id: "cs_test_3", metadata: { orderId: pending.orderId } } } });
  await s.webhook({ id: "evt_unpaid", type: "checkout.session.completed", data: { object: { id: "cs_test_3", payment_status: "unpaid", metadata: { orderId: pending.orderId } } } });
  assert.equal(s.mailCalls.length, 4);
  assert.equal((await s.admin(`/api/admin/orders/${pending.orderId}/notify`, { method: "POST", body: {} })).status, 409, "cannot notify an unpaid order");
});

test("notifications: provider failure keeps PAID, records the error and can be resent from the admin API", async () => {
  const s = setup();
  s.setMailFails(true);
  const created = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  const res = await s.webhook(paidEvent(created.orderId, "cs_test_1", created.quote.totalPrice));
  assert.equal(res.status, 200, "webhook is acknowledged despite the mail failure");
  const body = await res.json();
  assert.equal(body.notifications.customer_paid.status, "failed");
  assert.equal((await s.store.getOrder(created.orderId)).status, "PAID");
  const notes = await s.store.listNotifications(created.orderId);
  assert.ok(notes.every((n) => !n.sentAt && /mail boom/.test(n.error) && n.attempts === 1));
  assert.ok(s.logs.some((l) => /notification customer_paid failed for TF-00001/.test(l)));
  assert.ok(!s.logs.some((l) => /taro@example.com|千代田/.test(l)), "logs carry no personal data");
  const detail = await (await s.admin(`/api/admin/orders/${created.orderId}`)).json();
  assert.equal(detail.notifications.filter((n) => n.error).length, 2);
  s.setMailFails(false);
  const resend = await (await s.admin(`/api/admin/orders/${created.orderId}/notify`, { method: "POST", body: {} })).json();
  assert.equal(resend.results.customer_paid.status, "sent");
  assert.equal(resend.results.admin_paid.status, "sent");
  assert.equal(s.mailCalls.length, 4);
  assert.ok(resend.notifications.every((n) => n.sentAt && n.error === null && n.attempts === 2));
  // Mail not configured: recorded as skipped, order still PAID.
  const off = setup({ mailApiKey: undefined });
  const c2 = await (await off.call("/api/orders", { method: "POST", body: base })).json();
  const r2 = await (await off.webhook(paidEvent(c2.orderId, "cs_test_1", c2.quote.totalPrice))).json();
  assert.equal(r2.notifications.customer_paid.status, "skipped");
  assert.equal((await off.store.getOrder(c2.orderId)).status, "PAID");
  assert.equal(off.mailCalls.length, 0);
  const health = await (await off.call("/api/health")).json();
  assert.equal(health.mailConfigured, false);
});

test("mail templates never include the shipping address or phone number", () => {
  const order = { id: "TF-X", status: "PAID", paidAt: "2026-09-14T03:00:00.000Z", shipBy: "2026-09-21T03:00:00.000Z", customerName: "山田 太郎", customerEmail: "taro@example.com", shippingPostalCode: "1000001", shippingPrefecture: "東京都", shippingAddress1: "千代田区1-1", shippingAddress2: "ビル2F", shippingPhone: "0300000000", material: "mdf", thicknessMm: 3, widthMm: 40, heightMm: 120, quantity: 1, deliveryType: "EXPRESS", processingPrice: 2000, shippingPrice: 750, totalPrice: 2750, originalFileName: "a.svg", cutLengthMm: 500, pathCount: 3 };
  const c = customerPaidMail(order, { orderUrl: "https://site/order/?order=TF-X&token=t", contactUrl: "https://contact" });
  const a = adminPaidMail(order, { adminUrl: "https://admin/" });
  for (const m of [c, a]) for (const pii of ["1000001", "東京都", "千代田区", "ビル2F", "0300000000"]) assert.ok(!m.text.includes(pii) && !m.subject.includes(pii), pii);
  assert.match(c.text, /¥2,750/);
  assert.match(c.text, /特急/);
  assert.match(c.text, /2026-09-21/);
  assert.ok(!a.text.includes("taro@example.com"), "admin mail has no customer e-mail");
  assert.match(a.text, /山田 太郎/);
});

test("receipts (#10): fetched after PAID from the PaymentIntent, cached, and returned to the customer only once paid", async () => {
  const s = setup();
  const created = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  const view = (t) => s.call(`/api/orders/${created.orderId}?token=${t ?? created.accessToken}`);
  assert.equal((await (await view()).json()).order.receiptUrl, null);
  await s.webhook(paidEvent(created.orderId, "cs_test_1", created.quote.totalPrice));
  const order = await s.store.getOrder(created.orderId);
  assert.equal(order.stripeChargeId, "ch_pi_1");
  assert.equal(order.receiptUrl, "https://pay.stripe.test/receipts/pi_1");
  const piCalls = s.stripeCalls.filter((c) => c.url.includes("/v1/payment_intents/pi_1"));
  assert.equal(piCalls.length, 1);
  assert.match(piCalls[0].url, /expand\[\]=latest_charge/);
  assert.equal(piCalls[0].init.headers.Authorization, "Bearer sk_test_1");
  const paid = await (await view()).json();
  assert.equal(paid.order.receiptUrl, "https://pay.stripe.test/receipts/pi_1");
  assert.equal(paid.order.stripeChargeId, undefined, "Stripe ids stay private");
  assert.equal(s.stripeCalls.filter((c) => c.url.includes("/v1/payment_intents/")).length, 1, "cached: no second Stripe call");
  assert.equal((await view("bad")).status, 404, "wrong token: no receipt");
  // Customer mail points at the order page that shows the receipt.
  assert.match(s.mailCalls[0].body.text, /領収書/);
  // Receipt not yet available at webhook time → fetched lazily on the next customer view.
  const late = setup();
  late.setReceiptMissing(true);
  const c2 = await (await late.call("/api/orders", { method: "POST", body: base })).json();
  await late.webhook(paidEvent(c2.orderId, "cs_test_1", c2.quote.totalPrice));
  assert.equal((await late.store.getOrder(c2.orderId)).receiptUrl, null);
  assert.equal((await (await late.call(`/api/orders/${c2.orderId}?token=${c2.accessToken}`)).json()).order.receiptUrl, null);
  late.setReceiptMissing(false);
  assert.equal((await (await late.call(`/api/orders/${c2.orderId}?token=${c2.accessToken}`)).json()).order.receiptUrl, "https://pay.stripe.test/receipts/pi_1");
  // Cancelled orders hide the receipt again.
  await s.admin(`/api/admin/orders/${created.orderId}/status`, { method: "POST", body: { status: "CANCELLED" } });
  assert.equal((await (await view()).json()).order.receiptUrl, null);
  // Stripe lookup failure is logged and does not break the webhook.
  const broken = setup();
  const c3 = await (await broken.call("/api/orders", { method: "POST", body: base })).json();
  broken.setStripeFails(true);
  const r3 = await broken.webhook(paidEvent(c3.orderId, "cs_test_1", c3.quote.totalPrice));
  assert.equal(r3.status, 200);
  assert.equal((await broken.store.getOrder(c3.orderId)).status, "PAID");
  assert.ok(broken.logs.some((l) => /receipt lookup failed for TF-00001/.test(l)));
});

test("Cloudflare Access (#8): admin endpoints accept only a valid Cf-Access-Jwt-Assertion when Access is configured", async () => {
  const teamDomain = "typefab.cloudflareaccess.com", aud = "a".repeat(64);
  const kit = await makeAccessTestKit({ teamDomain, aud });
  const s = setup({ accessTeamDomain: teamDomain, accessAud: aud }, { certs: kit.certs });
  const nowSec = Math.floor(s.now().getTime() / 1000);
  const good = await kit.sign({ email: "owner@example.com", sub: "u1", iat: nowSec, exp: nowSec + 3600 });
  const withJwt = (path, jwt, opts = {}) => s.call(path, { ...opts, headers: { "Cf-Access-Jwt-Assertion": jwt, ...(opts.headers ?? {}) } });
  // Bearer token is ignored in Access mode.
  const bearer = await s.call("/api/admin/orders", { headers: { Authorization: "Bearer admin-secret" } });
  assert.equal(bearer.status, 401);
  assert.equal((await bearer.json()).authMode, "access");
  const ok = await withJwt("/api/admin/session", good);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { mode: "access", email: "owner@example.com", mailConfigured: true, retentionDays: 90 });
  assert.equal((await withJwt("/api/admin/orders", good)).status, 200);
  assert.equal(s.certCalls.length, 1, "JWKS cached across requests");
  // Wrong audience, wrong issuer, expired, unknown key, tampered payload.
  const otherKit = await makeAccessTestKit({ teamDomain, aud: "b".repeat(64), kid: "other" });
  assert.equal((await withJwt("/api/admin/orders", await otherKit.sign({ email: "x", exp: nowSec + 3600 }))).status, 401, "signed by an unknown key");
  assert.equal((await withJwt("/api/admin/orders", await kit.sign({ email: "x", exp: nowSec + 3600, aud: ["b".repeat(64)] }))).status, 401, "wrong aud");
  assert.equal((await withJwt("/api/admin/orders", await kit.sign({ email: "x", exp: nowSec + 3600, iss: "https://evil.cloudflareaccess.com" }))).status, 401, "wrong issuer");
  assert.equal((await withJwt("/api/admin/orders", await kit.sign({ email: "x", exp: nowSec - 10 }))).status, 401, "expired");
  const [h, , sig] = good.split(".");
  const tampered = `${h}.${btoa(JSON.stringify({ aud: [aud], iss: `https://${teamDomain}`, email: "evil@example.com", exp: nowSec + 3600 })).replace(/=+$/, "")}.${sig}`;
  assert.equal((await withJwt("/api/admin/orders", tampered)).status, 401, "tampered payload");
  assert.equal((await withJwt("/api/admin/orders", "garbage")).status, 401);
  // Status changes record who did them.
  const created = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  await s.webhook(paidEvent(created.orderId, "cs_test_1", created.quote.totalPrice));
  assert.equal((await withJwt(`/api/admin/orders/${created.orderId}/status`, good, { method: "POST", body: { status: "PROCESSING" } })).status, 200);
  assert.match((await s.store.listOrderEvents(created.orderId)).at(-1).note, /by owner@example.com/);
  // Key rotation: a token signed with a new key triggers one JWKS refresh.
  const rotated = await makeAccessTestKit({ teamDomain, aud, kid: "rotated" });
  const v = createAccessVerifier({ teamDomain, aud, fetch: async () => new Response(JSON.stringify(rotated.certs)), now: () => s.now().getTime() });
  assert.ok(await v(await rotated.sign({ email: "r@example.com", exp: nowSec + 60 })));
  // Token mode without Access: session reports it.
  assert.equal((await s.admin("/api/admin/session")).status, 401, "bearer is rejected in Access mode");
  const local = setup();
  assert.deepEqual(await (await local.admin("/api/admin/session")).json(), { mode: "token", email: null, mailConfigured: true, retentionDays: 90 });
});

test("retention purge (#8): closed orders lose personal data and SVG after the retention period; open orders keep them", async () => {
  const s = setup();
  const make = async (body = base) => {
    const c = await (await s.call("/api/orders", { method: "POST", body })).json();
    await s.webhook(paidEvent(c.orderId, `cs_${c.orderId}`, c.quote.totalPrice, `evt_${c.orderId}`));
    return c.orderId;
  };
  const step = (id, status) => s.admin(`/api/admin/orders/${id}/status`, { method: "POST", body: { status } });
  const done = await make();
  for (const st of ["PROCESSING", "READY", "SHIPPED", "COMPLETED"]) await step(done, st);
  const cancelled = await make();
  await step(cancelled, "CANCELLED");
  const open = await make();
  await step(open, "PROCESSING");
  // 89 days later: nothing.
  s.tick(89 * DAY);
  let r = await s.app.purgeExpiredData();
  assert.deepEqual(r.purged, []);
  // Dry run lists candidates without touching them.
  s.tick(2 * DAY);
  r = await s.app.purgeExpiredData({ dryRun: true });
  assert.deepEqual(r.purged.sort(), [done, cancelled].sort());
  assert.equal((await s.store.getOrder(done)).customerEmail, "taro@example.com");
  // Real run via the admin API.
  const api = await (await s.admin("/api/admin/maintenance/purge", { method: "POST", body: {} })).json();
  assert.deepEqual(api.purged.sort(), [done, cancelled].sort());
  for (const id of [done, cancelled]) {
    const o = await s.store.getOrder(id);
    for (const k of ["customerName", "customerEmail", "shippingPostalCode", "shippingPrefecture", "shippingAddress1", "shippingAddress2", "shippingPhone"]) assert.equal(o[k], null, `${id}.${k}`);
    assert.ok(o.personalDataDeletedAt);
    assert.equal(s.bucket.objects.has(o.svgObjectKey), false, "SVG deleted from the bucket");
    // Accounting data survives.
    assert.equal(o.totalPrice, (await s.store.getOrder(open)).totalPrice);
    assert.ok(o.stripePaymentIntentId && o.paidAt && o.material);
    assert.match((await s.store.listOrderEvents(id)).at(-1).note, /personal data and SVG deleted after 90 days/);
  }
  const still = await s.store.getOrder(open);
  assert.equal(still.customerEmail, "taro@example.com");
  assert.ok(s.bucket.objects.has(still.svgObjectKey));
  // Purged orders: no address in the admin API, SVG gone, no resend, list flags them.
  const detail = await (await s.admin(`/api/admin/orders/${done}`)).json();
  assert.equal(detail.order.shippingVisible, false);
  assert.ok(detail.order.personalDataDeletedAt);
  assert.equal((await s.admin(`/api/admin/orders/${done}/svg`)).status, 410);
  assert.equal((await s.admin(`/api/admin/orders/${done}/notify`, { method: "POST", body: {} })).status, 410);
  // A second run finds nothing new; the customer page still works without personal data.
  assert.deepEqual((await s.app.purgeExpiredData()).purged, []);
  const token = (await s.store.getOrder(done)).accessToken;
  const view = await (await s.call(`/api/orders/${done}?token=${token}`)).json();
  assert.equal(view.order.status, "COMPLETED");
  assert.equal(view.order.receiptUrl, `https://pay.stripe.test/receipts/pi_1`);
  // Retention period is configurable.
  const short = setup({ personalDataRetentionDays: 1 });
  const c = await (await short.call("/api/orders", { method: "POST", body: base })).json();
  await short.webhook({ id: "e", type: "checkout.session.expired", data: { object: { id: "cs", metadata: { orderId: c.orderId } } } });
  short.tick(2 * DAY);
  assert.deepEqual((await short.app.purgeExpiredData()).purged, [c.orderId]);
});

test("dev/prod separation (#11): validateConfig refuses live Stripe keys and console mail outside development", async () => {
  const dev = configFromEnv({ APP_ENV: "development", STRIPE_SECRET_KEY: "sk_test_1", STRIPE_WEBHOOK_SECRET: "whsec", ADMIN_TOKEN: "local-development", MAIL_MODE: "console", SITE_URL: "http://127.0.0.1:5173/TypeFab/" });
  assert.deepEqual(validateConfig(dev), []);
  assert.deepEqual(configWarnings(dev), []);
  assert.match(validateConfig({ ...dev, stripeSecretKey: "sk_live_abc" })[0], /live key/);
  assert.match(validateConfig({ ...dev, stripeSecretKey: "rk_live_abc" })[0], /live key/);
  assert.match(validateConfig({ ...dev, appEnv: "staging" })[0], /APP_ENV/);
  assert.match(validateConfig({ ...dev, mailMode: "smtp" })[0], /MAIL_MODE/);
  assert.match(configWarnings({ ...dev, stripeSecretKey: "sk_1" })[0], /test key/);
  assert.match(configWarnings({ ...dev, siteUrl: "https://fooping-tech.github.io/TypeFab/" })[0], /not a local address/);
  const prod = configFromEnv({ STRIPE_SECRET_KEY: "sk_live_1", STRIPE_WEBHOOK_SECRET: "whsec", ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com", ACCESS_AUD: "aud", MAIL_API_KEY: "re", MAIL_FROM: "x <x@y.z>" });
  assert.deepEqual(validateConfig(prod), [], "live key is fine in production");
  assert.deepEqual(configWarnings(prod), []);
  assert.match(validateConfig({ ...prod, mailMode: "console" })[0], /only allowed in development/);
  assert.match(validateConfig({ ...prod, stripeApiBase: "http://127.0.0.1:4242" })[0], /STRIPE_API_BASE/);
  assert.match(validateConfig({ ...prod, mailApiBase: "http://127.0.0.1:4242" })[0], /MAIL_API_BASE/);
  assert.match(configWarnings({ ...prod, adminToken: "x" })[0], /ADMIN_TOKEN is set but ignored/);
  assert.match(configWarnings({ ...prod, accessAud: undefined })[0], /Cloudflare Access .* not configured/);
  // The Worker entry refuses every API request while the config is invalid (no D1 access needed).
  const env = { APP_ENV: "development", STRIPE_SECRET_KEY: "sk_live_1", STRIPE_WEBHOOK_SECRET: "whsec", MAIL_MODE: "console" };
  const origError = console.error, origWarn = console.warn, printed = [];
  console.error = (m) => printed.push(m);
  console.warn = (m) => printed.push(m);
  try {
    const res = await worker.fetch(new Request("http://127.0.0.1:8787/api/health"), env);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.match(body.details[0], /live key/);
    let pending = null;
    await worker.scheduled({}, env, { waitUntil: (p) => (pending = p) });
    await pending;
    assert.ok(printed.some((m) => /retention purge skipped/.test(m)), "scheduled() logs and swallows the config error");
  } finally {
    console.error = origError;
    console.warn = origWarn;
  }
  assert.ok(printed.some((m) => /live key/.test(m)));
});

test("dev/prod separation (#11): ADMIN_TOKEN works only in development; production without Access answers 503", async () => {
  const dev = setup();
  const devHealth = await (await dev.call("/api/health")).json();
  assert.equal(devHealth.env, "development");
  assert.equal(devHealth.adminAuth, "token");
  assert.equal(devHealth.mailMode, "resend");
  assert.equal((await dev.admin("/api/admin/orders")).status, 200);
  const prod = setup({ appEnv: "production" });
  const prodHealth = await (await prod.call("/api/health")).json();
  assert.equal(prodHealth.env, "production");
  assert.equal(prodHealth.adminAuth, "none");
  assert.equal(prodHealth.accessConfigured, false);
  const res = await prod.admin("/api/admin/orders");
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.authMode, "none");
  assert.match(body.error, /Cloudflare Access/);
  assert.equal((await prod.call("/api/admin/session")).status, 503, "no header at all is refused the same way");
  assert.equal((await prod.call("/api/config")).status, 200, "public endpoints keep working");
  // An unknown APP_ENV is treated as production by the app.
  const odd = setup({ appEnv: "staging" });
  assert.equal((await odd.admin("/api/admin/orders")).status, 503);
  // Access configured: same in both environments (covered in the Access test); adminAuth reports it.
  const teamDomain = "typefab.cloudflareaccess.com", aud = "b".repeat(64);
  const kit = await makeAccessTestKit({ teamDomain, aud });
  const withAccess = setup({ appEnv: "production", accessTeamDomain: teamDomain, accessAud: aud }, { certs: kit.certs });
  assert.equal((await (await withAccess.call("/api/health")).json()).adminAuth, "access");
  assert.equal((await withAccess.admin("/api/admin/orders")).status, 401, "bearer token is not accepted with Access");
});

test("MAIL_MODE=console (#11): mails are printed, not sent, and recorded as sent; ignored outside development", async () => {
  const s = setup({ mailMode: "console", mailApiKey: undefined });
  assert.equal((await (await s.call("/api/health")).json()).mailConfigured, true, "console mode counts as configured");
  const created = await (await s.call("/api/orders", { method: "POST", body: base })).json();
  const body = await (await s.webhook(paidEvent(created.orderId, "cs_test_1", created.quote.totalPrice))).json();
  assert.deepEqual([body.notifications.customer_paid.status, body.notifications.customer_paid.mode], ["sent", "console"]);
  assert.equal(body.notifications.admin_paid.status, "sent");
  assert.equal(s.mailCalls.length, 0, "Resend is never called");
  assert.equal(s.mailConsole.length, 2);
  assert.match(s.mailConsole[0], /\[mail:console\] customer_paid for order TF-00001/);
  assert.match(s.mailConsole[0], /To: taro@example.com/);
  assert.match(s.mailConsole[0], /Subject: 【TypeFab】ご注文を承りました（TF-00001）/);
  assert.match(s.mailConsole[0], /注文番号: TF-00001/);
  assert.match(s.mailConsole[1], /\[mail:console\] admin_paid for order TF-00001/);
  assert.match(s.mailConsole[1], /To: owner@typefab.test/);
  const notes = await s.store.listNotifications(created.orderId);
  assert.deepEqual(notes.map((n) => [n.type, Boolean(n.sentAt), n.providerId.startsWith("console:")]).sort(), [["admin_paid", true, true], ["customer_paid", true, true]]);
  await s.webhook(paidEvent(created.orderId, "cs_test_1", created.quote.totalPrice));
  const resend = await (await s.admin(`/api/admin/orders/${created.orderId}/notify`, { method: "POST", body: {} })).json();
  assert.equal(resend.results.customer_paid.status, "already-sent");
  assert.equal(s.mailConsole.length, 2, "idempotent like the real provider");
  // createApp on its own (without validateConfig) never prints mail in production.
  const prod = setup({ appEnv: "production", accessTeamDomain: "t.cloudflareaccess.com", accessAud: "aud", mailMode: "console", mailApiKey: undefined });
  const h = await (await prod.call("/api/health")).json();
  assert.deepEqual([h.mailMode, h.mailConfigured], ["resend", false]);
});

test("size rules (sheet vs envelope): a TypeFab work area larger than the envelope is accepted when the cut outline fits, and the piece size is stored", async () => {
  const s = setup();
  const area = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="240mm" height="160mm" viewBox="0 0 240 160">${body}</svg>`;
  const ok = await s.call("/api/orders", { method: "POST", body: { ...base, svg: area('<rect x="20" y="10" width="50" height="140"/><circle cx="45" cy="40" r="8"/>') } });
  const okText = await ok.text();
  assert.equal(ok.status, 201, okText);
  const out = JSON.parse(okText);
  assert.deepEqual([out.order.widthMm, out.order.heightMm, out.order.pieceWidthMm, out.order.pieceHeightMm], [240, 160, 50, 140]);
  assert.equal(out.quote.shippingLabel, "コンパクト便");
  const stored = await s.store.getOrder(out.orderId);
  assert.deepEqual([stored.pieceWidthMm, stored.pieceHeightMm], [50, 140]);
  const cfg = await (await s.call("/api/config")).json();
  assert.deepEqual([cfg.catalog.sheet.name, cfg.catalog.envelope.name, cfg.catalog.limits.piece.maxWidthMm], ["A4 横", "長形3号封筒", 215]);
  // The same work area with an outline that does not fit the envelope is refused with the piece size.
  const bad = await s.call("/api/orders", { method: "POST", body: { ...base, svg: area('<rect x="10" y="10" width="220" height="120"/>') } });
  assert.equal(bad.status, 400);
  const body = await bad.json();
  assert.match(body.details[0], /切り抜き後のサイズが封筒に収まりません（220\.0 × 120\.0 mm/);
  // A work area that does not fit the sheet is refused even with a small outline.
  const sheet = await s.call("/api/orders", { method: "POST", body: { ...base, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300mm" height="200mm" viewBox="0 0 300 200"><rect x="20" y="10" width="50" height="140"/></svg>' } });
  assert.equal(sheet.status, 400);
  assert.match((await sheet.json()).details[0], /SVGが用紙に収まりません/);
  // The customer mail mentions the piece when it differs from the SVG.
  const paid = await s.webhook(paidEvent(out.orderId, "cs_test_1", out.quote.totalPrice));
  assert.equal((await paid.json()).notifications.customer_paid.status, "sent");
  assert.match(s.mailCalls[0].body.text, /サイズ: 240\.0 × 160\.0 mm（切り抜き後 50\.0 × 140\.0 mm）/);
  // Admin list and detail carry the piece size.
  const list = await (await s.admin("/api/admin/orders")).json();
  assert.deepEqual([list.orders[0].pieceWidthMm, list.orders[0].pieceHeightMm], [50, 140]);
});
