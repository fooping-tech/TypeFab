import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSVG, documentSize, securityIssues, withPhysicalSize, parseSVG } from "../src/svganalyze.js";
import { exportSVG, shapeContours } from "../src/geometry.js";

const svg = (attrs, body) => `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${body}</svg>`;
const rect = '<rect x="10" y="10" width="30" height="20" fill="none" stroke="red"/>';

test("mm size with viewBox and paths only is accepted, with cut length and closed path counts", () => {
  const a = analyzeSVG(svg('width="82.3mm" height="142mm" viewBox="0 0 82.3 142"', rect + '<path d="M0 0 L10 0 L10 10 Z"/>'));
  assert.ok(a.ok, a.errors.join());
  assert.equal(a.size.known, true);
  assert.equal(a.size.widthMm, 82.3);
  assert.equal(a.size.heightMm, 142);
  assert.equal(a.pathCount, 2);
  assert.equal(a.closedPaths, 2);
  assert.equal(a.openPaths, 0);
  assert.ok(Math.abs(a.cutLengthMm - (100 + 10 + 10 + Math.hypot(10, 10))) < 0.01);
  assert.equal(a.warnings.length, 0);
});

test("TypeFab's own export analyses as a real order (mm, viewBox, paths only)", () => {
  const project = {
    version: 2, width: 120, height: 80, layers: [{ id: "l", name: "L", visible: true, locked: false }],
    items: [{ id: "r", type: "rect", x: 10, y: 10, w: 40, h: 20, rotation: 0, layerId: "l", contours: shapeContours("rect", 40, 20) }],
  };
  const a = analyzeSVG(exportSVG(project));
  assert.ok(a.ok);
  assert.deepEqual([a.size.widthMm, a.size.heightMm], [120, 80]);
  assert.equal(a.cutLengthMm, 120);
});

test("cm and inch sizes convert to mm; width only with viewBox derives the height", () => {
  assert.deepEqual(documentSize(parseSVG(svg('width="10cm" height="2in"', rect))).widthMm, 100);
  assert.equal(documentSize(parseSVG(svg('width="10cm" height="2in"', rect))).heightMm, 50.8);
  const d = documentSize(parseSVG(svg('width="50mm" viewBox="0 0 100 40"', rect)));
  assert.equal(d.known, true);
  assert.equal(d.heightMm, 20);
});

test("missing width/height, px and unitless sizes need confirmation and block ordering", () => {
  for (const attrs of ['viewBox="0 0 100 50"', 'width="100px" height="50px"', 'width="100" height="50" viewBox="0 0 100 50"', 'height="50" viewBox="0 0 100 50"']) {
    const a = analyzeSVG(svg(attrs, rect));
    assert.equal(a.ok, false, attrs);
    assert.equal(a.size.known, false);
    assert.ok(a.size.suggestedWidthMm > 0, attrs);
    assert.match(a.errors[0], /実寸/);
  }
  const none = analyzeSVG(svg("", rect));
  assert.equal(none.size.source, "none");
  assert.match(none.errors[0], /大きさを取得できません/);
});

test("confirming the real width rewrites width/height in mm and keeps the aspect ratio", () => {
  const fixed = withPhysicalSize(svg('width="200" height="100" viewBox="0 0 200 100"', rect), 50);
  const a = analyzeSVG(fixed);
  assert.ok(a.ok, a.errors.join());
  assert.deepEqual([a.size.widthMm, a.size.heightMm], [50, 25]);
  assert.match(fixed, /width="50mm" height="25mm" viewBox="0 0 200 100"/);
  // no viewBox: one is created from the pixel size
  const px = withPhysicalSize(svg('width="96px" height="48px"', rect), 48);
  assert.match(px, /viewBox="0 0 96 48"/);
  assert.deepEqual([analyzeSVG(px).size.widthMm, analyzeSVG(px).size.heightMm], [48, 24]);
  assert.throws(() => withPhysicalSize(svg("", rect), 40), /大きさを決められません/);
});

