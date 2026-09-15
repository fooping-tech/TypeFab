// Bookmark mock-ups for the order page (issue #7): the finished piece in black
// kraft paper, the piece tucked into a bunko-size paperback, and a same-scale
// size comparison. Pure functions returning SVG strings; the order page only
// decides which view to show. Every drawing uses a millimetre viewBox, so the
// ratio between the book and the bookmark is exact at any display size.
import { parseSVG, documentSize } from "./svganalyze.js";
import { svgShapes } from "./svgimport.js";
import { pathContours } from "./path.js";

// Fixed bunko (A6) paperback and how far a bookmark shows above it. Both are
// display constants for the first version, not order parameters.
export const BOOK_WIDTH_MM = 105;
export const BOOK_HEIGHT_MM = 148;
export const VISIBLE_TOP_MM = 20;
// Sizes outside these read as unusual for a bunko bookmark. Informational only.
export const BOOKMARK_THRESHOLDS = { maxWidthMm: 50, minHeightMm: 90, maxHeightMm: 160 };
// Objects drawn next to the bookmark in the comparison view. Add entries here
// (rulers, coins, business cards) to extend the view; `draw` picks the sketch.
export const COMPARISON_REFERENCES = [{ id: "bunko", label: "文庫本", widthMm: BOOK_WIDTH_MM, heightMm: BOOK_HEIGHT_MM, draw: "book" }];

// Cut lines interrupted by bridges: a gap this wide or narrower is closed along
// the contour; a bridge's side (the short segment across the stroke between the
// outer and inner gap) is joined when it scores better than closing the gap.
export const MAX_GAP_MM = 6;
export const MAX_BRIDGE_SPAN_MM = 10;

const f = (v) => String(Number(Number(v).toFixed(3)));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const same = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const PAPER = { fill: "#25221f", edge: "#7d7167", grain: "#4b443e", ghost: "#8b8178" };
const BOOK = { cover: "#d8ccb4", spine: "#b9aa8c", pages: "#f3eee3", edge: "#a99a7c", text: "#6c5f4c" };
const INK = "#4f5d6a";

// ---- geometry ----------------------------------------------------------------

