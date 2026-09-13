import opentype from "opentype.js";
import "./style.css";
import {
  worldContours,
  pathData,
  cutGeometry,
  exportSVG,
  shapeContours,
  automaticBridges,
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
let typography;
const shapingFonts = new Map();
const typographyReady = import("./typography.js").then((m) => (typography = m));

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
const fonts = new Map(),
  fontLabels = new Map([
    ["zen", "Zen Kaku Gothic New"],
    ["shippori", "しっぽり明朝"],
  ]);
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
  activeLayer = "layer-default";
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
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem("typefab-v1", JSON.stringify(project));
      $("#save-status").textContent = "このブラウザに保存済み";
    } catch {
      $("#save-status").textContent = "自動保存できません · JSON保存を使用";
    }
  }, 200);
}
function checkpoint() {
  history.push(JSON.stringify(project));
  if (history.length > 60) history.shift();
  future = [];
}
function commit() {
  render();
  persist();
}
function undo() {
  if (!history.length) return;
  future.push(JSON.stringify(project));
  project = JSON.parse(history.pop());
  selectItem(null);
  commit();
}
function redo() {
  if (!future.length) return;
  history.push(JSON.stringify(project));
  project = JSON.parse(future.pop());
  selectItem(null);
  commit();
}
function textContours(item) {
  if (!typography) throw Error("フォントの準備が完了するまでお待ちください。");
  return typography.layoutText(
    item,
    fonts.get(item.font),
    shapingFonts.get(item.font),
  );
}
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
function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    download("typefab.svg", exportSVG(project), "image/svg+xml");
    notify(`SVGを書き出しました · 切り残しなしの閉輪郭 ${result.untouched} 個`);
  } catch (e) {
    notify(e.message);
  }
}

$("#app").innerHTML = `
<header><a class="brand" href="./"><span class="brand-mark">t<span>f</span></span>TypeFab<span class="beta">BETA</span></a><div class="document-title"><span id="project-name"></span><small id="save-status">ローカルプロジェクト</small></div><div class="header-actions"><button id="new-project" title="新規プロジェクト">新規</button><button id="open-project">開く</button><button id="save-project">保存</button><button id="export" class="primary">↗ SVGを書き出す</button></div></header>
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
  )}</div><div class="tool-group"><button id="auto-bridge" class="tool"><span class="tool-icon">✧</span>選択にブリッジ</button><button id="outline" class="tool"><span class="tool-icon">T̲</span>アウトライン化</button></div><div class="tool-group history"><button id="undo" title="元に戻す (Ctrl/⌘ Z)">↶</button><button id="redo" title="やり直す (Ctrl/⌘ Shift Z)">↷</button></div><button id="preview" class="preview-button">◎ 加工プレビュー</button></nav>
<main><aside class="layers-panel"><div class="panel-heading">ブラウザ<span class="eyebrow">OBJECTS</span></div><div class="document-row"><button id="add-layer">＋ レイヤー</button><span class="note">Shiftで複数選択</span></div><div id="layers"></div><div class="layer-actions"><button id="duplicate">＋ 複製</button><button id="delete">⌫ 削除</button></div><div class="left-bottom"><div class="eyebrow">YOUR NEXT IDEA</div><h3>文字を、かたちに。</h3><p>文字と図形をならべて、<br>世界にひとつのデザインを。</p><button id="add-text" class="text-link">＋ 文字を追加</button></div></aside>
<section class="canvas-panel" aria-label="デザインキャンバス"><div class="canvas-top"><span><i class="green-dot"></i> <span id="canvas-mode">スケッチ編集中</span></span><span id="board-label"></span></div><div id="canvas-scroll"><div id="board-wrap"><svg id="canvas" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="加工エリア。ツールを選んで配置、またはオブジェクトをドラッグ"><defs><pattern id="small-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#dce2e8" stroke-width="0.12"/></pattern><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="url(#small-grid)"/><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#c4cdd7" stroke-width="0.2"/></pattern></defs><rect id="paper" width="100%" height="100%" fill="url(#grid)"/><g id="objects"></g><g id="selection"></g></svg><span class="origin-label">0, 0</span></div></div><div class="canvas-bottom"><label class="check"><input type="checkbox" id="snap" checked> 1 mm スナップ</label><div class="zoom-controls"><button id="zoom-out" aria-label="縮小">−</button><button id="zoom-reset">100%</button><button id="zoom-in" aria-label="拡大">＋</button></div><span class="axis"><b>Y</b> ↓ &nbsp; → <em>X</em></span></div><div id="hint" class="canvas-hint"></div></section>
<aside class="inspector"><div class="panel-heading">プロパティ<span class="eyebrow">INSPECTOR</span></div><div id="properties"></div><section class="board-settings"><h4>加工エリア <span>mm</span></h4><div class="fields"><label>幅<input id="board-width" type="number" min="10" max="2000"></label><label>高さ<input id="board-height" type="number" min="10" max="2000"></label></div></section><section class="cut-check"><h4><span class="check-icon">◇</span> 加工チェック</h4><div id="checks"></div><p>ブリッジは切り残しです。材料・厚さに応じて幅を調整し、テスト加工してください。</p></section></aside></main>
<footer><span id="message" role="status" aria-live="polite">フォントを読み込んでいます…</span><span><i class="legend cut"></i> カット線 <i class="legend bridge"></i> 非カット &nbsp; <span class="subtle">TypeFab / 0.2</span></span></footer>
<input hidden type="file" id="font-file" accept=".ttf,.otf,.woff"><input hidden type="file" id="project-file" accept=".json,application/json">
<dialog id="help"><button class="dialog-close" id="close-help" aria-label="閉じる">×</button><div class="eyebrow">WELCOME TO TYPEFAB</div><h2>アイデアを、切り出そう。</h2><ol><li><b>文字・図形を配置</b><p>ツールを選び、加工エリアをクリック。ドラッグや数値入力で位置を調整できます。</p></li><li><b>切り残しをつくる</b><p>ブリッジを輪郭に重ねると、その部分のカット線が途切れます。自動ブリッジは各閉輪郭に保持用の切り残しを追加します。</p></li><li><b>確認して書き出す</b><p>加工プレビューの赤線がSVGに出力されます。SVGはmm単位のパスのみ。カット設定は加工機側で指定してください。</p></li></ol><p class="help-note">閉輪郭のチェックは接続強度の保証ではありません。Shiftで複数選択し、右側から結合・切り抜き・交差・XORを実行できます。差分は最初の選択が土台です。縦書きはフォントの縦用字形を使用します。カーフ補正・ルビ・縦中横は未対応です。</p><button id="start" class="primary">スケッチをはじめる →</button></dialog>`;

