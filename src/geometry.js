import { visibleItems } from "./layers.js";
// All geometry uses millimetres. Curves are adaptively flattened to 0.02 mm.
export const TOLERANCE = 0.02;
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-7;
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
function distance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l = dx * dx + dy * dy;
  const t = l
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l))
    : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function cubic(a, b, c, d, out, depth = 0) {
  if (
    depth >= 18 ||
    Math.max(distance(b, a, d), distance(c, a, d)) <= TOLERANCE
  ) {
    out.push(d);
    return;
  }
  const ab = mid(a, b),
    bc = mid(b, c),
    cd = mid(c, d),
    abc = mid(ab, bc),
    bcd = mid(bc, cd),
    m = mid(abc, bcd);
  cubic(a, ab, abc, m, out, depth + 1);
  cubic(m, bcd, cd, d, out, depth + 1);
}
export function flatten(commands) {
  const contours = [];
  let pts = [],
    p = { x: 0, y: 0 };
  const finish = () => {
    if (pts.length > 1) contours.push(pts);
    pts = [];
  };
  for (const cmd of commands) {
    const q = { x: cmd.x, y: cmd.y };
    if (cmd.type === "M") {
      finish();
      pts = [q];
      p = q;
    } else if (cmd.type === "L") {
      pts.push(q);
      p = q;
    } else if (cmd.type === "C") {
      cubic(p, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, q, pts);
      p = q;
    } else if (cmd.type === "Q") {
      cubic(
        p,
        {
          x: p.x + (2 / 3) * (cmd.x1 - p.x),
          y: p.y + (2 / 3) * (cmd.y1 - p.y),
        },
        {
          x: q.x + (2 / 3) * (cmd.x1 - q.x),
          y: q.y + (2 / 3) * (cmd.y1 - q.y),
        },
        q,
        pts,
      );
      p = q;
    } else if (cmd.type === "Z") {
      if (pts.length && !same(pts[0], p)) pts.push({ ...pts[0] });
      finish();
    }
  }
  finish();
  return contours;
}
export function transform(p, item, inverse = false) {
  const r = (((item.rotation || 0) * Math.PI) / 180) * (inverse ? -1 : 1),
    c = Math.cos(r),
    s = Math.sin(r);
  const x = inverse ? p.x - item.x : p.x,
    y = inverse ? p.y - item.y : p.y;
  return {
    x: x * c - y * s + (inverse ? 0 : item.x),
    y: x * s + y * c + (inverse ? 0 : item.y),
  };
}
export function worldContours(item) {
  return item.contours.map((ps) => ps.map((p) => transform(p, item)));
}
// Liang–Barsky clipping against each bridge. Keep only the outside intervals.
export function clipSegment(a, b, bridge) {
  const p = transform(a, bridge, true),
    q = transform(b, bridge, true),
    dx = q.x - p.x,
    dy = q.y - p.y;
  let lo = 0,
    hi = 1;
  for (const [v, w] of [
    [-dx, p.x + bridge.w / 2],
    [dx, bridge.w / 2 - p.x],
    [-dy, p.y + bridge.h / 2],
    [dy, bridge.h / 2 - p.y],
  ]) {
    if (Math.abs(v) < 1e-12) {
      if (w < 0) return [[a, b]];
      continue;
    }
    const t = w / v;
    if (v < 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (lo > hi) return [[a, b]];
  }
  const at = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const parts = [];
  if (lo > 1e-9) parts.push([a, at(lo)]);
  if (hi < 1 - 1e-9) parts.push([at(hi), b]);
  return parts;
}
export function cutContour(points, bridges) {
  const runs = [];
  let run = [];
  for (let i = 1; i < points.length; i++) {
    let segments = [[points[i - 1], points[i]]];
    for (const b of bridges)
      segments = segments.flatMap(([a, c]) => clipSegment(a, c, b));
    for (const [a, b] of segments) {
      if (same(a, b)) continue;
      if (run.length && same(run.at(-1), a)) run.push(b);
      else {
        if (run.length) runs.push(run);
        run = [a, b];
      }
    }
  }
  if (run.length) runs.push(run);
  if (runs.length > 1 && same(runs.at(-1).at(-1), runs[0][0])) {
    runs[0] = [...runs.pop(), ...runs[0].slice(1)];
  }
  return runs;
}
export function cutGeometry(items) {
  const bridges = items.filter((i) => i.type === "bridge");
  let closed = 0,
    untouched = 0,
    removed = 0,
    vanished = 0;
  const paths = [];
  for (const item of items.filter((i) => i.type !== "bridge")) {
    for (const contour of worldContours(item)) {
      const runs = cutContour(
        contour,
        bridges.filter((b) => !b.targetId || b.targetId === item.id),
      );
      if (!runs.length) vanished++;
      const length = (ps) =>
        ps
          .slice(1)
          .reduce((n, p, i) => n + Math.hypot(p.x - ps[i].x, p.y - ps[i].y), 0);
      const delta = length(contour) - runs.reduce((n, r) => n + length(r), 0);
      removed += delta;
      if (same(contour[0], contour.at(-1))) {
        closed++;
        if (delta < 1e-6) untouched++;
      }
      paths.push(...runs);
    }
  }
  return { paths, closed, untouched, removed, vanished };
}
const num = (n) => Number(n.toFixed(4));
export function pathData(paths) {
  return paths
    .map(
      (ps) =>
        ps.map((p, i) => `${i ? "L" : "M"}${num(p.x)} ${num(p.y)}`).join(" ") +
        (same(ps[0], ps.at(-1)) ? " Z" : ""),
    )
    .join(" ");
}
export function exportSVG(project) {
  const visible = visibleItems(project),
    result = cutGeometry(visible);
  if (!result.paths.length) throw new Error("出力できるカット線がありません。");
  const xml = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    );
  const path = (paths) =>
    `<path d="${pathData(paths)}" fill="none" stroke="#ff0000" stroke-width="0.1" stroke-linecap="butt"/>`;
  const bridges = visible.filter((i) => i.type === "bridge");
  const body = project.layers
    ? project.layers
        .filter((l) => l.visible)
        .map((layer) => {
          const cut = cutGeometry([
            ...visible.filter(
              (i) => i.type !== "bridge" && i.layerId === layer.id,
            ),
            ...bridges,
          ]);
          return cut.paths.length
            ? `<g id="layer-${xml(layer.id)}" inkscape:groupmode="layer" inkscape:label="${xml(layer.name)}">${path(cut.paths)}</g>`
            : "";
        })
        .join("\n")
    : path(result.paths);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${num(project.width)}mm" height="${num(project.height)}mm" viewBox="0 0 ${num(project.width)} ${num(project.height)}">\n<title>TypeFab laser cut paths</title>\n<desc>Units: mm. Flattening tolerance: 0.02 mm. Bridges are gaps in cut paths.</desc>\n${body}\n</svg>\n`;
}
export function shapeContours(type, w, h) {
  if (type === "line")
    return [
      [
        { x: 0, y: 0 },
        { x: w, y: h },
      ],
    ];
  if (type === "circle") {
    const n =
      4 *
      Math.ceil(
        Math.max(
          32,
          Math.ceil(
            Math.PI /
              Math.acos(Math.max(-1, 1 - TOLERANCE / (Math.max(w, h) / 2))),
          ),
        ) / 4,
      );
    const pts = Array.from({ length: n }, (_, i) => ({
      x: w / 2 + (w / 2) * Math.cos((i * 2 * Math.PI) / n),
      y: h / 2 + (h / 2) * Math.sin((i * 2 * Math.PI) / n),
    }));
    return [[...pts, { ...pts[0] }]];
  }
  return [
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
      { x: 0, y: 0 },
    ],
  ];
}
export function bounds(contours) {
  const ps = contours.flat();
  if (!ps.length) return { x: 0, y: 0, w: 1, h: 1 };
  let x = Infinity,
    y = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  for (const p of ps) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    x2 = Math.max(x2, p.x);
    y2 = Math.max(y2, p.y);
  }
  return { x, y, w: x2 - x, h: y2 - y };
}
export function automaticBridges(items, width = 1.5, targetIds = null) {
  const existing = items.filter((i) => i.type === "bridge"),
    added = [];
  for (const item of items.filter(
    (i) => i.type !== "bridge" && (!targetIds || targetIds.includes(i.id)),
  ))
    for (const ps of worldContours(item)) {
      if (!same(ps[0], ps.at(-1))) continue;
      const runs = cutContour(
        ps,
        [...existing, ...added].filter(
          (b) => !b.targetId || b.targetId === item.id,
        ),
      );
      if (runs.length !== 1 || !same(runs[0][0], runs[0].at(-1))) continue;
      // Place a square holding tab at the midpoint of the longest segment.
      let longest = -1,
        index = 1;
      for (let i = 1; i < ps.length; i++) {
        const d = Math.hypot(ps[i].x - ps[i - 1].x, ps[i].y - ps[i - 1].y);
        if (d > longest) {
          longest = d;
          index = i;
        }
      }
      const p = mid(ps[index - 1], ps[index]);
      added.push({
        targetId: item.id,
        layerId: item.layerId,
        type: "bridge",
        x: p.x,
        y: p.y,
        w: width,
        h: width,
        rotation: 0,
        name: "自動ブリッジ",
      });
    }
  return added;
}
