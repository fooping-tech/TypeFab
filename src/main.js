import opentype from "opentype.js";
import "./style.css";
import {
  worldContours,
  stencilContours,
  pathData,
  cutGeometry,
  exportSVG,
  shapeContours,
  automaticBridges,
  bounds,
  transform,
} from "./geometry.js";
import { validateProject } from "./project.js";
import { ensureLayers, visibleItems, isEditable } from "./layers.js";
import {
  booleanContours,
  itemBounds,
  canResize,
  resizeFromHandle,
  followBridges,
} from "./operations.js";
import {
  selectionRect,
  marqueeIds,
  layerMovePlan,
  wheelZoom,
  rangeIds,
  MAX_ZOOM,
} from "./interaction.js";
import {
  splitCharacters,
  splitWarpedCharacters,
  splitParts,
  reassignBridges,
  groupItems,
  ungroupItems,
  expandGroups,
  normalizeGroups,
} from "./grouping.js";
import { svgShapes, shapeItem, parseXML, fromDOM } from "./svgimport.js";
import {
  arrangeItems,
  cloneItems,
  rotateAbout,
  selectionCenter,
  normalizeAngle,
} from "./edit.js";
import {
  pathFromCommands,
  pathFromContours,
  pathContours,
  shapePath,
  toPathData,
  parsePathData,
  nodeKeys,
  nodeAt,
  parseKey,
  moveNodes,
  moveHandle,
  setNodeType,
  insertNode,
  deleteNodes,
  nearestSegment,
  visibleHandles,
} from "./path.js";
import {
  WARP_PRESETS,
  CORNERS,
  flatEnvelope,
  presetEnvelope,
  coons,
  warpContours,
  isFlat,
  WARPABLE,
  shapeSource,
  applyWarp,
} from "./warp.js";
import {
  createFontLoader,
  FONT_CATALOG,
  FONT_CATEGORIES,
  bundledFont,
  DEFAULT_FONT,
  fontPolicyAccepted,
  FONT_POLICY_VERSION,
  FONT_POLICY_TEXT,
  BUNDLED_FONTS_NOTE,
} from "./fonts.js";
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
let typography;
const typographyReady = import("./typography.js").then((m) => (typography = m));
// Bundled fonts are fetched lazily (issue #3): the default font at start-up,
// others when a text item needs them; each id is fetched once.
const fontLoader = createFontLoader({
  fetch: (url) => fetch(url),
  baseUrl: import.meta.env.BASE_URL,
  parse: (bytes) => opentype.parse(bytes),
  makeShaping: (bytes) => typography.makeShapingFont(bytes),
  onChange: () => {
    if (!loading) renderProperties();
  },
});
const shapingFonts = fontLoader.shaping;
async function loadFont(id) {
  await typographyReady;
  return fontLoader.load(id);
}
let fontPreviews = null;
const fontPreviewsReady = () =>
  fontPreviews
    ? Promise.resolve(fontPreviews)
    : import("./font-previews.js").then((m) => (fontPreviews = m.FONT_PREVIEWS));

const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const fonts = fontLoader.fonts,
  fontLabels = fontLoader.labels;
let project = {
  version: 1,
  name: "はじめてのタイポグラフィ",
  width: 240,
  height: 160,
  items: [],
};
let loading = true;
let selected = null,
  tool = "select",
  preview = false,
  snap = true,
  zoom = 1,
  history = [],
  future = [],
  drag = null,
  saveTimer,
  statusTimer;
const uid = () => crypto.randomUUID();
let multi = [],
  activeLayer = "layer-default",
  liveSession = null,
  warpId = null,
  pathEdit = null,
  warpBase = null,
  browserAnchor = null,
  lastPress = null,
  clipboard = null,
  pasteCount = 0;
const selectionIds = () => (multi.length ? multi : selected ? [selected] : []);
const selectedItems = () =>
  selectionIds()
    .map((id) => project.items.find((i) => i.id === id))
    .filter((i) => isEditable(project, i));
function selectItem(id, additive = false) {
  if (
    id &&
    !isEditable(
      project,
      project.items.find((i) => i.id === id),
    )
  )
    return;
  multi = additive
    ? selectionIds().includes(id)
      ? selectionIds().filter((x) => x !== id)
      : [...selectionIds(), id]
    : id
      ? [id]
      : [];
  selected = multi.at(-1) || null;
}
// Canvas picks select the whole group; browser rows can pick single members.
function selectGroupOf(id, additive = false) {
  const ids = expandGroups(project, [id]),
    current = selectionIds();
  multi = !additive
    ? ids
    : ids.every((x) => current.includes(x))
      ? current.filter((x) => !ids.includes(x))
      : [...new Set([...current, ...ids])];
  // The clicked item stays the primary selection shown in the inspector.
  if (multi.includes(id)) multi = [...multi.filter((x) => x !== id), id];
  selected = multi.at(-1) || null;
  browserAnchor = id;
}
function replaceItem(before, after) {
  followBridges(project.items, before, after);
  project.items[project.items.indexOf(before)] = after;
}

const selectedItem = () => project.items.find((i) => i.id === selected);
const icons = {
  select: "↖",
  text: "T",
  rect: "▭",
  circle: "◯",
  line: "╱",
  bridge: "⊣⊢",
};
const labels = {
  select: "選択",
  text: "文字",
  rect: "長方形",
  circle: "楕円",
  line: "線分",
  bridge: "ブリッジ",
};
function notify(message) {
  $("#message").textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(
    () => ($("#message").textContent = "ブラウザ内で編集 · mm"),
    7000,
  );
}
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem("typefab-v1", JSON.stringify(project));
    $("#save-status").textContent = "このブラウザに保存済み";
  } catch {
    $("#save-status").textContent = "自動保存できません · JSON保存を使用";
  }
}
// Autosave is debounced; a pending save is written when the page is hidden
// or closed, so the last edit is not lost.
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 200);
}
for (const event of ["pagehide", "visibilitychange"])
  window.addEventListener(event, () => {
    if (saveTimer && (event === "pagehide" || document.hidden)) saveNow();
  });
function checkpoint() {
  history.push(JSON.stringify(project));
  if (history.length > 60) history.shift();
  future = [];
}
function commit() {
  render();
  persist();
}
// Undo/redo clear the selection, except that Warp mode stays on its text.
function restore(snapshot) {
  const keep = warpId,
    keepPath = pathEdit?.id;
  project = JSON.parse(snapshot);
  selectItem(null);
  if (keep && project.items.some((i) => i.id === keep && i.warp)) {
    multi = [keep];
    selected = keep;
  }
  // Path Edit Mode continues on the restored shape, with nothing selected.
  const pathTarget = project.items.find((i) => i.id === keepPath);
  if (pathTarget && PATHABLE.includes(pathTarget.type)) {
    multi = [keepPath];
    selected = keepPath;
    pathEdit = {
      id: keepPath,
      path: workingPath(pathTarget),
      selection: new Set(),
    };
  }
  commit();
}
function undo() {
  if (!history.length) return;
  future.push(JSON.stringify(project));
  restore(history.pop());
}
function redo() {
  if (!future.length) return;
  history.push(JSON.stringify(project));
  restore(future.pop());
}
// A bundled font that is not loaded yet is fetched in the background; the
// caller gets a clear message instead of a silent fallback to another font.
function requireFont(id) {
  if (fonts.has(id)) return;
  const entry = bundledFont(id);
  if (!entry) return;
  const state = fontLoader.state(id);
  if (state === "error") throw Error(fontLoader.error(id));
  if (state !== "loading") loadFont(id).catch(() => renderProperties());
  throw Error(
    `フォント「${entry.label}」を読み込んでいます。完了後にもう一度操作してください。`,
  );
}
function textContours(item) {
  if (!typography) throw Error("フォントの準備が完了するまでお待ちください。");
  requireFont(item.font);
  return typography.layoutText(
    item,
    fonts.get(item.font),
    shapingFonts.get(item.font),
  );
}
function textGlyphs(item) {
  if (!typography) throw Error("フォントの準備が完了するまでお待ちください。");
  requireFont(item.font);
  return typography.layoutGlyphs(
    item,
    fonts.get(item.font),
    shapingFonts.get(item.font),
  );
}
// Outline before the warp. Text is laid out again (cached because envelope
// edits reuse it); shapes rebuild from their dimensions or stored source.
function unwarpedLayout(item) {
  if (item.type !== "text") {
    const contours = shapeSource(item);
    return { contours, box: bounds(contours) };
  }
  const key = JSON.stringify([
    item.font,
    item.text,
    item.size,
    item.spacing,
    item.vertical,
    item.stretch ?? 1,
  ]);
  if (warpBase?.key !== key) {
    const contours = textContours({ ...item, warp: undefined });
    warpBase = { key, contours, box: bounds(contours) };
  }
  return warpBase;
}
// Same result as layoutText with the warp, without laying the glyphs out again.
function withWarp(item, warp, base = unwarpedLayout(item)) {
  return {
    ...item,
    warp,
    contours: warpContours(base.contours, base.box, warp.envelope),
  };
}
// Path Edit Mode edits Bézier nodes. Fixed paths keep their nodes in
// item.path; rectangles and ellipses start from exact paths, warped shapes and
// plain polyline outlines from fitted curves. Nothing changes until an edit,
// which turns the item into a fixed path whose contours are the flattened path.
const PATHABLE = ["outline", "rect", "circle"];
const pathItem = () => {
  const item = selectedItem();
  return pathEdit && item?.id === pathEdit.id ? item : null;
};
function workingPath(item) {
  if (item.warp) return pathFromContours(item.contours);
  if (item.path) return structuredClone(item.path);
  if (["rect", "circle"].includes(item.type))
    return shapePath(item.type, item.w, item.h, item.radius);
  return pathFromContours(item.contours);
}
function toPathItem(item, path) {
  const {
    w,
    h,
    radius,
    warp,
    text,
    font,
    size,
    spacing,
    vertical,
    stretch,
    ...rest
  } = item;
  return { ...rest, type: "outline", path, contours: pathContours(path) };
}
// Each press redraws the canvas, which resets the browser's own click count,
// so double presses are detected here (same target, <450 ms, <6 px).
function doublePress(e, id) {
  const now = performance.now(),
    last = lastPress;
  lastPress = { id, time: now, x: e.clientX, y: e.clientY };
  const twice =
    last?.id === id &&
    now - last.time < 450 &&
    Math.hypot(e.clientX - last.x, e.clientY - last.y) < 6;
  if (twice) lastPress = null;
  return twice;
}
const canWarp = (item) =>
  WARPABLE.includes(item?.type) &&
  (item.type !== "outline" || item.contours.length > 0);
const warpItem = () => {
  const item = selectedItem();
  return warpId && item?.id === warpId && item.warp ? item : null;
};
const warpLabel = (warp) =>
  warp.preset === "custom"
    ? "カスタム"
    : warp.preset === "none"
      ? "なし"
      : `${WARP_PRESETS.find(([id]) => id === warp.preset)[1]} ${Math.round(warp.bend * 100)}%`;
const visibleChars = (text) => [...text].filter((c) => /\S/u.test(c)).length;
// What ungrouping does next: text → one item per character → parts.
function ungroupKind(item) {
  if (item?.groupId) return "group";
  if (item?.type === "text" && visibleChars(item.text) > 1) return "characters";
  if (["text", "outline"].includes(item?.type) && splitParts(item).length > 1)
    return "parts";
  return null;
}
const ungroupLabel = (kinds) =>
  kinds.size > 1 || kinds.has("group")
    ? "グループ化解除"
    : kinds.has("characters")
      ? "1文字ずつに分解"
      : "部位ごとに分解";
const shortcut = (key, shift = false) =>
  isMac ? `${shift ? "⇧" : ""}⌘${key}` : `Ctrl+${shift ? "Shift+" : ""}${key}`;
