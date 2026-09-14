// Stacking order changes happen inside each layer: items of other layers and
// unselected bridges (always drawn above shapes) keep their slots.
export function arrangeItems(items, ids, mode) {
  const selected = new Set(ids),
    result = [...items];
  for (const layerId of new Set(items.map((i) => i.layerId))) {
    const slots = [];
    items.forEach((item, index) => {
      if (
        item.layerId === layerId &&
        (item.type !== "bridge" || selected.has(item.id))
      )
        slots.push(index);
    });
    const seq = slots.map((n) => items[n]),
      isSelected = (item) => selected.has(item.id);
    let order = [...seq];
    if (mode === "front")
      order = [...seq.filter((i) => !isSelected(i)), ...seq.filter(isSelected)];
    else if (mode === "back")
      order = [...seq.filter(isSelected), ...seq.filter((i) => !isSelected(i))];
    else if (mode === "forward") {
      for (let n = order.length - 2; n >= 0; n--)
        if (isSelected(order[n]) && !isSelected(order[n + 1]))
          [order[n], order[n + 1]] = [order[n + 1], order[n]];
    } else if (mode === "backward") {
      for (let n = 1; n < order.length; n++)
        if (isSelected(order[n]) && !isSelected(order[n - 1]))
          [order[n], order[n - 1]] = [order[n - 1], order[n]];
    } else throw Error("不明な並べ替えです。");
    slots.forEach((slot, n) => (result[slot] = order[n]));
  }
  return result;
}
// Copies the items with their scoped bridges under new ids. Bridge owners and
// groups are remapped, so copies form their own groups. Returns the copies in
// stacking order and the new ids of the requested items.
export function cloneItems(items, ids, makeId, offset = 5, layerId = null) {
  const originals = items.filter(
      (i) => ids.includes(i.id) || ids.includes(i.targetId),
    ),
    mapping = new Map(originals.map((i) => [i.id, makeId()])),
    groups = new Map();
  const copies = originals.map((i) => {
    const copy = structuredClone(i);
    copy.id = mapping.get(i.id);
    copy.x += offset;
    copy.y += offset;
    if (mapping.has(i.targetId)) copy.targetId = mapping.get(i.targetId);
    if (i.groupId) {
      if (!groups.has(i.groupId)) groups.set(i.groupId, makeId());
      copy.groupId = groups.get(i.groupId);
    }
    if (layerId) copy.layerId = layerId;
    return copy;
  });
  return {
    copies,
    ids: originals
      .filter((i) => ids.includes(i.id))
      .map((i) => mapping.get(i.id)),
  };
}
