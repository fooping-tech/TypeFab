import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, CATALOG, shipByDate, shippingRule, publicCatalog, TRANSITIONS, ORDER_STATUSES } from "../src/pricing.js";

const base = { material: "mdf", thicknessMm: 2.5, quantity: 1, deliveryType: "NORMAL", widthMm: 82.3, heightMm: 142, cutLengthMm: 3428, pathCount: 12 };

test("normal order: base + material + processing + quantity, shipping separate", () => {
  const q = quote(base);
  assert.ok(q.ok);
  assert.equal(q.inquiryRequired, false);
  assert.equal(q.materialFee, Math.round((82.3 * 142) / 100 * 1.2));
  assert.equal(q.processingFee, Math.round(3428 * 0.25));
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
  assert.equal(quote({ ...base, thicknessMm: 4 }).ok, false);
  assert.equal(quote({ ...base, deliveryType: "SAME_DAY" }).ok, false);
  assert.equal(quote({ ...base, widthMm: 0 }).ok, false);
  assert.match(quote({ ...base, widthMm: 301, heightMm: 100 }).errors[0], /大きすぎ/);
  assert.ok(quote({ ...base, widthMm: 190, heightMm: 290 }).ok, "rotated fit is allowed");
  assert.match(quote({ ...base, widthMm: 3, heightMm: 3 }).errors[0], /小さすぎ/);
  const other = quote({ ...base, material: "other" });
  assert.ok(other.ok && other.inquiryRequired);
  assert.ok(quote({ ...base, material: "acrylic", thicknessMm: 3 }).ok);
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
  assert.equal(c.estimatedProcessingMinutes, Number((a.estimatedProcessingMinutes * 2).toFixed(1)));
});

test("ship-by date adds the configured lead time", () => {
  assert.equal(shipByDate("2026-09-14T00:00:00.000Z", "NORMAL"), "2026-09-21T00:00:00.000Z");
  assert.equal(shipByDate("2026-09-14T00:00:00.000Z", "EXPRESS"), "2026-09-17T00:00:00.000Z");
});

test("public catalogue is JSON-serialisable and statuses/transitions are consistent", () => {
  const p = JSON.parse(JSON.stringify(publicCatalog()));
  assert.equal(p.materials.length, 3);
  assert.equal(p.bulkThreshold, 10);
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    assert.ok(ORDER_STATUSES.includes(from));
    for (const t of tos) assert.ok(ORDER_STATUSES.includes(t));
  }
  assert.deepEqual(TRANSITIONS.READY, ["SHIPPED", "CANCELLED"]);
});