function addItem(type, x = 35, y = 45) {
  try {
    const layer = project.layers.find((l) => l.id === activeLayer);
    if (!layer?.visible || layer.locked)
      throw Error("表示中のロックされていないレイヤーを選んでください。");
    let item = {
      id: uid(),
      type,
      x,
      y,
      rotation: 0,
      name: labels[type],
      layerId: activeLayer,
      ratioLocked: false,
    };
    if (type === "text") {
      item = {
        ...item,
        text: "文字を、かたちに。",
        font: "zen",
        size: 16,
        spacing: 1,
        vertical: false,
      };
      item.name = item.text;
      item.contours = textContours(item);
    } else if (type === "bridge") Object.assign(item, { w: 4, h: 1.5 });
    else {
      Object.assign(item, {
        w: type === "line" ? 35 : 30,
        h: type === "line" ? 0 : 30,
      });
      item.contours = shapeContours(type, item.w, item.h);
    }
    checkpoint();
    project.items.push(item);
    selectItem(item.id);
    tool = "select";
    commit();
  } catch (e) {
    notify(e.message);
  }
}
// Downloads a named File. Some browsers and embedded views ignore the
// download name of an anonymous Blob and save it under its random id without
// an extension. The object URL stays valid for five minutes so a browser that
// asks where to save can still read it after the dialog. (Chrome's
// showSaveFilePicker is not used: it can reject as "aborted" without showing
// a dialog.) Returns the file name.
function saveFile(name, data, type) {
  const url = URL.createObjectURL(new File([data], name, { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  return name;
}
function withinBoard() {
  return visibleItems(project)
    .filter((i) => i.type !== "bridge")
    .every((i) =>
      worldContours(i)
        .flat()
        .every(
          (p) =>
            p.x >= -1e-6 &&
            p.y >= -1e-6 &&
            p.x <= project.width + 1e-6 &&
            p.y <= project.height + 1e-6,
        ),
    );
}
// Same checks as the export; the SVG is handed to the order page through
// localStorage (same origin), so nothing needs to be saved and re-uploaded.
function orderDesign() {
  try {
    const svg = cutSVG();
    localStorage.setItem(
      "typefab-order",
      JSON.stringify({ svg, fileName: "typefab.svg", at: Date.now() }),
    );
    saveNow();
    location.assign(`${import.meta.env.BASE_URL}order/`);
  } catch (e) {
    notify(e.message);
  }
}
// Export-ready SVG or an error explaining why it cannot be cut.
function cutSVG() {
  if (!withinBoard())
    throw Error(
      "加工エリアの外にカット線があります。位置または加工エリアを調整してください。",
    );
  const result = cutGeometry(visibleItems(project));
  if (result.vanished)
    throw Error(
      `${result.vanished} 個の輪郭がブリッジで完全に隠れています。ブリッジを小さくしてください。`,
    );
  return exportSVG(project);
}
function exportFile() {
  try {
    if (!withinBoard())
      throw Error(
        "加工エリアの外にカット線があります。位置または加工エリアを調整してください。",
      );
    const result = cutGeometry(visibleItems(project));
    if (result.vanished)
      throw Error(
        `${result.vanished} 個の輪郭がブリッジで完全に隠れています。ブリッジを小さくしてください。`,
      );
    const name = saveFile("typefab.svg", exportSVG(project), "image/svg+xml");
    notify(
      `${name} をダウンロードしました · 切り残しなしの閉輪郭 ${result.untouched} 個`,
    );
  } catch (e) {
    notify(e.message);
  }
}

$("#app").innerHTML = `
<header><a class="brand" href="./"><span class="brand-mark">t<span>f</span></span>TypeFab<span class="beta">BETA</span></a><div class="document-title"><span id="project-name"></span><small id="save-status">ローカルプロジェクト</small></div><div class="header-actions"><button id="new-project" title="新規プロジェクト">新規</button><button id="open-project" title="TypeFabプロジェクト（.json）を開く、またはSVGの図形を読み込む（キャンバスへのドロップも可）">開く</button><button id="save-project">保存</button><button id="export" class="primary">↗ SVGを書き出す</button><button id="order" title="現在のデザインのSVGをそのまま加工注文ページへ渡します">⚒ このデザインを加工注文する</button></div></header>
<div class="workspace-tabs"><span class="workspace-title">DESIGN WORKSPACE</span><span class="tab active">スケッチ</span><span class="subtle">文字から、ものづくりへ。</span><button id="help-button">? 使い方</button></div>
<nav class="toolbar" aria-label="スケッチツール"><div class="tool-group">${Object.entries(
  labels,
)
  .map(
    ([id, label]) =>
      `<button data-tool="${id}" class="tool" title="${label}"><span class="tool-icon">${icons[id]}</span>${label}</button>`,
  )
  .join(
    "",
  )}</div><div class="tool-group"><button id="auto-bridge" class="tool"><span class="tool-icon">✧</span>選択にブリッジ</button><button id="outline" class="tool"><span class="tool-icon">T̲</span>アウトライン化</button><button id="group" class="tool" title="選択をグループ化 (${shortcut("G")})"><span class="tool-icon">▣</span>グループ化</button><button id="ungroup" class="tool" title="グループを解除、または文字を1文字ずつ・部位ごとに分解 (${shortcut("G", true)})"><span class="tool-icon">⊞</span>グループ化解除</button><button id="warp" class="tool" title="文字のアウトラインをエンベロープで変形（Text Warp）"><span class="tool-icon">⌒</span>ワープ</button><button id="edit-path" class="tool" title="パスのノードを直接編集（ダブルクリックでも開始）"><span class="tool-icon">✎</span>パス編集</button></div><div class="tool-group history"><button id="undo" title="元に戻す (Ctrl/⌘ Z)">↶</button><button id="redo" title="やり直す (Ctrl/⌘ Shift Z)">↷</button></div><button id="preview" class="preview-button">◎ 加工プレビュー</button></nav>
<main><aside class="layers-panel"><div class="panel-heading">ブラウザ<span class="eyebrow">OBJECTS</span></div><div class="document-row"><button id="add-layer">＋ レイヤー</button><span class="note">Shiftで範囲 · ${isMac ? "⌘" : "Ctrl"}で追加 · 右クリックでメニュー</span></div><div id="layers"></div><div class="layer-actions"><button id="duplicate">＋ 複製</button><button id="delete">⌫ 削除</button></div><div class="left-bottom"><div class="eyebrow">YOUR NEXT IDEA</div><h3>文字を、かたちに。</h3><p>文字と図形をならべて、<br>世界にひとつのデザインを。</p><button id="add-text" class="text-link">＋ 文字を追加</button></div></aside>
<section class="canvas-panel" aria-label="デザインキャンバス"><div class="canvas-top"><span><i class="green-dot"></i> <span id="canvas-mode">スケッチ編集中</span></span><span id="board-label"></span></div><div id="canvas-scroll"><div id="canvas-stage"><div id="board-wrap"><svg id="canvas" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="加工エリア。ツールを選んで配置、またはオブジェクトをドラッグ"><defs><pattern id="small-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#dce2e8" stroke-width="0.12"/></pattern><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="url(#small-grid)"/><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#c4cdd7" stroke-width="0.2"/></pattern></defs><rect id="paper" width="100%" height="100%" fill="url(#grid)"/><g id="objects"></g><g id="selection"></g><rect id="marquee" hidden pointer-events="none" fill="#3889c4" fill-opacity=".12" stroke="#3889c4" stroke-width=".25" stroke-dasharray="1.5 1"/></svg><span class="origin-label">0, 0</span></div></div></div><div class="canvas-bottom"><label class="check"><input type="checkbox" id="snap" checked> 1 mm スナップ</label><div class="zoom-controls"><button id="zoom-out" aria-label="縮小">−</button><button id="zoom-reset">100%</button><button id="zoom-in" aria-label="拡大">＋</button></div><span class="axis"><b>Y</b> ↓ &nbsp; → <em>X</em></span></div><div id="hint" class="canvas-hint"></div></section>
<aside class="inspector"><div class="panel-heading">プロパティ<span class="eyebrow">INSPECTOR</span></div><div id="properties"></div><section class="board-settings"><h4>加工エリア <span>mm</span></h4><div class="fields"><label>幅<input id="board-width" type="number" min="10" max="2000"></label><label>高さ<input id="board-height" type="number" min="10" max="2000"></label></div></section><section class="cut-check"><h4><span class="check-icon">◇</span> 加工チェック</h4><div id="checks"></div><p>ブリッジは切り残しです。材料・厚さに応じて幅を調整し、テスト加工してください。</p></section></aside></main>
<footer><span id="message" role="status" aria-live="polite">フォントを読み込んでいます…</span><span><i class="legend cut"></i> カット線 <i class="legend bridge"></i> 非カット &nbsp; <button id="font-licenses-button" class="text-link">フォントライセンス</button> <span class="subtle">TypeFab / 0.12</span></span></footer>
<input hidden type="file" id="font-file" accept=".ttf,.otf,.woff"><input hidden type="file" id="project-file" accept=".json,.svg,application/json,image/svg+xml">
<dialog id="help"><button class="dialog-close" id="close-help" aria-label="閉じる">×</button><div class="eyebrow">WELCOME TO TYPEFAB</div><h2>アイデアを、切り出そう。</h2><ol><li><b>文字・図形を配置</b><p>ツールを選び、加工エリアをクリック。ドラッグや数値入力で位置を調整できます。</p></li><li><b>切り残しをつくる</b><p>ブリッジを輪郭に重ねると、その部分のカット線が途切れます。自動ブリッジは文字から矩形を切り抜き、内側の島を外側につなぎます。帯の側面も閉じたカット輪郭に含まれます。</p></li><li><b>確認して書き出す</b><p>加工プレビューの赤線がSVGに出力されます。SVGはmm単位のパスのみ。カット設定は加工機側で指定してください。</p></li></ol><p class="help-note">閉輪郭のチェックは接続強度の保証ではありません。Shiftで複数選択し、右側から結合・切り抜き・交差・XORを実行できます。差分は最初の選択が土台です。オブジェクトを右クリックすると編集メニューが開きます。「グループ化」でまとめて動かせます。「グループ化解除」はグループを解き、文字を1文字ずつ、もう一度で部位ごとに分解します。長方形は角の半径（フィレット）を指定できます。文字は四隅で拡縮、ダブルクリックで編集、アウトライン化した文字や図形はダブルクリックでノード（アンカーとハンドル）を直接編集、「開く」でSVGの図形も読み込めます。「ワープ」で文字・長方形・楕円・固定パスのアウトラインそのものを変形できます。縦書きはフォントの縦用字形を使用します。カーフ補正・ルビ・縦中横は未対応です。</p><button id="start" class="primary">スケッチをはじめる →</button></dialog>
<dialog id="font-gallery" class="font-gallery" aria-labelledby="font-gallery-title"><button class="dialog-close" data-close aria-label="閉じる">×</button><div class="eyebrow">FONTS</div><h2 id="font-gallery-title">フォント一覧</h2><div class="gallery-body"></div><button class="text-link" data-open-licenses>フォントライセンスを見る</button></dialog>
<dialog id="font-licenses" class="font-licenses" aria-labelledby="font-licenses-title"><button class="dialog-close" data-close aria-label="閉じる">×</button><div class="eyebrow">FONT LICENSES</div><h2 id="font-licenses-title">フォントライセンス</h2><div class="licenses-body"></div></dialog>
<dialog id="font-policy" class="font-policy" aria-labelledby="font-policy-title"><button class="dialog-close" data-close aria-label="閉じる">×</button><div class="eyebrow">USER FONTS</div><h2 id="font-policy-title">ユーザー追加フォントについて</h2><div class="policy-body">${FONT_POLICY_TEXT.split("\n\n").map((t) => `<p>${esc(t)}</p>`).join("")}</div><label class="check policy-check"><input type="checkbox" id="font-policy-agree"> このフォントを使用するために必要な権利・許諾を有していることを確認しました。</label><div class="policy-actions"><button class="text-link" data-open-licenses>詳細を見る（規約全文・標準フォントのライセンス）</button><button id="font-policy-accept" class="primary" disabled>確認してフォントを選ぶ</button></div><p class="note">規約バージョン ${FONT_POLICY_VERSION} · 同意はこのブラウザに保存され、規約が更新されると再確認します。</p></dialog>
<div id="context-menu" class="context-menu" role="menu" aria-label="編集メニュー" hidden></div>
<div id="text-editor" class="text-editor" hidden><textarea id="canvas-text" aria-label="文字を編集" maxlength="500" rows="2"></textarea><small>入力はすぐに反映 · Esc / ${shortcut("Enter")} で確定</small></div>`;

function layerRow(i) {
  return `<button class="layer ${selectionIds().includes(i.id) ? "selected" : ""} ${i.type === "bridge" ? "bridge-layer" : ""}" draggable="${isEditable(project, i)}" data-layer="${i.id}" ${!isEditable(project, i) ? "disabled" : ""}><span class="layer-icon">${i.warp ? "⌒" : icons[i.type] || "⌘"}</span><span>${esc(i.name)}</span><small>${i.type === "bridge" ? "TAB" : i.warp ? "WARP" : i.type === "text" ? "TEXT" : "PATH"}</small></button>`;
}
// Consecutive members of one group are shown under a group row.
function layerRows(items) {
  let html = "";
  for (let n = 0; n < items.length;) {
    const group = items[n].groupId;
    if (!group) {
      html += layerRow(items[n++]);
      continue;
    }
    const run = [];
    while (n < items.length && items[n].groupId === group) run.push(items[n++]);
    const all = run.every((i) => selectionIds().includes(i.id));
    html += `<div class="group-block"><button class="group-row ${all ? "selected" : ""}" data-group-row="${group}" ${run.some((i) => !isEditable(project, i)) ? "disabled" : ""}><span class="layer-icon">▣</span><span>グループ</span><small>${run.length} ITEMS</small></button>${run.map(layerRow).join("")}</div>`;
  }
  return html;
}
function renderLayers() {
  $("#layers").innerHTML = [...project.layers]
    .reverse()
    .map(
      (
        l,
      ) => `<div data-drop-layer="${l.id}" class="layer-group ${l.id === activeLayer ? "current" : ""}"><div class="layer-header">
    <button data-active-layer="${l.id}" aria-label="${esc(l.name)}を選択" title="追加先レイヤー">${l.id === activeLayer ? "◆" : "◇"}</button>
    <input data-layer-name="${l.id}" aria-label="レイヤー名" value="${esc(l.name)}" maxlength="100">
    <button data-layer-action="visible" data-id="${l.id}" title="${l.visible ? "非表示にする" : "表示する"}" aria-label="${esc(l.name)}の表示切替">${l.visible ? "◉" : "○"}</button>
    <button data-layer-action="locked" data-id="${l.id}" title="${l.locked ? "ロック解除" : "ロック"}" aria-label="${esc(l.name)}のロック切替">${l.locked ? "🔒" : "◇"}</button></div>
    <div class="layer-order"><button data-layer-action="up" data-id="${l.id}" ${project.layers.at(-1) === l ? "disabled" : ""} title="前面へ">↑</button><button data-layer-action="down" data-id="${l.id}" ${project.layers[0] === l ? "disabled" : ""} title="背面へ">↓</button><button data-layer-action="remove" data-id="${l.id}" ${project.layers.length === 1 || l.locked ? "disabled" : ""} title="レイヤー削除（中身は別レイヤーへ移動）">削除</button><small>${project.items.filter((i) => i.layerId === l.id).length} items</small></div>
    ${layerRows(project.items.filter((i) => i.layerId === l.id).reverse())}
  </div>`,
    )
    .join("");
}
function field(key, label, value, step = 1, min = -2000, max = 2000) {
  return `<label>${label}<input data-prop="${key}" type="number" value="${Number(value.toFixed(3))}" step="${step}" min="${min}" max="${max}"></label>`;
}
function presetIcon(id) {
  const e = presetEnvelope(id, 0.5, 3),
    at = (p) => `${(4 + p.x * 36).toFixed(2)} ${(9 + p.y * 14).toFixed(2)}`,
    outline = `M${at(e[0])} C${at(e[1])} ${at(e[2])} ${at(e[3])} C${at(e[4])} ${at(e[5])} ${at(e[6])} C${at(e[7])} ${at(e[8])} ${at(e[9])} C${at(e[10])} ${at(e[11])} ${at(e[0])} Z`,
    middle = Array.from({ length: 13 }, (_, n) => at(coons(e, n / 12, 0.5)));
  return `<svg viewBox="0 0 44 32" aria-hidden="true"><path d="${outline}" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="1.2"/><path d="M${middle.join(" L")}" fill="none" stroke="currentColor" stroke-width=".7" stroke-opacity=".6"/></svg>`;
}
function warpPanel(i) {
  const w = i.warp,
    bendable = WARP_PRESETS.some(([id]) => id === w.preset);
  return `<section class="warp-panel"><div class="object-type">${i.type === "text" ? "TEXT WARP" : "WARP"} / エンベロープ</div><h3>${esc(i.name)}</h3><h4>プリセット <span>${esc(warpLabel(w))}</span></h4><div class="warp-presets">${WARP_PRESETS.map(([id, en, ja]) => `<button data-warp-preset="${id}" class="${w.preset === id ? "active" : ""}" aria-pressed="${w.preset === id}" title="${ja}">${presetIcon(id)}<span>${en}</span></button>`).join("")}</div><label class="full-label">曲がり <output id="warp-bend-value">${Math.round(w.bend * 100)}%</output><input id="warp-bend" type="range" min="-100" max="100" step="1" value="${Math.round(w.bend * 100)}" ${bendable ? "" : "disabled"}></label><p class="note">${bendable ? "エンベロープの角・ハンドルをドラッグして形を調整できます。" : w.preset === "custom" ? "カスタム形状です。プリセットを選ぶと置き換わります。" : "プリセットを選ぶか、エンベロープの角・ハンドルをドラッグしてください。"}角をドラッグすると隣のハンドルも動きます（Alt/Optionで角だけ）。</p><div class="warp-actions"><button id="warp-reset">形をリセット</button><button id="warp-remove">ワープを解除</button></div><button id="warp-done" class="wide-button warp-done">完了</button><p class="note">${
    i.type === "text"
      ? "元の文字とワープ設定を保持します。文字の編集・拡縮後も同じ変形が掛かります。"
      : i.type === "outline"
        ? "変形前の輪郭とワープ設定を保持します。拡縮後も同じ変形が掛かり、解除すると元の輪郭に戻ります。"
        : "元の寸法とワープ設定を保持します。幅・高さ・フィレットを変えても同じ変形が掛かります。"
  }SVGには変形後の輪郭をパスで書き出します。</p></section>`;
}
function pathPanel(i) {
  const path = pathEdit.path,
    keys = [...pathEdit.selection],
    one = keys.length === 1 ? nodeAt(path, keys[0]) : null,
    world = one && transform(one, i),
    kind = one
      ? one.smooth
        ? "スムーズ"
        : one.in || one.out
          ? "コーナー（ハンドル独立）"
          : "コーナー（直線）"
      : "",
    pending = !(i.type === "outline" && i.path && !i.warp);
  return `<section class="path-panel"><div class="object-type">PATH EDIT / ノード編集</div><h3>${esc(i.name)}</h3><p class="path-stats">ノード ${nodeKeys(path).length} 個 · 選択 ${keys.length} 個${one ? ` · ${kind}` : ""}</p><div class="node-actions">${[
    ["smooth", "スムーズ"],
    ["corner", "コーナー"],
    ["line", "直線化"],
    ["insert", "追加"],
    ["delete", "削除"],
    ["all", "すべて選択"],
  ]
    .map(
      ([action, label]) =>
        `<button data-node-action="${action}" ${action === "all" || keys.length ? "" : "disabled"}>${label}</button>`,
    )
    .join("")}</div>${
    one
      ? `<h4>選択ノード <span>mm</span></h4><div class="fields"><label>X<input data-node-prop="x" type="number" step="0.1" value="${Number(world.x.toFixed(3))}"></label><label>Y<input data-node-prop="y" type="number" step="0.1" value="${Number(world.y.toFixed(3))}"></label></div>`
      : ""
  }<label class="full-label path-d">SVG path d <small>オブジェクト座標 mm · M L H V C S Q T A Z</small><textarea id="path-d" spellcheck="false" rows="5" aria-label="SVG path d">${esc(toPathData(path))}</textarea></label>${pending ? `<p class="note">${i.warp ? "ワープした形" : i.type === "rect" ? "長方形" : i.type === "circle" ? "楕円" : "この輪郭"}は最初の編集で編集用パスに変換されます。</p>` : ""}<button id="path-done" class="wide-button warp-done">完了</button><p class="note">クリックで選択、Shift+クリックで追加、空白からドラッグで範囲選択。アンカー・ハンドルをドラッグして変形します（Alt+ハンドルでコーナー化）。パス上をダブルクリックでノード追加、Deleteで削除、Escで終了。</p></section>`;
}
// Font picker: a <select> grouped by category (bundled fonts marked 標準,
// session fonts under 追加フォント), the current font's name drawn with its own
// glyphs, the loading / error state, and buttons for the gallery and adding.
function fontPreviewSVG(id, height = 22) {
  const p = fontPreviews?.[id];
  return p
    ? `<svg viewBox="${p.viewBox}" style="height:${height}px;width:auto;max-width:100%" aria-hidden="true"><path d="${p.d}" fill="currentColor"/></svg>`
    : "";
}
function fontStateLine(id) {
  const state = fontLoader.state(id);
  if (state === "loading") return `<span class="font-state loading">読み込み中…</span>`;
  if (state === "error") return `<span class="font-state error">${esc(fontLoader.error(id))}</span>`;
  if (state === "missing") return `<span class="font-state error">追加フォント（このセッションにありません。再度追加してください）</span>`;
  return "";
}
// The font being fetched for the selected item (the item keeps its font
// until the new one is ready).
let pendingFont = null;
function fontField(i) {
  if (!fontPreviews) fontPreviewsReady().then(() => selectedItem()?.type === "text" && renderProperties());
  const custom = [...fontLabels].filter(([k]) => !bundledFont(k));
  const waiting = pendingFont && fontLoader.state(pendingFont) === "loading" ? pendingFont : null;
  const shown = waiting ?? i.font;
  const groups = Object.entries(FONT_CATEGORIES)
    .map(([cat, label]) => {
      const entries = FONT_CATALOG.filter((f) => f.category === cat);
      return entries.length
        ? `<optgroup label="${esc(label)}">${entries.map((f) => `<option value="${f.id}" ${shown === f.id ? "selected" : ""}>${esc(f.label)}（標準）</option>`).join("")}</optgroup>`
        : "";
    })
    .join("");
  const customGroup = custom.length
    ? `<optgroup label="追加フォント">${custom.map(([k, v]) => `<option value="${esc(k)}" ${shown === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</optgroup>`
    : "";
  const unknown = !fontLabels.has(i.font)
    ? `<option value="${esc(i.font)}" selected>追加フォント（再読込が必要）</option>`
    : "";
  const entry = bundledFont(shown);
  const stateLine = waiting
    ? `<span class="font-state loading">「${esc(fontLabels.get(waiting))}」を読み込み中…（完了まで現在のフォントのままです）</span>`
    : fontStateLine(i.font);
  return `<label class="full-label">フォント<select id="font-select" aria-describedby="font-state">${groups}${customGroup}${unknown}</select></label><div id="font-preview" class="font-preview" title="${esc(fontLabels.get(shown) ?? shown)}">${fontPreviewSVG(shown, 26) || `<span>${esc(fontLabels.get(shown) ?? shown)}</span>`}</div><div id="font-state" class="font-meta">${entry ? `<span class="badge-std">TypeFab標準</span> ${esc(FONT_CATEGORIES[entry.category])} · ${esc(entry.licenseId)}` : `<span class="badge-user">追加フォント</span>`} ${stateLine}</div><div class="font-buttons"><button id="font-gallery-button" class="wide-button">☷ フォント一覧・プレビュー</button><button id="add-font" class="wide-button">＋ フォント追加 <small>TTF / OTF / WOFF</small></button></div>`;
}
// Selecting a font that is not loaded yet fetches it first; the item keeps its
// current font until the new one is ready, and errors are shown as errors.
async function chooseFont(id) {
  const item = selectedItem();
  if (!item || item.type !== "text") return;
  if (fonts.has(id)) return updateSelected("font", id);
  if (!bundledFont(id)) {
    notify("このフォントはこのセッションにありません。フォントを追加し直してください。");
    return renderProperties();
  }
  pendingFont = id;
  renderProperties();
  try {
    await loadFont(id);
    pendingFont = null;
    const current = selectedItem();
    if (current?.id === item.id && current.type === "text") updateSelected("font", id);
    else notify(`フォント「${fontLabels.get(id)}」を読み込みました。`);
  } catch (e) {
    pendingFont = null;
    notify(e.message);
    renderProperties();
  }
}
const fontGallery = $("#font-gallery");
function renderFontGallery() {
  const item = selectedItem(),
    current = item?.type === "text" ? item.font : null;
  const group = (title, entries) =>
    entries.length
      ? `<h4>${esc(title)}</h4><div class="gallery-list">${entries
          .map(
            ([id, label, std]) =>
              `<button data-font="${esc(id)}" class="gallery-item ${id === current ? "current" : ""}" aria-pressed="${id === current}"><span class="gallery-preview">${fontPreviewSVG(id, 24) || `<span>${esc(label)}</span>`}</span><span class="gallery-meta">${esc(label)}${std ? ` <span class="badge-std">TypeFab標準</span>` : ` <span class="badge-user">追加フォント</span>`} ${fontStateLine(id)}${id === current ? " · 選択中" : ""}</span></button>`,
          )
          .join("")}</div>`
      : "";
  fontGallery.querySelector(".gallery-body").innerHTML =
    Object.entries(FONT_CATEGORIES)
      .map(([cat, label]) =>
        group(
          label,
          FONT_CATALOG.filter((f) => f.category === cat).map((f) => [f.id, f.label, true]),
        ),
      )
      .join("") +
    group(
      "追加フォント（このセッション）",
      [...fontLabels].filter(([k]) => !bundledFont(k)).map(([k, v]) => [k, v, false]),
    ) +
    `<p class="note">標準フォントは選択時に読み込みます。プレビューは各フォントの実際の字形です。${current ? "" : "文字を選択してから開くと、ここでフォントを切り替えられます。"}</p>`;
}
function openFontGallery() {
  fontPreviewsReady().then(() => {
    renderFontGallery();
    fontGallery.showModal();
  });
}
const fontLicenses = $("#font-licenses");
function renderFontLicenses() {
  const base = import.meta.env.BASE_URL;
  const paragraphs = (text) => text.split("\n\n").map((t) => `<p>${esc(t)}</p>`).join("");
  fontLicenses.querySelector(".licenses-body").innerHTML = `<h3>標準搭載フォントについて</h3>${paragraphs(BUNDLED_FONTS_NOTE)}<table class="licenses"><thead><tr><th>フォント</th><th>著作権表示</th><th>ライセンス</th><th>配布元</th></tr></thead><tbody>${FONT_CATALOG.map((f) => `<tr><td>${esc(f.label)}<br><small>${esc(FONT_CATEGORIES[f.category])}</small></td><td>${esc(f.copyright)}</td><td><a href="${base}fonts/${f.licenseFile}" target="_blank" rel="noopener">${esc(f.license)}</a><br><small>同梱: fonts/${esc(f.licenseFile)}</small></td><td><a href="${esc(f.source)}" target="_blank" rel="noopener">Google Fonts</a><br><a href="${esc(f.upstream)}" target="_blank" rel="noopener"><small>作者リポジトリ</small></a></td></tr>`).join("")}</tbody></table><p class="note">同じ情報をリポジトリの <code>THIRD_PARTY_FONTS.md</code> でも管理しています。</p><h3 id="font-policy-heading">ユーザー追加フォントについて</h3>${paragraphs(FONT_POLICY_TEXT)}<p class="note">規約バージョン ${FONT_POLICY_VERSION}</p>`;
}
function openFontLicenses() {
  renderFontLicenses();
  fontLicenses.showModal();
}
// Local fonts can be added only after the person confirms they hold the
// rights; the accepted policy version is kept in this browser.
const FONT_POLICY_KEY = "typefab-font-policy";
function requestFontFile() {
  let accepted = false;
  try {
    accepted = fontPolicyAccepted(localStorage.getItem(FONT_POLICY_KEY));
  } catch {}
  if (accepted) return $("#font-file").click();
  const dialog = $("#font-policy");
  dialog.querySelector("#font-policy-agree").checked = false;
  dialog.querySelector("#font-policy-accept").disabled = true;
  dialog.showModal();
}
function renderProperties() {
  const i = selectedItem();
  if (pathItem()) {
    $("#properties").innerHTML = pathPanel(i);
    $("#board-width").value = project.width;
    $("#board-height").value = project.height;
    return;
  }
  if (warpItem()) {
    $("#properties").innerHTML = warpPanel(i);
    $("#board-width").value = project.width;
    $("#board-height").value = project.height;
    return;
  }
  $("#properties").innerHTML = i
    ? `<section><div class="object-type">${i.type === "bridge" ? "BRIDGE / 非カット" : i.type === "text" ? "TYPOGRAPHY" : "SKETCH / パス"}</div><h3>${esc(i.name)}</h3><h4>配置 <span>mm</span></h4><div class="fields">${field("x", "X", i.x, 0.5)}${field("y", "Y", i.y, 0.5)}${field("rotation", "回転 °", i.rotation, 1, -360, 360)}</div></section>
  ${i.type === "text" ? `<section><h4>テキスト</h4><textarea id="text-content" maxlength="500" aria-label="文字内容">${esc(i.text)}</textarea>${fontField(i)}<div class="fields">${field("size", "サイズ mm", i.size, 0.5, 1, 300)}${field("spacing", "字間 mm", i.spacing, 0.1, -100, 100)}${field("stretch", "長体・平体 %", (i.stretch ?? 1) * 100, 1, 5, 2000)}</div><label class="check vertical-check"><input type="checkbox" id="vertical" ${i.vertical ? "checked" : ""}> 縦書き（右から左）</label><p class="note">四隅のハンドルで拡縮すると、サイズと長体・平体が変わります。キャンバスでダブルクリックすると文字を編集できます。</p></section><section><h4>ワープ・パス</h4><button id="enter-warp" class="wide-button">⌒ ワープ（エンベロープ変形）</button><p class="note">${i.warp ? `現在: ${esc(warpLabel(i.warp))} · ` : ""}文字のアウトラインそのものを曲線のエンベロープで変形します。</p><button id="outline-edit" class="wide-button">✎ アウトライン化してパス編集</button><p class="note">文字の輪郭をベジェ曲線のパスに変換し、ノードを直接編集します。</p></section>` : ""}
  ${["bridge", "rect", "circle", "line"].includes(i.type) ? `<section><h4>${i.type === "bridge" ? "切り残し領域" : "寸法"} <span>mm</span></h4><div class="fields">${field("w", "幅", i.w, 0.1, i.type === "line" ? 0 : 0.1)}${field("h", "高さ", i.h, 0.1, i.type === "line" ? 0 : 0.1)}${i.type === "rect" ? field("radius", "フィレット R", i.radius ?? 0, 0.1, 0, 1000) : ""}</div>${i.type === "rect" ? '<p class="note">4つの角を半径Rで丸めます。最大は短辺の半分です。</p>' : ""}${i.type === "bridge" ? '<p class="note">オレンジ色の領域に重なったカット線を除去します。</p>' : ""}</section>` : ""}`
    : '<section class="no-selection"><span>↖</span><h3>オブジェクトを選択</h3><p>キャンバスや左の一覧から選択して、文字・位置・寸法を編集できます。</p></section>';
  if (i && i.type !== "text" && canWarp(i))
    $("#properties").innerHTML +=
      `<section><h4>パス・ワープ</h4><button id="enter-path" class="wide-button">✎ パスを編集（ノード）</button><p class="note">ダブルクリックでも開始できます。${i.path ? "" : "最初の編集で編集用パスに変換されます。"}</p><button id="enter-warp" class="wide-button">⌒ ワープ（エンベロープ変形）</button><p class="note">${i.warp ? `現在: ${esc(warpLabel(i.warp))} · ` : ""}輪郭そのものを曲線のエンベロープで変形します。</p></section>`;
  const chosen = selectedItems();
  if (chosen.length > 1)
    $("#properties").innerHTML =
      `<section><h3>${chosen.length} アイテムを選択</h3><p class="note">差分の土台: ${esc(chosen[0].name)}</p><div class="boolean-actions"><button data-boolean="union">結合 ∪</button><button data-boolean="difference">切り抜き −</button><button data-boolean="intersection">交差 ∩</button><button data-boolean="xor">排他的 XOR</button></div><p class="note">閉じた図形・文字の輪郭に適用します。結果は固定パスになります。</p></section>`;
  if (chosen.length) {
    const kinds = new Set(chosen.map(ungroupKind).filter(Boolean)),
      groupable = chosen.filter((c) => !c.targetId).length > 1;
    if (kinds.size || groupable)
      $("#properties").innerHTML +=
        `<section>${groupable ? '<button id="item-group" class="wide-button">▣ グループ化</button>' : ""}${kinds.size ? `<button id="item-ungroup" class="wide-button">⊞ ${ungroupLabel(kinds)}</button><p class="note">${kinds.has("group") ? "グループを解除します。もう一度で文字・部位に分解します。" : kinds.has("characters") ? "文字ごとに移動・編集できます。もう一度で部位ごとに分解します。" : "つながった部位ごとの固定パスにします。"}</p>` : ""}</section>`;
    if (chosen.length === 1 && canResize(i))
      $("#properties").innerHTML +=
        `<section><label class="check"><input id="ratio-lock" type="checkbox" ${i.ratioLocked ? "checked" : ""}> 縦横比を固定</label><p class="note">四隅のハンドルをドラッグして拡縮。Shiftでも比率を固定できます。</p></section>`;
    $("#properties").innerHTML +=
      `<section><label class="full-label">所属レイヤー<select id="item-layer">${project.layers.map((l) => `<option value="${l.id}" ${i.layerId === l.id ? "selected" : ""} ${l.locked || !l.visible ? "disabled" : ""}>${esc(l.name)}</option>`).join("")}</select></label><button id="item-auto-bridge" class="wide-button">✧ 選択アイテムに自動ブリッジ</button>${i.targetId ? '<p class="note">このブリッジは対象アイテムのみに適用され、移動に追従します。</p>' : ""}</section>`;
  }
  $("#board-width").value = project.width;
  $("#board-height").value = project.height;
}
// Envelope editor: the four Bézier sides, a light mesh showing the patch,
// corners (squares) and handles (dots). Sizes are in screen pixels.
function warpOverlay(item, scale) {
  const { box } = unwarpedLayout(item),
    e = item.warp.envelope,
    at = (p) => ({ x: box.x + p.x * box.w, y: box.y + p.y * box.h }),
    xy = (p) => {
      const q = at(p);
      return `${Number(q.x.toFixed(4))} ${Number(q.y.toFixed(4))}`;
    },
    px = 1 / scale,
    r = 4 * px;
  const outline = `M${xy(e[0])} C${xy(e[1])} ${xy(e[2])} ${xy(e[3])} C${xy(e[4])} ${xy(e[5])} ${xy(e[6])} C${xy(e[7])} ${xy(e[8])} ${xy(e[9])} C${xy(e[10])} ${xy(e[11])} ${xy(e[0])} Z`,
    mesh = [0.25, 0.5, 0.75].flatMap((t) => [
      Array.from({ length: 17 }, (_, n) => at(coons(e, t, n / 16))),
      Array.from({ length: 17 }, (_, n) => at(coons(e, n / 16, t))),
    ]),
    arms = [
      [0, 1],
      [0, 11],
      [3, 2],
      [3, 4],
      [6, 5],
      [6, 7],
      [9, 8],
      [9, 10],
    ];
  return `<g class="warp-envelope" transform="translate(${item.x} ${item.y}) rotate(${item.rotation})"><path d="${pathData(mesh)}" fill="none" stroke="#c27a45" stroke-opacity=".4" stroke-width="${px}" pointer-events="none"/><path d="${outline}" fill="none" stroke="#c27a45" stroke-width="${1.5 * px}" pointer-events="none"/>${arms
    .map(([a, b]) => {
      const p = at(e[a]),
        q = at(e[b]);
      return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#c27a45" stroke-width="${px}" pointer-events="none"/>`;
    })
    .join("")}${e
    .map((point, n) => {
      const p = at(point);
      return CORNERS.includes(n)
        ? `<rect data-warp-point="${n}" class="warp-point" aria-label="エンベロープの角" x="${p.x - r}" y="${p.y - r}" width="${2 * r}" height="${2 * r}" fill="white" stroke="#c27a45" stroke-width="${1.5 * px}"/>`
        : `<circle data-warp-point="${n}" class="warp-point" aria-label="エンベロープのハンドル" cx="${p.x}" cy="${p.y}" r="${r * 0.85}" fill="#c27a45" stroke="white" stroke-width="${px}"/>`;
    })
    .join("")}</g>`;
}
// Node editor overlay: the path, handles of the selected nodes (and of the
// segments touching them) as lines with round tips, and square anchors;
// selected anchors are filled. Sizes are in screen pixels.
function pathOverlay(item, scale) {
  const path = pathEdit.path,
    selection = pathEdit.selection,
    px = 1 / scale,
    r = 3.5 * px,
    f = (v) => Number(v.toFixed(4));
  const handles = visibleHandles(path, selection)
    .map(({ key, side }) => {
      const node = nodeAt(path, key),
        h = node[side];
      return `<line x1="${f(node.x)}" y1="${f(node.y)}" x2="${f(h.x)}" y2="${f(h.y)}" stroke="#1f7ac0" stroke-width="${px}" pointer-events="none"/><circle data-handle="${key}:${side}" class="path-handle" aria-label="ハンドル" cx="${f(h.x)}" cy="${f(h.y)}" r="${r * 0.9}" fill="white" stroke="#1f7ac0" stroke-width="${1.2 * px}"/>`;
    })
    .join("");
  const anchors = nodeKeys(path)
    .map((key) => {
      const n = nodeAt(path, key),
        on = selection.has(key);
      return `<rect data-node="${key}" class="path-node${on ? " selected" : ""}" aria-label="アンカーポイント" x="${f(n.x - r)}" y="${f(n.y - r)}" width="${2 * r}" height="${2 * r}" fill="${on ? "#1f7ac0" : "white"}" stroke="#1f7ac0" stroke-width="${1.2 * px}"/>`;
    })
    .join("");
  return `<g class="path-edit" transform="translate(${item.x} ${item.y}) rotate(${item.rotation})"><path d="${toPathData(path)}" fill="none" stroke="#1f7ac0" stroke-width="${1.2 * px}" pointer-events="none"/>${handles}${anchors}</g>`;
}
// Rotation handle: a knob above the selection, 24 px over its top edge. A
// single item carries it in its own rotated frame; several items share one
// over their combined box, drawn dashed.
function rotateOverlay(items, scale) {
  const px = 1 / scale,
    knob = (x, y, top) =>
      `<line x1="${x}" y1="${top}" x2="${x}" y2="${y}" stroke="#3b85b5" stroke-width="${px}" pointer-events="none"/><circle data-rotate="1" class="rotate-handle" aria-label="回転ハンドル" cx="${x}" cy="${y}" r="${4.5 * px}" fill="white" stroke="#3b85b5" stroke-width="${1.5 * px}"/>`;
  if (items.length === 1) {
    const i = items[0],
      b = itemBounds(i),
      x = b.x + b.w / 2;
    return `<g transform="translate(${i.x} ${i.y}) rotate(${i.rotation})">${knob(x, b.y - 24 * px, b.y)}</g>`;
  }
  const corners = items.flatMap((i) => {
      const b = itemBounds(i);
      return [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x, b.y + b.h],
        [b.x + b.w, b.y + b.h],
      ].map(([x, y]) => transform({ x, y }, i));
    }),
    xs = corners.map((q) => q.x),
    ys = corners.map((q) => q.y),
    box = bounds([corners]),
    cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="none" stroke="#3b85b5" stroke-width="${px}" stroke-dasharray="${4 * px} ${3 * px}" pointer-events="none"/>${knob(cx, Math.min(...ys) - 24 * px, Math.min(...ys))}`;
}
function renderCanvas() {
  const svg = $("#canvas");
  svg.setAttribute("viewBox", `0 0 ${project.width} ${project.height}`);
  const available = Math.max(300, $("#canvas-scroll").clientWidth - 100),
    height = Math.max(240, $("#canvas-scroll").clientHeight - 90);
  const scale =
    Math.min(available / project.width, height / project.height) * zoom;
  $("#board-wrap").style.width = `${project.width * scale}px`;
  $("#board-wrap").style.height = `${project.height * scale}px`;
  const visible = visibleItems(project),
    bridges = visible.filter((i) => i.type === "bridge"),
    normal = visible.filter((i) => i.type !== "bridge");
  $("#objects").innerHTML = preview
    ? `<path d="${pathData(cutGeometry(visibleItems(project)).paths)}" fill="none" stroke="#d84435" stroke-width="0.25"/>`
    : normal
        .map(
          (i) =>
            `<g data-object="${i.id}" class="canvas-object"><path d="${pathData(stencilContours(i, bridges))}" fill="${i.type === "line" ? "none" : selectionIds().includes(i.id) ? "#d9e9f5" : "#354859"}" fill-opacity="${i.type === "line" ? 0 : 0.9}" fill-rule="nonzero" stroke="${selectionIds().includes(i.id) ? "#276c9c" : "#243b50"}" stroke-width="0.22"/><path d="${pathData(worldContours(i))}" fill="none" stroke="transparent" stroke-width="2"/></g>`,
        )
        .join("") +
      bridges
        .map(
          (i) =>
            `<rect data-object="${i.id}" class="canvas-object bridge-object" x="${-i.w / 2}" y="${-i.h / 2}" width="${i.w}" height="${i.h}" transform="translate(${i.x} ${i.y}) rotate(${i.rotation})" fill="#faad53" fill-opacity="0.65" stroke="#df7b21" stroke-width="0.25"/>`,
        )
        .join("");
  let overlay = "";
  for (const i of selectedItems())
    if (!preview) {
      if (i.id === warpId) {
        overlay += warpOverlay(i, scale);
        continue;
      }
      if (i.id === pathEdit?.id) {
        overlay += pathOverlay(i, scale);
        continue;
      }
      const b = itemBounds(i),
        single = selectedItems().length === 1 && canResize(i),
        handle = 3 / scale;
      overlay += `<g transform="translate(${i.x} ${i.y}) rotate(${i.rotation})"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#3b85b5" stroke-width="0.22" stroke-dasharray="1.2 0.8" pointer-events="none"/>${
        single
          ? [
              [0, 0],
              [1, 0],
              [0, 1],
              [1, 1],
            ]
              .map(
                ([cx, cy]) =>
                  `<rect data-resize="${cx},${cy}" aria-label="拡縮ハンドル ${cx},${cy}" class="resize-handle" x="${b.x + cx * b.w - handle}" y="${b.y + cy * b.h - handle}" width="${handle * 2}" height="${handle * 2}" fill="white" stroke="#3b85b5" stroke-width=".3"/>`,
              )
              .join("")
          : ""
      }</g>`;
    }
  const chosen = selectedItems();
  if (!preview && !warpId && !pathEdit && chosen.length)
    overlay += rotateOverlay(chosen, scale);
  $("#selection").innerHTML = overlay;
  $("#canvas").style.cursor = preview
    ? "default"
    : tool === "select"
      ? "default"
      : "crosshair";
  $("#canvas-mode").textContent = preview
    ? "加工プレビュー · 実際に出力されるカット線"
    : warpId
      ? "ワープ編集中 · アウトラインそのものを変形"
      : pathEdit
        ? "パス編集中 · ノードを直接変形"
        : "スケッチ編集中";
  $("#hint").textContent = drag?.label
    ? drag.label
    : preview
      ? "赤い線をカットします。自動ブリッジは帯の側面を含む切り抜き輪郭です。"
      : warpId
        ? "角・ハンドルをドラッグ（Altで角だけ）· Esc / Enter で完了"
        : pathEdit
          ? "ノード・ハンドルをドラッグ · Shiftで追加選択 · パス上をダブルクリックで追加 · Deleteで削除 · Escで終了"
          : tool === "select"
            ? "空白からドラッグで範囲選択 · 右クリックで編集メニュー · 2本指スワイプで移動 · ピンチでズーム"
            : `${labels[tool]}を配置する場所をクリック`;
  $("#board-label").textContent = `${project.width} × ${project.height} mm`;
  $("#zoom-reset").textContent = `${Math.round(zoom * 100)}%`;
}
// While typing, the inspector is left intact so the text box keeps focus and IME state.
function render({ properties = true } = {}) {
  document.querySelectorAll("[data-loading-disabled]").forEach((el) => {
    el.disabled = el.dataset.loadingDisabled === "true";
    delete el.dataset.loadingDisabled;
  });
  $("#app").setAttribute("aria-busy", String(loading));
  ensureLayers(project);
  normalizeGroups(project);
  if (!project.layers.some((l) => l.id === activeLayer))
    activeLayer = project.layers[0].id;
  const valid = selectionIds().filter((id) =>
    isEditable(
      project,
      project.items.find((i) => i.id === id),
    ),
  );
  multi = valid;
  selected = valid.at(-1) || null;
  // Warp mode lasts while its text is the only selection.
  if (warpId && !(multi.length === 1 && warpItem())) warpId = null;
  if (pathEdit && !(multi.length === 1 && selected === pathEdit.id))
    pathEdit = null;
  $("#project-name").textContent = project.name;
  renderLayers();
  if (properties) {
    liveSession = null;
    renderProperties();
  } else {
    const title = $("#properties h3");
    if (title) title.textContent = selectedItem()?.name ?? "";
  }
  renderCanvas();
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  $("#preview").classList.toggle("active", preview);
  $("#undo").disabled = !history.length;
  $("#redo").disabled = !future.length;
  $("#outline").disabled =
    selectedItems().length !== 1 || selectedItem()?.type !== "text";
  $("#auto-bridge").disabled = !selectedItems().some(
    (i) => i.type !== "bridge",
  );
  $("#ungroup").disabled = !selectedItems().some(ungroupKind);
  $("#group").disabled = selectedItems().filter((i) => !i.targetId).length < 2;
  $("#warp").disabled =
    selectedItems().length !== 1 || !canWarp(selectedItem());
  $("#warp").classList.toggle("active", Boolean(warpId));
  $("#edit-path").disabled =
    !pathEdit &&
    (selectedItems().length !== 1 ||
      ![...PATHABLE, "text"].includes(selectedItem()?.type));
  $("#edit-path").classList.toggle("active", Boolean(pathEdit));
  $("#delete").disabled = $("#duplicate").disabled = !selectedItem();
  const c = cutGeometry(visibleItems(project)),
    outside = !withinBoard();
  $("#checks").innerHTML =
    `<div class="check-row"><span>閉じた輪郭</span><b>${c.closed}</b></div><div class="check-row ${c.untouched ? "warning" : "success"}"><span>切り残しなし</span><b>${c.untouched}</b></div><div class="check-row ${c.unbridgedIslands ? "warning" : "success"}"><span>内外が未接続の島</span><b>${c.unbridgedIslands}</b></div><div class="check-row"><span>ブリッジ</span><b>${project.items.filter((i) => i.type === "bridge").length}</b></div>${c.vanished ? `<div class="check-row warning"><span>完全に隠れた輪郭</span><b>${c.vanished}</b></div>` : ""}<div class="check-summary ${outside || c.vanished ? "warning" : ""}">${c.vanished ? "! ブリッジ幅を縮めて輪郭を残してください" : outside ? "! 加工エリア外にカット線があります" : c.unbridgedIslands ? "! 内側の島に自動ブリッジを適用してください" : c.untouched ? "! 脱落させたくない輪郭にブリッジを追加" : c.closed ? "✓ ブリッジ処理済み · 加工プレビューを確認" : "図形や文字を追加してください"}</div>`;
  if (loading)
    document.querySelectorAll("button,input,select,textarea").forEach((el) => {
      el.dataset.loadingDisabled = String(el.disabled);
      el.disabled = true;
    });
}
function updateSelected(key, value) {
  const old = selectedItem();
  if (!isEditable(project, old)) return;
  try {
    const next = { ...old, [key]: key === "stretch" ? value / 100 : value };
    if (key === "radius" && value > Math.min(old.w, old.h) / 2) {
      next.radius = Math.min(old.w, old.h) / 2;
      notify(`フィレット半径は短辺の半分（${next.radius} mm）までです。`);
    }
    if (old.ratioLocked && ["w", "h"].includes(key) && old.w > 0 && old.h > 0) {
      next[key === "w" ? "h" : "w"] =
        key === "w" ? (value * old.h) / old.w : (value * old.w) / old.h;
      if (next.w > 2000 || next.h > 2000)
        throw Error("寸法は2000 mm以内にしてください。");
    }
    if (
      next.type === "text" &&
      ["text", "font", "size", "spacing", "vertical", "stretch"].includes(key)
    ) {
      next.contours = textContours(next);
      next.name = next.text || "空の文字";
    } else if (["rect", "circle", "line"].includes(next.type)) {
      if (next.radius)
        next.radius = Math.min(next.radius, next.w / 2, next.h / 2);
      next.contours = applyWarp(next, shapeSource(next));
    }
    checkpoint();
    replaceItem(old, next);
    commit();
  } catch (e) {
    notify(e.message);
    renderProperties();
  }
}
$("#properties").addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.prop) {
    if (!el.checkValidity() || !Number.isFinite(el.valueAsNumber)) {
      notify("有効な数値を入力してください。");
      renderProperties();
      return;
    }
    updateSelected(el.dataset.prop, el.valueAsNumber);
  } else if (el.id === "font-select") chooseFont(el.value);
  else if (el.id === "vertical") updateSelected("vertical", el.checked);
  else if (el.id === "ratio-lock") updateSelected("ratioLocked", el.checked);
  else if (el.id === "warp-bend") liveSession = null;
  else if (el.dataset.nodeProp)
    moveSelectedNodeTo(el.dataset.nodeProp, el.valueAsNumber);
  else if (el.id === "path-d") {
    try {
      pathEdit.selection = new Set();
      applyPath(parsePathData(el.value), "SVG path d を反映しました。");
    } catch (error) {
      notify(error.message);
      renderProperties();
    }
  } else if (el.id === "item-layer")
    moveSelectionToLayer(selectionIds(), el.value);
});
// Continuous edits (typing, the bend slider) apply on every input event and
// share one undo step. Scoped bridges follow from the session start, so
// repeated updates do not accumulate drift.
function liveUpdate(current, next, kind) {
  if (liveSession?.id !== current.id || liveSession.kind !== kind) {
    checkpoint();
    liveSession = {
      id: current.id,
      kind,
      before: structuredClone(current),
      bridges: project.items
        .filter((i) => i.targetId === current.id)
        .map((b) => structuredClone(b)),
    };
  }
  for (const bridge of project.items) {
    const start = liveSession.bridges.find((b) => b.id === bridge.id);
    if (start) Object.assign(bridge, structuredClone(start));
  }
  followBridges(project.items, liveSession.before, next);
  project.items[project.items.indexOf(current)] = next;
  render({ properties: false });
  persist();
}
function liveText(value) {
  const current = selectedItem();
  if (current?.type !== "text" || !isEditable(project, current)) return;
  const next = { ...current, text: value, name: value || "空の文字" };
  try {
    next.contours = textContours(next);
  } catch (e) {
    notify(e.message);
    return;
  }
  liveUpdate(current, next, "text");
}
function liveBend(percent) {
  const item = warpItem();
  if (!item || !WARP_PRESETS.some(([id]) => id === item.warp.preset)) return;
  const { box } = unwarpedLayout(item),
    bend = percent / 100;
  liveUpdate(
    item,
    withWarp(item, {
      ...item.warp,
      bend,
      envelope: presetEnvelope(item.warp.preset, bend, box.w / (box.h || 1)),
    }),
    "bend",
  );
  $("#warp-bend-value").textContent = `${percent}%`;
}
$("#properties").addEventListener("input", (e) => {
  if (e.target.id === "text-content") liveText(e.target.value);
  if (e.target.id === "warp-bend") liveBend(e.target.valueAsNumber);
});
$("#properties").addEventListener("focusout", (e) => {
  if (e.target.id === "warp-bend") liveSession = null;
  if (e.target.id !== "text-content") return;
  liveSession = null;
  // Text the font cannot draw is not kept; show what the canvas shows.
  const current = selectedItem();
  if (current?.type === "text") e.target.value = current.text;
});
$("#properties").addEventListener("click", (e) => {
  if (e.target.closest("#add-font")) requestFontFile();
  if (e.target.closest("#font-gallery-button")) openFontGallery();
  if (e.target.closest("#item-auto-bridge")) applyAutoBridges();
  if (e.target.closest("#item-ungroup")) ungroup();
  if (e.target.closest("#item-group")) groupSelection();
  if (e.target.closest("#enter-warp")) enterWarp();
  if (e.target.closest("#enter-path")) enterPathEdit(selected);
  if (e.target.closest("#outline-edit") && outlineSelected())
    enterPathEdit(selected);
  const nodeButton = e.target.closest("[data-node-action]");
  if (nodeButton) nodeAction(nodeButton.dataset.nodeAction);
  if (e.target.closest("#path-done")) exitPathEdit();
  const preset = e.target.closest("[data-warp-preset]");
  if (preset) applyWarpPreset(preset.dataset.warpPreset);
  if (e.target.closest("#warp-reset")) resetWarp();
  if (e.target.closest("#warp-remove")) removeWarp();
  if (e.target.closest("#warp-done")) exitWarp();
  const op = e.target.closest("[data-boolean]");
  if (op) applyBoolean(op.dataset.boolean);
});
function moveSelectionToLayer(ids, layerId) {
  ids = expandGroups(project, ids);
  try {
    const moved = layerMovePlan(project, ids, layerId);
    if (moved.every((i) => i.layerId === layerId)) return;
    checkpoint();
    for (const item of moved) item.layerId = layerId;
    activeLayer = layerId;
    multi = ids;
    selected = multi.at(-1) || null;
    commit();
    notify(`${moved.length} アイテムをレイヤーへ移動しました。`);
  } catch (e) {
    notify(e.message);
    renderProperties();
  }
}
let layerDragIds = [];
function clearLayerDrop() {
  document
    .querySelectorAll(".drop-target,.drop-rejected")
    .forEach((el) => el.classList.remove("drop-target", "drop-rejected"));
}
$("#layers").addEventListener("dragstart", (e) => {
  const row = e.target.closest("[data-layer]");
  if (
    loading ||
    !row ||
    !isEditable(
      project,
      project.items.find((i) => i.id === row.dataset.layer),
    )
  ) {
    e.preventDefault();
    return;
  }
  layerDragIds = selectionIds().includes(row.dataset.layer)
    ? selectedItems().map((i) => i.id)
    : [row.dataset.layer];
  e.dataTransfer.setData(
    "application/x-typefab-items",
    JSON.stringify(layerDragIds),
  );
  e.dataTransfer.effectAllowed = "move";
});
$("#layers").addEventListener("dragover", (e) => {
  const zone = e.target.closest("[data-drop-layer]");
  if (!layerDragIds.length || !zone) return;
  e.preventDefault();
  clearLayerDrop();
  try {
    layerMovePlan(project, layerDragIds, zone.dataset.dropLayer);
    zone.classList.add("drop-target");
    e.dataTransfer.dropEffect = "move";
  } catch {
    zone.classList.add("drop-rejected");
    e.dataTransfer.dropEffect = "none";
  }
});
$("#layers").addEventListener("dragleave", (e) => {
  if (!$("#layers").contains(e.relatedTarget)) clearLayerDrop();
});
$("#layers").addEventListener("drop", (e) => {
  const zone = e.target.closest("[data-drop-layer]");
  if (!layerDragIds.length || !zone) return;
  e.preventDefault();
  const ids = [...layerDragIds];
  layerDragIds = [];
  clearLayerDrop();
  moveSelectionToLayer(ids, zone.dataset.dropLayer);
});
$("#layers").addEventListener("dragend", () => {
  layerDragIds = [];
  clearLayerDrop();
});
// Browser rows: click selects one row, ⌘/Ctrl toggles it, Shift selects the
// range from the anchor (Ctrl/⌘ Shift adds the range to the selection).
function selectRow(id, e) {
  const toggle = e.metaKey || (e.ctrlKey && !isMac);
  if (e.shiftKey) {
    const anchor = selectionIds().includes(browserAnchor)
        ? browserAnchor
        : selected || id,
      range = rangeIds(project, anchor, id);
    multi = toggle ? [...new Set([...selectionIds(), ...range])] : range;
    selected = multi.at(-1) || null;
    return;
  }
  selectItem(id, toggle);
  browserAnchor = id;
}
$("#layers").addEventListener("click", (e) => {
  // On a Mac, Ctrl+click is a right click and opens the menu instead.
  if (isMac && e.ctrlKey) return;
  const b = e.target.closest("[data-layer]");
  if (b) {
    selectRow(b.dataset.layer, e);
    render();
    return;
  }
  const groupRow = e.target.closest("[data-group-row]");
  if (groupRow) {
    const member = project.items.find(
      (i) => i.groupId === groupRow.dataset.groupRow,
    );
    if (member) selectGroupOf(member.id, e.shiftKey || e.metaKey || e.ctrlKey);
    render();
    return;
  }
  const active = e.target.closest("[data-active-layer]");
  if (active) {
    activeLayer = active.dataset.activeLayer;
    render();
    return;
  }
  const action = e.target.closest("[data-layer-action]");
  if (!action) return;
  const layer = project.layers.find((l) => l.id === action.dataset.id),
    index = project.layers.indexOf(layer),
    kind = action.dataset.layerAction;
  if (!layer || (kind === "remove" && layer.locked)) return;
  checkpoint();
  if (["visible", "locked"].includes(kind)) layer[kind] = !layer[kind];
  else if (kind === "up" && index < project.layers.length - 1)
    [project.layers[index], project.layers[index + 1]] = [
      project.layers[index + 1],
      layer,
    ];
  else if (kind === "down" && index > 0)
    [project.layers[index], project.layers[index - 1]] = [
      project.layers[index - 1],
      layer,
    ];
  else if (kind === "remove" && project.layers.length > 1) {
    const dest = project.layers.find((l) => l !== layer);
    for (const i of project.items)
      if (i.layerId === layer.id) i.layerId = dest.id;
    project.layers.splice(index, 1);
    activeLayer = dest.id;
  }
  commit();
});
$("#layers").addEventListener("change", (e) => {
  if (e.target.dataset.layerName) {
    checkpoint();
    project.layers.find((l) => l.id === e.target.dataset.layerName).name =
      e.target.value.trim() || "レイヤー";
    commit();
  }
});
$("#add-layer").onclick = () => {
  if (project.layers.length >= 100) {
    notify("レイヤーは100個までです。");
    return;
  }
  checkpoint();
  const layer = {
    id: uid(),
    name: `レイヤー ${project.layers.length + 1}`,
    visible: true,
    locked: false,
  };
  project.layers.push(layer);
  activeLayer = layer.id;
  commit();
};
for (const b of document.querySelectorAll("[data-tool]"))
  b.onclick = () => {
    tool = b.dataset.tool;
    preview = false;
    render();
  };
