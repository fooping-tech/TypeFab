import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import opentype from "opentype.js";
import { flatten, exportSVG, automaticBridges, shapeContours } from "../src/geometry.js";
import {
  BOOK_WIDTH_MM,
  BOOK_HEIGHT_MM,
  VISIBLE_TOP_MM,
  BOOKMARK_THRESHOLDS,
  COMPARISON_REFERENCES,
  closeCutLoops,
  bookmarkPiece,
  bookmarkOrientation,
  bookmarkWarnings,
  bookmarkLayout,
  renderSingle,
  renderInBook,
  renderComparison,
} from "../src/bookmark-preview.js";

const P = (x, y) => ({ x, y });
const svg = (attrs, body) => `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const viewBoxOf = (s) => /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(s).slice(1).map(Number);

test("book, visible top and size thresholds are the fixed first-version constants", () => {
  assert.deepEqual([BOOK_WIDTH_MM, BOOK_HEIGHT_MM, VISIBLE_TOP_MM], [105, 148, 20]);
  assert.deepEqual(BOOKMARK_THRESHOLDS, { maxWidthMm: 50, minHeightMm: 90, maxHeightMm: 160 });
  assert.equal(COMPARISON_REFERENCES[0].id, "bunko");
});

test("size warnings: the issue's four sample sizes", () => {
  const codes = (w, h) => bookmarkWarnings(w, h).map((x) => x.code);
  assert.deepEqual(codes(38, 120), []);
  assert.deepEqual(codes(50, 148), []); // 50 mm wide is still within the threshold
  assert.deepEqual(codes(20, 80), ["short"]);
  assert.deepEqual(codes(60, 180), ["wide", "long"]);
  assert.match(bookmarkWarnings(60, 180)[0].text, /やや幅広/);
  assert.match(bookmarkWarnings(20, 80)[0].text, /ほとんど見えない/);
  assert.match(bookmarkWarnings(60, 180)[1].text, /大きくはみ出す/);
  // Thresholds are parameters, not baked in.
  assert.deepEqual(bookmarkWarnings(45, 120, { maxWidthMm: 40, minHeightMm: 90, maxHeightMm: 160 }).map((x) => x.code), ["wide"]);
});

test("layout in the book: visible top, inserted length and bottom overhang", () => {
  const a = bookmarkLayout(38, 120);
  assert.equal(a.visibleTopMm, 20);
  assert.equal(a.insertedMm, 100);
  assert.equal(a.bottomOverhangMm, 0);
  near(a.widthRatio, 38 / 105);
  near(a.heightRatio, 120 / 148);
  const b = bookmarkLayout(60, 180);
  assert.equal(b.visibleTopMm, 20);
  assert.equal(b.insertedMm, 148);
  assert.equal(b.bottomOverhangMm, 12);
  // Very short pieces keep half inside the book instead of the fixed 20 mm out.
  assert.equal(bookmarkLayout(20, 30).visibleTopMm, 15);
});

test("landscape designs are shown upright by default and can be forced either way", () => {
  const piece = { widthMm: 120, heightMm: 38 };
  assert.deepEqual(bookmarkOrientation(piece), { rotated: true, widthMm: 38, heightMm: 120 });
  assert.deepEqual(bookmarkOrientation(piece, false), { rotated: false, widthMm: 120, heightMm: 38 });
  assert.deepEqual(bookmarkOrientation({ widthMm: 38, heightMm: 120 }), { rotated: false, widthMm: 38, heightMm: 120 });
});

test("closeCutLoops: closed contours pass through, a holding-tab gap is closed along the contour", () => {
  const square = [P(0, 0), P(10, 0), P(10, 10), P(0, 10), P(0, 0)];
  assert.equal(closeCutLoops([{ points: square, closed: true }]).loops.length, 1);
  // The same square cut with a 1.5 mm gap in the top edge (one open run).
  const gapped = [P(5.75, 0), P(10, 0), P(10, 10), P(0, 10), P(0, 0), P(4.25, 0)];
  const r = closeCutLoops([{ points: gapped, closed: false }]);
  assert.equal(r.loops.length, 1);
  assert.equal(r.open.length, 0);
  assert.deepEqual(r.loops[0][0], r.loops[0].at(-1));
});

test("closeCutLoops: a bridge across a ring joins outer and inner runs so the bridge stays material", () => {
  // Ring: outer square 0..20, inner square 6..14; a 1.5 mm wide bridge at
  // x≈10 crosses the top stroke, leaving four open runs.
  const outer = [P(10.75, 0), P(20, 0), P(20, 20), P(0, 20), P(0, 0), P(9.25, 0)];
  const inner = [P(9.25, 6), P(6, 6), P(6, 14), P(14, 14), P(14, 6), P(10.75, 6)];
  const r = closeCutLoops([
    { points: outer, closed: false },
    { points: inner, closed: false },
  ]);
  assert.equal(r.open.length, 0);
  assert.equal(r.loops.length, 1, "one loop following the cut around the bridge");
  const loop = r.loops[0];
  // The loop contains the bridge sides (10.75,0)-(10.75,6) and (9.25,6)-(9.25,0).
  const has = (a, b) => loop.some((p, i) => i && ((p.x === a.x && p.y === a.y && loop[i - 1].x === b.x && loop[i - 1].y === b.y) || (p.x === b.x && p.y === b.y && loop[i - 1].x === a.x && loop[i - 1].y === a.y)));
  assert.ok(has(P(10.75, 0), P(10.75, 6)));
  assert.ok(has(P(9.25, 0), P(9.25, 6)));
  // Runs too far apart stay open lines.
  const far = closeCutLoops([{ points: [P(0, 0), P(50, 0)], closed: false }, { points: [P(0, 30), P(50, 30)], closed: false }]);
  assert.equal(far.loops.length, 0);
  assert.equal(far.open.length, 2);
});

test("bookmarkPiece: the enclosing outline is the piece; the document is only the sheet", () => {
  // 38 × 120 rounded frame with a hole, placed inside a 200 × 150 mm work area.
  const s = svg('width="200mm" height="150mm" viewBox="0 0 200 150"', '<rect x="20" y="10" width="38" height="120" rx="3" fill="none" stroke="#f00"/><circle cx="39" cy="20" r="3" fill="none" stroke="#f00"/>');
  const piece = bookmarkPiece(s);
  near(piece.widthMm, 38, 1e-3);
  near(piece.heightMm, 120, 1e-3);
  assert.equal(piece.sheet, false);
  assert.deepEqual([piece.sheetWidthMm, piece.sheetHeightMm], [200, 150]);
  assert.equal(piece.loopCount, 2);
  assert.equal(piece.openCount, 0);
  assert.match(piece.fillD, /^M/);
  assert.doesNotMatch(piece.fillD, /NaN/);
  // Coordinates are relative to the piece's top-left corner.
  assert.ok(!/M-|L-/.test(piece.fillD));
});

test("bookmarkPiece: holes without an outline mean the whole sheet is the piece", () => {
  const s = svg('width="40mm" height="120mm" viewBox="0 0 40 120"', '<circle cx="20" cy="20" r="5"/><rect x="10" y="40" width="20" height="10"/>');
  const piece = bookmarkPiece(s);
  assert.equal(piece.sheet, true);
  assert.deepEqual([piece.widthMm, piece.heightMm], [40, 120]);
  assert.match(piece.fillD, /^M0 0H40V120H0Z/);
});

test("bookmarkPiece: unknown physical size, no cut shapes or unreadable text give null", () => {
  assert.equal(bookmarkPiece(svg('width="120" height="38"', '<rect width="10" height="10"/>')), null);
  assert.equal(bookmarkPiece(svg('viewBox="0 0 120 38"', '<rect width="10" height="10"/>')), null);
  assert.equal(bookmarkPiece(svg('width="120mm" height="38mm"', '<text>hi</text>')), null);
  assert.equal(bookmarkPiece("not svg"), null);
  // Open lines only: still a piece (the sheet) with the lines drawn as cuts.
  const lines = bookmarkPiece(svg('width="120mm" height="38mm" viewBox="0 0 120 38"', '<line x1="0" y1="0" x2="100" y2="0"/>'));
  assert.equal(lines.sheet, true);
  assert.equal(lines.openCount, 1);
  assert.match(lines.lineD, /^M0 0L100 0$/);
});

test("bookmarkPiece: TypeFab's own export with a real font and automatic bridges", () => {
  const bytes = fs.readFileSync(new URL("../public/fonts/ShipporiMincho-Regular.ttf", import.meta.url));
  const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const frame = { id: "f", type: "rect", x: 20, y: 10, w: 38, h: 120, rotation: 0, contours: shapeContours("rect", 38, 120, 3) };
  const text = { id: "t", type: "outline", x: 26, y: 20, rotation: 90, contours: flatten(font.getPath("本の栞", 0, 0, 14).commands) };
  const items = [frame, text, ...automaticBridges([text])];
  const piece = bookmarkPiece(exportSVG({ width: 200, height: 150, items }));
  near(piece.widthMm, 38, 1e-3);
  near(piece.heightMm, 120, 1e-3);
  assert.equal(piece.sheet, false);
  assert.ok(piece.loopCount > 3);
  assert.equal(piece.openCount, 0);
});

test("renderers: mm viewBox, evenodd paper, book at 105 × 148, labels and no NaN", () => {
  const piece = bookmarkPiece(svg('width="60mm" height="140mm" viewBox="0 0 60 140"', '<rect x="11" y="10" width="38" height="120" fill="none" stroke="#000"/><circle cx="30" cy="20" r="3"/>'));
  const single = renderSingle(piece);
  assert.match(single, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 /);
  assert.match(single, /fill-rule="evenodd"/);
  assert.match(single, /feTurbulence/);
  assert.match(single, /feDropShadow/);
  assert.match(single, /38\.0 mm/);
  assert.match(single, /120\.0 mm/);
  const [sw, sh] = viewBoxOf(single);
  assert.ok(sw > 38 && sh > 120);

  const book = renderInBook(piece);
  assert.match(book, /width="105" height="148"/);
  assert.match(book, /上部 20\.0 mm/);
  assert.match(book, /clip-path="url\(#/);
  assert.match(book, /stroke-dasharray/); // the hidden part as a dashed ghost
  assert.doesNotMatch(book, /はみ出し/);
  const [bw, bh] = viewBoxOf(book);
  assert.ok(bw > 105 && bh > 148 + 20);

  const compare = renderComparison(piece);
  assert.match(compare, />文庫本</);
  assert.match(compare, />しおり</);
  assert.match(compare, /105\.0 mm/);
  assert.match(compare, /148\.0 mm/);
  const [cw] = viewBoxOf(compare);
  assert.ok(cw > 105 + 38);
  for (const s of [single, book, compare]) {
    assert.doesNotMatch(s, /NaN|Infinity|undefined/);
    assert.match(s, /<title>/);
    assert.match(s, /role="img"/);
  }
});

test("renderInBook: a 180 mm piece shows the bottom overhang; landscape pieces are rotated", () => {
  const long = bookmarkPiece(svg('width="60mm" height="180mm" viewBox="0 0 60 180"', '<rect width="60" height="180"/>'));
  const book = renderInBook(long);
  assert.match(book, /はみ出し 12\.0 mm/);
  const wide = bookmarkPiece(svg('width="120mm" height="38mm" viewBox="0 0 120 38"', '<rect width="120" height="38"/>'));
  assert.match(renderInBook(wide), /rotate\(90\)/);
  assert.doesNotMatch(renderInBook(wide, { rotated: false }), /rotate\(90\)/);
  assert.match(renderSingle(wide), /38\.0 mm/);
});

test("comparison references can be extended without touching the renderer", () => {
  const piece = bookmarkPiece(svg('width="38mm" height="120mm" viewBox="0 0 38 120"', '<rect width="38" height="120"/>'));
  const s = renderComparison(piece, { references: [...COMPARISON_REFERENCES, { id: "card", label: "名刺", widthMm: 91, heightMm: 55, draw: "rect" }] });
  assert.match(s, />名刺</);
  assert.match(s, /91\.0 mm/);
  assert.match(s, /55\.0 mm/);
});
