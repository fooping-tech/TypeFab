// Request handlers for the TypeFab order API. Everything that touches the
// outside world (D1, R2, Stripe, mail, Access, time, randomness) comes in
// through `deps` so the flow can be tested end to end without Cloudflare.
import { quote, quoteOrder, publicCatalog, shipByDate, TRANSITIONS, CATALOG, missingTerms } from "../../src/pricing.js";
import { analyzeSVG, withPhysicalSize } from "../../src/svganalyze.js";
import { createCheckoutSession, verifyStripeSignature, timingSafeEqual, fetchReceipt } from "./stripe.js";
import { createAccessVerifier } from "./access.js";
import { sendMail, customerPaidMail, adminPaidMail, consoleMailText } from "./mail.js";
import { PERSONAL_DATA_FIELDS, NOTIFICATION_TYPES, legacyItems } from "./store.js";

// Several SVGs per order (CATALOG.limits.maxOrderSvgBytes) plus JSON escaping.
const MAX_BODY = 12 * 1024 * 1024;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Statuses in which a payment exists (receipt available) and in which the
// shipping details are still needed by the admin page.
const PAID_STATUSES = ["PAID", "PROCESSING", "READY", "SHIPPED", "COMPLETED"];
const SHIPPING_VISIBLE_STATUSES = ["PAID", "PROCESSING", "READY", "SHIPPED"];
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
const error = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status);
const clean = (v, max) => (v === undefined || v === null ? "" : String(v).trim().slice(0, max));
const randomId = (bytes) => {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return b;
};
export const newOrderId = () =>
  "TF-" + [...randomId(6)].map((n) => ID_ALPHABET[n % 32]).join("");
const newToken = () => [...randomId(16)].map((n) => n.toString(16).padStart(2, "0")).join("");
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Catalogue with environment overrides for the settable rules.
export function catalogFromConfig(config = {}) {
  const c = structuredClone(CATALOG);
  if (config.bulkThreshold > 0) c.bulkThreshold = Number(config.bulkThreshold);
  if (config.normalLeadTimeDays > 0) c.delivery.NORMAL.leadTimeDays = Number(config.normalLeadTimeDays);
  return c;
}
// The SVGs of an order as shown to the customer and in the admin list (no
// object keys or hashes).
const itemView = (it) => ({
  position: it.position,
  fileName: it.originalFileName,
  widthMm: it.widthMm,
  heightMm: it.heightMm,
  pieceWidthMm: it.pieceWidthMm ?? null,
  pieceHeightMm: it.pieceHeightMm ?? null,
  quantity: it.quantity,
  cutLengthMm: it.cutLengthMm ?? null,
  pathCount: it.pathCount ?? null,
  estimatedProcessingMinutes: it.estimatedProcessingMinutes ?? null,
  price: it.itemPrice ?? null,
});
const itemsOr = (o, items) => (items?.length ? items : legacyItems(o));
// Customer-facing view of an order (no address, no e-mail, no tokens, no
// Stripe ids). The receipt link only exists once the order was paid.
export const customerView = (o, items) => ({
  id: o.id,
  status: o.status,
  createdAt: o.createdAt,
  paidAt: o.paidAt,
  shipBy: o.shipBy,
  fileName: o.originalFileName,
  widthMm: o.widthMm,
  heightMm: o.heightMm,
  pieceWidthMm: o.pieceWidthMm ?? null,
  pieceHeightMm: o.pieceHeightMm ?? null,
  material: o.material,
  thicknessMm: o.thicknessMm,
  quantity: o.quantity,
  deliveryType: o.deliveryType,
  processingPrice: o.processingPrice,
  shippingPrice: o.shippingPrice,
  totalPrice: o.totalPrice,
  currency: o.currency,
  trackingNumber: o.shippingTrackingNumber,
  carrier: o.shippingCarrier,
  receiptUrl: PAID_STATUSES.includes(o.status) && o.receiptUrl ? o.receiptUrl : null,
  items: itemsOr(o, items).map((it) => {
    const { position, fileName, widthMm, heightMm, pieceWidthMm, pieceHeightMm, quantity } = itemView(it);
    return { position, fileName, widthMm, heightMm, pieceWidthMm, pieceHeightMm, quantity };
  }),
});
// Admin list view: what the order board needs, without contact details.
const ADMIN_LIST_FIELDS = [
  "id", "status", "createdAt", "updatedAt", "paidAt", "shipBy", "customerName", "originalFileName", "svgBytes", "widthMm", "heightMm", "pieceWidthMm", "pieceHeightMm",
  "pathCount", "cutLengthMm", "estimatedProcessingMinutes", "material", "thicknessMm", "quantity", "deliveryType", "basePrice", "processingPrice",
  "shippingPrice", "totalPrice", "currency", "shippingTrackingNumber", "shippingCarrier", "notes", "termsAcceptedAt", "personalDataDeletedAt",
];
export const adminListView = (o, items) => ({ ...Object.fromEntries(ADMIN_LIST_FIELDS.map((k) => [k, o[k] ?? null])), items: itemsOr(o, items).map(itemView) });
// Admin detail view: adds Stripe ids and the receipt; shipping details only
// while the order still needs to be produced or shipped (issue #8 §5).
export const adminDetailView = (o, items) => {
  const v = { ...adminListView(o, items), stripeCheckoutSessionId: o.stripeCheckoutSessionId, stripePaymentIntentId: o.stripePaymentIntentId, stripeChargeId: o.stripeChargeId, receiptUrl: o.receiptUrl, shippingVisible: false };
  if (SHIPPING_VISIBLE_STATUSES.includes(o.status) && !o.personalDataDeletedAt) {
    v.shippingVisible = true;
    for (const k of PERSONAL_DATA_FIELDS) v[k] = o[k] ?? null;
  } else v.customerName = null;
  return v;
};