$("#add-text").onclick = () => addItem("text");
$("#preview").onclick = togglePreview;
$("#snap").onchange = (e) => (snap = e.target.checked);
$("#undo").onclick = undo;
$("#redo").onclick = redo;
function remove() {
  const ids = selectedItems().map((i) => i.id);
  if (!ids.length) return;
  checkpoint();
  project.items = project.items.filter(
    (i) => !ids.includes(i.id) && !ids.includes(i.targetId),
  );
  selectItem(null);
  commit();
}
$("#delete").onclick = remove;
function addCopies(copies) {
  if (project.items.length + copies.length > 2000) {
    notify("オブジェクトが多すぎます。");
    return false;
  }
  checkpoint();
  project.items.push(...copies);
  return true;
}
function duplicate() {
  const chosen = selectedItems();
  if (!chosen.length) return;
  const { copies, ids } = cloneItems(
    project.items,
    chosen.map((i) => i.id),
    uid,
  );
  if (!addCopies(copies)) return;
  multi = ids;
  selected = multi.at(-1);
  commit();
}
$("#duplicate").onclick = duplicate;
// The clipboard lives in this page only; it holds the items with their scoped bridges.
function copySelection() {
  const ids = selectedItems().map((i) => i.id);
  if (!ids.length) return false;
  clipboard = {
    ids,
    items: structuredClone(
      project.items.filter(
        (i) => ids.includes(i.id) || ids.includes(i.targetId),
      ),
    ),
  };
  pasteCount = 0;
  notify(`${ids.length} アイテムをコピーしました。`);
  return true;
}
function cutSelection() {
  if (!copySelection()) return;
  remove();
  // The first paste after a cut goes back to the same place.
  pasteCount = -1;
  notify(`${clipboard.ids.length} アイテムを切り取りました。`);
}
function paste() {
  if (!clipboard) {
    notify(
      "貼り付けるアイテムがありません。コピーまたは切り取りしてください。",
    );
    return;
  }
  const layer = project.layers.find((l) => l.id === activeLayer);
  if (!layer?.visible || layer.locked) {
    notify("表示中のロックされていないレイヤーを選んでください。");
    return;
  }
  pasteCount++;
  const { copies, ids } = cloneItems(
    clipboard.items,
    clipboard.ids,
    uid,
    5 * pasteCount,
    activeLayer,
  );
  // A copied bridge whose owner is gone becomes a regular bridge.
  for (const copy of copies)
    if (
      copy.targetId &&
      !copies.some((c) => c.id === copy.targetId) &&
      !project.items.some((i) => i.id === copy.targetId)
    )
      delete copy.targetId;
  if (!addCopies(copies)) return;
  multi = ids;
  selected = multi.at(-1);
  preview = false;
  commit();
  notify(`${ids.length} アイテムを貼り付けました。`);
}
// Text becomes a fixed path made of the glyphs' own Bézier curves, so the
// outline is unchanged and every node can be edited. A warped text keeps its
// warp with the unwarped glyph path as source.
function outlineSelected() {
  const i = selectedItem();
  if (i?.type !== "text" || !isEditable(project, i)) return false;
  let path = null;
  try {
    path = pathFromCommands(textGlyphs(i).flatMap((g) => g.commands));
  } catch {
    // Without the font the drawn outline is kept as it is.
  }
  checkpoint();
  if (i.warp) {
    if (path) i.warp = { ...i.warp, source: pathContours(path) };
    else delete i.warp;
  } else if (path) i.contours = pathContours(path);
  if (path) i.path = path;
  for (const key of ["text", "font", "size", "spacing", "vertical", "stretch"])
    delete i[key];
  i.type = "outline";
  commit();
  notify(
    "アウトライン化しました。ダブルクリックでノードを編集、四隅で拡縮できます。",
  );
  return true;
}
$("#outline").onclick = outlineSelected;
function groupSelection() {
  try {
    const chosen = selectedItems().filter((i) => !i.targetId);
    if (chosen.length < 2)
      throw Error("グループ化するアイテムを2つ以上選択してください。");
    const primary = chosen.includes(selectedItem())
      ? selectedItem()
      : chosen.at(-1);
    checkpoint();
    multi = groupItems(
      project,
      chosen.map((i) => i.id),
      uid(),
      primary.layerId,
    );
    selected = primary.id;
    multi = [...multi.filter((id) => id !== primary.id), primary.id];
    preview = false;
    commit();
    notify(
      `${multi.length} アイテムをグループ化しました。キャンバスでまとめて選択・移動できます。`,
    );
  } catch (e) {
    notify(e.message);
  }
}
$("#group").onclick = groupSelection;
$("#warp").onclick = () => (warpId ? exitWarp() : enterWarp());
$("#edit-path").onclick = () => {
  if (pathEdit) exitPathEdit();
  else if (selectedItem()?.type === "text") {
    if (outlineSelected()) enterPathEdit(selected);
  } else enterPathEdit(selected);
};
// Double-clicking text opens a small editor under it; typing updates live.
const editor = $("#text-editor"),
  editorText = $("#canvas-text");
