import ClipperLib from "clipper-lib";
import {
  bounds,
  transform,
  worldContours,
  crossesContour,
} from "./geometry.js";
const SCALE = 10000;
const isClosed = (c) =>
  c.length > 3 && Math.hypot(c[0].x - c.at(-1).x, c[0].y - c.at(-1).y) < 1e-7;
const shift = (contours, d) =>
  contours.map((c) => c.map((p) => ({ x: p.x - d.x, y: p.y - d.y })));
// One editable text item per glyph cluster from layoutGlyphs. Each keeps the
// owner's settings and rotation, and its glyph stays exactly where it was.
export function splitCharacters(item, glyphs) {
  const { id, ...rest } = item;
  return glyphs
    .filter((g) => g.contours.length)
    .map((g) => ({
      ...rest,
      ...transform(g.origin, item),
      text: g.text,
      name: g.text,
      contours: shift(g.contours, g.origin),
    }));
}
// Each connected filled region (an outer contour with its holes) becomes a
// fixed outline. Islands inside a hole, such as the centre of 回, are parts too.
export function splitParts(item) {
  const { id, text, font, size, spacing, vertical, ...rest } = item,
    closed = item.contours.filter(isClosed);
  const groups = [
    ...(closed.length ? filledRegions(closed) : []),
    ...item.contours.filter((c) => !isClosed(c)).map((c) => [c]),
  ];
  return groups
    .filter((g) => g.length)
    .map((contours) => ({ box: bounds(contours), contours }))
    .sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y)
    .map(({ box, contours }, n) => ({
      ...rest,
      type: "outline",
      name: `${item.name}・部位${n + 1}`,
      ...transform(box, item),
      contours: shift(contours, box),
    }));
}
// Nonzero union of closed contours, grouped as [outer, ...holes] per region.
function filledRegions(contours) {
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(
    contours.map((c) =>
      c.slice(0, -1).map((p) => ({
        X: Math.round(p.x * SCALE),
        Y: Math.round(p.y * SCALE),
      })),
    ),
    ClipperLib.PolyType.ptSubject,
    true,
  );
  const tree = new ClipperLib.PolyTree();
  if (
    !clipper.Execute(
      ClipperLib.ClipType.ctUnion,
      tree,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero,
    )
  )
    throw Error("部位の分解に失敗しました。");
  const decode = (path) => {
    const ps = path.map((p) => ({ x: p.X / SCALE, y: p.Y / SCALE }));
    return [...ps, { ...ps[0] }];
  };
  const groups = [];
  const walk = (node) => {
    for (const outer of node.Childs()) {
      groups.push(
        [outer.Contour(), ...outer.Childs().map((hole) => hole.Contour())]
          .filter((c) => c.length >= 3)
          .map(decode),
      );
      for (const hole of outer.Childs()) walk(hole);
    }
  };
  walk(tree);
  return groups;
}
// A bridge scoped to a split item keeps acting on every piece it crosses, so
// the cut geometry is unchanged: it is retargeted to the first such piece and
// copied for the others. A bridge crossing none goes to the nearest piece.
// Returns the copies, which the caller adds to the project.
export function reassignBridges(items, ownerId, pieces, makeId) {
  const candidates = pieces.map((piece) => {
    const contours = worldContours(piece);
    return { piece, contours, box: bounds(contours) };
  });
  const copies = [];
  for (const bridge of items.filter(
    (i) => i.type === "bridge" && i.targetId === ownerId,
  )) {
    const gap = ({ box }) =>
      Math.hypot(
        Math.max(box.x - bridge.x, 0, bridge.x - box.x - box.w),
        Math.max(box.y - bridge.y, 0, bridge.y - box.y - box.h),
      );
    let owners = candidates.filter((c) =>
      c.contours.some((points) => crossesContour(points, bridge)),
    );
    if (!owners.length)
      owners = [candidates.reduce((a, b) => (gap(b) < gap(a) ? b : a))];
    owners.forEach(({ piece }, n) => {
      const target = n ? { ...bridge, id: makeId() } : bridge;
      target.targetId = piece.id;
      target.layerId = piece.layerId;
      if (n) copies.push(target);
    });
  }
  return copies;
}
