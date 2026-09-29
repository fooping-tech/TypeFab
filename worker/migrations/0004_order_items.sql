-- 2026-09-30: several SVGs per order. Idempotent (CREATE TABLE IF NOT EXISTS).
-- Apply once:  npm run db:migrate:remote   (local development: npm run db:migrate:local)
-- One row per SVG of an order (2026-09-30: several SVGs per order). The
-- orders row keeps the totals and the first SVG; orders created before this
-- table have no rows here and are shown as one item from the orders columns.
-- The SVG objects are deleted by the retention purge; the rows (sizes,
-- quantities, prices) are kept for accounting like the rest of the order.
CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  svg_object_key TEXT NOT NULL,
  original_file_name TEXT,
  svg_hash TEXT,
  svg_bytes INTEGER,
  width_mm REAL NOT NULL,
  height_mm REAL NOT NULL,
  piece_width_mm REAL,
  piece_height_mm REAL,
  path_count INTEGER,
  cut_length_mm REAL,
  estimated_processing_minutes REAL,
  quantity INTEGER NOT NULL,
  base_price INTEGER NOT NULL,
  material_fee INTEGER,
  processing_fee INTEGER,
  item_price INTEGER NOT NULL,
  PRIMARY KEY (order_id, position)
);
