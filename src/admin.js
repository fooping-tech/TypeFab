import "./order.css";
import { TRANSITIONS, CATALOG } from "./pricing.js";

const API = (import.meta.env.VITE_ORDER_API_URL || "").replace(/\/$/, "");
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const yen = (n) => (n === null || n === undefined ? "—" : `¥${Number(n).toLocaleString("ja-JP")}`);
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
const FILTERS = [
  ["open", "未処理"],
  ["PAID", "PAID"],
  ["PROCESSING", "PROCESSING"],
  ["READY", "READY"],
  ["SHIPPED", "SHIPPED"],
  ["COMPLETED", "COMPLETED"],
  ["PAYMENT_PENDING,CANCELLED", "未決済・取消"],
  ["", "すべて"],
];
const LABELS = { PROCESSING: "加工開始", READY: "加工完了", SHIPPED: "発送済みにする", COMPLETED: "完了にする", CANCELLED: "キャンセル" };
let token = sessionStorage.getItem("typefab-admin-token") || "";
let filter = "open";
let orders = [];

$("#api-label").textContent = API ? new URL(API).host : "API未設定";
function alertMsg(text) {
  const el = $("#alert");
  el.textContent = text ?? "";
  el.classList.toggle("hidden", !text);
}
async function api(path, options = {}) {
  if (!API) throw Error("注文APIのURL（VITE_ORDER_API_URL）が設定されていません。");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers ?? {}) },
  });
  if (res.status === 401) {
    logout();
    throw Error("管理者トークンが違います。");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Error(body.error || `エラー (${res.status})`);
  }
  return res;
}
function logout() {
  token = "";
  sessionStorage.removeItem("typefab-admin-token");
  $("#login").classList.remove("hidden");
  $("#list-view").classList.add("hidden");
  $("#logout").classList.add("hidden");
}
async function load() {
  alertMsg("");
  try {
    const res = await api(`/api/admin/orders${filter ? `?status=${filter}` : ""}`);
    orders = (await res.json()).orders;
    $("#login").classList.add("hidden");
    $("#list-view").classList.remove("hidden");
    $("#logout").classList.remove("hidden");
    sessionStorage.setItem("typefab-admin-token", token);
    render();
  } catch (e) {
    alertMsg(e.message);
  }
}
function render() {
  $("#filters").innerHTML =
    FILTERS.map(([v, label]) => `<button data-filter="${v}" aria-pressed="${filter === v}">${label}</button>`).join("") +
    `<button id="reload" style="margin-left:auto">↻ 更新</button>`;
  $("#count").textContent = `${orders.length} 件 · 特急は赤い帯、発送期限を過ぎたものは赤字`;
  const now = Date.now();
  $("#orders").innerHTML = orders.length
    ? orders
        .map((o) => {
          const express = o.deliveryType === "EXPRESS";
          const overdue = o.shipBy && ["PAID", "PROCESSING", "READY"].includes(o.status) && new Date(o.shipBy).getTime() < now;
          const next = (TRANSITIONS[o.status] ?? []).filter((s) => LABELS[s]);
          return `<article class="order ${express ? "express" : ""}" data-id="${esc(o.id)}">
  <div>
    <div class="id">#${esc(o.id)} <span class="badge status-${esc(o.status)}">${esc(o.status)}</span> <span class="badge ${express ? "express" : ""}">${express ? "特急" : "通常便"}</span></div>
    <div class="meta"><span>注文日 <b>${day(o.createdAt)}</b></span><span>決済 <b>${day(o.paidAt)}</b></span><span class="deadline ${overdue ? "overdue" : ""}">発送期限 <b>${day(o.shipBy)}</b>${overdue ? " 超過" : ""}</span></div>
    <div class="spec">
      <div><span>材料</span>${esc(CATALOG.materials.find((m) => m.id === o.material)?.name ?? o.material)} ${esc(o.thicknessMm)} mm</div>
      <div><span>サイズ</span>${Number(o.widthMm).toFixed(1)} × ${Number(o.heightMm).toFixed(1)} mm</div>
      <div><span>数量</span>${esc(o.quantity)}</div>
      <div><span>カット長 / パス</span>${Math.round(o.cutLengthMm ?? 0).toLocaleString("ja-JP")} mm / ${esc(o.pathCount ?? "—")}</div>
      <div><span>予測加工時間</span>${o.estimatedProcessingMinutes ?? "—"} 分</div>
      <div><span>ファイル</span>${esc(o.originalFileName)}</div>
    </div>
  </div>
  <div class="price">${yen(o.totalPrice)}<div class="note" style="margin:2px 0 0">加工 ${yen(o.processingPrice)} + 送料 ${yen(o.shippingPrice)}</div></div>
  <div class="address">${esc(o.customerName)}（${esc(o.customerEmail)}）〒${esc(o.shippingPostalCode)} ${esc(o.shippingPrefecture)} ${esc(o.shippingAddress1)} ${esc(o.shippingAddress2 ?? "")} ${o.shippingPhone ? `☎ ${esc(o.shippingPhone)}` : ""}${o.shippingTrackingNumber ? ` · 追跡番号 <b>${esc(o.shippingTrackingNumber)}</b>${o.shippingCarrier ? `（${esc(o.shippingCarrier)}）` : ""}` : ""}${o.notes ? ` · メモ: ${esc(o.notes)}` : ""}</div>
  <div class="buttons">
    <button data-action="view">SVGを表示</button>
    <button data-action="download">SVGをダウンロード</button>
    ${next.map((s) => `<button data-action="status" data-status="${s}" class="${s === "CANCELLED" ? "danger" : ""}">${LABELS[s]}</button>`).join("")}
  </div>
</article>`;
        })
        .join("")
    : `<p class="note">該当する注文はありません。</p>`;
}
async function svgBlob(id) {
  const res = await api(`/api/admin/orders/${id}/svg`);
  return { blob: await res.blob(), name: /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] };
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.filter !== undefined) {
    filter = b.dataset.filter;
    return load();
  }
  if (b.id === "reload") return load();
  const article = b.closest("article[data-id]");
  if (!article) return;
  const id = article.dataset.id;
  try {
    if (b.dataset.action === "view") {
      const { blob } = await svgBlob(id);
      const url = URL.createObjectURL(new File([blob], `${id}.svg`, { type: "image/svg+xml" }));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else if (b.dataset.action === "download") {
      const { blob, name } = await svgBlob(id);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = decodeURIComponent(name || `${id}.svg`);
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    } else if (b.dataset.action === "status") {
      const status = b.dataset.status;
      const body = { status };
      if (status === "SHIPPED") {
        const tracking = prompt("追跡番号（任意）を入力してください。空欄でも発送済みにできます。", "");
        if (tracking === null) return;
        body.trackingNumber = tracking.trim();
        if (body.trackingNumber) {
          const carrier = prompt("配送会社（任意）: ヤマト運輸 / 日本郵便 / 佐川急便 など", "");
          if (carrier === null) return;
          body.carrier = carrier.trim();
        }
      } else if (status === "CANCELLED" && !confirm(`${id} をキャンセルしますか？（Stripeの返金は別途Stripeダッシュボードで行います）`)) return;
      await api(`/api/admin/orders/${id}/status`, { method: "POST", body: JSON.stringify(body) });
      await load();
    }
  } catch (err) {
    alertMsg(err.message);
  }
});
$("#enter").onclick = () => {
  token = $("#token").value.trim();
  if (!token) return alertMsg("トークンを入力してください。");
  load();
};
$("#token").addEventListener("keydown", (e) => e.key === "Enter" && $("#enter").click());
$("#logout").onclick = logout;
if (!API) alertMsg("注文APIのURL（VITE_ORDER_API_URL）が設定されていないため、注文を表示できません。README の「加工注文（EC）」を参照してください。");
else if (token) load();
