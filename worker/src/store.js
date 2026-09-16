// Order storage behind a small interface so the request handlers can be
// tested without a database. d1Store() is used in production, memoryStore()
// in tests. Orders are camelCase objects; D1 columns are snake_case.
export const ORDER_COLUMNS = {
  id: "id",
  status: "status",
  createdAt: "created_at",
  updatedAt: "updated_at",
  paidAt: "paid_at",
  shipBy: "ship_by",
  customerName: "customer_name",
  customerEmail: "customer_email",
  shippingPostalCode: "shipping_postal_code",
  shippingPrefecture: "shipping_prefecture",
  shippingAddress1: "shipping_address1",
  shippingAddress2: "shipping_address2",
  shippingPhone: "shipping_phone",
  svgObjectKey: "svg_object_key",
  originalFileName: "original_file_name",
  svgHash: "svg_hash",
  svgBytes: "svg_bytes",
  widthMm: "width_mm",
  heightMm: "height_mm",
  // Finished piece after cutting (envelope check); the SVG itself is width/height.
  pieceWidthMm: "piece_width_mm",
  pieceHeightMm: "piece_height_mm",
  pathCount: "path_count",
  cutLengthMm: "cut_length_mm",
  estimatedProcessingMinutes: "estimated_processing_minutes",
  material: "material",
  thicknessMm: "thickness_mm",
  quantity: "quantity",
  deliveryType: "delivery_type",
  basePrice: "base_price",
  processingPrice: "processing_price",
  shippingPrice: "shipping_price",
  totalPrice: "total_price",
  currency: "currency",
  stripeCheckoutSessionId: "stripe_checkout_session_id",
  stripePaymentIntentId: "stripe_payment_intent_id",
  stripeChargeId: "stripe_charge_id",
  receiptUrl: "receipt_url",
  shippingTrackingNumber: "shipping_tracking_number",
  shippingCarrier: "shipping_carrier",
  accessToken: "access_token",
  notes: "notes",
  personalDataDeletedAt: "personal_data_deleted_at",
};
// Columns cleared by the retention purge (issue #8). Everything else —
// order id, amounts, dates, Stripe ids, specs, status — is kept for
// accounting.
export const PERSONAL_DATA_FIELDS = [
  "customerName",
  "customerEmail",
  "shippingPostalCode",
  "shippingPrefecture",
  "shippingAddress1",
  "shippingAddress2",
  "shippingPhone",
];
// Orders in these states no longer change; retention counts from their last
// update (the transition into the state).
export const CLOSED_STATUSES = ["COMPLETED", "CANCELLED"];
export const NOTIFICATION_TYPES = ["customer_paid", "admin_paid"];

const toRow = (order) =>
  Object.fromEntries(
    Object.entries(ORDER_COLUMNS)
      .filter(([k]) => order[k] !== undefined)
      .map(([k, col]) => [col, order[k]]),
  );
const fromRow = (row) =>
  row
    ? Object.fromEntries(Object.entries(ORDER_COLUMNS).map(([k, col]) => [k, row[col] ?? null]))
    : null;
const notificationFromRow = (r) => ({ orderId: r.order_id, type: r.type, sentAt: r.sent_at ?? null, providerId: r.provider_id ?? null, error: r.error ?? null, attempts: r.attempts ?? 0, updatedAt: r.updated_at ?? null });