// Joins open cut lines into closed loops. Each endpoint is paired with at
// most one other endpoint: the gap left by a bridge is closed along the
// contour, unless the segment across the stroke (the side of the bridge)
// is clearly shorter — then the loop follows the real cut around the bridge
// and the bridge stays as material in the fill.
export function closeCutLoops(polylines) {
  const loops = [],
    open = [];
  const ends = [];
  polylines.forEach((pl, i) => {
    const pts = dedupe(pl.points);
    if (pts.length < 2) return;
    if (pl.closed || same(pts[0], pts.at(-1))) {
      if (pts.length >= 3) loops.push(same(pts[0], pts.at(-1)) ? pts : [...pts, { ...pts[0] }]);
      return;
    }
    const tangent = (a, b) => {
      const d = dist(a, b) || 1;
      return { x: (a.x - b.x) / d, y: (a.y - b.y) / d };
    };
    const id = open.length;
    open.push(pts);
    ends.push({ poly: id, side: "start", p: pts[0], t: tangent(pts[0], pts[1]) });
    ends.push({ poly: id, side: "end", p: pts.at(-1), t: tangent(pts.at(-1), pts.at(-2)) });
  });
  const pairs = [];
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i],
        b = ends[j],
        d = dist(a.p, b.p);
      if (d > MAX_BRIDGE_SPAN_MM) continue;
      const v = d > 1e-9 ? { x: (b.p.x - a.p.x) / d, y: (b.p.y - a.p.y) / d } : { x: 0, y: 0 };
      const c = Math.max(Math.abs(a.t.x * v.x + a.t.y * v.y), Math.abs(b.t.x * v.x + b.t.y * v.y));
      if (c > 0.5 && d > MAX_GAP_MM) continue;
      pairs.push({ i, j, score: d * (1 + 4 * c) });
    }
  pairs.sort((p, q) => p.score - q.score || p.i - q.i || p.j - q.j);
  const partner = new Array(ends.length).fill(-1);
  for (const { i, j } of pairs) {
    if (partner[i] >= 0 || partner[j] >= 0) continue;
    partner[i] = j;
    partner[j] = i;
  }
  const used = new Array(open.length).fill(false);
  const chains = [];
  for (let start = 0; start < open.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    const chain = [...open[start]];
    let closed = false;
    // Forward from this polyline's end, then backward from its start, so an
    // open chain is still merged into one polyline.
    let idx = 2 * start + 1;
    for (;;) {
      const to = partner[idx];
      if (to < 0) break;
      const e = ends[to];
      if (e.poly === start) {
        closed = true;
        break;
      }
      if (used[e.poly]) break;
      used[e.poly] = true;
      chain.push(...(e.side === "start" ? open[e.poly] : [...open[e.poly]].reverse()));
      idx = e.side === "start" ? 2 * e.poly + 1 : 2 * e.poly;
    }
    if (!closed) {
      idx = 2 * start;
      for (;;) {
        const to = partner[idx];
        if (to < 0) break;
        const e = ends[to];
        if (e.poly === start || used[e.poly]) break;
        used[e.poly] = true;
        chain.unshift(...(e.side === "end" ? open[e.poly] : [...open[e.poly]].reverse()));
        idx = e.side === "end" ? 2 * e.poly : 2 * e.poly + 1;
      }
    }
    if (closed && chain.length >= 3) loops.push([...chain, { ...chain[0] }]);
    else chains.push(chain);
  }
  return { loops, open: chains };
}
function dedupe(points) {
  const out = [];
  for (const p of points) if (!out.length || !same(out.at(-1), p)) out.push({ x: p.x, y: p.y });
  return out;
}
function boundsOf(lists) {
  let x = Infinity,
    y = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  for (const ps of lists)
    for (const p of ps) {
      x = Math.min(x, p.x);
      y = Math.min(y, p.y);
      x2 = Math.max(x2, p.x);
      y2 = Math.max(y2, p.y);
    }
  return Number.isFinite(x) ? { x, y, w: x2 - x, h: y2 - y } : null;
}
function insidePolygon(p, c) {
  let inside = false;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1],
      b = c[i];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const pathOf = (lists, close) =>
  lists.map((ps) => `M${ps.map((p) => `${f(p.x)} ${f(p.y)}`).join("L")}${close ? "Z" : ""}`).join("");

// Reads the finished piece out of an SVG: the outline enclosing every other
// cut line when there is one (the rest is scrap), otherwise the whole sheet
// (document size) with the cut lines as holes. Returns null when the physical
// size is unknown or nothing can be cut. Coordinates are mm from the piece's
// top-left corner.
export function bookmarkPiece(svgText) {
  let root;
  try {
    root = parseSVG(svgText);
  } catch {
    return null;
  }
  const size = documentSize(root);
  if (!size.known) return null;
  let shapes;
  try {
    shapes = svgShapes(root).shapes;
  } catch {
    return null;
  }
  const polylines = [];
  for (const shape of shapes)
    for (const sub of shape.path)
      for (const points of pathContours([sub])) if (points.length >= 2) polylines.push({ points, closed: Boolean(sub.closed) });
  if (!polylines.length) return null;
  const { loops, open } = closeCutLoops(polylines);
  const all = [...loops, ...open];
  const box = boundsOf(all);
  if (!box || !(box.w > 0 || box.h > 0)) return null;
  // The enclosing outline: the loop whose polygon contains a point of every
  // other cut line and whose box spans all of them.
  let outer = null;
  for (const loop of loops) {
    const b = boundsOf([loop]);
    if (Math.abs(b.w - box.w) > 1e-6 || Math.abs(b.h - box.h) > 1e-6) continue;
    if (all.every((ps) => ps === loop || insidePolygon(ps[0], loop) || ps.every((p) => onLoop(p, loop)))) {
      outer = loop;
      break;
    }
  }
  const sheet = !outer;
  const origin = sheet ? { x: 0, y: 0 } : { x: box.x, y: box.y };
  const widthMm = sheet ? size.widthMm : box.w;
  const heightMm = sheet ? size.heightMm : box.h;
  const shift = (ps) => ps.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
  const fillLoops = loops.map(shift);
  const fillD = (sheet ? `M0 0H${f(widthMm)}V${f(heightMm)}H0Z` : "") + pathOf(fillLoops, true);
  return {
    widthMm,
    heightMm,
    sheet,
    sheetWidthMm: size.widthMm,
    sheetHeightMm: size.heightMm,
    loopCount: loops.length,
    openCount: open.length,
    fillD,
    lineD: pathOf(open.map(shift), false),
  };
}
function onLoop(p, loop) {
  for (let i = 1; i < loop.length; i++) {
    const a = loop[i - 1],
      b = loop[i],
      l = dist(a, b);
    if (l < 1e-9) continue;
    const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (l * l);
    if (t < -1e-6 || t > 1 + 1e-6) continue;
    const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    if (dist(p, q) < 1e-3) return true;
  }
  return false;
}

