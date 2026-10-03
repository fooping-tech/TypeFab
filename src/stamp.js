import ClipperLib from "clipper-lib";
import { worldContours, shapeContours, pathData } from "./geometry.js";
import { SCALE, encode, decode, isClosed } from "./polygon.js";
// Stamp Mode (issue #12): a rubber stamp instead of cut lines. The board is
// the stamp face; every visible closed outline is ink (the raised rubber that
// prints). The export engraves the rest of the face and cuts the rubber's
// outline, mirrored so the print reads the right way round.
//
//   engrave = face − ink   (negative, the default: the characters print)
//   engrave = face ∩ ink   (positive: the characters are white in the print)
//
// Everything is in millimetres with the board's origin at the top left.

export const FABRICATION_MODES = Object.freeze({
  cut: { label: "切り抜き", hint: "しおり・ステンシル（カット線）" },
  stamp: { label: "ハンコ", hint: "ゴム印（彫刻＋外形カット）" },
});
export const fabricationMode = (project) =>
  project?.fabrication === "stamp" ? "stamp" : "cut";
export const STAMP_SHAPES = Object.freeze({
  rectangle: "長方形",
  "rounded-rectangle": "角丸長方形",
  circle: "円形",
});
export const ENGRAVING_MODES = Object.freeze({
  negative: "背景を彫る（文字が押される）",
  positive: "文字を彫る（文字が白抜き）",
});
export const BOLD_PRESETS = Object.freeze([0, 0.1, 0.2, 0.3]);
export const STAMP_DEFAULTS = Object.freeze({
  shape: "rectangle",
  mirror: true,
  engravingMode: "negative",
  margin: 2,
  cornerRadius: 3,
  boldOffset: 0.1,
  guide: false,
});
// The face size is the board size, so it shares the board's 10 mm minimum.
export const STAMP_LIMITS = Object.freeze({
  size: [10, 200],
  margin: [0, 20],
  cornerRadius: [0, 100],
  boldOffset: [-0.5, 1],
});
export const STAMP_SIZE_DEFAULT = Object.freeze({ width: 60, height: 20 });

const inRange = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi;
// Saved settings with defaults filled in; anything malformed is rejected so a
// project file cannot smuggle odd values into the geometry.
export function normalizeStamp(stamp = {}) {
  if (!stamp || typeof stamp !== "object" || Array.isArray(stamp))
    throw Error("ハンコ設定が不正です。");
  const o = { ...STAMP_DEFAULTS };
  for (const key of Object.keys(STAMP_DEFAULTS))
    if (stamp[key] !== undefined) o[key] = stamp[key];
  if (
    !(o.shape in STAMP_SHAPES) ||
    !(o.engravingMode in ENGRAVING_MODES) ||
    typeof o.mirror !== "boolean" ||
    typeof o.guide !== "boolean" ||
    !inRange(o.margin, STAMP_LIMITS.margin) ||
    !inRange(o.cornerRadius, STAMP_LIMITS.cornerRadius) ||
    !inRange(o.boldOffset, STAMP_LIMITS.boldOffset)
  )
    throw Error("ハンコ設定が不正です。");
  return o;
}
// Settings plus the face size (the board).
export const stampOptions = (project) => ({
  ...normalizeStamp(project.stamp ?? {}),
  width: project.width,
  height: project.height,
});

// ---- Clipper on integer paths (SCALE units) ----
const NONZERO = ClipperLib.PolyFillType.pftNonZero;
function boolean(subject, clip, type) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const out = [];
  if (!c.Execute(type, out, NONZERO, NONZERO)) throw Error("印面の合成に失敗しました。");
  return out.filter((p) => p.length >= 3);
}
const union = (a, b) => boolean(a, b, ClipperLib.ClipType.ctUnion);
const difference = (a, b) => boolean(a, b, ClipperLib.ClipType.ctDifference);
const intersection = (a, b) => boolean(a, b, ClipperLib.ClipType.ctIntersection);
// Positive grows, negative thins; round joins keep the letter shapes.
function offset(paths, distance) {
  if (!distance || !paths.length) return paths;
  const co = new ClipperLib.ClipperOffset(2, 0.02 * SCALE);
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, distance * SCALE);
  return out.filter((p) => p.length >= 3);
}
const area = (paths) =>
  paths.reduce((n, p) => n + ClipperLib.Clipper.Area(p), 0) / (SCALE * SCALE);