export function d1Store(db) {
  return {
    async insertOrder(order) {
      const row = toRow(order),
        cols = Object.keys(row);
      await db
        .prepare(`INSERT INTO orders (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`)
        .bind(...cols.map((c) => row[c]))
        .run();
      return order;
    },
    async getOrder(id) {
      return fromRow(await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first());
    },
    async updateOrder(id, patch) {
      const row = toRow(patch),
        cols = Object.keys(row);
      if (!cols.length) return this.getOrder(id);
      await db
        .prepare(`UPDATE orders SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
        .bind(...cols.map((c) => row[c]), id)
        .run();
      return this.getOrder(id);
    },
    async listOrders({ statuses = null, limit = 200 } = {}) {
      const where = statuses?.length ? `WHERE status IN (${statuses.map(() => "?").join(",")})` : "";
      const { results } = await db
        .prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ?`)
        .bind(...(statuses ?? []), limit)
        .all();
      return results.map(fromRow);
    },
    // Closed orders whose personal data is still present and older than `before`.
    async listPurgeCandidates(before, limit = 100) {
      const { results } = await db
        .prepare(`SELECT * FROM orders WHERE status IN (${CLOSED_STATUSES.map(() => "?").join(",")}) AND personal_data_deleted_at IS NULL AND updated_at < ? ORDER BY updated_at LIMIT ?`)
        .bind(...CLOSED_STATUSES, before, limit)
        .all();
      return results.map(fromRow);
    },
    // Returns false when the Stripe event was already recorded (idempotency).
    async recordStripeEvent(id, type, receivedAt) {
      try {
        await db
          .prepare("INSERT INTO stripe_events (id, type, received_at) VALUES (?, ?, ?)")
          .bind(id, type, receivedAt)
          .run();
        return true;
      } catch (e) {
        if (/UNIQUE|constraint/i.test(String(e.message))) return false;
        throw e;
      }
    },
    async addOrderEvent({ orderId, fromStatus, toStatus, at, note = null }) {
      await db
        .prepare("INSERT INTO order_events (order_id, from_status, to_status, at, note) VALUES (?, ?, ?, ?, ?)")
        .bind(orderId, fromStatus, toStatus, at, note)
        .run();
    },
    async listOrderEvents(orderId) {
      const { results } = await db
        .prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id")
        .bind(orderId)
        .all();
      return results.map((r) => ({ fromStatus: r.from_status, toStatus: r.to_status, at: r.at, note: r.note }));
    },
    async listNotifications(orderId) {
      const { results } = await db.prepare("SELECT * FROM order_notifications WHERE order_id = ? ORDER BY type").bind(orderId).all();
      return results.map(notificationFromRow);
    },
    // Upserts the delivery record of one notification (sent or failed).
    async recordNotification({ orderId, type, sentAt = null, providerId = null, error = null, at }) {
      await db
        .prepare(
          `INSERT INTO order_notifications (order_id, type, sent_at, provider_id, error, attempts, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)
           ON CONFLICT(order_id, type) DO UPDATE SET sent_at = COALESCE(excluded.sent_at, order_notifications.sent_at), provider_id = COALESCE(excluded.provider_id, order_notifications.provider_id), error = excluded.error, attempts = order_notifications.attempts + 1, updated_at = excluded.updated_at`,
        )
        .bind(orderId, type, sentAt, providerId, error, at)
        .run();
    },
  };
}

export function memoryStore() {
  const orders = new Map(),
    events = new Set(),
    log = [],
    notifications = new Map();
  return {
    orders,
    log,
    notifications,
    async insertOrder(order) {
      if (orders.has(order.id)) throw Error("duplicate order id");
      orders.set(order.id, { ...fromRow(toRow(order)) });
      return orders.get(order.id);
    },
    async getOrder(id) {
      return orders.has(id) ? { ...orders.get(id) } : null;
    },
    async updateOrder(id, patch) {
      const o = orders.get(id);
      if (!o) return null;
      Object.assign(o, Object.fromEntries(Object.entries(patch).filter(([k]) => k in ORDER_COLUMNS)));
      return { ...o };
    },
    async listOrders({ statuses = null, limit = 200 } = {}) {
      return [...orders.values()]
        .filter((o) => !statuses?.length || statuses.includes(o.status))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, limit)
        .map((o) => ({ ...o }));
    },
    async listPurgeCandidates(before, limit = 100) {
      return [...orders.values()]
        .filter((o) => CLOSED_STATUSES.includes(o.status) && !o.personalDataDeletedAt && o.updatedAt < before)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1))
        .slice(0, limit)
        .map((o) => ({ ...o }));
    },
    async recordStripeEvent(id) {
      if (events.has(id)) return false;
      events.add(id);
      return true;
    },
    async addOrderEvent(e) {
      log.push({ ...e });
    },
    async listOrderEvents(orderId) {
      return log.filter((e) => e.orderId === orderId);
    },
    async listNotifications(orderId) {
      return [...notifications.values()].filter((n) => n.orderId === orderId).map((n) => ({ ...n }));
    },
    async recordNotification({ orderId, type, sentAt = null, providerId = null, error = null, at }) {
      const key = `${orderId}/${type}`;
      const prev = notifications.get(key);
      notifications.set(key, {
        orderId,
        type,
        sentAt: sentAt ?? prev?.sentAt ?? null,
        providerId: providerId ?? prev?.providerId ?? null,
        error,
        attempts: (prev?.attempts ?? 0) + 1,
        updatedAt: at,
      });
    },
  };
}
// In-memory stand-in for the R2 bucket binding (tests, local checks).
export function memoryBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, body, opts = {}) {
      objects.set(key, { body: typeof body === "string" ? body : new TextDecoder().decode(body), opts });
    },
    async get(key) {
      const o = objects.get(key);
      return o
        ? { key, body: o.body, httpMetadata: o.opts.httpMetadata, text: async () => o.body, arrayBuffer: async () => new TextEncoder().encode(o.body).buffer }
        : null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
