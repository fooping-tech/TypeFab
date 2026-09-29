import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, quoteOrder, CATALOG, shipByDate, shippingRule, publicCatalog, TRANSITIONS, ORDER_STATUSES, fitsWithin, missingTerms } from "../src/pricing.js";

const base = { material: "kraft-black", thicknessMm: 0.3, quantity: 1, deliveryType: "NORMAL", widthMm: 82.3, heightMm: 142, cutLengthMm: 3428, pathCount: 12 };

test("normal order: base + material + processing + quantity, shipping separate", () => {
  const q = quote(base);
  assert.ok(q.ok);
  assert.equal(q.inquiryRequired, false);
  assert.equal(q.materialFee, Math.max(100, Math.round((82.3 * 142) / 100 * 0.3)), "material fee has a ¥100 floor");
  assert.equal(quote({ ...base, widthMm: 215, heightMm: 100 }).materialFee, 100, "even a full-size piece (215 cm² × ¥0.3 = ¥65) is charged the ¥100 floor");
  assert.equal(q.processingFee, Math.round(3428 * 0.1));
  assert.equal(q.quantityFee, 0);
  assert.equal(q.fabricationPrice, 500 + q.materialFee + q.processingFee);
  assert.equal(q.processingPrice, q.fabricationPrice);
  assert.equal(q.shippingPrice, 300, "flat letter-mail shipping and packaging");
  assert.equal(q.shippingLabel, "日本郵便 定形郵便");
  assert.equal(q.totalPrice, q.processingPrice + 300);
  assert.equal(q.leadTimeDays, 7);
  assert.ok(Number.isInteger(q.totalPrice));
});

test("express was withdrawn: only the normal lead time is offered and EXPRESS quotes are refused", () => {
  assert.deepEqual(Object.keys(CATALOG.delivery), ["NORMAL"]);
  const n = quote(base);
  assert.equal(n.deliveryMultiplier, 1);
  assert.equal(n.totalPrice, n.processingPrice + n.shippingPrice);
  const e = quote({ ...base, deliveryType: "EXPRESS" });
  assert.equal(e.ok, false);
  assert.ok(e.errors.includes("納期の種類が不正です。"));
});

