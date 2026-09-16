import "./order.css";
import { CATALOG, quote, publicCatalog } from "./pricing.js";
import { analyzeSVG, sanitizeSVG, withPhysicalSize } from "./svganalyze.js";
import { BOOK_WIDTH_MM, BOOK_HEIGHT_MM, bookmarkPiece, bookmarkOrientation, bookmarkLayout, bookmarkWarnings, renderSingle, renderInBook, renderComparison } from "./bookmark-preview.js";

const API = (import.meta.env.VITE_ORDER_API_URL || "").replace(/\/$/, "");
const HANDOFF_KEY = "typefab-order";
// Only the fabrication options are remembered, and only for this tab
// (sessionStorage). Name, e-mail, address and phone stay in the form and are
// never written to browser storage (issue #8).
const DRAFT_KEY = "typefab-order-options";
const LEGACY_KEYS = ["typefab-order-draft", "typefab-order-last"];
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const yen = (n) => (n === null || n === undefined ? "—" : `¥${Number(n).toLocaleString("ja-JP")}`);
const PREFECTURES = "北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県".split(" ");
const STATUS_LABEL = {
  NEW: "受付",
  PAYMENT_PENDING: "決済待ち",
  PAID: "決済完了（加工待ち）",
  PROCESSING: "加工中",
  READY: "加工完了（発送準備中）",
  SHIPPED: "発送済み",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const state = {
  catalog: publicCatalog(CATALOG),
  online: false,
  contactUrl: "https://github.com/fooping-tech/TypeFab/issues",
  svg: "",
  fileName: "",
  fromEditor: false,
  analysis: null,
  material: "kraft-black",
  thicknessMm: 0.3,
  quantity: 1,
  deliveryType: "NORMAL",
  quote: null,
  // Finished-look mock-ups (issue #7): which view is open, whether a
  // landscape design is shown upright (null = automatic), and the piece
  // read from the SVG (null until the physical size is known).
  mockup: { view: "book", rotated: null, piece: null },
};
let previewUrl = null;

function alertMsg(text) {
  const el = $("#alert");
  el.textContent = text ?? "";
  el.classList.toggle("hidden", !text);
  if (text) el.scrollIntoView({ block: "nearest" });
}
function banner(text, kind = "") {
  const el = $("#banner");
  el.className = `banner ${kind} ${text ? "" : "hidden"}`;
  el.textContent = text ?? "";
}

// ---- SVG ------------------------------------------------------------------
function setSVG(text, fileName, fromEditor = false) {
  state.svg = text;
  state.fileName = fileName || "design.svg";
  state.fromEditor = fromEditor;
  state.analysis = analyzeSVG(text, { limits: state.catalog.limits });
  state.mockup.piece = null;
  state.mockup.rotated = null;
  if (state.analysis.size?.known && !state.analysis.security.length) {
    try {
      state.mockup.piece = bookmarkPiece(text);
    } catch {
      state.mockup.piece = null;
    }
  }
  renderSVG();
  renderMockup();
  updateQuote();
}
// ---- finished-look mock-ups -------------------------------------------------------
const MOCKUP_VIEWS = { single: renderSingle, book: renderInBook, compare: renderComparison };
function renderMockup() {
  const a = state.analysis,
    m = state.mockup,
    box = $("#mockup"),
    panel = $("#mockup-panel"),
    tabs = [...$("#mockup-tabs").querySelectorAll("[role=tab]")];
  const unreadable = !a || !state.svg || a.errors.some((e) => /読み込めません|SVGファイルではありません|大きすぎます（最大/.test(e)) || a.security.length;
  const sizePending = a && a.size && !a.size.known;
  if (unreadable || !a.pathCount || (!sizePending && !m.piece)) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  for (const t of tabs) {
    const on = t.dataset.view === m.view;
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.tabIndex = on ? 0 : -1;
    t.disabled = Boolean(sizePending);
  }
  panel.setAttribute("aria-labelledby", `mockup-tab-${m.view}`);
  $("#mockup-rotate-wrap").classList.add("hidden");
  if (sizePending) {
    panel.innerHTML = `<p class="empty">実寸（mm）を確定すると完成イメージを表示します。上の「実寸の幅 (mm)」を入力して「実寸を適用」を押してください。</p>`;
    $("#mockup-info").innerHTML = "";
    $("#mockup-warnings").innerHTML = "";
    return;
  }
  const piece = m.piece;
  const o = bookmarkOrientation(piece, m.rotated);
  const lay = bookmarkLayout(o.widthMm, o.heightMm);
  panel.innerHTML = MOCKUP_VIEWS[m.view](piece, { rotated: o.rotated });
  const mm = (v) => `${Number(v).toFixed(1)} mm`;
  const rows = [
    ["文庫本", `${BOOK_WIDTH_MM} × ${BOOK_HEIGHT_MM} mm`],
    ["しおり", `${mm(o.widthMm)} × ${mm(o.heightMm)}${piece.sheet ? "（SVG全体を1枚の紙として表示）" : "（切断線の外形）"}`],
  ];
  if (!piece.sheet && (Math.abs(piece.sheetWidthMm - piece.widthMm) > 0.05 || Math.abs(piece.sheetHeightMm - piece.heightMm) > 0.05))
    rows.push(["SVG実寸", `${mm(piece.sheetWidthMm)} × ${mm(piece.sheetHeightMm)}（外形の周りは余白）`]);
  if (m.view === "book") {
    rows.push(["上部表示", mm(lay.visibleTopMm)]);
    if (lay.bottomOverhangMm > 0) rows.push(["下部はみ出し", mm(lay.bottomOverhangMm)]);
  }
  if (m.view === "compare") rows.push(["文庫本との比", `幅 ${Math.round(lay.widthRatio * 100)}% · 高さ ${Math.round(lay.heightRatio * 100)}%`]);
  $("#mockup-info").innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  if (piece.widthMm > piece.heightMm) {
    $("#mockup-rotate-wrap").classList.remove("hidden");
    $("#mockup-rotate").checked = o.rotated;
  }
  $("#mockup-warnings").innerHTML = bookmarkWarnings(o.widthMm, o.heightMm)
    .map((w) => `<li class="warn" data-code="${esc(w.code)}">${esc(w.text)}</li>`)
    .join("");
}
function selectMockupView(view, focus = false) {
  if (!MOCKUP_VIEWS[view]) return;
  state.mockup.view = view;
  renderMockup();
  if (focus) $(`#mockup-tab-${view}`)?.focus();
}
function renderSVG() {
  const a = state.analysis;
  $("#file-line").innerHTML = state.svg
    ? `<code>${esc(state.fileName)}</code><span class="note" style="margin:0">${(state.svg.length / 1024).toFixed(1)} KB${state.fromEditor ? " · TypeFabのエディタから受け取ったデザイン" : ""}</span>`
    : "";
  const preview = $("#preview");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  if (!state.svg || !a || a.errors.some((e) => /読み込めません|SVGファイルではありません|大きすぎます（最大/.test(e))) {
    preview.innerHTML = `<span class="empty">${state.svg ? "プレビューできません" : "SVGがまだありません"}</span>`;
  } else {
    // The preview is the sanitised document inside <img>, which never runs
    // scripts or loads external resources.
    try {
      const clean = sanitizeSVG(state.svg);
      previewUrl = URL.createObjectURL(new Blob([clean], { type: "image/svg+xml" }));
      preview.innerHTML = `<img alt="注文するSVGのプレビュー" />`;
      preview.querySelector("img").src = previewUrl;
    } catch {
      preview.innerHTML = `<span class="empty">プレビューできません</span>`;
    }
  }
  const items = [];
  if (a) {
    if (!a.errors.some((e) => /読み込めません|SVGファイルではありません/.test(e))) items.push(["ok", "SVG形式"]);
    if (a.size?.known) items.push(["ok", `実寸 ${a.size.widthMm.toFixed(1)} × ${a.size.heightMm.toFixed(1)} mm`]);
    if (a.size?.viewBox) items.push(["ok", "viewBox 正常"]);
    if (a.pathCount && !Object.keys(a.unsupported).length) items.push(["ok", "pathのみ（カット図形のみ）"]);
    for (const e of a.errors) items.push(["bad", e]);
    for (const w of a.warnings) items.push(["warn", w]);
    if (a.security.length) items.push(["bad", "安全のため、このファイルは受け付けられません。スクリプト・外部参照を取り除いて保存し直してください。"]);
  }
  $("#checks").innerHTML = items.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join("");
  $("#stat").innerHTML = a?.pathCount
    ? `総カット長 <b>${Math.round(a.cutLengthMm).toLocaleString("ja-JP")}</b> mm · パス <b>${a.pathCount}</b> 個（閉じた輪郭 ${a.closedPaths}、開いた線 ${a.openPaths}）`
    : "";
  const needSize = a && a.size && !a.size.known && a.size.source !== "none";
  $("#size-confirm").classList.toggle("hidden", !needSize);
  if (needSize && !$("#confirm-width").value) $("#confirm-width").value = a.size.suggestedWidthMm ?? "";
}
async function readFile(file) {
  if (!file) return;
  if (file.size > state.catalog.limits.maxSvgBytes) return alertMsg(`ファイルが大きすぎます（最大 ${Math.round(state.catalog.limits.maxSvgBytes / 1024 / 1024)} MB）。`);
  alertMsg("");
  setSVG(await file.text(), file.name, false);
}

// ---- options & quote --------------------------------------------------------
function renderOptions() {
  const c = state.catalog;
  // A draft from an earlier catalogue may name a material that is gone.
  if (!c.materials.some((m) => m.id === state.material)) state.material = c.materials[0]?.id ?? null;
  $("#material").innerHTML = c.materials.map((m) => `<option value="${m.id}" ${m.id === state.material ? "selected" : ""}>${esc(m.name)}</option>`).join("");
  const mat = c.materials.find((m) => m.id === state.material);
  const ths = mat?.thicknesses ?? [];
  if (!ths.some((t) => t.mm === state.thicknessMm)) state.thicknessMm = ths[0]?.mm ?? null;
  $("#thickness").innerHTML = ths.length
    ? ths.map((t) => `<option value="${t.mm}" ${t.mm === state.thicknessMm ? "selected" : ""}>${t.mm} mm</option>`).join("")
    : `<option value="">要相談</option>`;
  $("#thickness").disabled = !ths.length;
  $("#quantity").value = state.quantity;
  $("#delivery").innerHTML = Object.entries(c.delivery)
    .map(
      ([id, d]) =>
        `<label><input type="radio" name="delivery" value="${id}" ${id === state.deliveryType ? "checked" : ""}><span><b>${esc(d.label)}${id === "EXPRESS" ? "（加工料金 ×2）" : ""}</b><small>注文確定後 ${d.leadTimeDays} 日以内を目安に発送${id === "EXPRESS" ? "。送料は変わりません" : ""}</small></span></label>`,
    )
    .join("");
}
function updateQuote() {
  const a = state.analysis;
  const q = quote(
    {
      material: state.material,
      thicknessMm: state.thicknessMm,
      quantity: state.quantity,
      deliveryType: state.deliveryType,
      widthMm: a?.size?.widthMm,
      heightMm: a?.size?.heightMm,
      cutLengthMm: a?.cutLengthMm ?? 0,
      pathCount: a?.pathCount ?? 0,
    },
    state.catalog,
  );
  state.quote = q;
  const rows = [];
  if (!a) rows.push(["SVGを読み込むと料金を表示します", ""]);
  else if (!q.ok) rows.push([q.errors[0], ""]);
  else {
    rows.push(["基本料金", yen(q.baseFee)]);
    rows.push([`材料費（${q.materialName} ${q.thicknessMm ?? "—"} mm）`, yen(q.materialFee)]);
    rows.push([`加工費（カット長 ${Math.round(q.cutLengthMm).toLocaleString("ja-JP")} mm）`, yen(q.processingFee)]);
    if (q.quantity > 1) rows.push([`数量加算（${q.quantity - 1} 個分）`, yen(q.quantityFee)]);
    if (q.deliveryMultiplier > 1) rows.push(["特急（加工料金 ×2）", `× ${q.deliveryMultiplier}`]);
    if (!q.inquiryRequired) {
      rows.push(["加工料金", yen(q.processingPrice)]);
      rows.push([`送料（${q.shippingLabel}）`, yen(q.shippingPrice)]);
      rows.push(["合計", yen(q.totalPrice), "total"]);
      rows.push([`予測加工時間 約 ${q.estimatedProcessingMinutes} 分 · ${q.leadTimeDays} 日以内に発送`, "", "sub"]);
    }
  }
  $("#quote").innerHTML = rows.map(([l, v, k = ""]) => `<div class="${k}">${esc(l)}</div><div class="amount ${k}">${esc(v)}</div>`).join("");
  const bulk = $("#bulk");
  if (q.ok && q.inquiryRequired) {
    bulk.classList.remove("hidden");
    bulk.innerHTML = `<b>${state.quantity >= state.catalog.bulkThreshold ? `${state.catalog.bulkThreshold}個以上の大量注文について` : "この材料について"}</b><br>${esc(q.inquiryReasons.join(" "))}<br><a href="${esc(state.contactUrl)}" target="_blank" rel="noopener">大量注文について問い合わせる →</a>`;
  } else bulk.classList.add("hidden");
  $("#review").disabled = !(a?.ok && q.ok && !q.inquiryRequired && state.online);
  saveDraft();
}

// ---- customer form ----------------------------------------------------------
const fields = ["name", "email", "postal", "prefecture", "address1", "address2", "phone"];
function customer() {
  const v = (id) => $(`#${id}`).value.trim();
  return {
    customer: { name: v("name"), email: v("email") },
    shipping: { postalCode: v("postal"), prefecture: v("prefecture"), address1: v("address1"), address2: v("address2"), phone: v("phone") },
  };
}
function validateCustomer() {
  const { customer: c, shipping: s } = customer();
  const errors = [];
  if (!c.name) errors.push("お名前を入力してください。");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) errors.push("メールアドレスを確認してください。");
  if (s.postalCode.replace(/[^0-9]/g, "").length !== 7) errors.push("郵便番号は7桁で入力してください。");
  if (!s.prefecture) errors.push("都道府県を選んでください。");
  if (!s.address1) errors.push("住所を入力してください。");
  return errors;
}
function saveDraft() {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ material: state.material, thicknessMm: state.thicknessMm, quantity: state.quantity, deliveryType: state.deliveryType }));
  } catch {}
}
function loadDraft() {
  try {
    // Drafts written by earlier versions held the address in localStorage.
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    if (!d) return;
    Object.assign(state, { material: d.material ?? state.material, thicknessMm: d.thicknessMm ?? state.thicknessMm, quantity: d.quantity ?? 1, deliveryType: d.deliveryType ?? "NORMAL" });
  } catch {}
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(HANDOFF_KEY);
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {}
}

