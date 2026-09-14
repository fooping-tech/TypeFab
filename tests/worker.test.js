import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../worker/src/app.js";
import { memoryStore, memoryBucket } from "../worker/src/store.js";
import { signStripePayload, verifyStripeSignature, formEncode } from "../worker/src/stripe.js";
import { configFromEnv } from "../worker/src/index.js";
import { quote } from "../src/pricing.js";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="82.3mm" height="142mm" viewBox="0 0 82.3 142"><path d="M10 10 L60 10 L60 60 L10 60 Z"/><circle cx="40" cy="100" r="20"/></svg>';
const PX_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect x="10" y="10" width="100" height="50"/></svg>';
const ORIGIN = "https://fooping-tech.github.io";
const base = {
  svg: SVG,
  fileName: "terminal-bookmark.svg",
  material: "mdf",
  thicknessMm: 2.5,
  quantity: 2,
  deliveryType: "NORMAL",
  totalPrice: 1, // must be ignored by the server
  customer: { name: "山田 太郎", email: "taro@example.com" },
  shipping: { postalCode: "100-0001", prefecture: "東京都", address1: "千代田区1-1", address2: "", phone: "0300000000" },
};
function setup(overrides = {}) {
  const store = memoryStore(), bucket = memoryBucket();
  const stripeCalls = [];
  let stripeFails = false, sessionCounter = 0;
  const fetch = async (url, init) => {
    stripeCalls.push({ url, init });
    if (stripeFails) return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
    const id = `cs_test_${++sessionCounter}`;
    return new Response(JSON.stringify({ id, url: `https://checkout.stripe.test/${id}` }), { status: 200 });
  };
  let clock = new Date("2026-09-14T03:00:00.000Z");
  const config = {
    stripeSecretKey: "sk_test_1",
    stripeWebhookSecret: "whsec_test",
    adminToken: "admin-secret",
    siteUrl: "https://fooping-tech.github.io/TypeFab/",
    allowedOrigins: [ORIGIN, "http://127.0.0.1:5173"],
    contactUrl: "https://example.com/contact",
    ...overrides,
  };
  const app = createApp({ store, bucket, config, fetch, now: () => clock, makeOrderId: () => `TF-${String(store.orders.size + 1).padStart(5, "0")}` });
  const call = (path, { method = "GET", body, headers = {}, raw } = {}) =>
    app(new Request(`https://api.test${path}`, { method, headers: { Origin: ORIGIN, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) }));
  const admin = (path, opts = {}) => call(path, { ...opts, headers: { Authorization: "Bearer admin-secret", ...(opts.headers ?? {}) } });
  const webhook = async (event, { secret = "whsec_test", t } = {}) => {
    const payload = JSON.stringify(event);
    return call("/api/stripe/webhook", { method: "POST", raw: payload, headers: { "Stripe-Signature": await signStripePayload(payload, secret, t ?? Math.floor(clock.getTime() / 1000)) } });
  };
  return { store, bucket, app, call, admin, webhook, stripeCalls, setStripeFails: (v) => (stripeFails = v), tick: (ms) => (clock = new Date(clock.getTime() + ms)) };
}
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
  const q = await (await call("/api/quote", { method: "POST", body: { material: "mdf", thicknessMm: 3, quantity: 1, deliveryType: "EXPRESS", widthMm: 50, heightMm: 50, cutLengthMm: 500, pathCount: 2 } })).json();
  assert.equal(q.quote.deliveryMultiplier, 2);
  const preflight = await call("/api/orders", { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  const other = await createApp({ store: memoryStore(), bucket: memoryBucket(), config: { allowedOrigins: [ORIGIN] } })(new Request("https://api.test/api/health", { headers: { Origin: "https://evil.example" } }));
  assert.equal(other.headers.get("Access-Control-Allow-Origin"), null);
});

test("order creation: SVG validated, price recomputed on the server, SVG stored in the bucket, Checkout Session created", async () => {
  const { call, store, bucket, stripeCalls } = setup();
  const res = await call("/api/orders", { method: "POST", body: base });
  const text = await res.text();
  assert.equal(res.status, 201, text);
  const out = JSON.parse(text);
  assert.equal(out.orderId, "TF-00001");
  assert.match(out.checkoutUrl, /^https:\/\/checkout\.stripe\.test\/cs_test_1$/);
  const expected = quote({ material: "mdf", thicknessMm: 2.5, quantity: 2, deliveryType: "NORMAL", widthMm: 82.3, heightMm: 142, cutLengthMm: out.order.widthMm ? out.quote.cutLengthMm : 0, pathCount: 2 });
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
  assert.equal((await call("/api/orders/TF-00001?token=nope")).status, 404);
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
  const detail = await (await s.admin(`/api/admin/orders/${a.orderId}`)).json();
  assert.equal(detail.order.customerEmail, "taro@example.com");
  assert.equal(detail.events.at(-1).toStatus, "PAID");
  const svg = await s.admin(`/api/admin/orders/${a.orderId}/svg`);
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get("Content-Type"), /image\/svg\+xml/);
  assert.match(svg.headers.get("Content-Disposition"), /attachment; filename="TF-00001-terminal-bookmark\.svg"/);
  assert.equal(svg.headers.get("Access-Control-Expose-Headers"), "Content-Disposition");
  assert.equal(await svg.text(), SVG);
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
  const cfg = configFromEnv({ STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh", ADMIN_TOKEN: "a", BULK_THRESHOLD: "5", ALLOWED_ORIGINS: "https://a.example, https://b.example" });
  assert.deepEqual(cfg.allowedOrigins, ["https://a.example", "https://b.example"]);
  assert.equal(cfg.bulkThreshold, 5);
  assert.equal(cfg.siteUrl, "https://fooping-tech.github.io/TypeFab/");
  const app = createApp({ store: memoryStore(), bucket: memoryBucket(), config: cfg });
  const q = await (await app(new Request("https://x/api/quote", { method: "POST", body: JSON.stringify({ material: "mdf", thicknessMm: 3, quantity: 5, deliveryType: "NORMAL", widthMm: 50, heightMm: 50 }) }))).json();
  assert.equal(q.quote.inquiryRequired, true, "env bulk threshold applies");
});