function editText(id) {
  const item = project.items.find((i) => i.id === id);
  if (loading || item?.type !== "text" || !isEditable(project, item)) return;
  if (warpId !== id) warpId = null;
  selectItem(id);
  preview = false;
  tool = "select";
  render();
  const box = (
    document.querySelector(`#objects [data-object="${id}"]`) ||
    $("#canvas-scroll")
  ).getBoundingClientRect();
  editorText.value = item.text;
  editor.hidden = false;
  const size = editor.getBoundingClientRect(),
    below = box.bottom + 8;
  editor.style.left = `${Math.max(8, Math.min(box.left, innerWidth - size.width - 8))}px`;
  editor.style.top = `${below + size.height > innerHeight - 8 ? Math.max(8, box.top - size.height - 8) : below}px`;
  editorText.focus();
  editorText.select();
}
function closeEditor() {
  if (editor.hidden) return;
  editor.hidden = true;
  liveSession = null;
  render();
}
editorText.addEventListener("input", () => liveText(editorText.value));
editorText.addEventListener("keydown", (e) => {
  if (e.isComposing) return;
  if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
    e.preventDefault();
    closeEditor();
  }
});
editorText.addEventListener("focusout", closeEditor);
function rotateSelection(degrees) {
  const chosen = selectedItems();
  if (!chosen.length) return;
  const ids = chosen.map((i) => i.id),
    center = selectionCenter(chosen, itemBounds);
  checkpoint();
  for (const item of chosen) {
    if (item.targetId && ids.includes(item.targetId)) continue;
    const current = project.items.find((i) => i.id === item.id);
    replaceItem(current, rotateAbout(current, center, degrees));
  }
  commit();
}
const arrangeLabels = {
  front: "最前面へ",
  forward: "前面へ",
  backward: "背面へ",
  back: "最背面へ",
};
function arrange(mode) {
  const ids = selectedItems().map((i) => i.id);
  if (!ids.length) return;
  const next = arrangeItems(project.items, ids, mode);
  if (next.every((item, n) => item === project.items[n])) {
    notify("これ以上移動できません。");
    return;
  }
  checkpoint();
  project.items = next;
  commit();
  notify(`${arrangeLabels[mode]}移動しました。`);
}
function selectAll() {
  multi = visibleItems(project)
    .filter((i) => isEditable(project, i))
    .map((i) => i.id);
  selected = multi.at(-1) || null;
  preview = false;
  render();
}
// Fusion's "Find in Browser": reveal and focus the row of the selection.
function findInBrowser() {
  const row = document.querySelector(`[data-layer="${selected}"]`);
  if (!row) return;
  row.scrollIntoView({ block: "nearest" });
  row.focus();
  row.classList.add("found");
  setTimeout(() => row.classList.remove("found"), 1200);
}
function togglePreview() {
  preview = !preview;
  tool = "select";
  render();
}
function applyAutoBridges() {
  const ids = selectedItems()
    .filter((i) => i.type !== "bridge")
    .map((i) => i.id);
  if (!ids.length) {
    notify("自動ブリッジを適用するアイテムを選択してください。");
    return;
  }
  const obsolete = project.items
    .filter(
      (i) =>
        ids.includes(i.targetId) && i.bridgeMode && i.bridgeMode !== "stencil",
    )
    .map((i) => i.id);
  const added = automaticBridges(
    visibleItems(project).filter((i) => !obsolete.includes(i.id)),
    1.5,
    ids,
  );
  if (!added.length) {
    notify("選択アイテムに切り残しを追加する閉輪郭はありません。");
    return;
  }
  if (project.items.length + added.length > 2000) {
    notify("オブジェクトが多すぎます。文字を減らしてください。");
    return;
  }
  checkpoint();
  project.items = project.items.filter((i) => !obsolete.includes(i.id));
  project.items.push(...added.map((i) => ({ ...i, id: uid() })));
  preview = true;
  commit();
  notify(
    `選択した ${ids.length} アイテムに ${added.length} 個のブリッジを追加しました。`,
  );
}
$("#auto-bridge").onclick = applyAutoBridges;
function applyBoolean(operation) {
  try {
    const chosen = selectedItems(),
      contours = booleanContours(chosen, operation);
    if (!contours.length)
      throw Error("演算結果が空です。元のアイテムを残しました。");
    const ids = chosen.map((i) => i.id),
      name = {
        union: "結合",
        difference: "切り抜き",
        intersection: "交差",
        xor: "XOR",
      }[operation];
    const result = {
      id: uid(),
      type: "outline",
      name,
      x: 0,
      y: 0,
      rotation: 0,
      contours,
      layerId: chosen[0].layerId,
      ratioLocked: false,
    };
    checkpoint();
    project.items = project.items.filter((i) => !ids.includes(i.id));
    for (const b of project.items)
      if (ids.includes(b.targetId)) {
        b.targetId = result.id;
        b.layerId = result.layerId;
      }
    project.items.push(result);
    selectItem(result.id);
    preview = false;
    commit();
    notify(`${name}を実行しました。元に戻す操作で復元できます。`);
  } catch (e) {
    notify(e.message);
  }
}
function enterPathEdit(id) {
  const item = project.items.find((i) => i.id === id);
  if (!item || !PATHABLE.includes(item.type) || !isEditable(project, item)) {
    notify(
      "パス編集できるのはアウトライン化した文字・固定パス・長方形・楕円です。",
    );
    return;
  }
  const path = workingPath(item);
  if (!nodeKeys(path).length) {
    notify("編集できる輪郭がありません。");
    return;
  }
  warpId = null;
  selectItem(id);
  preview = false;
  tool = "select";
  pathEdit = { id, path, selection: new Set() };
  render();
  notify(
    "パス編集: ノードをクリックして選択し、ドラッグで変形します。Escで終了。",
  );
}
function exitPathEdit() {
  pathEdit = null;
  render();
}
// Every node operation replaces the item by a fixed path built from the edit.
function applyPath(path, message) {
  const item = pathItem();
  if (!item) return;
  checkpoint();
  replaceItem(item, toPathItem(item, path));
  pathEdit.path = path;
  pathEdit.selection = new Set(
    [...pathEdit.selection].filter((key) => nodeAt(path, key)),
  );
  commit();
  if (message) notify(message);
}
function nodeAction(action) {
  if (!pathItem()) return;
  const keys = [...pathEdit.selection];
  if (action === "all") {
    pathEdit.selection = new Set(nodeKeys(pathEdit.path));
    render();
    return;
  }
  if (!keys.length) {
    notify(
      "ノードを選択してください（クリック・Shift+クリック・範囲ドラッグ）。",
    );
    return;
  }
  try {
    if (["smooth", "corner", "line"].includes(action))
      applyPath(
        setNodeType(pathEdit.path, keys, action),
        {
          smooth: "スムーズノードにしました。ハンドルは連動します。",
          corner: "コーナーノードにしました。ハンドルは独立して動きます。",
          line: "ハンドルを削除して直線にしました。",
        }[action],
      );
    else if (action === "delete") {
      const path = deleteNodes(pathEdit.path, keys);
      pathEdit.selection = new Set();
      applyPath(path, `${keys.length} 個のノードを削除しました。`);
    } else if (action === "insert") {
      // Add a node in the middle of the segment after each selected node,
      // from the last one back so earlier indices stay valid.
      let path = pathEdit.path;
      const added = [];
      for (const [s, n] of keys
        .map(parseKey)
        .sort((a, b) => b[0] - a[0] || b[1] - a[1])) {
        const sp = path[s];
        if (!sp.closed && n >= sp.nodes.length - 1) continue;
        path = insertNode(path, s, n, 0.5).path;
        for (const a of added) if (a[0] === s && a[1] > n) a[1]++;
        added.push([s, n + 1]);
      }
      if (!added.length)
        throw Error("選択したノードの後ろに区間がありません。");
      pathEdit.selection = new Set(added.map(([s, n]) => `${s}:${n}`));
      applyPath(path, `${added.length} 個のノードを追加しました。`);
    }
  } catch (error) {
    notify(error.message);
  }
}
function moveSelectedNodeTo(axis, value) {
  const item = pathItem(),
    [key] = pathEdit.selection;
  if (!item || !key || !Number.isFinite(value)) return;
  const node = nodeAt(pathEdit.path, key),
    world = transform(node, item);
  world[axis] = value;
  const local = transform(world, item, true);
  applyPath(
    moveNodes(pathEdit.path, [key], local.x - node.x, local.y - node.y),
  );
}
function nudgeNodes(dx, dy) {
  const item = pathItem(),
    local = transform({ x: item.x + dx, y: item.y + dy }, item, true);
  applyPath(
    moveNodes(pathEdit.path, [...pathEdit.selection], local.x, local.y),
  );
}
// Text Warp: the envelope deforms the real glyph outlines; the text, font and
// warp parameters stay on the item so it can be edited again.
function enterWarp() {
  const item = selectedItem();
  if (selectedItems().length !== 1 || !canWarp(item)) {
    notify("ワープする文字・長方形・楕円・固定パスを1つ選択してください。");
    return;
  }
  try {
    unwarpedLayout(item);
  } catch (e) {
    notify(e.message);
    return;
  }
  // A flat envelope changes nothing, so entering needs no undo step.
  if (!item.warp)
    item.warp = {
      preset: "none",
      bend: 0.5,
      envelope: flatEnvelope(),
      // A fixed path has nothing to rebuild from, so it keeps its outline.
      ...(item.type === "outline" && {
        source: structuredClone(item.contours),
      }),
    };
  const { box } = unwarpedLayout(item);
  if (!(box.w > 0.001 && box.h > 0.001)) {
    if (isFlat(item.warp.envelope)) delete item.warp;
    notify("幅と高さのある形だけワープできます。");
    return;
  }
  warpId = item.id;
  pathEdit = null;
  preview = false;
  tool = "select";
  render();
  notify(
    "ワープ: プリセットを選ぶか、エンベロープの角・ハンドルをドラッグしてください。",
  );
}
function exitWarp() {
  const item = warpItem();
  if (item && isFlat(item.warp.envelope)) {
    item.contours = unwarpedLayout(item).contours;
    delete item.warp;
  }
  warpId = null;
  render();
  persist();
}
function applyWarpPreset(name) {
  const item = warpItem();
  if (!item) return;
  const { box } = unwarpedLayout(item),
    bend = item.warp.bend || 0.5;
  checkpoint();
  replaceItem(
    item,
    withWarp(item, {
      ...item.warp,
      preset: name,
      bend,
      envelope: presetEnvelope(name, bend, box.w / (box.h || 1)),
    }),
  );
  commit();
}
function resetWarp() {
  const item = warpItem();
  if (!item || isFlat(item.warp.envelope)) return;
  checkpoint();
  replaceItem(
    item,
    withWarp(item, { ...item.warp, preset: "none", envelope: flatEnvelope() }),
  );
  commit();
}
function removeWarp() {
  const item = warpItem();
  if (!item) return;
  const next = { ...item, contours: unwarpedLayout(item).contours };
  delete next.warp;
  checkpoint();
  replaceItem(item, next);
  warpId = null;
  commit();
  notify("ワープを解除しました。元に戻す操作で復元できます。");
}
function ungroup() {
  // Groups are released first; ungrouping again splits text, then parts.
  const grouped = selectedItems().filter((i) => i.groupId);
  if (grouped.length) {
    checkpoint();
    multi = ungroupItems(
      project,
      grouped.map((i) => i.id),
    ).filter((id) =>
      isEditable(
        project,
        project.items.find((i) => i.id === id),
      ),
    );
    selected = multi.includes(selected) ? selected : multi.at(-1) || null;
    if (selected) multi = [...multi.filter((id) => id !== selected), selected];
    commit();
    notify(`グループを解除しました（${multi.length} アイテム）。`);
    return;
  }
  try {
    const replaced = [];
    for (const item of selectedItems()) {
      const kind = ungroupKind(item);
      if (!kind) continue;
      let done = kind,
        pieces =
          kind !== "characters"
            ? []
            : item.warp
              ? splitWarpedCharacters(item, textGlyphs(item))
              : splitCharacters(item, textGlyphs(item));
      // Several characters shaped into one glyph fall through to parts.
      if (pieces.length < 2) {
        pieces = splitParts(item);
        done = "parts";
      }
      if (pieces.length > 1)
        replaced.push({
          item,
          kind: done,
          pieces: pieces.map((p) => ({ ...p, id: uid() })),
        });
    }
    if (!replaced.length)
      throw Error("選択中のアイテムはこれ以上分解できません。");
    const added = replaced.reduce((n, r) => n + r.pieces.length - 1, 0);
    if (project.items.length + added > 2000)
      throw Error("オブジェクトが多すぎます。分解する文字を減らしてください。");
    checkpoint();
    for (const { item, pieces } of replaced) {
      const copies = reassignBridges(project.items, item.id, pieces, uid);
      project.items.splice(project.items.indexOf(item), 1, ...pieces);
      project.items.push(...copies);
    }
    multi = replaced.flatMap((r) => r.pieces.map((p) => p.id));
    selected = multi.at(-1);
    preview = false;
    commit();
    const kinds = new Set(replaced.map((r) => r.kind));
    notify(
      kinds.size > 1
        ? `${multi.length} アイテムに分解しました。元に戻す操作で復元できます。`
        : kinds.has("characters")
          ? `${multi.length} 文字に分解しました。もう一度で部位ごとに分解できます。`
          : `${multi.length} つの部位に分解しました。元に戻す操作で復元できます。`,
    );
  } catch (e) {
    notify(e.message);
  }
}
$("#ungroup").onclick = ungroup;
$("#export").onclick = exportFile;
$("#order").onclick = orderDesign;
$("#save-project").onclick = () =>
  notify(
    `${saveFile("typefab-project.json", JSON.stringify(project, null, 2), "application/json")} をダウンロードしました。`,
  );