function renderLayers() {
  $("#layers").innerHTML = [...project.layers]
    .reverse()
    .map(
      (
        l,
      ) => `<div class="layer-group ${l.id === activeLayer ? "current" : ""}"><div class="layer-header">
    <button data-active-layer="${l.id}" aria-label="${esc(l.name)}を選択" title="追加先レイヤー">${l.id === activeLayer ? "◆" : "◇"}</button>
    <input data-layer-name="${l.id}" aria-label="レイヤー名" value="${esc(l.name)}" maxlength="100">
    <button data-layer-action="visible" data-id="${l.id}" title="${l.visible ? "非表示にする" : "表示する"}" aria-label="${esc(l.name)}の表示切替">${l.visible ? "◉" : "○"}</button>
    <button data-layer-action="locked" data-id="${l.id}" title="${l.locked ? "ロック解除" : "ロック"}" aria-label="${esc(l.name)}のロック切替">${l.locked ? "🔒" : "◇"}</button></div>
    <div class="layer-order"><button data-layer-action="up" data-id="${l.id}" ${project.layers.at(-1) === l ? "disabled" : ""} title="前面へ">↑</button><button data-layer-action="down" data-id="${l.id}" ${project.layers[0] === l ? "disabled" : ""} title="背面へ">↓</button><button data-layer-action="remove" data-id="${l.id}" ${project.layers.length === 1 || l.locked ? "disabled" : ""} title="レイヤー削除（中身は別レイヤーへ移動）">削除</button><small>${project.items.filter((i) => i.layerId === l.id).length} items</small></div>
    ${project.items
      .filter((i) => i.layerId === l.id)
      .reverse()
      .map(
        (i) =>
          `<button class="layer ${selectionIds().includes(i.id) ? "selected" : ""} ${i.type === "bridge" ? "bridge-layer" : ""}" data-layer="${i.id}" ${!isEditable(project, i) ? "disabled" : ""}><span class="layer-icon">${icons[i.type] || "⌘"}</span><span>${esc(i.name)}</span><small>${i.type === "bridge" ? "TAB" : i.type === "text" ? "TEXT" : "PATH"}</small></button>`,
      )
      .join("")}
  </div>`,
    )
    .join("");
}
function field(key, label, value, step = 1, min = -2000, max = 2000) {
  return `<label>${label}<input data-prop="${key}" type="number" value="${Number(value.toFixed(3))}" step="${step}" min="${min}" max="${max}"></label>`;
}
function renderProperties() {
  const i = selectedItem();
  $("#properties").innerHTML = i
    ? `<section><div class="object-type">${i.type === "bridge" ? "BRIDGE / 非カット" : i.type === "text" ? "TYPOGRAPHY" : "SKETCH / パス"}</div><h3>${esc(i.name)}</h3><h4>配置 <span>mm</span></h4><div class="fields">${field("x", "X", i.x, 0.5)}${field("y", "Y", i.y, 0.5)}${field("rotation", "回転 °", i.rotation, 1, -360, 360)}</div></section>
  ${i.type === "text" ? `<section><h4>テキスト</h4><textarea id="text-content" maxlength="500" aria-label="文字内容">${esc(i.text)}</textarea><label class="full-label">フォント<select id="font-select">${[...fontLabels].map(([k, v]) => `<option value="${esc(k)}" ${i.font === k ? "selected" : ""}>${esc(v)}</option>`).join("")}${!fontLabels.has(i.font) ? `<option value="${esc(i.font)}" selected>追加フォント（再読込が必要）</option>` : ""}</select></label><div id="font-preview" class="font-preview" style="font-family:${i.font === "zen" ? "ZenPreview" : i.font === "shippori" ? "ShipporiPreview" : "sans-serif"}">日本語 Aa 123</div><button id="add-font" class="wide-button">＋ フォント追加 <small>TTF / OTF / WOFF</small></button><div class="fields">${field("size", "サイズ mm", i.size, 0.5, 1, 300)}${field("spacing", "字間 mm", i.spacing, 0.1, -100, 100)}</div><label class="check vertical-check"><input type="checkbox" id="vertical" ${i.vertical ? "checked" : ""}> 縦書き（右から左）</label></section>` : ""}
  ${["bridge", "rect", "circle", "line"].includes(i.type) ? `<section><h4>${i.type === "bridge" ? "切り残し領域" : "寸法"} <span>mm</span></h4><div class="fields">${field("w", "幅", i.w, 0.1, i.type === "line" ? 0 : 0.1)}${field("h", "高さ", i.h, 0.1, i.type === "line" ? 0 : 0.1)}</div>${i.type === "bridge" ? '<p class="note">オレンジ色の領域に重なったカット線を除去します。</p>' : ""}</section>` : ""}`
    : '<section class="no-selection"><span>↖</span><h3>オブジェクトを選択</h3><p>キャンバスや左の一覧から選択して、文字・位置・寸法を編集できます。</p></section>';
  const chosen = selectedItems();
  if (chosen.length > 1)
    $("#properties").innerHTML =
      `<section><h3>${chosen.length} アイテムを選択</h3><p class="note">差分の土台: ${esc(chosen[0].name)}</p><div class="boolean-actions"><button data-boolean="union">結合 ∪</button><button data-boolean="difference">切り抜き −</button><button data-boolean="intersection">交差 ∩</button><button data-boolean="xor">排他的 XOR</button></div><p class="note">閉じた図形・文字の輪郭に適用します。結果は固定パスになります。</p></section>`;
  if (chosen.length) {
    if (chosen.length === 1 && canResize(i))
      $("#properties").innerHTML +=
        `<section><label class="check"><input id="ratio-lock" type="checkbox" ${i.ratioLocked ? "checked" : ""}> 縦横比を固定</label><p class="note">四隅のハンドルをドラッグして拡縮。Shiftでも比率を固定できます。</p></section>`;
    $("#properties").innerHTML +=
      `<section><label class="full-label">所属レイヤー<select id="item-layer">${project.layers.map((l) => `<option value="${l.id}" ${i.layerId === l.id ? "selected" : ""} ${l.locked || !l.visible ? "disabled" : ""}>${esc(l.name)}</option>`).join("")}</select></label><button id="item-auto-bridge" class="wide-button">✧ 選択アイテムに自動ブリッジ</button>${i.targetId ? '<p class="note">このブリッジは対象アイテムのみに適用され、移動に追従します。</p>' : ""}</section>`;
  }
  $("#board-width").value = project.width;
  $("#board-height").value = project.height;
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
            `<g data-object="${i.id}" class="canvas-object"><path d="${pathData(worldContours(i))}" fill="${i.type === "line" ? "none" : selectionIds().includes(i.id) ? "#d9e9f5" : "#354859"}" fill-opacity="${i.type === "line" ? 0 : 0.9}" fill-rule="nonzero" stroke="${selectionIds().includes(i.id) ? "#276c9c" : "#243b50"}" stroke-width="0.22"/><path d="${pathData(worldContours(i))}" fill="none" stroke="transparent" stroke-width="2"/></g>`,
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
  $("#selection").innerHTML = overlay;
  $("#canvas").style.cursor = preview
    ? "default"
    : tool === "select"
      ? "default"
      : "crosshair";
  $("#canvas-mode").textContent = preview
    ? "加工プレビュー · 実際に出力されるカット線"
    : "スケッチ編集中";
  $("#hint").textContent = preview
    ? "赤い線をカットします。ブリッジ部分には線が出力されません。"
    : tool === "select"
      ? "四隅で拡縮 · Shiftで複数選択 / 比率固定 · Deleteで削除"
      : `${labels[tool]}を配置する場所をクリック`;
  $("#board-label").textContent = `${project.width} × ${project.height} mm`;
  $("#zoom-reset").textContent = `${Math.round(zoom * 100)}%`;
}
function render() {
  document.querySelectorAll("[data-loading-disabled]").forEach((el) => {
    el.disabled = el.dataset.loadingDisabled === "true";
    delete el.dataset.loadingDisabled;
  });
  $("#app").setAttribute("aria-busy", String(loading));
  ensureLayers(project);
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
  $("#project-name").textContent = project.name;
  renderLayers();
  renderProperties();
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
  $("#delete").disabled = $("#duplicate").disabled = !selectedItem();
  const c = cutGeometry(visibleItems(project)),
    outside = !withinBoard();
  $("#checks").innerHTML =
    `<div class="check-row"><span>閉じた輪郭</span><b>${c.closed}</b></div><div class="check-row ${c.untouched ? "warning" : "success"}"><span>切り残しなし</span><b>${c.untouched}</b></div><div class="check-row"><span>ブリッジ</span><b>${project.items.filter((i) => i.type === "bridge").length}</b></div>${c.vanished ? `<div class="check-row warning"><span>完全に隠れた輪郭</span><b>${c.vanished}</b></div>` : ""}<div class="check-summary ${outside || c.vanished ? "warning" : ""}">${c.vanished ? "! ブリッジ幅を縮めて輪郭を残してください" : outside ? "! 加工エリア外にカット線があります" : c.untouched ? "! 脱落させたくない輪郭にブリッジを追加" : c.closed ? "✓ 全閉輪郭に切り残しあり · 強度は要確認" : "図形や文字を追加してください"}</div>`;
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
    const next = { ...old, [key]: value };
    if (old.ratioLocked && ["w", "h"].includes(key) && old.w > 0 && old.h > 0) {
      next[key === "w" ? "h" : "w"] =
        key === "w" ? (value * old.h) / old.w : (value * old.w) / old.h;
      if (next.w > 2000 || next.h > 2000)
        throw Error("寸法は2000 mm以内にしてください。");
    }
    if (
      next.type === "text" &&
      ["text", "font", "size", "spacing", "vertical"].includes(key)
    ) {
      next.contours = textContours(next);
      next.name = next.text || "空の文字";
    } else if (["rect", "circle", "line"].includes(next.type))
      next.contours = shapeContours(next.type, next.w, next.h);
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
  } else if (el.id === "text-content") updateSelected("text", el.value);
  else if (el.id === "font-select") updateSelected("font", el.value);
  else if (el.id === "vertical") updateSelected("vertical", el.checked);
  else if (el.id === "ratio-lock") updateSelected("ratioLocked", el.checked);
  else if (el.id === "item-layer") {
    const layer = project.layers.find((l) => l.id === el.value);
    if (!layer?.visible || layer.locked) return;
    if (
      selectedItems().some(
        (i) => i.targetId && !selectionIds().includes(i.targetId),
      )
    ) {
      notify("対象付きブリッジは親アイテムと一緒にレイヤー移動してください。");
      renderProperties();
      return;
    }
    checkpoint();
    for (const i of selectedItems()) {
      i.layerId = layer.id;
      for (const b of project.items.filter((b) => b.targetId === i.id))
        b.layerId = layer.id;
    }
    activeLayer = layer.id;
    commit();
  }
});
$("#properties").addEventListener("click", (e) => {
  if (e.target.closest("#add-font")) $("#font-file").click();
  if (e.target.closest("#item-auto-bridge")) applyAutoBridges();
  const op = e.target.closest("[data-boolean]");
  if (op) applyBoolean(op.dataset.boolean);
});
$("#layers").addEventListener("click", (e) => {
  const b = e.target.closest("[data-layer]");
  if (b) {
    selectItem(b.dataset.layer, e.shiftKey || e.metaKey || e.ctrlKey);
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
$("#preview").onclick = () => {
  preview = !preview;
  tool = "select";
  render();
};
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
$("#duplicate").onclick = () => {
  const chosen = selectedItems();
  if (!chosen.length) return;
  checkpoint();
  const mapping = new Map(chosen.map((i) => [i.id, uid()]));
  const originals = [
    ...chosen,
    ...project.items.filter(
      (i) => mapping.has(i.targetId) && !mapping.has(i.id),
    ),
  ];
  const copies = originals.map((i) => {
    const copy = structuredClone(i);
    copy.id = mapping.get(i.id) || uid();
    copy.x += 5;
    copy.y += 5;
    if (mapping.has(i.targetId)) copy.targetId = mapping.get(i.targetId);
    return copy;
  });
  project.items.push(...copies);
  multi = chosen.map((i) => mapping.get(i.id));
  selected = multi.at(-1);
  commit();
};
$("#outline").onclick = () => {
  const i = selectedItem();
  if (i?.type !== "text" || !isEditable(project, i)) return;
  checkpoint();
  i.type = "outline";
  commit();
  notify("固定アウトラインに変換しました。四隅で拡縮できます。");
};
function applyAutoBridges() {
  const ids = selectedItems()
    .filter((i) => i.type !== "bridge")
    .map((i) => i.id);
  if (!ids.length) {
    notify("自動ブリッジを適用するアイテムを選択してください。");
    return;
  }
  const added = automaticBridges(visibleItems(project), 1.5, ids);
  if (!added.length) {
    notify("選択アイテムに切り残しを追加する閉輪郭はありません。");
    return;
  }
  if (project.items.length + added.length > 2000) {
    notify("オブジェクトが多すぎます。文字を減らしてください。");
    return;
  }
  checkpoint();
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
$("#export").onclick = exportFile;
$("#save-project").onclick = () =>
  download(
    "typefab-project.json",
    JSON.stringify(project, null, 2),
    "application/json",
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
    fonts.set(id, font);
    shapingFonts.set(
      id,
      typography.makeShapingFont(await typography.fontSFNT(bytes)),
    );
    fontLabels.set(id, file.name.replace(/\.[^.]+$/, ""));
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
$("#project-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024)
      throw Error("プロジェクトは20 MB以下にしてください。");
    const next = validateProject(JSON.parse(await file.text()));
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
  e.target.value = "";
};
function canvasPoint(e) {
  const matrix = $("#canvas").getScreenCTM();
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
}
$("#canvas").addEventListener("pointerdown", (e) => {
  if (loading || e.button !== 0 || preview) return;
  const p = canvasPoint(e);
  if (tool !== "select") {
    addItem(tool, snap ? Math.round(p.x) : p.x, snap ? Math.round(p.y) : p.y);
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
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    selectItem(id, true);
    render();
    return;
  }
  if (!selectionIds().includes(id)) selectItem(id);
  const chosen = selectedItems();
  if (chosen.length) {
    drag = {
      kind: "move",
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
  if (!drag.moved) {
    if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 0.3) return;
    checkpoint();
    drag.moved = true;
  }
  if (drag.kind === "resize") {
    const before = drag.before,
      current = project.items.find((i) => i.id === before.id);
    const point = snap ? { x: Math.round(p.x), y: Math.round(p.y) } : p;
    replaceItem(
      current,
      resizeFromHandle(
        before,
        drag.corner,
        point,
        before.ratioLocked || e.shiftKey,
      ),
    );
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
    if (drag?.moved) commit();
    drag = null;
  });
function setZoom(v) {
  zoom = Math.min(4, Math.max(0.25, v));
  renderCanvas();
}
$("#zoom-in").onclick = () => setZoom(zoom * 1.25);
$("#zoom-out").onclick = () => setZoom(zoom / 1.25);
$("#zoom-reset").onclick = () => setZoom(1);
new ResizeObserver(() => renderCanvas()).observe($("#canvas-scroll"));
window.addEventListener("keydown", (e) => {
  if (loading) return;
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || $("#help").open) return;
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
    await Promise.all(
      [
        ["zen", "ZenKakuGothicNew-Regular.ttf"],
        ["shippori", "ShipporiMincho-Regular.ttf"],
      ].map(async ([id, file]) => {
        const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
        if (!res.ok) throw Error(`フォント取得に失敗 (${res.status})`);
        const bytes = await res.arrayBuffer();
        fonts.set(id, opentype.parse(bytes));
        shapingFonts.set(id, typography.makeShapingFont(bytes));
      }),
    );
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
