-- TypeFab order API (Cloudflare D1). Apply with:
--   npx wrangler d1 execute typefab-orders --file=schema.sql [--local | --remote]
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  ship_by TEXT,
  customer_name TEXT,
  customer_email TEXT NOT NULL,
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
  shipping_tracking_number TEXT,
  shipping_carrier TEXT,
  access_token TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS orders_session ON orders (stripe_checkout_session_id);

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