test("quantity 1 and 9 price normally; 10 requires an inquiry; 0 and fractions are rejected", () => {
  const q1 = quote(base), q9 = quote({ ...base, quantity: 9 });
  assert.equal(q9.quantityFee, (q1.materialFee + q1.processingFee) * 8);
  assert.equal(q9.inquiryRequired, false);
  assert.equal(q9.shippingPrice, 300, "shipping stays flat for several pieces");
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

test("size rules: the SVG must fit the A4 landscape sheet, the finished piece the 長形3号 envelope (10 mm margins, either orientation)", () => {
  assert.deepEqual(CATALOG.sheet, { name: "A4 横", widthMm: 297, heightMm: 210, marginMm: 10 });
  assert.deepEqual(CATALOG.envelope, { name: "長形3号封筒", widthMm: 120, heightMm: 235, marginMm: 10 });
  assert.equal(CATALOG.limits.sheet.maxWidthMm, CATALOG.sheet.widthMm - 2 * CATALOG.sheet.marginMm);
  assert.equal(CATALOG.limits.sheet.maxHeightMm, CATALOG.sheet.heightMm - 2 * CATALOG.sheet.marginMm);
  assert.equal(CATALOG.limits.piece.maxWidthMm, CATALOG.envelope.heightMm - 2 * CATALOG.envelope.marginMm);
  assert.equal(CATALOG.limits.piece.maxHeightMm, CATALOG.envelope.widthMm - 2 * CATALOG.envelope.marginMm);
  assert.ok(fitsWithin(100, 215, CATALOG.limits.piece) && !fitsWithin(101, 101, CATALOG.limits.piece));
  // A TypeFab export: the whole work area is the SVG, the bookmark outline is the piece.
  const typical = quote({ ...base, widthMm: 240, heightMm: 160, pieceWidthMm: 50, pieceHeightMm: 140 });
  assert.ok(typical.ok, typical.errors.join());
  assert.deepEqual([typical.pieceWidthMm, typical.pieceHeightMm], [50, 140]);
  assert.equal(typical.shippingPrice, 300);
  assert.equal(typical.materialFee, Math.round((240 * 160) / 100 * 0.3), "material is the sheet area consumed");
  // Without a cut analysis the piece defaults to the document.
  assert.ok(quote({ ...base, widthMm: 215, heightMm: 100 }).ok, "exactly the envelope limit fits");
  assert.ok(quote({ ...base, widthMm: 100, heightMm: 215 }).ok, "portrait fits");
  assert.ok(quote({ ...base, widthMm: 82.3, heightMm: 142 }).ok, "a bookmark fits");
  const wide = quote({ ...base, widthMm: 215.1, heightMm: 100 });
  assert.equal(wide.ok, false);
  assert.match(wide.errors[0], /切り抜き後のサイズが封筒に収まりません（215\.1 × 100\.0 mm。最大 215 × 100 mm、長形3号封筒（120 × 235 mm）から周囲 10 mm のマージン/);
  assert.equal(quote({ ...base, widthMm: 101, heightMm: 101 }).ok, false, "101 × 101 does not fit the envelope in either orientation");
  // The sheet rule is about the SVG itself.
  const big = quote({ ...base, widthMm: 277, heightMm: 190, pieceWidthMm: 50, pieceHeightMm: 140 });
  assert.ok(big.ok, "a full A4-minus-margin SVG with a small piece is fine");
  const sheet = quote({ ...base, widthMm: 278, heightMm: 100, pieceWidthMm: 50, pieceHeightMm: 140 });
  assert.equal(sheet.ok, false);
  assert.match(sheet.errors[0], /SVGが用紙に収まりません（278\.0 × 100\.0 mm。最大 277 × 190 mm、A4 横（297 × 210 mm）から周囲 10 mm のマージン/);
  assert.ok(quote({ ...base, widthMm: 190, heightMm: 277, pieceWidthMm: 50, pieceHeightMm: 140 }).ok, "a portrait SVG is laid out rotated");
  assert.equal(quote({ ...base, widthMm: 297, heightMm: 210, pieceWidthMm: 50, pieceHeightMm: 140 }).ok, false, "a full A4 SVG leaves no margin");
  // Both rules fail together.
  const both = quote({ ...base, widthMm: 300, heightMm: 200, pieceWidthMm: 300, pieceHeightMm: 200 });
  assert.equal(both.errors.length, 2);
  assert.match(both.errors[1], /封筒に収まりません/);
  assert.equal(quote({ ...base, widthMm: 100, heightMm: 100, pieceWidthMm: 0, pieceHeightMm: 10 }).ok, false, "a degenerate piece is rejected");
  assert.match(quote({ ...base, widthMm: 100, heightMm: 100, pieceWidthMm: 3, pieceHeightMm: 3 }).errors[0], /切り抜き後のサイズが小さすぎます/);
});

test("shipping: one flat letter-mail rule; size-based rules can still be put in front", () => {
  assert.deepEqual(CATALOG.shipping, [{ id: "letter", label: "日本郵便 定形郵便", price: 300 }]);
  for (const size of [{ widthMm: 215, heightMm: 100, quantity: 9 }, { widthMm: 10, heightMm: 10, quantity: 1 }]) assert.equal(shippingRule(CATALOG, size).id, "letter");
  const c = { ...CATALOG, shipping: [{ id: "tiny", maxWidthMm: 50, maxHeightMm: 50, maxQuantity: 1, price: 100 }, ...CATALOG.shipping] };
  assert.equal(shippingRule(c, { widthMm: 40, heightMm: 40, quantity: 1 }).id, "tiny");
  assert.equal(shippingRule(c, { widthMm: 60, heightMm: 40, quantity: 1 }).id, "letter");
  assert.match(CATALOG.shippingNote, /定形郵便/);
  assert.match(CATALOG.shippingNote, /追跡番号・配達状況の確認・補償はなく/);
  assert.match(CATALOG.shippingNote, /全国一律 300 円/);
});

test("order terms: laser marks, neck width, letter mail and no cancellation must all be accepted", () => {
  assert.deepEqual(CATALOG.terms.map((t) => t.id), ["laser-marks", "neck-width", "letter-mail", "no-cancel"]);
  assert.match(CATALOG.terms[0].text, /焦げ粉や匂い/);
  assert.match(CATALOG.terms[1].text, /4 mm 以上のネック幅/);
  assert.match(CATALOG.terms[2].text, /追跡番号・配達状況の確認・補償はありません/);
  assert.match(CATALOG.terms[3].text, /決済後のお客様のご都合によるキャンセル・返品・交換はお受けできません/);
  assert.deepEqual(missingTerms(["laser-marks", "neck-width", "letter-mail", "no-cancel"]), []);
  assert.deepEqual(missingTerms(["laser-marks"]), ["neck-width", "letter-mail", "no-cancel"]);
  assert.deepEqual(missingTerms(undefined), ["laser-marks", "neck-width", "letter-mail", "no-cancel"]);
  assert.deepEqual(missingTerms("laser-marks"), ["laser-marks", "neck-width", "letter-mail", "no-cancel"], "a string is not a list");
  const p = JSON.parse(JSON.stringify(publicCatalog()));
  assert.equal(p.terms.length, 4);
  assert.equal(p.shippingNote, CATALOG.shippingNote);
});

test("processing time estimate grows with cut length, path count and quantity", () => {
  const a = quote(base), b = quote({ ...base, cutLengthMm: 6856 }), c = quote({ ...base, quantity: 2 });
  assert.ok(a.estimatedProcessingMinutes > 0);
  assert.ok(b.estimatedProcessingMinutes > a.estimatedProcessingMinutes);
  assert.ok(Math.abs(c.estimatedProcessingMinutes - a.estimatedProcessingMinutes * 2) < 0.15, "quantity 2 takes twice as long (within rounding)");
});

test("ship-by date adds the configured lead time", () => {
  assert.equal(shipByDate("2026-09-14T00:00:00.000Z", "NORMAL"), "2026-09-21T00:00:00.000Z");
  // A stored order with the withdrawn type still gets a date (the normal lead time).
  assert.equal(shipByDate("2026-09-14T00:00:00.000Z", "EXPRESS"), "2026-09-21T00:00:00.000Z");
});

test("public catalogue is JSON-serialisable and statuses/transitions are consistent", () => {
  const p = JSON.parse(JSON.stringify(publicCatalog()));
  assert.equal(p.materials.length, 1);
  assert.deepEqual([p.limits.sheet.maxWidthMm, p.limits.sheet.maxHeightMm, p.limits.piece.maxWidthMm, p.limits.piece.maxHeightMm], [277, 190, 215, 100]);
  assert.equal(p.sheet.name, "A4 横");
  assert.equal(p.envelope.name, "長形3号封筒");
  assert.equal(p.bulkThreshold, 10);
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    assert.ok(ORDER_STATUSES.includes(from));
    for (const t of tos) assert.ok(ORDER_STATUSES.includes(t));
  }
  assert.deepEqual(TRANSITIONS.READY, ["SHIPPED", "CANCELLED"]);
});

test("quoteOrder (2026-09-30): base fee per SVG, one shipping per order, bulk decided by the total quantity", () => {
  const a = { label: "a.svg", widthMm: 50, heightMm: 120, cutLengthMm: 400, pathCount: 3, quantity: 2 };
  const b = { label: "b.svg", widthMm: 60, heightMm: 30, cutLengthMm: 180, pathCount: 1, quantity: 1 };
  const opts = { material: "kraft-black", thicknessMm: 0.3, deliveryType: "NORMAL" };
  const q = quoteOrder({ ...opts, items: [a, b] });
  const qa = quote({ ...opts, ...a }), qb = quote({ ...opts, ...b });
  assert.equal(q.ok, true);
  assert.equal(q.items.length, 2);
  assert.equal(q.basePrice, CATALOG.baseFee * 2);
  assert.equal(q.processingPrice, qa.processingPrice + qb.processingPrice);
  assert.equal(q.shippingPrice, 300);
  assert.equal(q.totalPrice, qa.processingPrice + qb.processingPrice + 300, "shipping once, not per SVG");
  assert.equal(q.totalPrice, qa.totalPrice + qb.totalPrice - 300);
  assert.equal(q.quantity, 3);
  assert.equal(q.cutLengthMm, 580);
  assert.deepEqual(q.items.map((it) => it.price), [qa.processingPrice, qb.processingPrice]);
  // Total quantity 9 is fine, 10 needs an inquiry.
  assert.equal(quoteOrder({ ...opts, items: [{ ...a, quantity: 5 }, { ...b, quantity: 4 }] }).inquiryRequired, false);
  const bulk = quoteOrder({ ...opts, items: [{ ...a, quantity: 5 }, { ...b, quantity: 5 }] });
  assert.equal(bulk.inquiryRequired, true);
  assert.equal(bulk.totalPrice, null);
  // Errors name the SVG when there are several.
  const bad = quoteOrder({ ...opts, items: [a, { ...b, widthMm: 400 }] });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /^「b\.svg」: SVGが用紙に収まりません/);
  assert.match(quoteOrder({ ...opts, items: [{ ...b, widthMm: 400 }] }).errors[0], /^SVGが用紙に収まりません/, "no prefix for one SVG");
  assert.deepEqual(quoteOrder({ ...opts, items: [] }).errors, ["SVGを追加してください。"]);
  assert.match(quoteOrder({ ...opts, items: Array.from({ length: CATALOG.limits.maxItems + 1 }, () => b) }).errors[0], /までです/);
  // quote() with one SVG is the same as quoteOrder with one item.
  assert.equal(quote({ ...opts, ...a }).totalPrice, quoteOrder({ ...opts, items: [a] }).totalPrice);
});
