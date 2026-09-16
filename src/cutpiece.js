// The finished piece of a cut file, shared by the order page (mock-ups and
// the envelope check) and the Worker (authoritative check). Pure geometry on
// millimetre polylines; nothing here touches the DOM.
import { pathContours } from "./path.js";

const same = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Cut lines interrupted by bridges: a gap this wide or narrower is closed along
// the contour; a bridge's side (the short segment across the stroke between the
// outer and inner gap) is joined when it scores better than closing the gap.
export const MAX_GAP_MM = 6;
export const MAX_BRIDGE_SPAN_MM = 10;

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


// Polylines (mm) of every cut shape returned by svgShapes().
export function cutPolylines(shapes) {
  const polylines = [];
  for (const shape of shapes)
    for (const sub of shape.path)
      for (const points of pathContours([sub])) if (points.length >= 2) polylines.push({ points, closed: Boolean(sub.closed) });
  return polylines;
}

// What comes off the laser: the outline enclosing every other cut line when
// there is one (the rest is scrap), otherwise the whole sheet (document size)
// with the cut lines as holes. `size` is the document size in mm. Returns
// null when nothing can be cut. Coordinates are mm in document space; the
// piece's own origin is `box` (or 0,0 for the sheet).
export function cutPiece(shapes, size) {
  const polylines = cutPolylines(shapes);
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
  return {
    widthMm: sheet ? size.widthMm : box.w,
    heightMm: sheet ? size.heightMm : box.h,
    sheet,
    box: sheet ? { x: 0, y: 0, w: size.widthMm, h: size.heightMm } : box,
    cutBox: box,
    loops,
    open,
    outer,
  };
}
export { boundsOf, insidePolygon, dist as pointDistance };