export function createApp(deps) {
  const {
    store,
    bucket,
    config,
    fetch: fetchImpl = globalThis.fetch,
    now = () => new Date(),
    makeOrderId = newOrderId,
    makeToken = newToken,
    log = (msg) => console.error(msg),
    // MAIL_MODE=console (development): where the mails are printed instead of sent.
    mailConsole = (msg) => console.log(msg),
  } = deps;
  // "development" (wrangler dev + .dev.vars) or "production" (issue #11).
  const appEnv = config.appEnv === "development" ? "development" : "production";
  const mailMode = config.mailMode === "console" && appEnv === "development" ? "console" : "resend";
  const catalog = catalogFromConfig(config);
  const trim = (o) => o.replace(/\/$/, "");
  const allowedOrigins = (config.allowedOrigins ?? []).map(trim);
  const adminAllowedOrigins = (config.adminAllowedOrigins ?? []).map(trim);
  const stripeConfigured = Boolean(config.stripeSecretKey && config.stripeWebhookSecret);
  const stripeAuth = { secretKey: config.stripeSecretKey, apiBase: config.stripeApiBase };
  const mailConfigured = mailMode === "console" || Boolean(config.mailApiKey && config.mailFrom);
  const accessConfigured = Boolean(config.accessTeamDomain && config.accessAud);
  // How /api/admin/* authenticates: Access when configured; the ADMIN_TOKEN
  // bearer only in development; nothing (503) in production without Access.
  const adminAuth = accessConfigured ? "access" : appEnv === "development" && config.adminToken ? "token" : "none";
  const verifyAccess = accessConfigured
    ? createAccessVerifier({ teamDomain: config.accessTeamDomain, aud: config.accessAud, fetch: fetchImpl, now: () => now().getTime() })
    : null;
  const siteUrl = (config.siteUrl ?? "").replace(/\/?$/, "/");
  const retentionDays = Number(config.personalDataRetentionDays) > 0 ? Number(config.personalDataRetentionDays) : 90;

  // Public endpoints answer the site origins; admin endpoints answer only
  // the explicitly configured admin origins (none in production, where the
  // admin page is served by this Worker and is same-origin).
  const cors = (request, isAdminPath) => {
    const origin = request.headers.get("Origin");
    const list = isAdminPath ? adminAllowedOrigins : allowedOrigins;
    const headers = { Vary: "Origin" };
    if (origin && list.includes(trim(origin))) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      headers["Access-Control-Allow-Headers"] = isAdminPath ? "Content-Type, Authorization" : "Content-Type";
      headers["Access-Control-Max-Age"] = "600";
      if (isAdminPath) headers["Access-Control-Expose-Headers"] = "Content-Disposition";
    }
    return headers;
  };
  // Admin identity: Cloudflare Access JWT when Access is configured, else
  // the ADMIN_TOKEN bearer (development only). Never both.
  const adminIdentity = async (request) => {
    if (adminAuth === "access") {
      const who = await verifyAccess(request.headers.get("Cf-Access-Jwt-Assertion"));
      return who ? { mode: "access", email: who.email } : null;
    }
    if (adminAuth !== "token") return null;
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    return config.adminToken && token && timingSafeEqual(token, config.adminToken) ? { mode: "token", email: null } : null;
  };
  const readJson = async (request) => {
    const length = Number(request.headers.get("Content-Length") ?? 0);
    if (length > MAX_BODY) throw Object.assign(Error("リクエストが大きすぎます。"), { status: 413 });
    const text = await request.text();
    if (text.length > MAX_BODY) throw Object.assign(Error("リクエストが大きすぎます。"), { status: 413 });
    try {
      return JSON.parse(text);
    } catch {
      throw Object.assign(Error("JSONを読み取れません。"), { status: 400 });
    }
  };
  const orderUrl = (o) => `${siteUrl}order/?order=${o.id}&token=${o.accessToken}`;
  const itemsOf = async (o) => itemsOr(o, (await store.listItems([o.id])).get(o.id));

  // One SVG of an order request: sanitised name, SVG checks (with the width
  // the customer confirmed for px/unitless files) and its analysis.
  const analyze = (text) => analyzeSVG(text, { limits: catalog.limits, sheet: catalog.sheet });
  function readItem(raw, label) {
    let svg = typeof raw?.svg === "string" ? raw.svg : "";
    if (!svg) return { error: `${label}SVGがありません。` };
    if (svg.length > catalog.limits.maxSvgBytes) return { error: `${label}SVGが大きすぎます。`, status: 413 };
    const fileName = clean(raw.fileName, 120).replace(/[\\/:*?"<>|]/g, "_") || "design.svg";
    const confirmedWidth = Number(raw.confirmedWidthMm);
    let analysis = analyze(svg);
    if (!analysis.ok && analysis.size && !analysis.size.known && confirmedWidth > 0) {
      try {
        svg = withPhysicalSize(svg, confirmedWidth);
      } catch (e) {
        return { error: `${label}${e.message}` };
      }
      analysis = analyze(svg);
    }
    if (!analysis.ok) return { error: `${label}SVGに問題があります。`, details: analysis.errors.map((e) => `${label}${e}`), analysis };
    return { svg, fileName, analysis, quantity: raw.quantity };
  }

  async function createOrder(body) {
    // Since 2026-09-30 an order holds `items` (several SVGs, each with its
    // quantity); the single-SVG body of earlier pages is one item.
    const rawItems = Array.isArray(body.items) ? body.items : [{ svg: body.svg, fileName: body.fileName, confirmedWidthMm: body.confirmedWidthMm, quantity: body.quantity }];
    if (!rawItems.length) return error("SVGがありません。");
    if (rawItems.length > catalog.limits.maxItems) return error(`1回の注文に入れられるSVGは${catalog.limits.maxItems}個までです。`);
    if (rawItems.reduce((n, it) => n + (typeof it?.svg === "string" ? it.svg.length : 0), 0) > catalog.limits.maxOrderSvgBytes)
      return error(`SVGの合計が大きすぎます（最大 ${Math.round(catalog.limits.maxOrderSvgBytes / 1024 / 1024)} MB）。`, 413);
    const read = [];
    for (const [i, raw] of rawItems.entries()) {
      const r = readItem(raw, rawItems.length > 1 ? `SVG ${i + 1}: ` : "");
      if (r.error && r.details) return error(rawItems.length > 1 ? r.error : "SVGに問題があります。", 400, { details: r.details, analysis: r.analysis, item: i + 1 });
      if (r.error) return error(r.error, r.status ?? 400, { item: i + 1 });
      read.push(r);
    }
    const q = quoteOrder(
      {
        material: body.material,
        thicknessMm: body.thicknessMm,
        deliveryType: body.deliveryType,
        items: read.map((r) => ({
          label: r.fileName,
          quantity: r.quantity,
          widthMm: r.analysis.size.widthMm,
          heightMm: r.analysis.size.heightMm,
          pieceWidthMm: r.analysis.piece?.widthMm,
          pieceHeightMm: r.analysis.piece?.heightMm,
          cutLengthMm: r.analysis.cutLengthMm,
          pathCount: r.analysis.pathCount,
        })),
      },
      catalog,
    );
    if (!q.ok) return error("注文内容に問題があります。", 400, { details: q.errors });
    if (q.inquiryRequired) return error("この注文は事前のお問い合わせが必要です。", 400, { inquiryRequired: true, details: q.inquiryReasons, contactUrl: config.contactUrl ?? null });
    const customer = body.customer ?? {},
      shipping = body.shipping ?? {};
    const email = clean(customer.email, 254);
    const details = [];
    if (!EMAIL.test(email)) details.push("メールアドレスを確認してください。");
    const postal = clean(shipping.postalCode, 10).replace(/[^0-9]/g, "");
    if (postal.length !== 7) details.push("郵便番号は7桁で入力してください。");
    if (!clean(shipping.prefecture, 20)) details.push("都道府県を入力してください。");
    if (!clean(shipping.address1, 200)) details.push("住所を入力してください。");
    if (!clean(customer.name, 100)) details.push("お名前を入力してください。");
    if (details.length) return error("配送先を確認してください。", 400, { details });
    // Consent to the production and shipping conditions (order page checkboxes).
    const missing = missingTerms(body.agreedTerms, catalog);
    if (missing.length) return error("注意事項への同意が必要です。", 400, { details: ["注文前の注意事項（加工の焦げ・匂い、ネック幅、定形郵便での発送）をすべて確認して同意してください。"], missingTerms: missing });
    if (!stripeConfigured) return error("決済の設定が完了していないため、現在は注文を受け付けられません。", 503);

    const at = now().toISOString();
    const id = makeOrderId(),
      accessToken = makeToken();
    const items = [];
    for (const [i, r] of read.entries()) {
      const hash = await sha256(r.svg);
      const key = `orders/${id}/${i + 1}-${hash.slice(0, 16)}.svg`;
      await bucket.put(key, r.svg, { httpMetadata: { contentType: "image/svg+xml" }, customMetadata: { orderId: id, position: String(i + 1), fileName: r.fileName } });
      const p = q.items[i];
      items.push({
        orderId: id,
        position: i + 1,
        svgObjectKey: key,
        originalFileName: r.fileName,
        svgHash: hash,
        svgBytes: r.analysis.bytes,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        pieceWidthMm: p.pieceWidthMm,
        pieceHeightMm: p.pieceHeightMm,
        pathCount: p.pathCount,
        cutLengthMm: p.cutLengthMm,
        estimatedProcessingMinutes: p.estimatedProcessingMinutes,
        quantity: p.quantity,
        basePrice: p.baseFee,
        materialFee: p.materialFee,
        processingFee: p.processingFee,
        itemPrice: p.price,
      });
    }
    // The orders row keeps the first SVG (columns shared with older orders)
    // and the totals of the whole order.
    const first = items[0];
    const order = {
      id,
      status: "PAYMENT_PENDING",
      createdAt: at,
      updatedAt: at,
      paidAt: null,
      shipBy: null,
      customerName: clean(customer.name, 100),
      customerEmail: email,
      shippingPostalCode: postal,
      shippingPrefecture: clean(shipping.prefecture, 20),
      shippingAddress1: clean(shipping.address1, 200),
      shippingAddress2: clean(shipping.address2, 200),
      shippingPhone: clean(shipping.phone, 30),
      svgObjectKey: first.svgObjectKey,
      originalFileName: first.originalFileName,
      svgHash: first.svgHash,
      svgBytes: items.reduce((n, it) => n + it.svgBytes, 0),
      widthMm: first.widthMm,
      heightMm: first.heightMm,
      pieceWidthMm: first.pieceWidthMm,
      pieceHeightMm: first.pieceHeightMm,
      pathCount: q.pathCount,
      cutLengthMm: q.cutLengthMm,
      estimatedProcessingMinutes: q.estimatedProcessingMinutes,
      material: q.material,
      thicknessMm: q.thicknessMm,
      quantity: q.quantity,
      deliveryType: q.deliveryType,
      basePrice: q.basePrice,
      processingPrice: q.processingPrice,
      shippingPrice: q.shippingPrice,
      totalPrice: q.totalPrice,
      currency: q.currency,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      receiptUrl: null,
      shippingTrackingNumber: null,
      shippingCarrier: null,
      accessToken,
      notes: null,
      termsAcceptedAt: at,
      personalDataDeletedAt: null,
    };
    await store.insertOrder(order);
    try {
      await store.insertItems(items);
    } catch (e) {
      await store.updateOrder(id, { status: "CANCELLED", updatedAt: now().toISOString(), notes: `saving items failed: ${e.message}` });
      throw e;
    }
    await store.addOrderEvent({ orderId: id, fromStatus: null, toStatus: "PAYMENT_PENDING", at, note: items.length > 1 ? `order created (${items.length} SVGs)` : "order created" });
    const url = orderUrl(order);
    let session;
    try {
      session = await createCheckoutSession(
        stripeAuth,
        {
          mode: "payment",
          client_reference_id: id,
          customer_email: email,
          success_url: `${url}&result=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${url}&result=cancel`,
          metadata: { orderId: id },
          // receipt_email makes Stripe send its receipt to the customer when
          // "Successful payments" e-mails are enabled in the dashboard (#10).
          payment_intent_data: { metadata: { orderId: id }, receipt_email: email },
          // One line per SVG plus the shipping; they add up to totalPrice.
          line_items: [
            ...items.map((it) => ({
              quantity: 1,
              price_data: {
                currency: "jpy",
                unit_amount: it.itemPrice,
                product_data: {
                  name: `レーザー加工 ${q.materialName} ${q.thicknessMm} mm × ${it.quantity}（${catalog.delivery[q.deliveryType].label}）`,
                  description: `${it.originalFileName} · ${it.widthMm.toFixed(1)} × ${it.heightMm.toFixed(1)} mm · 注文 ${id}`,
                },
              },
            })),
            { quantity: 1, price_data: { currency: "jpy", unit_amount: q.shippingPrice, product_data: { name: `送料・梱包料（${q.shippingLabel}）` } } },
          ],
        },
        fetchImpl,
      );
    } catch (e) {
      await store.updateOrder(id, { status: "CANCELLED", updatedAt: now().toISOString(), notes: `checkout session failed: ${e.message}` });
      await store.addOrderEvent({ orderId: id, fromStatus: "PAYMENT_PENDING", toStatus: "CANCELLED", at: now().toISOString(), note: "checkout session failed" });
      return error("決済ページ（Checkout Session）の作成に失敗しました。時間をおいて再度お試しください。", 502);
    }
    await store.updateOrder(id, { stripeCheckoutSessionId: session.id, updatedAt: now().toISOString() });
    return json({ orderId: id, accessToken, checkoutUrl: session.url, quote: q, order: customerView(await store.getOrder(id), items) }, 201);
  }

  // Looks the receipt up at Stripe and caches it. Best effort: returns the
  // (possibly unchanged) order and never throws.
  async function cacheReceipt(order) {
    if (!order.stripePaymentIntentId || order.receiptUrl || !stripeConfigured) return order;
    try {
      const r = await fetchReceipt(stripeAuth, order.stripePaymentIntentId, fetchImpl);
      if (r?.receiptUrl) return await store.updateOrder(order.id, { stripeChargeId: r.chargeId, receiptUrl: r.receiptUrl });
    } catch (e) {
      log(`receipt lookup failed for ${order.id}: ${e.message}`);
    }
    return order;
  }

  // Sends the PAID notifications that have not been sent yet. Each type is
  // recorded separately; failures are stored and never thrown (#9 §4, §5).
  // `origin` is this Worker's origin: the admin page is served here, not on
  // SITE_URL (GitHub Pages), so it is the default link in the admin mail.
  async function sendPaidNotifications(order, { retry = false, origin } = {}) {
    const results = {};
    const items = await itemsOf(order);
    const existing = Object.fromEntries((await store.listNotifications(order.id)).map((n) => [n.type, n]));
    for (const type of NOTIFICATION_TYPES) {
      const prev = existing[type];
      if (prev?.sentAt) {
        results[type] = { status: "already-sent", sentAt: prev.sentAt };
        continue;
      }
      if (prev && !retry) {
        results[type] = { status: "failed", error: prev.error };
        continue;
      }
      const at = now().toISOString();
      let to, mail;
      if (type === "customer_paid") {
        to = order.customerEmail;
        mail = customerPaidMail(order, { orderUrl: orderUrl(order), contactUrl: config.contactUrl ?? siteUrl, items });
      } else {
        to = config.adminNotificationEmail;
        mail = adminPaidMail(order, { adminUrl: config.adminUrl ?? (origin ? `${origin}/admin/` : `${siteUrl}admin/`), items });
      }
      if (!mailConfigured || !to) {
        const reason = !mailConfigured ? "mail not configured" : "no recipient configured";
        await store.recordNotification({ orderId: order.id, type, error: reason, at });
        results[type] = { status: "skipped", error: reason };
        continue;
      }
      try {
        let id;
        if (mailMode === "console") {
          // Development: print instead of sending, but record it as sent so
          // the admin page and the idempotency rules behave as in production.
          mailConsole(consoleMailText({ to, from: config.mailFrom ?? "(MAIL_FROM unset)", ...mail, orderId: order.id, type }));
          id = `console:${at}`;
        } else {
          ({ id } = await sendMail({ apiKey: config.mailApiKey, apiBase: config.mailApiBase, from: config.mailFrom, replyTo: config.mailReplyTo }, { to, ...mail }, fetchImpl));
        }
        await store.recordNotification({ orderId: order.id, type, sentAt: at, providerId: id, error: null, at });
        results[type] = { status: "sent", sentAt: at, mode: mailMode };
      } catch (e) {
        const msg = String(e.message).slice(0, 300);
        await store.recordNotification({ orderId: order.id, type, error: msg, at });
        log(`notification ${type} failed for ${order.id}: ${msg}`);
        results[type] = { status: "failed", error: msg };
      }
    }
    return results;
  }

  async function webhook(request) {
    const payload = await request.text();
    const ok = await verifyStripeSignature(payload, request.headers.get("Stripe-Signature"), config.stripeWebhookSecret, {
      now: Math.floor(now().getTime() / 1000),
    });
    if (!ok) return error("署名を検証できません。", 400);
    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      return error("JSONを読み取れません。");
    }
    if (!event?.id || !event?.type) return error("イベント形式が不正です。");
    const at = now().toISOString();
    if (!(await store.recordStripeEvent(event.id, event.type, at))) return json({ received: true, duplicate: true });
    const session = event.data?.object ?? {};
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    const order = orderId ? await store.getOrder(orderId) : null;
    const paidTypes = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
    if (!order) return json({ received: true, ignored: "unknown order" });
    if (paidTypes.includes(event.type) && (session.payment_status === "paid" || event.type === paidTypes[1])) {
      if (["NEW", "PAYMENT_PENDING"].includes(order.status)) {
        const notes = session.amount_total !== undefined && Number(session.amount_total) !== Number(order.totalPrice)
          ? `amount mismatch: stripe ${session.amount_total} / order ${order.totalPrice}`
          : order.notes;
        // 1. Commit PAID. Everything after this is best effort and must not
        //    make Stripe retry the event.
        let paid = await store.updateOrder(order.id, {
          status: "PAID",
          paidAt: at,
          updatedAt: at,
          shipBy: shipByDate(at, order.deliveryType, catalog),
          stripeCheckoutSessionId: session.id ?? order.stripeCheckoutSessionId,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
          notes,
        });
        await store.addOrderEvent({ orderId: order.id, fromStatus: order.status, toStatus: "PAID", at, note: event.type });
        // 2. Receipt (#10) and notifications (#9).
        paid = await cacheReceipt(paid);
        let notifications = null;
        try {
          notifications = await sendPaidNotifications(paid, { origin: new URL(request.url).origin });
        } catch (e) {
          log(`notifications failed for ${order.id}: ${e.message}`);
        }
        return json({ received: true, notifications });
      }
      return json({ received: true });
    }
    if (["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) {
      if (order.status === "PAYMENT_PENDING") {
        await store.updateOrder(order.id, { status: "CANCELLED", updatedAt: at, notes: event.type });
        await store.addOrderEvent({ orderId: order.id, fromStatus: order.status, toStatus: "CANCELLED", at, note: event.type });
      }
      return json({ received: true });
    }
    return json({ received: true, ignored: event.type });
  }

  async function adminStatus(request, order, who) {
    const body = await readJson(request);
    const to = clean(body.status, 20);
    if (!TRANSITIONS[order.status]?.includes(to))
      return error(`${order.status} から ${to || "?"} には変更できません。`, 409, { allowed: TRANSITIONS[order.status] ?? [] });
    const at = now().toISOString();
    const patch = { status: to, updatedAt: at };
    if (body.trackingNumber !== undefined) patch.shippingTrackingNumber = clean(body.trackingNumber, 60) || null;
    if (body.carrier !== undefined) patch.shippingCarrier = clean(body.carrier, 40) || null;
    if (body.note) patch.notes = clean(body.note, 500);
    const updated = await store.updateOrder(order.id, patch);
    const note = [clean(body.note, 200), who?.email ? `by ${who.email}` : ""].filter(Boolean).join(" · ") || null;
    await store.addOrderEvent({ orderId: order.id, fromStatus: order.status, toStatus: to, at, note });
    return json({ order: adminDetailView(updated, await itemsOf(updated)) });
  }

  // Retention purge (#8 §2): closed orders older than the retention period
  // lose their personal data and their SVG. Returns what was purged.
  async function purgeExpiredData({ dryRun = false } = {}) {
    const before = new Date(now().getTime() - retentionDays * 86400000).toISOString();
    const candidates = await store.listPurgeCandidates(before);
    const purged = [];
    for (const o of candidates) {
      if (dryRun) {
        purged.push(o.id);
        continue;
      }
      const at = now().toISOString();
      try {
        const keys = new Set([o.svgObjectKey, ...(await itemsOf(o)).map((it) => it.svgObjectKey)].filter(Boolean));
        for (const key of keys) await bucket.delete(key);
      } catch (e) {
        log(`svg delete failed for ${o.id}: ${e.message}`);
        continue;
      }
      await store.updateOrder(o.id, { ...Object.fromEntries(PERSONAL_DATA_FIELDS.map((k) => [k, null])), personalDataDeletedAt: at });
      await store.addOrderEvent({ orderId: o.id, fromStatus: o.status, toStatus: o.status, at, note: `personal data and SVG deleted after ${retentionDays} days` });
      purged.push(o.id);
    }
    return { before, retentionDays, candidates: candidates.length, purged, dryRun };
  }

  async function handle(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const isAdminPath = path.startsWith("/api/admin");
    const headers = cors(request, isAdminPath);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const respond = async () => {
      if (path === "/api/health") return json({ ok: true, env: appEnv, stripeConfigured, mailConfigured, mailMode, accessConfigured, adminAuth, time: now().toISOString() });
      if (path === "/api/config" && request.method === "GET")
        return json({ catalog: publicCatalog(catalog), stripeConfigured, contactUrl: config.contactUrl ?? null, siteUrl, privacyUrl: `${siteUrl}privacy/`, personalDataRetentionDays: retentionDays });
      if (path === "/api/quote" && request.method === "POST") {
        const body = await readJson(request);
        const q = quote(body, catalog);
        return q.ok ? json({ quote: q }) : error("見積もりできません。", 400, { details: q.errors });
      }
      if (path === "/api/orders" && request.method === "POST") return createOrder(await readJson(request));
      if (path === "/api/stripe/webhook" && request.method === "POST") return webhook(request);
      let m = /^\/api\/orders\/([A-Z0-9-]+)$/.exec(path);
      if (m && request.method === "GET") {
        let order = await store.getOrder(m[1]);
        const token = url.searchParams.get("token") ?? "";
        if (!order || !token || !timingSafeEqual(token, order.accessToken)) return error("注文が見つかりません。", 404);
        if (PAID_STATUSES.includes(order.status)) order = await cacheReceipt(order);
        return json({ order: customerView(order, await itemsOf(order)) });
      }
      if (isAdminPath) {
        if (adminAuth === "none") return error("本番環境（APP_ENV=production）では Cloudflare Access（ACCESS_TEAM_DOMAIN / ACCESS_AUD）の設定が必要です。ADMIN_TOKEN は使えません。", 503, { authMode: "none" });
        const who = await adminIdentity(request);
        if (!who) return error(accessConfigured ? "Cloudflare Access の認証が必要です。" : "管理者トークンが必要です。", 401, { authMode: adminAuth });
        if (path === "/api/admin/session" && request.method === "GET") return json({ mode: who.mode, email: who.email, mailConfigured, retentionDays });
        if (path === "/api/admin/orders" && request.method === "GET") {
          const filter = url.searchParams.get("status");
          const statuses = filter === "open" ? ["PAID", "PROCESSING", "READY"] : filter ? filter.split(",") : null;
          const orders = await store.listOrders({ statuses });
          const items = await store.listItems(orders.map((o) => o.id));
          return json({ orders: orders.map((o) => adminListView(o, items.get(o.id))) });
        }
        if (path === "/api/admin/maintenance/purge" && request.method === "POST") {
          const body = await readJson(request).catch(() => ({}));
          return json(await purgeExpiredData({ dryRun: body?.dryRun === true }));
        }
        m = /^\/api\/admin\/orders\/([A-Z0-9-]+)(\/svg|\/status|\/notify)?$/.exec(path);
        if (!m) return error("Not found", 404);
        const order = await store.getOrder(m[1]);
        if (!order) return error("注文が見つかりません。", 404);
        if (!m[2] && request.method === "GET")
          return json({ order: adminDetailView(order, await itemsOf(order)), events: await store.listOrderEvents(order.id), notifications: await store.listNotifications(order.id) });
        if (m[2] === "/svg" && request.method === "GET") {
          if (order.personalDataDeletedAt) return error("保持期間を過ぎたため、このSVGは削除されています。", 410);
          // ?item=N picks one SVG of the order (1-based); the first by default.
          const items = await itemsOf(order);
          const position = Number(url.searchParams.get("item") ?? 1);
          const item = items.find((it) => it.position === position);
          if (!item) return error("SVGが見つかりません。", 404);
          const obj = await bucket.get(item.svgObjectKey);
          if (!obj) return error("SVGが見つかりません。", 404);
          const name = (item.originalFileName || "design.svg").replace(/"/g, "");
          const prefix = items.length > 1 ? `${order.id}-${item.position}` : order.id;
          return new Response(obj.body, {
            headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="${prefix}-${encodeURIComponent(name)}"`, "Cache-Control": "no-store" },
          });
        }
        if (m[2] === "/status" && request.method === "POST") return adminStatus(request, order, who);
        if (m[2] === "/notify" && request.method === "POST") {
          if (!PAID_STATUSES.includes(order.status)) return error("決済済みの注文にのみ送信できます。", 409);
          if (order.personalDataDeletedAt) return error("保持期間を過ぎたため、送信先がありません。", 410);
          const withReceipt = await cacheReceipt(order);
          const results = await sendPaidNotifications(withReceipt, { retry: true, origin: new URL(request.url).origin });
          return json({ results, notifications: await store.listNotifications(order.id) });
        }
      }
      return error("Not found", 404);
    };
    let res;
    try {
      res = await respond();
    } catch (e) {
      if (!e.status) log(`unhandled error on ${request.method} ${path}: ${e.message}`);
      res = error(e.status ? e.message : "サーバーエラーが発生しました。", e.status ?? 500);
    }
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }
  handle.purgeExpiredData = purgeExpiredData;
  return handle;
}
