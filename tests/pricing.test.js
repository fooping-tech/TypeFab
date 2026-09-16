import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, CATALOG, shipByDate, shippingRule, publicCatalog, TRANSITIONS, ORDER_STATUSES } from "../src/pricing.js";

const base = { material: "kraft-black", thicknessMm: 0.3, quantity: 1, deliveryType: "NORMAL", widthMm: 82.3, heightMm: 142, cutLengthMm: 3428, pathCount: 12 };

test("normal order: base + material + processing + quantity, shipping separate", () => {
  const q = quote(base);
  assert.ok(q.ok);
  assert.equal(q.inquiryRequired, false);
  assert.equal(q.materialFee, Math.max(100, Math.round((82.3 * 142) / 100 * 0.3)), "material fee has a ¥100 floor");
  assert.equal(quote({ ...base, widthMm: 277, heightMm: 190 }).materialFee, Math.round((277 * 190) / 100 * 0.3), "a full sheet is above the floor");
  assert.equal(q.processingFee, Math.round(3428 * 0.1));
  assert.equal(q.quantityFee, 0);
  assert.equal(q.fabricationPrice, 500 + q.materialFee + q.processingFee);
  assert.equal(q.processingPrice, q.fabricationPrice);
  assert.equal(q.shippingPrice, 750);
  assert.equal(q.totalPrice, q.processingPrice + 750);
  assert.equal(q.leadTimeDays, 7);
  assert.ok(Number.isInteger(q.totalPrice));
});

test("express doubles the fabrication price but not the shipping", () => {
  const n = quote(base), e = quote({ ...base, deliveryType: "EXPRESS" });
  assert.equal(e.processingPrice, n.processingPrice * 2);
  assert.equal(e.shippingPrice, n.shippingPrice);
  assert.equal(e.totalPrice, n.processingPrice * 2 + n.shippingPrice);
  assert.equal(e.leadTimeDays, 3);
});

test("quantity 1 and 9 price normally; 10 requires an inquiry; 0 and fractions are rejected", () => {
  const q1 = quote(base), q9 = quote({ ...base, quantity: 9 });
  assert.equal(q9.quantityFee, (q1.materialFee + q1.processingFee) * 8);
  assert.equal(q9.inquiryRequired, false);
  assert.equal(q9.shippingPrice, 1100, "more than 3 pieces ship as a parcel");
  const q10 = quote({ ...base, quantity: 10 });
  assert.ok(q10.ok && q10.inquiryRequired);
  assert.equal(q10.totalPrice, null);
  assert.match(q10.inquiryReasons[0], /10個以上/);
  assert.equal(quote({ ...base, quantity: 0 }).ok, false);
  assert.equal(quote({ ...base, quantity: 1.5 }).ok, false);
  assert.equal(quote({ ...base, quantity: 1000 }).ok, false);
});

test("bulk threshold is a catalogue setting", () => {
  const c = { ...CATALOG, bulkThreshold: 3 };
  assert.equal(quote({ ...base, quantity: 3 }, c).inquiryRequired, true);
  assert.equal(quote({ ...base, quantity: 2 }, c).inquiryRequired, false);
});

test("materials, thicknesses, size limits and delivery types are validated", () => {
  assert.equal(quote({ ...base, material: "wood" }).ok, false);
  assert.equal(quote({ ...base, material: "mdf", thicknessMm: 2.5 }).ok, false, "former materials are gone");
  assert.equal(quote({ ...base, material: "acrylic", thicknessMm: 3 }).ok, false);
  assert.equal(quote({ ...base, material: "other" }).ok, false);
  assert.equal(quote({ ...base, thicknessMm: 4 }).ok, false);
  assert.equal(quote({ ...base, deliveryType: "SAME_DAY" }).ok, false);
  assert.equal(quote({ ...base, widthMm: 0 }).ok, false);
  assert.match(quote({ ...base, widthMm: 3, heightMm: 3 }).errors[0], /小さすぎ/);
  // Only one material and one thickness are offered.
  assert.deepEqual(CATALOG.materials.map((m) => [m.id, m.name, m.thicknesses.map((t) => t.mm)]), [["kraft-black", "黒クラフトペーパー", [0.3]]]);
  const q = quote(base);
  assert.equal(q.materialName, "黒クラフトペーパー");
  assert.equal(q.thicknessMm, 0.3);
});