// ---- confirmation & checkout ------------------------------------------------
function showConfirm() {
  const a = state.analysis,
    q = state.quote,
    { customer: c, shipping: s } = customer();
  const d = state.catalog.delivery[q.deliveryType];
  $("#summary").innerHTML = [
    ["SVG", esc(state.fileName)],
    ["サイズ", `${a.size.widthMm.toFixed(1)} × ${a.size.heightMm.toFixed(1)} mm`],
    ["材料", esc(q.materialName)],
    ["厚さ", `${q.thicknessMm} mm`],
    ["数量", String(q.quantity)],
    ["納期", `${esc(d.label)} ${d.leadTimeDays}日以内発送`],
    ["加工料金", yen(q.processingPrice)],
    ["送料", yen(q.shippingPrice)],
    ["合計", `<b>${yen(q.totalPrice)}</b>`],
    ["お届け先", `${esc(c.name)}<br>〒${esc(s.postalCode)} ${esc(s.prefecture)} ${esc(s.address1)} ${esc(s.address2)}<br>${esc(c.email)}${s.phone ? ` · ${esc(s.phone)}` : ""}`],
  ]
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");
  $("#form-view").classList.add("hidden");
  $("#confirm-view").classList.remove("hidden");
  window.scrollTo({ top: 0 });
}
async function pay() {
  const btn = $("#pay");
  btn.disabled = true;
  btn.textContent = "決済ページを準備しています…";
  alertMsg("");
  try {
    const res = await fetch(`${API}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        svg: state.svg,
        fileName: state.fileName,
        material: state.material,
        thicknessMm: state.thicknessMm,
        quantity: state.quantity,
        deliveryType: state.deliveryType,
        ...customer(),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const details = body.details?.length ? ` ${body.details.join(" ")}` : "";
      throw Error((body.error || `注文を作成できませんでした (${res.status})`) + details + (body.inquiryRequired && body.contactUrl ? ` お問い合わせ: ${body.contactUrl}` : ""));
    }
    // Nothing about the order stays in the browser: Stripe redirects back to
    // the order page with the order id and token in the URL.
    clearDraft();
    for (const id of fields) $(`#${id}`).value = "";
    location.assign(body.checkoutUrl);
  } catch (e) {
    alertMsg(e.message);
    btn.disabled = false;
    btn.textContent = "Stripeで支払う";
  }
}

// ---- order status view (after Stripe redirects back) ------------------------
const PAID_LIKE = ["PAID", "PROCESSING", "READY", "SHIPPED", "COMPLETED"];
async function showStatus(orderId, token, result) {
  clearDraft();
  $("#form-view").classList.add("hidden");
  $("#confirm-view").classList.add("hidden");
  const view = $("#status-view");
  view.classList.remove("hidden");
  const render = (order, note) => {
    view.innerHTML = `<h2>注文 ${esc(orderId)}</h2>${note ? `<div class="banner ${order?.status === "PAID" ? "ok" : ""}">${note}</div>` : ""}${
      order
        ? `<dl class="summary"><dt>ステータス</dt><dd><span class="badge status-${esc(order.status)}">${esc(STATUS_LABEL[order.status] ?? order.status)}</span></dd><dt>SVG</dt><dd>${esc(order.fileName)}（${Number(order.widthMm).toFixed(1)} × ${Number(order.heightMm).toFixed(1)} mm）</dd><dt>内容</dt><dd>${esc(order.material)} ${esc(order.thicknessMm)} mm × ${esc(order.quantity)} · ${order.deliveryType === "EXPRESS" ? "特急" : "通常"}</dd><dt>合計</dt><dd>${yen(order.totalPrice)}</dd>${order.shipBy ? `<dt>発送予定</dt><dd>${new Date(order.shipBy).toLocaleDateString("ja-JP")} まで</dd>` : ""}${order.trackingNumber ? `<dt>追跡番号</dt><dd>${esc(order.trackingNumber)}${order.carrier ? `（${esc(order.carrier)}）` : ""}</dd>` : ""}${
            order.receiptUrl ? `<dt>領収書</dt><dd><a href="${esc(order.receiptUrl)}" target="_blank" rel="noopener" id="receipt-link"><button>領収書を表示（Stripe）</button></a><span class="note" style="display:block;margin:4px 0 0">Stripe が発行する領収書です。決済時のメールアドレスにも Stripe から領収書メールが届きます。</span></dd>` : PAID_LIKE.includes(order.status) ? `<dt>領収書</dt><dd><span class="note" style="margin:0">領収書を準備しています。しばらくしてからこのページを再読み込みしてください。</span></dd>` : ""
          }</dl>`
        : ""
    }<p class="note">このページには配送先やメールアドレスを表示しません。注文受付メールに記載した確認用URLは第三者に共有しないでください。お問い合わせは注文番号を添えて <a href="${esc(state.contactUrl)}" target="_blank" rel="noopener">問い合わせ窓口</a> へ。 <a href="../privacy/">プライバシーポリシー</a></p><div class="actions"><a href="../app/"><button>エディタに戻る</button></a><a href="./"><button>別のSVGを注文する</button></a></div>`;
  };
  const fetchOrder = async () => {
    const res = await fetch(`${API}/api/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`);
    if (!res.ok) throw Error("注文情報を取得できませんでした。注文番号とメールをお控えください。");
    return (await res.json()).order;
  };
  try {
    let order = await fetchOrder();
    if (result === "cancel") render(order, "決済はキャンセルされました。内容を変えて再度注文できます（この注文は未決済のまま残り、支払いは発生しません）。");
    else if (result === "success") {
      const paidNote = "決済を受け付けました。ありがとうございます。注文受付メールをお送りしました（届かない場合は迷惑メールフォルダーもご確認ください）。";
      render(order, order.status === "PAID" ? paidNote : "決済結果を確認しています…（Stripeからの通知を待っています）");
      // Wait for the webhook (status) and then, briefly, for the receipt.
      for (let i = 0; i < 20 && (!["PAID", "PROCESSING", "READY", "SHIPPED", "COMPLETED", "CANCELLED"].includes(order.status) || (PAID_LIKE.includes(order.status) && !order.receiptUrl && i < 3)); i++) {
        await new Promise((r) => setTimeout(r, 3000));
        order = await fetchOrder();
        render(order, order.status === "PAID" ? paidNote : "決済結果を確認しています…（Stripeからの通知を待っています）");
      }
      if (order.status === "PAYMENT_PENDING") render(order, "まだ決済の確定通知が届いていません。しばらくしてからこのページを再読み込みしてください。");
    } else render(order, "");
  } catch (e) {
    view.innerHTML = `<h2>注文 ${esc(orderId)}</h2><div class="banner error">${esc(e.message)}</div><div class="actions"><a href="./"><button>注文ページへ</button></a></div>`;
  }
}

// ---- wiring -------------------------------------------------------------------
function wire() {
  $("#prefecture").innerHTML = `<option value="">選択</option>` + PREFECTURES.map((p) => `<option>${p}</option>`).join("");
  const drop = $("#drop");
  $("#file").onchange = (e) => readFile(e.target.files[0]);
  for (const ev of ["dragenter", "dragover"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); });
  for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); });
  drop.addEventListener("drop", (e) => readFile(e.dataTransfer.files[0]));
  $("#confirm-apply").onclick = () => {
    try {
      setSVG(withPhysicalSize(state.svg, Number($("#confirm-width").value)), state.fileName, state.fromEditor);
      alertMsg("");
    } catch (e) {
      alertMsg(e.message);
    }
  };
  $("#mockup-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[role=tab]");
    if (tab && !tab.disabled) selectMockupView(tab.dataset.view);
  });
  $("#mockup-tabs").addEventListener("keydown", (e) => {
    const views = Object.keys(MOCKUP_VIEWS),
      i = views.indexOf(state.mockup.view);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      selectMockupView(views[(i + (e.key === "ArrowRight" ? 1 : views.length - 1)) % views.length], true);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      selectMockupView(e.key === "Home" ? views[0] : views.at(-1), true);
    }
  });
  $("#mockup-rotate").onchange = (e) => { state.mockup.rotated = e.target.checked; renderMockup(); };
  $("#material").onchange = (e) => { state.material = e.target.value; renderOptions(); updateQuote(); };
  $("#thickness").onchange = (e) => { state.thicknessMm = Number(e.target.value); updateQuote(); };
  $("#quantity").oninput = (e) => { state.quantity = Math.max(1, Math.floor(Number(e.target.value) || 1)); updateQuote(); };
  $("#delivery").onchange = (e) => { state.deliveryType = e.target.value; updateQuote(); };
  $("#review").onclick = () => {
    const errors = validateCustomer();
    if (errors.length) return alertMsg(errors.join(" "));
    alertMsg("");
    showConfirm();
  };
  $("#edit").onclick = () => { $("#confirm-view").classList.add("hidden"); $("#form-view").classList.remove("hidden"); };
  $("#pay").onclick = pay;
}
async function loadConfig() {
  if (!API) {
    banner("注文サービス（Cloudflare Workers）のURLが設定されていないため、現在は概算の表示のみで、決済はできません。", "");
    return;
  }
  try {
    const res = await fetch(`${API}/api/config`);
    if (!res.ok) throw Error(`HTTP ${res.status}`);
    const cfg = await res.json();
    state.catalog = cfg.catalog;
    state.contactUrl = cfg.contactUrl || state.contactUrl;
    if (cfg.personalDataRetentionDays) for (const el of document.querySelectorAll("[data-retention-days]")) el.textContent = cfg.personalDataRetentionDays;
    state.online = Boolean(cfg.stripeConfigured);
    if (!cfg.stripeConfigured) banner("決済（Stripe）の設定が完了していないため、現在は概算の表示のみで、注文はできません。");
    else banner("");
  } catch (e) {
    banner(`注文サービスに接続できません（${e.message}）。概算のみ表示します。`, "error");
  }
}
async function init() {
  wire();
  const params = new URLSearchParams(location.search);
  if (params.get("order") && params.get("token")) {
    if (!API) return banner("注文APIのURLが設定されていません。", "error");
    // The token is only needed for the API call; drop it from the address
    // bar so it is not kept in history or copied by accident.
    try {
      history.replaceState(null, "", location.pathname);
    } catch {}
    await loadConfig();
    return showStatus(params.get("order"), params.get("token"), params.get("result"));
  }
  loadDraft();
  renderOptions();
  await loadConfig();
  renderOptions();
  try {
    const handoff = JSON.parse(localStorage.getItem(HANDOFF_KEY) || "null");
    if (handoff?.svg) setSVG(handoff.svg, handoff.fileName || "typefab.svg", true);
  } catch {}
  updateQuote();
}
init();
