-- Migration for databases created from the original schema (issue #1).
-- Apply once:  npx wrangler d1 execute typefab-orders --remote --file=migrations/0002_privacy_mail_receipt.sql
-- New databases only need schema.sql. The orders table is rebuilt because
-- SQLite cannot drop the NOT NULL constraint on customer_email, which the
-- retention purge now clears.
CREATE TABLE orders_new (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  ship_by TEXT,
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
  personal_data_deleted_at TEXT
);
INSERT INTO orders_new (id, status, created_at, updated_at, paid_at, ship_by, customer_name, customer_email, shipping_postal_code, shipping_prefecture, shipping_address1, shipping_address2, shipping_phone, svg_object_key, original_file_name, svg_hash, svg_bytes, width_mm, height_mm, path_count, cut_length_mm, estimated_processing_minutes, material, thickness_mm, quantity, delivery_type, base_price, processing_price, shipping_price, total_price, currency, stripe_checkout_session_id, stripe_payment_intent_id, shipping_tracking_number, shipping_carrier, access_token, notes)
  SELECT id, status, created_at, updated_at, paid_at, ship_by, customer_name, customer_email, shipping_postal_code, shipping_prefecture, shipping_address1, shipping_address2, shipping_phone, svg_object_key, original_file_name, svg_hash, svg_bytes, width_mm, height_mm, path_count, cut_length_mm, estimated_processing_minutes, material, thickness_mm, quantity, delivery_type, base_price, processing_price, shipping_price, total_price, currency, stripe_checkout_session_id, stripe_payment_intent_id, shipping_tracking_number, shipping_carrier, access_token, notes FROM orders;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS orders_session ON orders (stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS orders_retention ON orders (status, personal_data_deleted_at, updated_at);
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
