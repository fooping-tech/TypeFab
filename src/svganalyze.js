// SVG analysis for laser-cut orders (issue #1): physical size, cut paths,
// cut length, open/closed paths, duplicate lines, unsupported content and
// security findings. Works in browsers (DOMParser) and in Node/Workers (the
// plain XML reader from svgimport.js). Sizes are in millimetres.
import { svgShapes, parseXML, fromDOM, lengthMM } from "./svgimport.js";
import { pathContours } from "./path.js";

const PHYSICAL_UNITS = /^\s*[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?\s*(mm|cm|in|pt|pc|q)\s*$/i;
const NUMBER = /^\s*[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?\s*(px)?\s*$/i;
const ACTIVE_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
  "video",
  "audio",
  "animate",
  "set",
  "animatetransform",
  "animatemotion",
  "handler",
  "listener",
]);
const HREF_ATTRS = ["href", "xlink:href", "src", "data"];
const EXTERNAL = /^\s*(https?:|ftp:|file:|\/\/)/i;
const JS_URL = /^\s*(javascript|vbscript|data:text\/html)/i;

// Parses SVG text into the plain node tree { name, attrs, children }.
export function parseSVG(text) {
  if (typeof DOMParser === "function") {
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    if (
      doc.getElementsByTagName("parsererror").length ||
      doc.documentElement?.localName !== "svg"
    )
      throw Error("SVGとして読み込めません。XMLの形式を確認してください。");
    return fromDOM(doc.documentElement);
  }
  if (!/<svg[\s>]/i.test(text)) throw Error("SVGファイルではありません。");
  // The lightweight reader is tolerant; reject clearly unbalanced documents.
  const opens = (text.match(/<svg[\s>]/gi) || []).length,
    closes = (text.match(/<\/svg\s*>/gi) || []).length;
  if (opens !== closes) throw Error("SVGとして読み込めません。XMLの形式を確認してください。");
  return parseXML(text);
}

// Physical size of the document. `known` is true only when width and height
// carry physical units (mm, cm, in, pt, pc, q). Otherwise `suggested*` holds
// a best guess (viewBox units as mm, or px at 96 dpi) for the user to confirm.
export function documentSize(root) {
  const a = root.attrs,
    vb = String(a.viewBox ?? "").trim().split(/[\s,]+/).map(Number),
    viewBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0 ? vb : null;
  const physical = (v) => (v !== undefined && PHYSICAL_UNITS.test(v) ? lengthMM(v) : null);
  const pixel = (v) => (v !== undefined && NUMBER.test(v) ? lengthMM(v) : null);
  const w = physical(a.width),
    h = physical(a.height);
  if (w > 0 && h > 0) return { known: true, widthMm: w, heightMm: h, viewBox, source: "physical" };
  if ((w > 0 || h > 0) && viewBox) {
    const width = w ?? (h * viewBox[2]) / viewBox[3],
      height = h ?? (w * viewBox[3]) / viewBox[2];
    return { known: true, widthMm: width, heightMm: height, viewBox, source: "physical" };
  }
  const pw = pixel(a.width),
    ph = pixel(a.height);
  if (viewBox)
    return {
      known: false,
      widthMm: null,
      heightMm: null,
      viewBox,
      source: pw > 0 || ph > 0 ? "px" : "viewBox",
      suggestedWidthMm: Number(viewBox[2].toFixed(3)),
      suggestedHeightMm: Number(viewBox[3].toFixed(3)),
    };
  if (pw > 0 && ph > 0)
    return { known: false, widthMm: null, heightMm: null, viewBox: null, source: "px", suggestedWidthMm: Number(pw.toFixed(3)), suggestedHeightMm: Number(ph.toFixed(3)) };
  return { known: false, widthMm: null, heightMm: null, viewBox: null, source: "none" };
}

// Rewrites the root <svg> so that width/height are explicit millimetres and a
// viewBox exists, keeping the drawing's aspect ratio. Used after the user
// confirms the real width of a px/unitless file.
export function withPhysicalSize(text, widthMm) {
  const root = parseSVG(text),
    size = documentSize(root);
  const w = Number(widthMm);
  if (!(w > 0)) throw Error("実寸の幅（mm）を入力してください。");
  let vb = size.viewBox;
  if (!vb) {
    const pw = lengthMM(root.attrs.width),
      ph = lengthMM(root.attrs.height);
    if (!(pw > 0 && ph > 0)) throw Error("このSVGは大きさを決められません（viewBox または width/height が必要です）。");
    vb = [0, 0, pw / (25.4 / 96), ph / (25.4 / 96)];
  }
  const h = (w * vb[3]) / vb[2];
  const num = (n) => Number(n.toFixed(4));
  const open = /<svg\b[^>]*>/i.exec(text);
  if (!open) throw Error("SVGファイルではありません。");
  let tag = open[0]
    .replace(/\s(width|height|viewBox)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/\s*\/?>$/, "");
  tag += ` width="${num(w)}mm" height="${num(h)}mm" viewBox="${vb.map(num).join(" ")}"${open[0].endsWith("/>") ? "/>" : ">"}`;
  return text.slice(0, open.index) + tag + text.slice(open.index + open[0].length);
}