// ---- sizes, layout, warnings ---------------------------------------------------

// Displayed orientation. A landscape design is stood upright by default,
// which is how a bookmark goes into a book; callers may override.
export function bookmarkOrientation(piece, rotated = null) {
  const rot = rotated === null || rotated === undefined ? piece.widthMm > piece.heightMm : Boolean(rotated);
  return { rotated: rot, widthMm: rot ? piece.heightMm : piece.widthMm, heightMm: rot ? piece.widthMm : piece.heightMm };
}
export function bookmarkWarnings(widthMm, heightMm, t = BOOKMARK_THRESHOLDS) {
  const out = [];
  if (widthMm > t.maxWidthMm) out.push({ code: "wide", text: `幅 ${widthMm.toFixed(1)} mm は文庫本のしおりとしてはやや幅広です（目安 ${t.maxWidthMm} mm 以下）。` });
  if (heightMm < t.minHeightMm) out.push({ code: "short", text: `長さ ${heightMm.toFixed(1)} mm は短いため、本からほとんど見えない可能性があります（目安 ${t.minHeightMm} mm 以上）。` });
  if (heightMm > t.maxHeightMm) out.push({ code: "long", text: `長さ ${heightMm.toFixed(1)} mm は文庫本より長く、大きくはみ出す可能性があります（目安 ${t.maxHeightMm} mm 以下）。` });
  return out;
}
// How the bookmark sits in the book: `visibleTopMm` above the pages, the rest
// inside, and any length that would poke out of the bottom.
export function bookmarkLayout(widthMm, heightMm, visibleTopMm = VISIBLE_TOP_MM) {
  const visible = Math.min(visibleTopMm, heightMm / 2);
  const inserted = heightMm - visible;
  return {
    widthMm,
    heightMm,
    bookWidthMm: BOOK_WIDTH_MM,
    bookHeightMm: BOOK_HEIGHT_MM,
    visibleTopMm: visible,
    insertedMm: Math.min(inserted, BOOK_HEIGHT_MM),
    bottomOverhangMm: Math.max(0, inserted - BOOK_HEIGHT_MM),
    widthRatio: widthMm / BOOK_WIDTH_MM,
    heightRatio: heightMm / BOOK_HEIGHT_MM,
  };
}

// ---- drawing --------------------------------------------------------------------