$("#open-project").onclick = () => $("#project-file").click();
$("#new-project").onclick = () => {
  checkpoint();
  project = {
    version: 1,
    name: "無題のスケッチ",
    width: 240,
    height: 160,
    items: [],
  };
  selectItem(null);
  preview = false;
  commit();
  notify("新規プロジェクトを作成しました。元に戻す操作で復元できます。");
};
for (const key of ["width", "height"])
  $(`#board-${key}`).onchange = (e) => {
    if (!e.target.checkValidity() || !Number.isFinite(e.target.valueAsNumber)) {
      renderProperties();
      return;
    }
    checkpoint();
    project[key] = e.target.valueAsNumber;
    commit();
  };
$("#font-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 30 * 1024 * 1024)
      throw Error("フォントは30 MB以下にしてください。");
    await typographyReady;
    const bytes = await file.arrayBuffer();
    const font = opentype.parse(bytes);
    const id = `custom-${uid()}`;
    fontLoader.add(
      id,
      font,
      typography.makeShapingFont(await typography.fontSFNT(bytes)),
      file.name.replace(/\.[^.]+$/, ""),
    );
    if (selectedItem()?.type === "text") updateSelected("font", id);
    else render();
    notify(
      "フォントを追加しました。追加フォントはこのセッション内で利用できます。",
    );
  } catch (error) {
    notify(`フォントを読み込めません: ${error.message}`);
  }
  e.target.value = "";
};
// 「開く」 and dropped files: a .json project replaces the design, an SVG
// adds its shapes to it as editable paths.
async function openFile(file) {
  try {
    if (file.size > 20 * 1024 * 1024)
      throw Error("ファイルは20 MB以下にしてください。");
    const text = await file.text();
    if (/\.svg$/i.test(file.name) || file.type === "image/svg+xml") {
      importSVG(text, file.name);
      return;
    }
    const next = validateProject(JSON.parse(text));
    checkpoint();
    project = next;
    selectItem(null);
    preview = false;
    commit();
    notify(
      "プロジェクトを開きました。追加フォントの文字は保存された輪郭で表示します。",
    );
  } catch (error) {
    notify(`開けません: ${error.message}`);
  }
}
$("#project-file").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (file) await openFile(file);
};
function readSVG(text) {
  if (typeof DOMParser !== "function") return parseXML(text);
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (
    doc.getElementsByTagName("parsererror").length ||
    doc.documentElement?.localName !== "svg"
  )
    throw Error("SVGとして読み込めません。XMLの形式を確認してください。");
  return fromDOM(doc.documentElement);
}
// SVG shapes become fixed paths at their millimetre positions. Inkscape
// layers (as TypeFab exports) go to layers of the same name; the rest to the
// active layer. Shapes arriving together in a layer form one group.
function importSVG(text, fileName) {
  const { shapes, skipped, invalid } = svgShapes(readSVG(text));
  if (!shapes.length)
    throw Error(
      "読み込める図形がありません（パス・長方形・円・楕円・線・折れ線・多角形に対応）。",
    );
  const active = project.layers.find((l) => l.id === activeLayer);
  if (!active?.visible || active.locked)
    throw Error("表示中のロックされていないレイヤーを選んでください。");
  if (project.items.length + shapes.length > 2000)
    throw Error("図形が多すぎます。オブジェクトは全体で2000個までです。");
  const next = structuredClone(project),
    layers = new Map();
  const items = shapes.map((shape) => {
    if (shape.layer && !layers.has(shape.layer)) {
      let layer = next.layers.find(
        (l) => l.name === shape.layer && l.visible && !l.locked,
      );
      if (!layer && next.layers.length < 100) {
        layer = {
          id: uid(),
          name: shape.layer.slice(0, 100),
          visible: true,
          locked: false,
        };
        next.layers.push(layer);
      }
      layers.set(shape.layer, layer?.id ?? activeLayer);
    }
    return shapeItem(shape, uid(), layers.get(shape.layer) ?? activeLayer);
  });
  for (const layerId of new Set(items.map((i) => i.layerId))) {
    const members = items.filter((i) => i.layerId === layerId);
    if (members.length > 1) {
      const groupId = uid();
      for (const item of members) item.groupId = groupId;
    }
  }
  next.items.push(...items);
  validateProject(JSON.parse(JSON.stringify(next)));
  checkpoint();
  project = next;
  multi = items.map((i) => i.id);
  selected = multi.at(-1);
  preview = false;
  tool = "select";
  warpId = null;
  pathEdit = null;
  commit();
  const notes = [
    ...Object.entries(skipped).map(([kind, n]) => `${kind} ${n} 個`),
    ...(invalid ? [`読めない図形 ${invalid} 個`] : []),
  ];
  notify(
    `${fileName} から ${items.length} 個の図形をパスとして読み込みました。${notes.length ? `読み込めないもの: ${notes.join("・")}（文字はアウトライン化して保存してください）。` : "ダブルクリックでノードを編集できます。"}`,
  );
}
// Files dropped on the canvas open like 「開く」.
$("#canvas-scroll").addEventListener("dragover", (e) => {
  if (loading || ![...e.dataTransfer.types].includes("Files")) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});
