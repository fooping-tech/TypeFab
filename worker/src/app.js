// Request handlers for the TypeFab order API. Everything that touches the
// outside world (D1, R2, Stripe, time, randomness) comes in through `deps`
// so the flow can be tested end to end without Cloudflare.
import { quote, publicCatalog, shipByDate, TRANSITIONS, CATALOG } from "../../src/pricing.js";
import { analyzeSVG, withPhysicalSize } from "../../src/svganalyze.js";
import { createCheckoutSession, verifyStripeSignature, timingSafeEqual } from "./stripe.js";

const MAX_BODY = 3 * 1024 * 1024;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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
  if (config.expressLeadTimeDays > 0) c.delivery.EXPRESS.leadTimeDays = Number(config.expressLeadTimeDays);
  return c;
}
// Customer-facing view of an order (no address, no tokens).
export const customerView = (o) => ({
  id: o.id,
  status: o.status,
  createdAt: o.createdAt,
  paidAt: o.paidAt,
  shipBy: o.shipBy,
  fileName: o.originalFileName,
  widthMm: o.widthMm,
  heightMm: o.heightMm,
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
});
const adminView = (o) => {
  const { accessToken, ...rest } = o;
  return rest;
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
  } = deps;
  const catalog = catalogFromConfig(config);
  const allowedOrigins = (config.allowedOrigins ?? []).map((o) => o.replace(/\/$/, ""));
  const stripeConfigured = Boolean(config.stripeSecretKey && config.stripeWebhookSecret);
  const siteUrl = (config.siteUrl ?? "").replace(/\/?$/, "/");

  const cors = (request) => {
    const origin = request.headers.get("Origin");
    const headers = {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Expose-Headers": "Content-Disposition",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    };
    if (origin && allowedOrigins.includes(origin.replace(/\/$/, ""))) headers["Access-Control-Allow-Origin"] = origin;
    return headers;
  };
  const isAdmin = (request) => {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    return Boolean(config.adminToken && token && timingSafeEqual(token, config.adminToken));
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

  async function createOrder(body) {
    let svg = typeof body.svg === "string" ? body.svg : "";
    if (!svg) return error("SVGがありません。");
    if (svg.length > catalog.limits.maxSvgBytes) return error("SVGが大きすぎます。", 413);
    const fileName = clean(body.fileName, 120).replace(/[\\/:*?"<>|]/g, "_") || "design.svg";
    const confirmedWidth = Number(body.confirmedWidthMm);
    let analysis = analyzeSVG(svg, { limits: catalog.limits });
    if (!analysis.ok && analysis.size && !analysis.size.known && confirmedWidth > 0) {
      try {
        svg = withPhysicalSize(svg, confirmedWidth);
      } catch (e) {
        return error(e.message);
      }
      analysis = analyzeSVG(svg, { limits: catalog.limits });
    }
    if (!analysis.ok) return error("SVGに問題があります。", 400, { details: analysis.errors, analysis });
    const q = quote(
      {
        material: body.material,
        thicknessMm: body.thicknessMm,
        quantity: body.quantity,
        deliveryType: body.deliveryType,
        widthMm: analysis.size.widthMm,
        heightMm: analysis.size.heightMm,
        cutLengthMm: analysis.cutLengthMm,
        pathCount: analysis.pathCount,
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
    if (!stripeConfigured) return error("決済の設定が完了していないため、現在は注文を受け付けられません。", 503);

    const at = now().toISOString();
    const id = makeOrderId(),
      accessToken = makeToken(),
      hash = await sha256(svg);
    const key = `orders/${id}/${hash.slice(0, 16)}.svg`;
    await bucket.put(key, svg, { httpMetadata: { contentType: "image/svg+xml" }, customMetadata: { orderId: id, fileName } });
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
      svgObjectKey: key,
      originalFileName: fileName,
      svgHash: hash,
      svgBytes: analysis.bytes,
      widthMm: analysis.size.widthMm,
      heightMm: analysis.size.heightMm,
      pathCount: analysis.pathCount,
      cutLengthMm: analysis.cutLengthMm,
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
      shippingTrackingNumber: null,
      shippingCarrier: null,
      accessToken,
      notes: null,
    };
    await store.insertOrder(order);
    await store.addOrderEvent({ orderId: id, fromStatus: null, toStatus: "PAYMENT_PENDING", at, note: "order created" });
    const orderUrl = `${siteUrl}order/?order=${id}&token=${accessToken}`;
    let session;
    try {
      session = await createCheckoutSession(
        { secretKey: config.stripeSecretKey, apiBase: config.stripeApiBase },
        {
          mode: "payment",
          client_reference_id: id,
          customer_email: email,
          success_url: `${orderUrl}&result=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${orderUrl}&result=cancel`,
          metadata: { orderId: id },
          payment_intent_data: { metadata: { orderId: id } },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "jpy",
                unit_amount: q.totalPrice,
                product_data: {
                  name: `レーザー加工 ${q.materialName} ${q.thicknessMm} mm × ${q.quantity}（${catalog.delivery[q.deliveryType].label}）`,
                  description: `${fileName} · ${analysis.size.widthMm.toFixed(1)} × ${analysis.size.heightMm.toFixed(1)} mm · 注文 ${id}`,
                },
              },
            },
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
    return json({ orderId: id, accessToken, checkoutUrl: session.url, quote: q, order: customerView(await store.getOrder(id)) }, 201);
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
        await store.updateOrder(order.id, {
          status: "PAID",
          paidAt: at,
          updatedAt: at,
          shipBy: shipByDate(at, order.deliveryType, catalog),
          stripeCheckoutSessionId: session.id ?? order.stripeCheckoutSessionId,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
          notes,
        });
        await store.addOrderEvent({ orderId: order.id, fromStatus: order.status, toStatus: "PAID", at, note: event.type });
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

  async function adminStatus(request, order) {
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
    await store.addOrderEvent({ orderId: order.id, fromStatus: order.status, toStatus: to, at, note: clean(body.note, 200) || null });
    return json({ order: adminView(updated) });
  }

  return async function handle(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const headers = cors(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const respond = async () => {
      if (path === "/api/health") return json({ ok: true, stripeConfigured, time: now().toISOString() });
      if (path === "/api/config" && request.method === "GET")
        return json({ catalog: publicCatalog(catalog), stripeConfigured, contactUrl: config.contactUrl ?? null, siteUrl });
      if (path === "/api/quote" && request.method === "POST") {
        const body = await readJson(request);
        const q = quote(body, catalog);
        return q.ok ? json({ quote: q }) : error("見積もりできません。", 400, { details: q.errors });
      }
      if (path === "/api/orders" && request.method === "POST") return createOrder(await readJson(request));
      if (path === "/api/stripe/webhook" && request.method === "POST") return webhook(request);
      let m = /^\/api\/orders\/([A-Z0-9-]+)$/.exec(path);
      if (m && request.method === "GET") {
        const order = await store.getOrder(m[1]);
        const token = url.searchParams.get("token") ?? "";
        if (!order || !token || !timingSafeEqual(token, order.accessToken)) return error("注文が見つかりません。", 404);
        return json({ order: customerView(order) });
      }
      if (path.startsWith("/api/admin/")) {
        if (!isAdmin(request)) return error("管理者トークンが必要です。", 401);
        if (path === "/api/admin/orders" && request.method === "GET") {
          const filter = url.searchParams.get("status");
          const statuses = filter === "open" ? ["PAID", "PROCESSING", "READY"] : filter ? filter.split(",") : null;
          const orders = await store.listOrders({ statuses });
          return json({ orders: orders.map(adminView) });
        }
        m = /^\/api\/admin\/orders\/([A-Z0-9-]+)(\/svg|\/status)?$/.exec(path);
        if (!m) return error("Not found", 404);
        const order = await store.getOrder(m[1]);
        if (!order) return error("注文が見つかりません。", 404);
        if (!m[2] && request.method === "GET") return json({ order: adminView(order), events: await store.listOrderEvents(order.id) });
        if (m[2] === "/svg" && request.method === "GET") {
          const obj = await bucket.get(order.svgObjectKey);
          if (!obj) return error("SVGが見つかりません。", 404);
          const name = (order.originalFileName || "design.svg").replace(/"/g, "");
          return new Response(obj.body, {
            headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="${order.id}-${encodeURIComponent(name)}"`, "Cache-Control": "no-store" },
          });
        }
        if (m[2] === "/status" && request.method === "POST") return adminStatus(request, order);
      }
      return error("Not found", 404);
    };
    let res;
    try {
      res = await respond();
    } catch (e) {
      res = error(e.status ? e.message : "サーバーエラーが発生しました。", e.status ?? 500);
    }
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  };
}