let uid = 0;
function defs(id) {
  return `<defs>
<filter id="${id}-grain" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.9 1.3" numOctaves="3" seed="11" result="noise"/>
<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.38  0 0 0 0 0.34  0 0 0 0.22 0" result="fibre"/>
<feComposite in="fibre" in2="SourceGraphic" operator="in" result="clipped"/>
<feBlend in="clipped" in2="SourceGraphic" mode="screen"/>
</filter>
<filter id="${id}-shadow" x="-10%" y="-10%" width="125%" height="125%" color-interpolation-filters="sRGB">
<feDropShadow dx="0.5" dy="0.9" stdDeviation="0.7" flood-color="#000" flood-opacity="0.38"/>
</filter>
<filter id="${id}-softshadow" x="-10%" y="-10%" width="125%" height="125%" color-interpolation-filters="sRGB">
<feDropShadow dx="0.4" dy="0.7" stdDeviation="0.6" flood-color="#000" flood-opacity="0.22"/>
</filter>
</defs>`;
}
// The bookmark as black kraft paper, drawn with its top-left at (x, y).
function paper(piece, orient, id, x, y, { ghost = false } = {}) {
  const t = orient.rotated ? `translate(${f(x + orient.widthMm)} ${f(y)}) rotate(90)` : `translate(${f(x)} ${f(y)})`;
  if (ghost)
    return `<g transform="${t}"><path d="${piece.fillD}" fill="${PAPER.ghost}" fill-opacity="0.16" fill-rule="evenodd" stroke="${PAPER.ghost}" stroke-width="0.35" stroke-dasharray="1.6 1.1" stroke-opacity="0.75" vector-effect="non-scaling-stroke"/></g>`;
  return `<g transform="${t}" filter="url(#${id}-shadow)"><g filter="url(#${id}-grain)"><path d="${piece.fillD}" fill="${PAPER.fill}" fill-rule="evenodd"/></g><path d="${piece.fillD}" fill="none" stroke="${PAPER.edge}" stroke-width="0.22" stroke-opacity="0.55" stroke-linejoin="round"/>${
    piece.lineD ? `<path d="${piece.lineD}" fill="none" stroke="${PAPER.edge}" stroke-width="0.25" stroke-opacity="0.7" stroke-linecap="round"/>` : ""
  }</g>`;
}
// A closed bunko paperback seen from the front: spine on the left, page
// block peeking above the cover so a bookmark visibly comes out of the pages.
function book(x, y, { label = "文庫本", pagesTop = 2.2, dim = false } = {}) {
  const w = BOOK_WIDTH_MM,
    h = BOOK_HEIGHT_MM;
  const o = dim ? 0.55 : 1;
  return `<g opacity="${o}">
<rect x="${f(x + 1.2)}" y="${f(y - pagesTop)}" width="${f(w - 1.6)}" height="${f(h + pagesTop)}" rx="0.6" fill="${BOOK.pages}" stroke="${BOOK.edge}" stroke-width="0.25"/>
<path d="${Array.from({ length: 8 }, (_, i) => `M${f(x + 2.4)} ${f(y - pagesTop + 0.35 + (i * (pagesTop - 0.7)) / 7)}H${f(x + w - 1.8)}`).join("")}" stroke="${BOOK.edge}" stroke-width="0.12" stroke-opacity="0.6"/>
<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="1.4" fill="${BOOK.cover}" stroke="${BOOK.edge}" stroke-width="0.3"/>
<rect x="${f(x)}" y="${f(y)}" width="7" height="${f(h)}" rx="1.4" fill="${BOOK.spine}"/>
<rect x="${f(x + 5.6)}" y="${f(y)}" width="1.4" height="${f(h)}" fill="${BOOK.spine}"/>
<rect x="${f(x + 18)}" y="${f(y + 22)}" width="${f(w - 30)}" height="9" rx="1" fill="#fff" fill-opacity="0.45"/>
<rect x="${f(x + 18)}" y="${f(y + 36)}" width="${f(w - 46)}" height="3.2" rx="0.8" fill="${BOOK.text}" fill-opacity="0.35"/>
<rect x="${f(x + 7)}" y="${f(y + h - 24)}" width="${f(w - 7)}" height="24" rx="0.8" fill="#fff" fill-opacity="0.5"/>
<text x="${f(x + 18)}" y="${f(y + 29)}" font-size="5" font-weight="700" fill="${BOOK.text}" font-family="'Hiragino Sans','Yu Gothic',sans-serif" letter-spacing="0.4">${esc(label)}</text>
<text x="${f(x + 12)}" y="${f(y + h - 9)}" font-size="4" fill="${BOOK.text}" fill-opacity="0.85" font-family="'Hiragino Sans','Yu Gothic',sans-serif">${f(w)} × ${f(h)} mm</text>
</g>`;
}
// Dimension line with end ticks and a label. `side` is "h" (horizontal,
// label below) or "v" (vertical, label to the right).
function dimension(side, a, b, at, label, fontMm) {
  const tick = fontMm * 0.5;
  if (side === "h")
    return `<g fill="${INK}" stroke="${INK}" stroke-width="0.2"><path d="M${f(a)} ${f(at)}H${f(b)}M${f(a)} ${f(at - tick)}V${f(at + tick)}M${f(b)} ${f(at - tick)}V${f(at + tick)}"/><text x="${f((a + b) / 2)}" y="${f(at + fontMm * 1.25)}" font-size="${f(fontMm)}" text-anchor="middle" stroke="none" font-family="Inter,system-ui,sans-serif" font-variant-numeric="tabular-nums">${esc(label)}</text></g>`;
  return `<g fill="${INK}" stroke="${INK}" stroke-width="0.2"><path d="M${f(at)} ${f(a)}V${f(b)}M${f(at - tick)} ${f(a)}H${f(at + tick)}M${f(at - tick)} ${f(b)}H${f(at + tick)}"/><text x="${f(at + fontMm * 0.6)}" y="${f((a + b) / 2)}" font-size="${f(fontMm)}" dominant-baseline="middle" stroke="none" font-family="Inter,system-ui,sans-serif" font-variant-numeric="tabular-nums">${esc(label)}</text></g>`;
}
const mm = (v) => `${Number(v).toFixed(1)} mm`;
function svgOpen(w, h, title, id) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="100%" role="img" aria-label="${esc(title)}" data-scene="${id}"><title>${esc(title)}</title>${defs(id)}`;
}
function fontFor(sceneMm) {
  return Math.min(6, Math.max(3.2, sceneMm / 34));
}

// 単体: the piece alone on a light surface with its width and height.
export function renderSingle(piece, options = {}) {
  const o = bookmarkOrientation(piece, options.rotated);
  const id = `bm${++uid}`;
  const font = fontFor(Math.max(o.widthMm, o.heightMm, 60));
  const pad = font * 3.2;
  const W = o.widthMm + pad + font * 8.5,
    H = o.heightMm + pad * 2;
  const x = pad,
    y = pad;
  return `${svgOpen(W, H, `しおり単体のプレビュー ${mm(o.widthMm)} × ${mm(o.heightMm)}`, id)}