$("#canvas-scroll").addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (loading || !file) return;
  e.preventDefault();
  openFile(file);
});
function canvasPoint(e) {
  const matrix = $("#canvas").getScreenCTM();
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
}
// Pointer presses in Path Edit Mode. Returns false to fall through to normal
// selection (a press on another object leaves the mode).
function pathPointerDown(e, p) {
  const item = pathItem(),
    handle = e.target.closest("[data-handle]"),
    node = e.target.closest("[data-node]"),
    edit = {
      before: structuredClone(item),
      bridges: project.items
        .filter((i) => i.targetId === item.id)
        .map((b) => structuredClone(b)),
      startPath: structuredClone(pathEdit.path),
      start: p,
      moved: false,
    };
  if (handle) {
    const [s, n, side] = handle.dataset.handle.split(":");
    drag = { kind: "handle", key: `${s}:${n}`, side, ...edit };
  } else if (node) {
    const key = node.dataset.node,
      selection = pathEdit.selection;
    if (e.shiftKey)
      selection.has(key) ? selection.delete(key) : selection.add(key);
    else if (!selection.has(key)) pathEdit.selection = new Set([key]);
    render();
    e.preventDefault();
    if (!pathEdit.selection.has(key)) return true;
    drag = { kind: "nodes", keys: [...pathEdit.selection], ...edit };
  } else {
    const hit = e.target.closest("[data-object]")?.dataset.object;
    if (hit && hit !== item.id) {
      pathEdit = null;
      return false;
    }
    const near = nearestSegment(pathEdit.path, transform(p, item, true)),
      mmPerPx = 1 / $("#canvas").getScreenCTM().a;
    // A double click on the outline adds a node there (on release, so a
    // quick click-then-drag still draws a selection rectangle).
    const twice = doublePress(e, `path:${item.id}`);
    drag = {
      kind: "node-marquee",
      start: p,
      end: p,
      base: e.shiftKey ? [...pathEdit.selection] : [],
      insert: twice && near.distance < 8 * mmPerPx ? near : null,
      moved: false,
    };
  }
  $("#canvas").setPointerCapture(e.pointerId);
  e.preventDefault();
  return true;
}
$("#canvas").addEventListener("pointerdown", (e) => {
  if (loading || e.button !== 0 || preview) return;
  // On a Mac, Ctrl+click is a right click and opens the menu instead.
  if (isMac && e.ctrlKey && e.pointerType === "mouse") return;
  const p = canvasPoint(e);
  if (tool !== "select") {
    if (e.pointerType === "touch") {
      drag = { kind: "place", start: p, tool, moved: false };
      $("#canvas").setPointerCapture(e.pointerId);
      return;
    }
    addItem(tool, snap ? Math.round(p.x) : p.x, snap ? Math.round(p.y) : p.y);
    return;
  }
  if (pathItem() && pathPointerDown(e, p)) return;
  const warpPoint = e.target.closest("[data-warp-point]");
  if (warpPoint && warpItem()) {
    const item = warpItem();
    drag = {
      kind: "warp",
      index: Number(warpPoint.dataset.warpPoint),
      before: structuredClone(item),
      bridges: project.items
        .filter((i) => i.targetId === item.id)
        .map((b) => structuredClone(b)),
      base: unwarpedLayout(item),
      start: p,
      moved: false,
    };
    $("#canvas").setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if (e.target.closest("[data-rotate]") && selectedItems().length) {
    const chosen = selectedItems();
    drag = {
      kind: "rotate",
      center: selectionCenter(chosen, itemBounds),
      before: chosen.map((i) => structuredClone(i)),
      start: p,
      moved: false,
    };
    $("#canvas").setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  const handle = e.target.closest("[data-resize]");
  if (handle && selectedItems().length === 1 && canResize(selectedItem())) {
    drag = {
      kind: "resize",
      before: structuredClone(selectedItem()),
      corner: handle.dataset.resize.split(",").map(Number),
      start: p,
      moved: false,
    };
    $("#canvas").setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  const target = e.target.closest("[data-object]"),
    id = target?.dataset.object || null;
  if (
    id &&
    !isEditable(
      project,
      project.items.find((i) => i.id === id),
    )
  )
    return;
  if (!id) {
    drag = {
      kind: "marquee",
      start: p,
      end: p,
      base: e.shiftKey || e.ctrlKey || e.metaKey ? selectionIds() : [],
      moved: false,
    };
    $("#canvas").setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  // A double click (released without moving) opens the text editor on text
  // and Path Edit Mode on paths and shapes; a click-then-drag still moves.
  const twice = doublePress(e, id) && !e.shiftKey;
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    selectGroupOf(id, true);
    render();
    return;
  }
  if (!selectionIds().includes(id)) selectGroupOf(id);
  const chosen = selectedItems();
  if (chosen.length) {
    drag = {
      kind: "move",
      double: twice ? id : null,
      before: chosen.map((i) => structuredClone(i)),
      start: p,
      moved: false,
    };
    $("#canvas").setPointerCapture(e.pointerId);
  }
  render();
});
$("#canvas").addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  if (drag.kind === "place") {
    if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 0.5)
      drag.moved = true;
    return;
  }
  if (drag.kind === "marquee" || drag.kind === "node-marquee") {
    drag.end = p;
    drag.moved = Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 0.5;
    const r = selectionRect(drag.start, p);
    const box = $("#marquee");
    box.removeAttribute("hidden");
    for (const key of ["x", "y", "w", "h"])
      box.setAttribute({ w: "width", h: "height" }[key] || key, r[key]);
    return;
  }
  if (!drag.moved) {
    // At most 0.3 mm or 3 screen pixels, so zoomed-in edits start promptly.
    const threshold = Math.min(0.3, 3 / $("#canvas").getScreenCTM().a);
    if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < threshold) return;
    checkpoint();
    drag.moved = true;
  }
  if (drag.kind === "rotate") {
    // Angle swept around the selection centre since the press. Shift snaps
    // a single item's angle (or a selection's turn) to 15°.
    const c = drag.center,
      swept =
        ((Math.atan2(p.y - c.y, p.x - c.x) -
          Math.atan2(drag.start.y - c.y, drag.start.x - c.x)) *
          180) /
        Math.PI,
      r0 = drag.before.length === 1 ? drag.before[0].rotation || 0 : 0;
    let delta = normalizeAngle(swept);
    if (e.shiftKey) delta = Math.round((r0 + delta) / 15) * 15 - r0;
    const ids = drag.before.map((i) => i.id);
    for (const before of drag.before) {
      if (before.targetId && ids.includes(before.targetId)) continue;
      const current = project.items.find((i) => i.id === before.id);
      replaceItem(current, rotateAbout(before, c, delta));
    }
    drag.label =
      drag.before.length === 1
        ? `回転 ${Number(normalizeAngle(r0 + delta).toFixed(1))}° · Shiftで15°刻み`
        : `回転 ${Number(delta.toFixed(1))}° · Shiftで15°刻み`;
  } else if (drag.kind === "nodes" || drag.kind === "handle") {
    // Rebuilt from the drag start each frame; one undo step for the drag.
    const { before } = drag,
      current = project.items.find((i) => i.id === before.id),
      b = transform(p, before, true);
    let path;
    if (drag.kind === "nodes") {
      const a = transform(drag.start, before, true);
      path = moveNodes(drag.startPath, drag.keys, b.x - a.x, b.y - a.y);
    } else path = moveHandle(drag.startPath, drag.key, drag.side, b, e.altKey);
    for (const bridge of project.items) {
      const start = drag.bridges.find((s) => s.id === bridge.id);
      if (start) Object.assign(bridge, structuredClone(start));
    }
    const next = toPathItem(before, path);
    followBridges(project.items, before, next);
    project.items[project.items.indexOf(current)] = next;
    pathEdit.path = path;
  } else if (drag.kind === "warp") {
    // The pointer moves the point in the unwarped box's units; a corner
    // carries its two handles unless Alt/Option is held.
    const { before, base } = drag,
      current = project.items.find((i) => i.id === before.id),
      a = transform(drag.start, before, true),
      b = transform(p, before, true),
      dx = (b.x - a.x) / (base.box.w || 1),
      dy = (b.y - a.y) / (base.box.h || 1),
      n = drag.index,
      envelope = before.warp.envelope.map((q) => ({ ...q })),
      clamp = (v) => Math.max(-50, Math.min(50, v));
    for (const k of CORNERS.includes(n) && !e.altKey
      ? [n, (n + 1) % 12, (n + 11) % 12]
      : [n])
      envelope[k] = {
        x: clamp(envelope[k].x + dx),
        y: clamp(envelope[k].y + dy),
      };
    for (const bridge of project.items) {
      const start = drag.bridges.find((s) => s.id === bridge.id);
      if (start) Object.assign(bridge, structuredClone(start));
    }
    const next = withWarp(
      current,
      { ...before.warp, preset: "custom", envelope },
      base,
    );
    followBridges(project.items, before, next);
    project.items[project.items.indexOf(current)] = next;
  } else if (drag.kind === "resize") {
    const before = drag.before,
      current = project.items.find((i) => i.id === before.id);
    const point = snap ? { x: Math.round(p.x), y: Math.round(p.y) } : p;
    try {
      replaceItem(
        current,
        resizeFromHandle(
          before,
          drag.corner,
          point,
          before.ratioLocked || e.shiftKey,
          textContours,
        ),
      );
    } catch (error) {
      notify(error.message);
      drag = null;
      commit();
      return;
    }
  } else {
    const ids = drag.before.map((i) => i.id);
    for (const before of drag.before) {
      if (before.targetId && ids.includes(before.targetId)) continue;
      const current = project.items.find((i) => i.id === before.id);
      let x = before.x + p.x - drag.start.x,
        y = before.y + p.y - drag.start.y;
      if (snap) {
        x = Math.round(x);
        y = Math.round(y);
      }
      replaceItem(current, { ...current, x, y });
    }
  }
  renderCanvas();
});
for (const event of ["pointerup", "pointercancel"])
  $("#canvas").addEventListener(event, () => {
    if (drag) drag.label = null;
    if (drag?.kind === "marquee") {
      if (event === "pointerup") {
        multi = drag.moved
          ? expandGroups(
              project,
              marqueeIds(project, drag.start, drag.end, drag.base),
            )
          : drag.base;
        selected = multi.at(-1) || null;
        render();
      }
      $("#marquee").setAttribute("hidden", "");
    } else if (drag?.kind === "node-marquee" && drag.insert && !drag.moved) {
      if (event === "pointerup" && pathItem()) {
        const { path, key } = insertNode(
          pathEdit.path,
          drag.insert.s,
          drag.insert.i,
          drag.insert.t,
        );
        pathEdit.selection = new Set([key]);
        applyPath(path, "ノードを追加しました。");
      }
    } else if (drag?.kind === "node-marquee") {
      const item = pathItem();
      if (event === "pointerup" && item) {
        const r = selectionRect(drag.start, drag.end),
          hits = drag.moved
            ? nodeKeys(pathEdit.path).filter((key) => {
                const w = transform(nodeAt(pathEdit.path, key), item);
                return (
                  w.x >= r.x &&
                  w.x <= r.x + r.w &&
                  w.y >= r.y &&
                  w.y <= r.y + r.h
                );
              })
            : [];
        pathEdit.selection = new Set([...drag.base, ...hits]);
        render();
      }
      $("#marquee").setAttribute("hidden", "");
    } else if (drag?.kind === "place") {
      if (event === "pointerup" && !drag.moved)
        addItem(
          drag.tool,
          snap ? Math.round(drag.start.x) : drag.start.x,
          snap ? Math.round(drag.start.y) : drag.start.y,
        );
    } else if (drag?.moved) commit();
    else if (drag?.double && event === "pointerup") {
      const id = drag.double,
        type = project.items.find((i) => i.id === id)?.type;
      drag = null;
      if (type === "text") editText(id);
      else if (PATHABLE.includes(type)) enterPathEdit(id);
    }
    drag = null;
  });