test("size limit: A4 minus a 10 mm margin (277 × 190 mm) in either orientation", () => {
  assert.deepEqual(CATALOG.sheet, { name: "A4", widthMm: 210, heightMm: 297, marginMm: 10 });
  assert.equal(CATALOG.limits.maxWidthMm, CATALOG.sheet.heightMm - 2 * CATALOG.sheet.marginMm);
  assert.equal(CATALOG.limits.maxHeightMm, CATALOG.sheet.widthMm - 2 * CATALOG.sheet.marginMm);
  assert.ok(quote({ ...base, widthMm: 277, heightMm: 190 }).ok, "exactly the limit fits");
  assert.ok(quote({ ...base, widthMm: 190, heightMm: 277 }).ok, "portrait fits");
  assert.ok(quote({ ...base, widthMm: 82.3, heightMm: 142 }).ok, "a bookmark fits");
  const wide = quote({ ...base, widthMm: 277.1, heightMm: 100 });
  assert.equal(wide.ok, false);
  assert.match(wide.errors[0], /最大 277 × 190 mm、A4 用紙（210 × 297 mm）から周囲 10 mm のマージン/);
  assert.equal(quote({ ...base, widthMm: 200, heightMm: 200 }).ok, false, "200 × 200 does not fit in either orientation");
  assert.equal(quote({ ...base, widthMm: 210, heightMm: 297 }).ok, false, "a full A4 sheet is too big");
  assert.equal(quote({ ...base, widthMm: 300, heightMm: 100 }).ok, false, "the old 300 mm limit no longer applies");
});

test("shipping rule: compact for small boards and up to 3 pieces, parcel otherwise", () => {
  assert.equal(shippingRule(CATALOG, { widthMm: 200, heightMm: 150, quantity: 3 }).id, "compact");
  assert.equal(shippingRule(CATALOG, { widthMm: 150, heightMm: 200, quantity: 1 }).id, "compact");
  assert.equal(shippingRule(CATALOG, { widthMm: 201, heightMm: 100, quantity: 1 }).id, "parcel");
  assert.equal(shippingRule(CATALOG, { widthMm: 100, heightMm: 100, quantity: 4 }).id, "parcel");
});

test("processing time estimate grows with cut length, path count and quantity", () => {
  const a = quote(base), b = quote({ ...base, cutLengthMm: 6856 }), c = quote({ ...base, quantity: 2 });
  assert.ok(a.estimatedProcessingMinutes > 0);
  assert.ok(b.estimatedProcessingMinutes > a.estimatedProcessingMinutes);
  assert.ok(Math.abs(c.estimatedProcessingMinutes - a.estimatedProcessingMinutes * 2) < 0.15, "quantity 2 takes twice as long (within rounding)");
});

test("ship-by date adds the configured lead time", () => {
  assert.equal(shipByDate("2026-09-14T00:00:00.000Z", "NORMAL"), "2026-09-21T00:00:00.000Z");
  assert.equal(shipByDate("2026-09-14T00:00:00.000Z", "EXPRESS"), "2026-09-17T00:00:00.000Z");
});

test("public catalogue is JSON-serialisable and statuses/transitions are consistent", () => {
  const p = JSON.parse(JSON.stringify(publicCatalog()));
  assert.equal(p.materials.length, 1);
  assert.equal(p.limits.maxWidthMm, 277);
  assert.equal(p.sheet.name, "A4");
  assert.equal(p.bulkThreshold, 10);
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    assert.ok(ORDER_STATUSES.includes(from));
    for (const t of tos) assert.ok(ORDER_STATUSES.includes(t));
  }
  assert.deepEqual(TRANSITIONS.READY, ["SHIPPED", "CANCELLED"]);
});