test("script, foreignObject, event handlers, external URLs, iframe and entities are rejected", () => {
  const cases = [
    ['<script>alert(1)</script>', "element:script"],
    ['<foreignObject><div>x</div></foreignObject>', "element:foreignobject"],
    ['<rect width="1" height="1" onclick="alert(1)"/>', "event-handler"],
    ['<a href="javascript:alert(1)"><rect width="1" height="1"/></a>', "script-url"],
    ['<image xlink:href="https://example.com/x.png"/>', "external-url"],
    ['<use href="https://example.com/x.svg#a"/>', "external-url"],
    ['<rect width="1" height="1" style="fill:url(https://evil/x)"/>', "external-url"],
    ['<style>@import url(https://evil/x.css);</style>', "css-import"],
    ['<iframe src="https://evil"/>', "element:iframe"],
  ];
  for (const [body, code] of cases) {
    const text = svg('width="10mm" height="10mm" viewBox="0 0 10 10"', rect + body);
    const issues = securityIssues(parseSVG(text), text);
    assert.ok(issues.some((i) => i.code === code), `${code} in ${body}: ${JSON.stringify(issues)}`);
    assert.equal(analyzeSVG(text).ok, false);
  }
  const xxe = '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' + svg('width="10mm" height="10mm"', rect);
  assert.ok(securityIssues(parseSVG(xxe), xxe).some((i) => i.code === "entity"));
  const clean = svg('width="10mm" height="10mm"', rect + '<a href="#top"><circle r="2"/></a>');
  assert.deepEqual(securityIssues(parseSVG(clean), clean), []);
});

test("text-only files are reported as not cuttable; text next to paths is a warning", () => {
  const only = analyzeSVG(svg('width="10mm" height="10mm"', "<text>abc</text>"));
  assert.equal(only.ok, false);
  assert.equal(only.hasText, true);
  assert.match(only.errors[0], /カットできる図形がありません/);
  const mixed = analyzeSVG(svg('width="10mm" height="10mm"', rect + "<text>abc</text><image href='data:image/png;base64,AAAA'/>"));
  assert.ok(mixed.ok);
  assert.ok(mixed.warnings.some((w) => /文字/.test(w)));
  assert.ok(mixed.warnings.some((w) => /画像/.test(w)));
});

test("open paths and duplicate lines are counted", () => {
  const a = analyzeSVG(svg('width="50mm" height="50mm" viewBox="0 0 50 50"', '<path d="M0 0 L20 0"/><line x1="0" y1="0" x2="20" y2="0"/><polyline points="0,10 10,10 10,20"/>'));
  assert.ok(a.ok);
  assert.equal(a.openPaths, 3);
  assert.equal(a.closedPaths, 0);
  assert.equal(a.duplicateSegments, 1);
  assert.ok(a.warnings.some((w) => /Open path 3/.test(w)));
  assert.ok(a.warnings.some((w) => /重複線の可能性 1/.test(w)));
  assert.equal(a.cutLengthMm, 60);
});

test("malformed, oversized and too-large files are rejected with messages", () => {
  const bad = analyzeSVG("<svg width='10mm' height='10mm'><rect width='1' height='1'>");
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /SVGとして読み込めません/);
  assert.equal(analyzeSVG("hello").ok, false);
  const big = analyzeSVG(svg('width="400mm" height="100mm"', rect));
  assert.match(big.errors[0], /SVGが用紙に収まりません（400\.0 × 100\.0 mm。最大 277 × 190 mm、A4 横/);
  assert.equal(big.layout, null);
  assert.ok(analyzeSVG(svg('width="100mm" height="215mm"', rect)).ok, "a portrait SVG is laid out rotated; the piece (whole sheet, no outline) fits the envelope");
  assert.ok(analyzeSVG(svg('width="100mm" height="250mm"', rect)).ok, "a small closed shape on a large sheet is a small piece");
  assert.match(analyzeSVG(svg('width="100mm" height="250mm" viewBox="0 0 100 250"', '<rect width="100" height="250"/>')).errors[0], /切り抜き後のサイズが封筒に収まりません（100\.0 × 250\.0 mm。最大 215 × 100 mm、長形3号封筒/);
  const huge = analyzeSVG(svg('width="10mm" height="10mm"', rect), { limits: { maxSvgBytes: 100 } });
  assert.match(huge.errors[0], /ファイルが大きすぎます/);
});