// The rubber's outline: the whole board as a rectangle, a rounded rectangle
// or the inscribed ellipse (a circle when the face is square).
export function stampBase({ width, height, shape, cornerRadius = 0 }) {
  if (shape === "circle") return shapeContours("circle", width, height);
  if (shape === "rounded-rectangle" && cornerRadius > 0)
    return shapeContours("rect", width, height, Math.min(cornerRadius, width / 2, height / 2));
  return shapeContours("rect", width, height);
}

// Union of the closed outlines of the given items. Each item is normalised on
// its own first (nonzero), so one item's counter (the hole of 口) is not
// filled or cut by the winding of another. Open lines have no width and
// bridges do not apply to a stamp; both are counted and skipped.
function inkOf(items) {
  let ink = [],
    open = 0,
    bridges = 0;
  for (const item of items) {
    if (item.type === "bridge") {
      bridges++;
      continue;
    }
    const world = worldContours(item),
      closed = world.filter(isClosed);
    open += world.length - closed.length;
    if (!closed.length) continue;
    const own = ClipperLib.Clipper.SimplifyPolygons(
      closed.map(encode).filter((p) => p.length >= 3),
      NONZERO,
    );
    ink = ink.length ? union(ink, own) : own;
  }
  return { ink, open, bridges };
}

// Stamp geometry in the stamp's own (unmirrored) orientation:
// - base: the rubber outline (CUT)
// - raised: what stays and prints
// - engrave: what the laser removes (ENGRAVE)
// - marginArea: the face inset by the margin (GUIDE)
// with checks: no ink, ink outside the face or the margin, skipped items.
export function stampGeometry(items, options) {
  const o = { ...normalizeStamp(options), width: options.width, height: options.height };
  const base = stampBase(o).map(encode),
    { ink, open, bridges } = inkOf(items),
    grown = offset(ink, o.boldOffset),
    inside = intersection(grown, base),
    raised = o.engravingMode === "positive" ? difference(base, grown) : inside,
    engrave = o.engravingMode === "positive" ? inside : difference(base, grown),
    marginArea = o.margin > 0 ? offset(base, -o.margin) : base;
  const inkArea = area(inside),
    faceArea = Math.abs(area(base));
  return {
    options: o,
    base: base.map(decode),
    raised: raised.map(decode),
    engrave: engrave.map(decode),
    marginArea: marginArea.map(decode),
    empty: !ink.length,
    // Ink thinned away entirely by a negative bold offset.
    vanished: ink.length > 0 && inkArea < 1e-6,
    inkArea,
    faceArea,
    outsideFace: grown.length > 0 && area(difference(grown, base)) > 1e-4,
    outsideMargin:
      grown.length > 0 && marginArea.length > 0 && area(difference(grown, marginArea)) > 1e-4,
    open,
    bridges,
  };
}

// Left–right mirror inside the face; the point order is reversed so outer
// contours and holes keep their orientation.
export const mirrorContours = (contours, width) =>
  contours.map((c) => c.map((p) => ({ x: width - p.x, y: p.y })).reverse());

const num = (n) => Number(Number(n).toFixed(4));
const xml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const layer = (id, body) =>
  `<g id="${id}" inkscape:groupmode="layer" inkscape:label="${id}">${body}</g>`;
// Centre lines and the margin, drawn but not meant to be lasered.
function guidePaths(g) {
  const { width: w, height: h } = g.options;
  return [
    ...g.marginArea,
    [{ x: w / 2, y: 0 }, { x: w / 2, y: h }],
    [{ x: 0, y: h / 2 }, { x: w, y: h / 2 }],
  ];
}