function setZoom(v, anchor) {
  const viewport = $("#canvas-scroll"),
    rect = viewport.getBoundingClientRect();
  anchor = anchor || {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
  const before = canvasPoint(anchor);
  zoom = Math.min(MAX_ZOOM, Math.max(0.25, v));
  renderCanvas();
  const after = new DOMPoint(before.x, before.y).matrixTransform(
    $("#canvas").getScreenCTM(),
  );
  viewport.scrollLeft += after.x - anchor.clientX;
  viewport.scrollTop += after.y - anchor.clientY;
}
$("#zoom-in").onclick = () => setZoom(zoom * 1.25);
$("#zoom-out").onclick = () => setZoom(zoom / 1.25);
$("#zoom-reset").onclick = () => setZoom(1);
$("#canvas-scroll").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (loading || drag) return;
    if (e.ctrlKey || e.metaKey)
      setZoom(wheelZoom(zoom, e.deltaY, e.deltaMode, true), e);
    else {
      const unit =
        e.deltaMode === 1
          ? 16
          : e.deltaMode === 2
            ? $("#canvas-scroll").clientHeight
            : 1;
      $("#canvas-scroll").scrollLeft += e.deltaX * unit;
      $("#canvas-scroll").scrollTop += e.deltaY * unit;
    }
  },
  { passive: false },
);
const touchPoints = new Map();
let pinch = null,
  pinchActive = false,
  safariZoom = 1;
