-- Adds the finished-piece size (2026-09-17): the SVG is laid out on an A4
-- landscape sheet and the piece after cutting must fit the envelope.
-- Apply once:  npx wrangler d1 execute typefab-orders --remote --file=migrations/0003_piece_size.sql
-- (local development: npm run db:migrate:local). Old orders keep NULL here.
ALTER TABLE orders ADD COLUMN piece_width_mm REAL;
ALTER TABLE orders ADD COLUMN piece_height_mm REAL;