test("sheet layout and finished piece: the SVG goes on the A4 landscape sheet, the envelope check uses the cut outline", () => {
  const outline = '<rect x="20" y="10" width="50" height="140"/><circle cx="45" cy="40" r="8"/>';
  const a = analyzeSVG(svg('width="240mm" height="160mm" viewBox="0 0 240 160"', outline));
  assert.ok(a.ok, a.errors.join());
  assert.deepEqual(a.layout, { sheetWidthMm: 297, sheetHeightMm: 210, marginMm: 10, rotated: false, x: 10, y: 10, widthMm: 240, heightMm: 160 });
  assert.deepEqual(a.piece, { widthMm: 50, heightMm: 140, sheet: false, x: 20, y: 10, loopCount: 2, openCount: 0 });
  // Portrait work area: laid out rotated, same piece.
  const p = analyzeSVG(svg('width="160mm" height="240mm" viewBox="0 0 160 240"', '<rect x="10" y="20" width="50" height="140"/>'));
  assert.ok(p.ok, p.errors.join());
  assert.equal(p.layout.rotated, true);
  assert.deepEqual([p.layout.widthMm, p.layout.heightMm], [240, 160]);
  assert.deepEqual([p.piece.widthMm, p.piece.heightMm], [50, 140]);
  // The work area fits the sheet but the outline does not fit the envelope.
  const tall = analyzeSVG(svg('width="240mm" height="160mm" viewBox="0 0 240 160"', '<rect x="10" y="10" width="220" height="120"/>'));
  assert.equal(tall.ok, false);
  assert.match(tall.errors[0], /切り抜き後のサイズが封筒に収まりません（220\.0 × 120\.0 mm/);
  assert.ok(tall.layout, "the sheet layout is still known");
  // No enclosing outline: the whole sheet is the piece.
  const holes = analyzeSVG(svg('width="240mm" height="160mm" viewBox="0 0 240 160"', '<circle cx="40" cy="40" r="10"/><circle cx="200" cy="120" r="10"/>'));
  assert.equal(holes.ok, false);
  assert.equal(holes.piece.sheet, true);
  assert.deepEqual([holes.piece.widthMm, holes.piece.heightMm], [240, 160]);
  const small = analyzeSVG(svg('width="100mm" height="80mm" viewBox="0 0 100 80"', '<circle cx="40" cy="40" r="10"/><circle cx="60" cy="40" r="10"/>'));
  assert.ok(small.ok, small.errors.join());
  assert.equal(small.piece.sheet, true);
  // Sheet too big even though the piece is fine; both messages are separate.
  const big = analyzeSVG(svg('width="300mm" height="200mm" viewBox="0 0 300 200"', outline));
  assert.equal(big.layout, null);
  assert.deepEqual([big.piece.widthMm, big.piece.heightMm], [50, 140]);
  assert.equal(big.errors.length, 1);
  assert.match(big.errors[0], /SVGが用紙に収まりません/);
  // Custom limits and sheet flow through.
  const custom = analyzeSVG(svg('width="240mm" height="160mm" viewBox="0 0 240 160"', outline), { limits: { piece: { maxWidthMm: 120, maxHeightMm: 40, note: "小さい封筒" } }, sheet: { name: "A4", widthMm: 297, heightMm: 210, marginMm: 5 } });
  assert.match(custom.errors[0], /最大 120 × 40 mm、小さい封筒/);
  assert.equal(custom.layout.marginMm, 5);
});
