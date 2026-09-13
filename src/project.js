import { ensureLayers } from "./layers.js";
export function validateProject(p) {
  if (
    !p ||
    ![1, 2].includes(p.version) ||
    !Number.isFinite(p.width) ||
    !Number.isFinite(p.height) ||
    p.width < 10 ||
    p.height < 10 ||
    p.width > 2000 ||
    p.height > 2000 ||
    !Array.isArray(p.items) ||
    p.items.length > 2000
  )
    throw Error("TypeFabプロジェクト形式またはサイズが不正です。");
  const layerIds = new Set();
  if (p.version === 2) {
    if (!Array.isArray(p.layers) || !p.layers.length || p.layers.length > 100)
      throw Error("レイヤー形式が不正です。");
    for (const l of p.layers) {
      if (
        !l ||
        typeof l.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(l.id) ||
        layerIds.has(l.id) ||
        typeof l.name !== "string" ||
        l.name.length > 100 ||
        typeof l.visible !== "boolean" ||
        typeof l.locked !== "boolean"
      )
        throw Error("レイヤー設定が不正です。");
      layerIds.add(l.id);
    }
  }
  const ids = new Set();
  let points = 0;
  for (const i of p.items) {
    if (
      !["text", "outline", "rect", "circle", "line", "bridge"].includes(
        i.type,
      ) ||
      typeof i.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(i.id) ||
      ids.has(i.id)
    )
      throw Error("オブジェクト形式が不正です。");
    ids.add(i.id);
    if (p.version === 2 && !layerIds.has(i.layerId))
      throw Error("所属レイヤーがありません。");
    if (i.ratioLocked !== undefined && typeof i.ratioLocked !== "boolean")
      throw Error("比率ロックが不正です。");
    for (const key of ["x", "y", "rotation"])
      if (!Number.isFinite(i[key]) || Math.abs(i[key]) > 10000)
        throw Error("座標が不正です。");
    if (i.type === "bridge" || ["rect", "circle", "line"].includes(i.type))
      for (const key of ["w", "h"])
        if (
          !Number.isFinite(i[key]) ||
          i[key] < 0 ||
          i[key] > 2000 ||
          (i.type !== "line" && i[key] === 0)
        )
          throw Error("寸法が不正です。");
    if (
      i.type === "text" &&
      (typeof i.text !== "string" ||
        i.text.length > 500 ||
        typeof i.font !== "string" ||
        !Number.isFinite(i.size) ||
        i.size < 1 ||
        i.size > 300 ||
        !Number.isFinite(i.spacing) ||
        Math.abs(i.spacing) > 100)
    )
      throw Error("文字設定が不正です。");
    if (i.type !== "bridge") {
      if (!Array.isArray(i.contours)) throw Error("輪郭がありません。");
      for (const c of i.contours) {
        if (!Array.isArray(c) || c.length < 2) throw Error("輪郭が不正です。");
        points += c.length;
        if (points > 300000) throw Error("輪郭データが大きすぎます。");
        for (const q of c)
          if (
            !q ||
            !Number.isFinite(q.x) ||
            !Number.isFinite(q.y) ||
            Math.abs(q.x) > 10000 ||
            Math.abs(q.y) > 10000
          )
            throw Error("輪郭の座標が不正です。");
      }
    }
  }
  for (const i of p.items)
    if (
      i.targetId !== undefined &&
      (i.type !== "bridge" ||
        typeof i.targetId !== "string" ||
        !p.items.some(
          (owner) => owner.id === i.targetId && owner.type !== "bridge",
        ))
    )
      throw Error("ブリッジの対象が不正です。");
  return ensureLayers({
    version: 2,
    layers: p.layers,
    name: typeof p.name === "string" ? p.name.slice(0, 100) : "無題",
    width: p.width,
    height: p.height,
    items: p.items,
  });
}
