-- TypeFab order API (Cloudflare D1). Apply with:
--   npx wrangler d1 execute typefab-orders --file=schema.sql [--local | --remote]
-- Existing databases: apply the migrations in order instead of this file.
--   before 2026-09-16: migrations/0002_privacy_mail_receipt.sql (issues #8/#9/#10)
--   before 2026-09-17: migrations/0003_piece_size.sql (piece_width_mm / piece_height_mm / terms_accepted_at)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  ship_by TEXT,
  -- Personal data: cleared by the retention purge once the order is closed.
  customer_name TEXT,
  customer_email TEXT,
  shipping_postal_code TEXT,
  shipping_prefecture TEXT,
  shipping_address1 TEXT,
  shipping_address2 TEXT,
  shipping_phone TEXT,
  svg_object_key TEXT NOT NULL,
  original_file_name TEXT,
  svg_hash TEXT,
  svg_bytes INTEGER,
  width_mm REAL NOT NULL,
  height_mm REAL NOT NULL,
  -- Finished piece after cutting (must fit the envelope); NULL for old orders.
  piece_width_mm REAL,
  piece_height_mm REAL,
  path_count INTEGER,
  cut_length_mm REAL,
  estimated_processing_minutes REAL,
  material TEXT NOT NULL,
  thickness_mm REAL NOT NULL,
  quantity INTEGER NOT NULL,
  delivery_type TEXT NOT NULL,
  base_price INTEGER NOT NULL,
  processing_price INTEGER NOT NULL,
  shipping_price INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'JPY',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  receipt_url TEXT,
  shipping_tracking_number TEXT,
  shipping_carrier TEXT,
  access_token TEXT NOT NULL,
  notes TEXT,
  -- When the customer accepted the order terms (laser marks, neck width, letter mail).
  terms_accepted_at TEXT,
  -- Set when the personal data columns were cleared and the SVG deleted.
  personal_data_deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS orders_session ON orders (stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS orders_retention ON orders (status, personal_data_deleted_at, updated_at);

-- Processed Stripe webhook events; the primary key makes handling idempotent.
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  at TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS order_events_order ON order_events (order_id, id);

-- One row per order and notification type (customer_paid / admin_paid):
-- sent_at is set once the provider accepted the message; error keeps the
-- last failure so the admin page can resend. No message bodies are stored.
CREATE TABLE IF NOT EXISTS order_notifications (
  order_id TEXT NOT NULL,
  type TEXT NOT NULL,
  sent_at TEXT,
  provider_id TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (order_id, type)
);