<rect width="${f(W)}" height="${f(H)}" fill="#f2eee7"/>
${paper(piece, o, id, x, y)}
${dimension("h", x, x + o.widthMm, y + o.heightMm + font * 1.4, mm(o.widthMm), font)}
${dimension("v", y, y + o.heightMm, x + o.widthMm + font * 1.4, mm(o.heightMm), font)}
</svg>`;
}

// 本に挟む: the piece tucked into the paperback, the top showing above the
// pages, the hidden part drawn as a dashed ghost through the cover.
export function renderInBook(piece, options = {}) {
  const o = bookmarkOrientation(piece, options.rotated);
  const lay = bookmarkLayout(o.widthMm, o.heightMm, options.visibleTopMm ?? VISIBLE_TOP_MM);
  const id = `bm${++uid}`;
  const font = fontFor(BOOK_HEIGHT_MM + lay.visibleTopMm);
  const pad = font * 2.2;
  const bookX = pad + Math.max(0, (o.widthMm - BOOK_WIDTH_MM) / 2),
    bookY = pad + lay.visibleTopMm + 3;
  const bmX = bookX + (BOOK_WIDTH_MM - o.widthMm) / 2 + 6;
  const bmY = bookY - lay.visibleTopMm;
  const W = bookX + Math.max(BOOK_WIDTH_MM, bmX - bookX + o.widthMm) + font * 9.5,
    H = bookY + BOOK_HEIGHT_MM + Math.max(lay.bottomOverhangMm, 0) + pad;
  const pagesTop = 2.2;
  const above = `${id}-above`,
    below = `${id}-below`;
  return `${svgOpen(W, H, `文庫本に挟んだしおりのプレビュー（本 ${mm(BOOK_WIDTH_MM)} × ${mm(BOOK_HEIGHT_MM)}、しおり ${mm(o.widthMm)} × ${mm(o.heightMm)}、上部 ${mm(lay.visibleTopMm)}）`, id)}
