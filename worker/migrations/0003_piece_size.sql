-- 2026-09-17: the finished-piece size (the SVG is laid out on an A4
-- landscape sheet and the piece after cutting must fit the envelope) and the
-- time the customer accepted the order terms before checkout.
-- Apply once:  npx wrangler d1 execute typefab-orders --remote --file=migrations/0003_piece_size.sql
-- (local development: npm run db:migrate:local). Old orders keep NULL here.
ALTER TABLE orders ADD COLUMN piece_width_mm REAL;
ALTER TABLE orders ADD COLUMN piece_height_mm REAL;
ALTER TABLE orders ADD COLUMN terms_accepted_at TEXT;