// Laser SVG: mm units, viewBox, paths only. ENGRAVE is a black filled
// compound path (even-odd), CUT a red hairline, the optional GUIDE blue. The
// colours let LightBurn put them on separate layers; xTool Creative Space
// reads filled shapes as engraving and strokes as cutting. Group ids and
// Inkscape layer labels name the operation.
export function stampSVG(items, options) {
  const g = stampGeometry(items, options),
    o = g.options;
  if (g.empty) throw Error("印面に文字や図形がありません。閉じた輪郭を配置してください。");
  if (g.vanished || !g.raised.length)
    throw Error("太さ補正で文字が消えました。補正を大きくしてください。");
  if (!g.engrave.length) throw Error("彫刻する部分がありません。");
  const m = (c) => (o.mirror ? mirrorContours(c, o.width) : c);
  const engrave = `<path d="${pathData(m(g.engrave))}" fill="#000000" fill-rule="evenodd" stroke="none"/>`,
    cut = `<path d="${pathData(m(g.base))}" fill="none" stroke="#ff0000" stroke-width="0.1"/>`,
    guide = o.guide
      ? `\n${layer("GUIDE", `<path d="${pathData(m(guidePaths(g)))}" fill="none" stroke="#0000ff" stroke-width="0.05" stroke-dasharray="0.6 0.4"/>`)}`
      : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${num(o.width)}mm" height="${num(o.height)}mm" viewBox="0 0 ${num(o.width)} ${num(o.height)}">\n<title>TypeFab rubber stamp</title>\n<desc>${xml(`Units: mm. ENGRAVE (black fill) is the area to engrave, CUT (red line) is the rubber outline${o.guide ? ", GUIDE (blue) is for reference only and is not meant to be processed" : ""}. ${o.mirror ? "Mirrored left to right for stamping." : "Not mirrored."} Shape: ${o.shape}. Bold offset: ${o.boldOffset} mm. Engraving: ${o.engravingMode}.`)}</desc>\n${layer("ENGRAVE", engrave)}\n${layer("CUT", cut)}${guide}\n</svg>\n`;
}

// Small mock-ups for the inspector, in mm with a little padding.
// "laser": the export (mirrored when set) — engraving dark, cut line red.
// "print": the impression on paper, always the right way round.
export const STAMP_INK = "#c8332b";
export function stampPreviewSVG(g, view) {
  const o = g.options,
    pad = Math.max(o.width, o.height) * 0.06,
    box = `${num(-pad)} ${num(-pad)} ${num(o.width + 2 * pad)} ${num(o.height + 2 * pad)}`,
    m = (c) => (view === "laser" && o.mirror ? mirrorContours(c, o.width) : c);
  const body =
    view === "laser"
      ? `<path d="${pathData(m(g.base))}" fill="#f1e6d6"/><path d="${pathData(m(g.engrave))}" fill="#4a4038" fill-rule="evenodd"/><path d="${pathData(m(g.base))}" fill="none" stroke="#e0362b" stroke-width="${num(Math.max(o.width, o.height) * 0.008)}"/>`
      : `<path d="${pathData(g.base)}" fill="none" stroke="#d9d2c6" stroke-width="${num(Math.max(o.width, o.height) * 0.005)}" stroke-dasharray="${num(pad / 3)} ${num(pad / 4)}"/><path d="${pathData(g.raised)}" fill="${STAMP_INK}" fill-opacity=".92" fill-rule="evenodd"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-label="${view === "laser" ? "加工データ" : "押印プレビュー"}">${body}</svg>`;
}

// Uniform scale and centre that fits a box of content into the margin area
// (less the bold offset):
// the inner rectangle, or for a circle the largest box of the same shape
// inside the inner ellipse. Returns { k, from, to } (scale about `from`, then
// move it to `to`).
export function fitTransform(box, options) {
  const o = { ...normalizeStamp(options), width: options.width, height: options.height };
  // The bold offset grows the ink after the fit, so it is kept inside too.
  const inset = o.margin + Math.max(0, o.boldOffset),
    w = Math.max(o.width - 2 * inset, 0.1),
    h = Math.max(o.height - 2 * inset, 0.1),
    bw = Math.max(box.w, 1e-6),
    bh = Math.max(box.h, 1e-6);
  const k =
    o.shape === "circle"
      ? 1 / Math.hypot(bw / w, bh / h)
      : Math.min(w / bw, h / bh);
  return {
    k,
    from: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
    to: { x: o.width / 2, y: o.height / 2 },
  };
}