<clipPath id="${above}"><rect x="-1000" y="-1000" width="3000" height="${f(1000 + bookY - pagesTop + 0.3)}"/></clipPath>
<clipPath id="${below}"><rect x="-1000" y="${f(bookY + BOOK_HEIGHT_MM - 0.3)}" width="3000" height="2000"/></clipPath>
<rect width="${f(W)}" height="${f(H)}" fill="#f2eee7"/>
${book(bookX, bookY, { pagesTop })}
${paper(piece, o, id, bmX, bmY, { ghost: true })}
<g clip-path="url(#${above})">${paper(piece, o, id, bmX, bmY)}</g>
${lay.bottomOverhangMm > 0 ? `<g clip-path="url(#${below})">${paper(piece, o, id, bmX, bmY)}</g>` : ""}
${dimension("v", bmY, bookY - pagesTop, bmX + o.widthMm + font * 1.2, `上部 ${mm(lay.visibleTopMm)}`, font)}
${lay.bottomOverhangMm > 0 ? dimension("v", bookY + BOOK_HEIGHT_MM, bmY + o.heightMm, bmX + o.widthMm + font * 1.2, `はみ出し ${mm(lay.bottomOverhangMm)}`, font) : ""}
</svg>`;
}

// サイズ比較: the references and the piece side by side at one scale,
// bottoms aligned, each with its width and height.
export function renderComparison(piece, options = {}) {
  const o = bookmarkOrientation(piece, options.rotated);
  const refs = options.references ?? COMPARISON_REFERENCES;
  const id = `bm${++uid}`;
  const tallest = Math.max(o.heightMm, ...refs.map((r) => r.heightMm));
  const font = fontFor(tallest);
  const gap = font * 8.5,
    pad = font * 2.5;
  const items = [...refs.map((r) => ({ ...r })), { id: "bookmark", label: "しおり", widthMm: o.widthMm, heightMm: o.heightMm, draw: "paper" }];
  let x = pad;
  const baseline = pad + tallest;
  const parts = [];
  for (const it of items) {
    const y = baseline - it.heightMm;
    if (it.draw === "book") parts.push(book(x, y, { label: it.label, pagesTop: 0, dim: true }));
    else if (it.draw === "paper") parts.push(paper(piece, o, id, x, y));
    else parts.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(it.widthMm)}" height="${f(it.heightMm)}" fill="#e6e0d4" stroke="${BOOK.edge}" stroke-width="0.3"/>`);
    parts.push(`<text x="${f(x + it.widthMm / 2)}" y="${f(y - font * 0.8)}" font-size="${f(font)}" text-anchor="middle" fill="${INK}" font-family="Inter,'Hiragino Sans','Yu Gothic',sans-serif">${esc(it.label)}</text>`);
    parts.push(dimension("h", x, x + it.widthMm, baseline + font * 1.4, mm(it.widthMm), font));
    parts.push(dimension("v", y, baseline, x + it.widthMm + font * 1.2, mm(it.heightMm), font));
    x += it.widthMm + gap;
  }
  const W = x - gap + font * 8.5,
    H = baseline + pad + font * 2;
  return `${svgOpen(W, H, `サイズ比較 ${items.map((i) => `${i.label} ${mm(i.widthMm)} × ${mm(i.heightMm)}`).join("、")}`, id)}
<rect width="${f(W)}" height="${f(H)}" fill="#f2eee7"/>
<path d="M${f(pad - font)} ${f(baseline)}H${f(W - pad)}" stroke="${BOOK.edge}" stroke-width="0.3" stroke-dasharray="2 1.5"/>
${parts.join("\n")}
</svg>`;
}