// Security review of user-supplied SVG: anything that can run code or reach
// the network is reported. Callers reject (Worker) or strip (browser preview).
export function securityIssues(root, text = "") {
  const issues = [];
  const add = (code, message) => {
    if (!issues.some((i) => i.code === code)) issues.push({ code, message });
  };
  const walk = (node) => {
    if (ACTIVE_ELEMENTS.has(node.name)) add(`element:${node.name}`, `<${node.name}> 要素は受け付けません。`);
    for (const [k, v] of Object.entries(node.attrs)) {
      const key = k.toLowerCase();
      if (key.startsWith("on")) add("event-handler", `イベント属性（${k}）は受け付けません。`);
      if (JS_URL.test(v)) add("script-url", `${k} にスクリプトURLが含まれています。`);
      if (HREF_ATTRS.includes(key) && EXTERNAL.test(v)) add("external-url", `外部URL（${k}="${v.slice(0, 60)}"）は受け付けません。`);
      if (/url\(\s*['"]?\s*(https?:|\/\/)/i.test(v)) add("external-url", `外部リソース参照（${k}）は受け付けません。`);
      if (/@import/i.test(v)) add("css-import", "CSSの @import は受け付けません。");
    }
    node.children.forEach(walk);
  };
  walk(root);
  // Text content is not kept by the node tree; scan the raw document too.
  if (/<script[\s>]/i.test(text)) add("element:script", "<script> 要素は受け付けません。");
  if (/<foreignobject[\s>]/i.test(text)) add("element:foreignobject", "<foreignobject> 要素は受け付けません。");
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (/@import/i.test(m[1])) add("css-import", "CSSの @import は受け付けません。");
    if (/url\(\s*['"]?\s*(https?:|\/\/)/i.test(m[1])) add("external-url", "CSSから外部リソースを参照しています。");
    if (/expression\s*\(|behavior\s*:/i.test(m[1])) add("css-script", "CSSにスクリプト相当の指定があります。");
  }
  if (/<!DOCTYPE[^>]*\[[\s\S]*<!ENTITY/i.test(text) || /<!ENTITY[^>]*\b(SYSTEM|PUBLIC)\b/i.test(text))
    add("entity", "外部エンティティ宣言は受け付けません。");
  if (/<\?xml-stylesheet/i.test(text)) add("external-url", "外部スタイルシート宣言は受け付けません。");
  return issues;
}

// Removes the content reported by securityIssues from a DOM document so the
// remainder can be previewed. Browser only (needs DOMParser/XMLSerializer).
export function sanitizeSVG(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length || doc.documentElement?.localName !== "svg")
    throw Error("SVGとして読み込めません。XMLの形式を確認してください。");
  const strip = (el) => {
    for (const child of [...el.children]) {
      const name = child.localName.toLowerCase();
      if (ACTIVE_ELEMENTS.has(name) || name === "image" || name === "use" || name === "style") {
        child.remove();
        continue;
      }
      strip(child);
    }
    for (const attr of [...el.attributes]) {
      const key = attr.name.toLowerCase(),
        v = attr.value;
      if (
        key.startsWith("on") ||
        JS_URL.test(v) ||
        (HREF_ATTRS.includes(key) && !/^\s*#/.test(v)) ||
        /url\(\s*['"]?\s*(https?:|\/\/|data:)/i.test(v) ||
        /@import/i.test(v)
      )
        el.removeAttribute(attr.name);
    }
  };
  strip(doc.documentElement);
  // Display aid only: hairline cut strokes (e.g. TypeFab's 0.1 mm) stay
  // visible at any preview size. Fill-only shapes are unaffected.
  const style = doc.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = "[stroke]:not([stroke='none']){vector-effect:non-scaling-stroke;stroke-width:1.2px}";
  doc.documentElement.prepend(style);
  return new XMLSerializer().serializeToString(doc.documentElement);
}

const segmentLength = (ps) =>
  ps.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - ps[i].x, p.y - ps[i].y), 0);
const same = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

// Full analysis. `errors` block ordering; `warnings` are shown to the user.
export function analyzeSVG(text, options = {}) {
  const bytes = new TextEncoder().encode(text).length;
  const limits = { maxWidthMm: 300, maxHeightMm: 200, minSizeMm: 5, maxSvgBytes: 2 * 1024 * 1024, ...options.limits };
  const result = {
    bytes,
    size: null,
    pathCount: 0,
    subpathCount: 0,
    openPaths: 0,
    closedPaths: 0,
    cutLengthMm: 0,
    duplicateSegments: 0,
    hasText: false,
    unsupported: {},
    invalidElements: 0,
    security: [],
    errors: [],
    warnings: [],
  };
  if (bytes > limits.maxSvgBytes) {
    result.errors.push(`ファイルが大きすぎます（最大 ${Math.round(limits.maxSvgBytes / 1024 / 1024)} MB）。`);
    return { ...result, ok: false };
  }
  let root;
  try {
    root = parseSVG(text);
  } catch (e) {
    result.errors.push(e.message);
    return { ...result, ok: false };
  }
  result.security = securityIssues(root, text);
  for (const s of result.security) result.errors.push(s.message);
  result.size = documentSize(root);
  if (!result.size.known)
    result.errors.push(
      result.size.source === "none"
        ? "SVGの大きさを取得できません（width/height または viewBox が必要です）。"
        : "SVGの実寸が確定できません（px または単位なし）。実寸の幅（mm）を確認してください。",
    );
  else {
    const { widthMm: w, heightMm: h } = result.size;
    const fits = (w <= limits.maxWidthMm && h <= limits.maxHeightMm) || (h <= limits.maxWidthMm && w <= limits.maxHeightMm);
    if (!fits) result.errors.push(`サイズが大きすぎます（${w.toFixed(1)} × ${h.toFixed(1)} mm、最大 ${limits.maxWidthMm} × ${limits.maxHeightMm} mm）。`);
    if (w < limits.minSizeMm || h < limits.minSizeMm) result.errors.push(`サイズが小さすぎます（最小 ${limits.minSizeMm} mm）。`);
  }
  let shapes;
  try {
    shapes = svgShapes(root);
  } catch (e) {
    result.errors.push(e.message);
    return { ...result, ok: false };
  }
  result.unsupported = shapes.skipped;
  result.invalidElements = shapes.invalid;
  result.hasText = (shapes.skipped["文字"] ?? 0) > 0;
  const seen = new Map();
  for (const shape of shapes.shapes) {
    result.pathCount++;
    for (const sub of shape.path) {
      const contours = pathContours([sub]);
      for (const ps of contours) {
        if (ps.length < 2) continue;
        result.subpathCount++;
        const closed = sub.closed || same(ps[0], ps.at(-1));
        if (closed) result.closedPaths++;
        else result.openPaths++;
        result.cutLengthMm += segmentLength(ps);
        for (let i = 1; i < ps.length; i++) {
          const a = ps[i - 1],
            b = ps[i];
          if (same(a, b)) continue;
          const k1 = `${a.x.toFixed(2)},${a.y.toFixed(2)}`,
            k2 = `${b.x.toFixed(2)},${b.y.toFixed(2)}`;
          const key = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
          const n = (seen.get(key) ?? 0) + 1;
          seen.set(key, n);
          if (n === 2) result.duplicateSegments++;
        }
      }
    }
  }
  result.cutLengthMm = Number(result.cutLengthMm.toFixed(2));
  if (!result.pathCount) result.errors.push("カットできる図形がありません（パス・長方形・円・楕円・線・折れ線・多角形）。");
  if (result.hasText) result.warnings.push(`文字（text）要素 ${shapes.skipped["文字"]} 個はカットされません。アウトライン化してください。`);
  for (const [name, n] of Object.entries(shapes.skipped)) if (name !== "文字") result.warnings.push(`${name} ${n} 個は対応していないため無視されます。`);
  if (shapes.invalid) result.warnings.push(`読み取れない要素が ${shapes.invalid} 個あります。`);
  if (result.openPaths) result.warnings.push(`Open path ${result.openPaths} 箇所（閉じていない線は切り抜きになりません）。`);
  if (result.duplicateSegments) result.warnings.push(`重複線の可能性 ${result.duplicateSegments} 箇所（同じ線を2回カットします）。`);
  return { ...result, ok: result.errors.length === 0 };
}
// Short human summary lines for the order page.
export function summaryLines(a) {
  const lines = [];
  if (a.size?.known) lines.push(`✓ 実寸 ${a.size.widthMm.toFixed(1)} × ${a.size.heightMm.toFixed(1)} mm`);
  if (a.size?.viewBox) lines.push("✓ viewBox 正常");
  if (a.pathCount && !Object.keys(a.unsupported).length) lines.push("✓ カット図形のみ");
  return lines;
}