const touchMeasure = () => {
  const [a, b] = [...touchPoints.values()];
  return {
    distance: Math.max(
      1,
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    ),
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2,
  };
};
$("#canvas-scroll").addEventListener(
  "pointerdown",
  (e) => {
    if (loading || e.pointerType !== "touch") return;
    touchPoints.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    if (touchPoints.size === 2) {
      if (drag?.moved && ["move", "resize"].includes(drag.kind)) {
        project = JSON.parse(history.pop());
        future = [];
        persist();
      }
      drag = null;
      $("#marquee").setAttribute("hidden", "");
      pinchActive = true;
      pinch = touchMeasure();
      for (const id of touchPoints.keys())
        $("#canvas-scroll").setPointerCapture(id);
      render();
      e.preventDefault();
      e.stopPropagation();
    } else if (pinchActive) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true,
);
$("#canvas-scroll").addEventListener(
  "pointermove",
  (e) => {
    if (e.pointerType !== "touch" || !touchPoints.has(e.pointerId)) return;
    touchPoints.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    if (!pinchActive) return;
    e.preventDefault();
    e.stopPropagation();
    if (touchPoints.size >= 2) {
      const next = touchMeasure();
      setZoom((zoom * next.distance) / pinch.distance, pinch);
      $("#canvas-scroll").scrollLeft += pinch.clientX - next.clientX;
      $("#canvas-scroll").scrollTop += pinch.clientY - next.clientY;
      pinch = next;
    }
  },
  true,
);
for (const type of ["pointerup", "pointercancel"])
  $("#canvas-scroll").addEventListener(
    type,
    (e) => {
      if (e.pointerType !== "touch") return;
      touchPoints.delete(e.pointerId);
      if (pinchActive) {
        e.preventDefault();
        e.stopPropagation();
        pinch = touchPoints.size >= 2 ? touchMeasure() : null;
        if (touchPoints.size === 0) pinchActive = false;
      }
    },
    true,
  );
$("#canvas-scroll").addEventListener(
  "gesturestart",
  (e) => {
    e.preventDefault();
    safariZoom = zoom;
  },
  { passive: false },
);
$("#canvas-scroll").addEventListener(
  "gesturechange",
  (e) => {
    e.preventDefault();
    if (!loading && !pinchActive)
      setZoom(safariZoom * e.scale, Number.isFinite(e.clientX) ? e : undefined);
  },
  { passive: false },
);
new ResizeObserver(() => renderCanvas()).observe($("#canvas-scroll"));
// Right-click edit menu, listing Fusion-style commands for the selection.
const menu = $("#context-menu");
let menuReturn = null;
const menuActions = {
  cut: cutSelection,
  copy: copySelection,
  paste,
  duplicate,
  delete: remove,
  group: groupSelection,
  ungroup,
  outline: outlineSelected,
  "edit-text": () => editText(selected),
  "rotate-cw": () => rotateSelection(90),
  "rotate-ccw": () => rotateSelection(-90),
  "edit-path": () => enterPathEdit(selected),
  "outline-edit": () => outlineSelected() && enterPathEdit(selected),
  "node-smooth": () => nodeAction("smooth"),
  "node-corner": () => nodeAction("corner"),
  "node-line": () => nodeAction("line"),
  "node-insert": () => nodeAction("insert"),
  "node-delete": () => nodeAction("delete"),
  "node-all": () => nodeAction("all"),
  "path-done": exitPathEdit,
  warp: enterWarp,
  fillet: () => {
    const field = $('[data-prop="radius"]');
    field?.focus();
    field?.select();
  },
  "auto-bridge": applyAutoBridges,
  union: () => applyBoolean("union"),
  difference: () => applyBoolean("difference"),
  intersection: () => applyBoolean("intersection"),
  xor: () => applyBoolean("xor"),
  front: () => arrange("front"),
  forward: () => arrange("forward"),
  backward: () => arrange("backward"),
  back: () => arrange("back"),
  find: findInBrowser,
  "select-all": selectAll,
  undo,
  redo,
  preview: togglePreview,
};
function menuEntries(onObject) {
  if (onObject === "path") {
    const any = pathEdit.selection.size > 0;
    return [
      ["node-smooth", "スムーズ", "", any],
      ["node-corner", "コーナー", "", any],
      ["node-line", "直線化", "", any],
      "-",
      ["node-insert", "ノードを追加", "", any],
      ["node-delete", "ノードを削除", "Delete", any],
      "-",
      ["node-all", "すべてのノードを選択", shortcut("A"), true],
      ["path-done", "パス編集を終了", "Esc", true],
    ];
  }
  if (!onObject)
    return [
      ["undo", "元に戻す", shortcut("Z"), history.length],
      ["redo", "やり直す", shortcut("Z", true), future.length],
      "-",
      ["paste", "貼り付け", shortcut("V"), clipboard],
      ["select-all", "すべて選択", shortcut("A"), true],
      "-",
      ["preview", preview ? "スケッチに戻る" : "加工プレビュー", "", true],
    ];
  const chosen = selectedItems(),
    one = chosen.length === 1 ? chosen[0] : null,
    has = chosen.length > 0,
    kinds = new Set(chosen.map(ungroupKind).filter(Boolean));
  return [
    ["cut", "切り取り", shortcut("X"), has],
    ["copy", "コピー", shortcut("C"), has],
    ["paste", "貼り付け", shortcut("V"), clipboard],
    ["duplicate", "複製", shortcut("D"), has],
    ["delete", "削除", "Delete", has],
    "-",
    [
      "group",
      "グループ化",
      shortcut("G"),
      chosen.filter((i) => !i.targetId).length > 1,
    ],
    [
      "ungroup",
      kinds.size ? ungroupLabel(kinds) : "グループ化解除",
      shortcut("G", true),
      kinds.size,
    ],
    "-",
    ["edit-text", "テキストを編集", "", one?.type === "text"],
    ["edit-path", "パスを編集", "", PATHABLE.includes(one?.type)],
    ["outline-edit", "アウトライン化してパス編集", "", one?.type === "text"],
    ["warp", "ワープ…", "", canWarp(one)],
    ["outline", "アウトライン化", "", one?.type === "text"],
    ["fillet", "フィレット…", "", one?.type === "rect"],
    [
      "auto-bridge",
      "自動ブリッジ",
      "",
      chosen.some((i) => i.type !== "bridge"),
    ],
    ...(chosen.length > 1
      ? [
          "-",
          ["union", "結合 ∪", "", true],
          ["difference", "切り抜き −", "", true],
          ["intersection", "交差 ∩", "", true],
          ["xor", "排他的 XOR", "", true],
        ]
      : []),
    "-",
    ["rotate-cw", "右に90°回転", "", has],
    ["rotate-ccw", "左に90°回転", "", has],
    "-",
    ["front", "最前面へ", shortcut("]", true), has],
    ["forward", "前面へ", shortcut("]"), has],
    ["backward", "背面へ", shortcut("["), has],
    ["back", "最背面へ", shortcut("[", true), has],
    "-",
    ["find", "ブラウザで表示", "", has],
    ["select-all", "すべて選択", shortcut("A"), true],
  ];
}
function openMenu(x, y, onObject) {
  const chosen = selectedItems(),
    title =
      onObject === "path"
        ? `パス編集 · ノード ${pathEdit.selection.size} 個選択`
        : !onObject
          ? "キャンバス"
          : chosen.length === 1
            ? chosen[0].name
            : `${chosen.length} アイテム`;
  menu.innerHTML =
    `<div class="menu-title">${esc(title)}</div>` +
    menuEntries(onObject)
      .map((entry) =>
        entry === "-"
          ? '<hr role="separator">'
          : `<button type="button" role="menuitem" data-action="${entry[0]}" ${entry[3] ? "" : "disabled"}><span>${entry[1]}</span>${entry[2] ? `<kbd>${esc(entry[2])}</kbd>` : ""}</button>`,
      )
      .join("");
  menuReturn = document.activeElement;
  menu.hidden = false;
  const box = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - box.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - box.height - 8))}px`;
  menu.querySelector("button:not(:disabled)")?.focus();
}
function closeMenu(restoreFocus = true) {
  if (menu.hidden) return;
  menu.hidden = true;
  if (restoreFocus && menuReturn?.isConnected)
    menuReturn.focus({ preventScroll: true });
}
// Keyboard: Shift+F10 or the menu key opens the menu at the selection.
function openMenuForSelection() {
  const first = selectedItems()
      .map((i) => document.querySelector(`#objects [data-object="${i.id}"]`))
      .find(Boolean),
    box = (first || $("#canvas-scroll")).getBoundingClientRect();
  openMenu(
    box.left + box.width / 2,
    box.top + box.height / 2,
    selectedItems().length > 0,
  );
}
menu.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || b.disabled) return;
  closeMenu();
  menuActions[b.dataset.action]();
});
menu.addEventListener("keydown", (e) => {
  const items = [...menu.querySelectorAll("button:not(:disabled)")],
    at = items.indexOf(document.activeElement);
  if (e.key === "ArrowDown" || e.key === "ArrowUp")
    items[
      (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
    ]?.focus();
  else if (e.key === "Home") items[0]?.focus();
  else if (e.key === "End") items.at(-1)?.focus();
  else if (e.key === "Escape") closeMenu();
  else if (e.key === "Tab") closeMenu(false);
  else return;
  e.preventDefault();
  e.stopPropagation();
});
menu.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener(
  "pointerdown",
  (e) => !menu.contains(e.target) && closeMenu(false),
  true,
);
document.addEventListener(
  "scroll",
  (e) => !menu.contains(e.target) && closeMenu(false),
  true,
);
window.addEventListener("resize", () => closeMenu(false));
window.addEventListener("blur", () => closeMenu(false));
$("#canvas").addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (loading || drag?.moved) return;
  // A touch long-press opens the menu instead of starting a drag.
  drag = null;
  $("#marquee").setAttribute("hidden", "");
  const id = e.target.closest("[data-object]")?.dataset.object,
    item = id && project.items.find((i) => i.id === id),
    onObject = Boolean(item && isEditable(project, item));
  // In Path Edit Mode the menu edits nodes; a right-clicked node is selected.
  if (pathItem() && (!id || id === pathEdit.id)) {
    const node = e.target.closest("[data-node]")?.dataset.node;
    if (node && !pathEdit.selection.has(node))
      pathEdit.selection = new Set([node]);
    render();
    openMenu(e.clientX, e.clientY, "path");
    return;
  }
  if (onObject && !selectionIds().includes(id)) selectGroupOf(id);
  tool = "select";
  render();
  openMenu(e.clientX, e.clientY, onObject);
});
$("#layers").addEventListener("contextmenu", (e) => {
  const row = e.target.closest("[data-layer]:not(:disabled)"),
    groupRow = e.target.closest("[data-group-row]:not(:disabled)");
  // Layer name fields keep the browser's own text menu.
  if (loading || (!row && !groupRow)) return;
  e.preventDefault();
  if (row && !selectionIds().includes(row.dataset.layer)) {
    selectItem(row.dataset.layer);
    browserAnchor = row.dataset.layer;
  } else if (groupRow) {
    const member = project.items.find(
      (i) => i.groupId === groupRow.dataset.groupRow,
    );
    if (
      member &&
      !expandGroups(project, [member.id]).every((id) =>
        selectionIds().includes(id),
      )
    )
      selectGroupOf(member.id);
  }
  render();
  openMenu(e.clientX, e.clientY, true);
});
window.addEventListener("keydown", (e) => {
  if (loading) return;
  if (
    /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
    $("#help").open ||
    !menu.hidden
  )
    return;
  const mod = e.metaKey || e.ctrlKey,
    key = e.key.toLowerCase();
  if (pathItem()) {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      exitPathEdit();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      nodeAction("delete");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      nodeAction("all");
      return;
    }
    const step = e.shiftKey ? 1 : 0.1,
      arrows = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
    if (arrows[e.key] && pathEdit.selection.size) {
      e.preventDefault();
      nudgeNodes(...arrows[e.key]);
      return;
    }
  }
  if (warpId && (e.key === "Escape" || e.key === "Enter")) {
    e.preventDefault();
    exitWarp();
    return;
  }
  // Keep the text while its envelope is being edited.
  if (warpId && (e.key === "Delete" || e.key === "Backspace")) return;
  if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
    e.preventDefault();
    openMenuForSelection();
    return;
  }
  if (mod && key === "g") {
    e.preventDefault();
    e.shiftKey ? ungroup() : groupSelection();
    return;
  }
  if (
    mod &&
    !e.shiftKey &&
    !e.altKey &&
    ["x", "c", "v", "d", "a"].includes(key)
  ) {
    e.preventDefault();
    ({
      x: cutSelection,
      c: copySelection,
      v: paste,
      d: duplicate,
      a: selectAll,
    })[key]();
    return;
  }
  if (mod && ["[", "]", "{", "}"].includes(e.key)) {
    e.preventDefault();
    const up = ["]", "}"].includes(e.key);
    arrange(e.shiftKey ? (up ? "front" : "back") : up ? "forward" : "backward");
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if (e.key === "Escape") {
    selectItem(null);
    tool = "select";
    render();
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    remove();
  }
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
    selectedItems().length
  ) {
    e.preventDefault();
    checkpoint();
    const d = e.shiftKey ? 5 : 0.5,
      chosen = selectedItems(),
      ids = chosen.map((i) => i.id);
    for (const i of chosen) {
      if (ids.includes(i.targetId)) continue;
      const next = { ...i };
      if (e.key === "ArrowUp") next.y -= d;
      if (e.key === "ArrowDown") next.y += d;
      if (e.key === "ArrowLeft") next.x -= d;
      if (e.key === "ArrowRight") next.x += d;
      replaceItem(i, next);
    }
    commit();
  }
});
$("#help-button").onclick = () => $("#help").showModal();
$("#font-licenses-button").onclick = openFontLicenses;
document.querySelectorAll("dialog [data-close]").forEach((b) => (b.onclick = () => b.closest("dialog").close()));
document.querySelectorAll("dialog [data-open-licenses]").forEach((b) => (b.onclick = openFontLicenses));
fontGallery.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-font]");
  if (!b) return;
  fontGallery.close();
  chooseFont(b.dataset.font);
});
$("#font-policy-agree").onchange = (e) => ($("#font-policy-accept").disabled = !e.target.checked);
$("#font-policy-accept").onclick = () => {
  try {
    localStorage.setItem(FONT_POLICY_KEY, String(FONT_POLICY_VERSION));
  } catch {}
  $("#font-policy").close();
  $("#font-file").click();
};
$("#close-help").onclick = $("#start").onclick = () => $("#help").close();
async function init() {
  let restored = false;
  try {
    const saved = localStorage.getItem("typefab-v1");
    if (saved) {
      project = validateProject(JSON.parse(saved));
      restored = true;
    }
  } catch {
    notify("自動保存データを復元できませんでした。");
  }

  render();
  try {
    await typographyReady;
    // Only the default font is fetched at start-up. Fonts used by a restored
    // project load in the background (their outlines are already stored).
    await loadFont(DEFAULT_FONT);
    const used = [
      ...new Set(
        project.items
          .filter((i) => i.type === "text" && bundledFont(i.font))
          .map((i) => i.font),
      ),
    ];
    for (const id of used) loadFont(id).catch((e) => notify(e.message));
    if (!restored) {
      const title = {
        id: uid(),
        type: "text",
        name: "つくる、を自由に。",
        text: "つくる、を自由に。",
        x: 30,
        y: 47,
        rotation: 0,
        font: "zen",
        size: 20,
        spacing: 0.5,
        vertical: false,
      };
      title.contours = textContours(title);
      const sub = {
        id: uid(),
        type: "text",
        name: "MAKE IT YOURS",
        text: "MAKE IT YOURS",
        x: 33,
        y: 81,
        rotation: 0,
        font: "zen",
        size: 7,
        spacing: 1.4,
        vertical: false,
      };
      sub.contours = textContours(sub);
      const line = {
        id: uid(),
        type: "line",
        name: "アクセントライン",
        x: 33,
        y: 103,
        rotation: 0,
        w: 170,
        h: 0,
        contours: shapeContours("line", 170, 0),
      };
      project.items = [title, sub, line];
      ensureLayers(project);
      selectItem(title.id);
    }
    loading = false;
    commit();
    notify("準備ができました。文字を編集して、あなただけのデザインに。");
  } catch (e) {
    loading = false;
    render();
    notify(`${e.message} · ページを再読み込みしてください。`);
  }
}
init();
