import * as hb from "harfbuzzjs";
import { flatten } from "./geometry.js";
export function makeShapingFont(bytes) {
  const blob = new hb.Blob(bytes),
    face = new hb.Face(blob),
    font = new hb.Font(face);
  return { blob, face, font };
}
export function verticalGlyphs(shaping, text) {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.setDirection(hb.Direction.TTB);
  buffer.setScript("Hani");
  buffer.setLanguage("ja");
  hb.shape(shaping.font, buffer, [
    new hb.Feature("vert", 1),
    new hb.Feature("vrt2", 1),
  ]);
  const info = buffer.getGlyphInfos(),
    positions = buffer.getGlyphPositions();
  return info.map((i, n) => ({
    id: i.codepoint,
    cluster: i.cluster,
    ...positions[n],
  }));
}
export function layoutText(item, font, shaping) {
  if (!font) throw Error("この文字のフォントを追加し、選び直してください。");
  const missing = [
    ...new Set(
      [...item.text].filter((c) => !/[\s]/u.test(c) && !font.hasChar(c)),
    ),
  ];
  if (missing.length)
    throw Error(`このフォントにない文字: ${missing.join(" ")}`);
  const all = [];
  const size = item.size;
  if (item.vertical) {
    if (!shaping) throw Error("縦書きエンジンの読み込みが完了していません。");
    const scale = size / font.unitsPerEm;
    item.text.split("\n").forEach((line, column) => {
      let x = size / 2 - column * size * 1.3,
        y = 0;
      for (const g of verticalGlyphs(shaping, line)) {
        const glyph = font.glyphs.get(g.id);
        all.push(
          ...flatten(
            glyph.getPath(x + g.xOffset * scale, y - g.yOffset * scale, size)
              .commands,
          ),
        );
        x += g.xAdvance * scale;
        y -= g.yAdvance * scale;
        y += item.spacing;
      }
    });
  } else {
    let x = 0,
      y = size;
    for (const char of item.text) {
      if (char === "\n") {
        x = 0;
        y += size * 1.4;
        continue;
      }
      const glyph = font.charToGlyph(char);
      all.push(...flatten(glyph.getPath(x, y, size).commands));
      x +=
        ((glyph.advanceWidth || font.unitsPerEm) / font.unitsPerEm) * size +
        item.spacing;
    }
  }
  return all;
}
// Preserve every original OpenType table when unpacking WOFF, including vert/vrt2 and vmtx.
export async function fontSFNT(bytes) {
  const input = new DataView(bytes);
  if (input.getUint32(0) !== 0x774f4646) return bytes;
  const count = input.getUint16(12),
    size = input.getUint32(16);
  if (count < 1 || count > 4096 || size > 64 * 1024 * 1024)
    throw Error("WOFFフォントのサイズが不正です。");
  const out = new ArrayBuffer(size),
    view = new DataView(out),
    dest = new Uint8Array(out);
  view.setUint32(0, input.getUint32(4));
  view.setUint16(4, count);
  const power = Math.floor(Math.log2(count));
  view.setUint16(6, 16 * 2 ** power);
  view.setUint16(8, power);
  view.setUint16(10, count * 16 - 16 * 2 ** power);
  let offset = 12 + 16 * count;
  for (let i = 0; i < count; i++) {
    const from = 44 + i * 20,
      to = 12 + i * 16,
      src = input.getUint32(from + 4),
      compressed = input.getUint32(from + 8),
      length = input.getUint32(from + 12);
    if (
      src + compressed > bytes.byteLength ||
      offset + length > size ||
      compressed > length
    )
      throw Error("WOFFテーブルが不正です。");
    const part = bytes.slice(src, src + compressed);
    const data =
      compressed === length
        ? part
        : await new Response(
            new Blob([part])
              .stream()
              .pipeThrough(new DecompressionStream("deflate")),
          ).arrayBuffer();
    if (data.byteLength !== length) throw Error("WOFF展開に失敗しました。");
    view.setUint32(to, input.getUint32(from));
    view.setUint32(to + 4, input.getUint32(from + 16));
    view.setUint32(to + 8, offset);
    view.setUint32(to + 12, length);
    dest.set(new Uint8Array(data), offset);
    offset += Math.ceil(length / 4) * 4;
  }
  return out;
}
