import "./order.css";
import { TRANSITIONS, CATALOG } from "./pricing.js";

// Served by the Worker (base "/"): the API is same-origin and protected by
// Cloudflare Access. Under the Vite dev server the page calls the Worker
// named by VITE_ORDER_API_URL with the ADMIN_TOKEN (local development).
const API = (import.meta.env.BASE_URL === "/" ? location.origin : import.meta.env.VITE_ORDER_API_URL || "").replace(/\/$/, "");
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const yen = (n) => (n === null || n === undefined ? "—" : `¥${Number(n).toLocaleString("ja-JP")}`);
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
const when = (iso) => (iso ? new Date(iso).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
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
const NOTIFICATION_LABEL = { customer_paid: "購入者への受付メール", admin_paid: "管理者への新規注文通知" };
let token = sessionStorage.getItem("typefab-admin-token") || "";
let session = null; // { mode: "access" | "token", email }
let filter = "open";
let orders = [];
const details = new Map(); // order id → { order, events, notifications }

$("#api-label").textContent = API ? new URL(API).host : "API未設定";
function alertMsg(text) {
  const el = $("#alert");
  el.textContent = text ?? "";
  el.classList.toggle("hidden", !text);
}
function show(id, on) {
  $(`#${id}`).classList.toggle("hidden", !on);
}
async function api(path, options = {}) {
  if (!API) throw Error("注文APIのURL（VITE_ORDER_API_URL）が設定されていません。");
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers ?? {}) },
  });
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    unauthenticated(body.authMode);
    throw Error(body.authMode === "access" ? "Cloudflare Access の認証が必要です。" : "管理者トークンが違います。");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Error(body.error || `エラー (${res.status})`);
  }
  return res;
}
function unauthenticated(mode) {
  token = "";
  session = null;
  sessionStorage.removeItem("typefab-admin-token");
  show("list-view", false);
  show("logout", false);
  show("login", mode !== "access");
  show("access-required", mode === "access");
  $("#who").textContent = "";
}
function logout() {
  unauthenticated(session?.mode);
}
async function start() {
  alertMsg("");
  try {
    // Ask the public health endpoint which auth mode the Worker runs in, so
    // a token-mode page shows the form without a failing request first.
    if (!token) {
      const health = await (await fetch(`${API}/api/health`)).json().catch(() => null);
      if (health?.adminAuth === "none") {
        unauthenticated("access");
        return alertMsg("この Worker は本番モード（APP_ENV=production）ですが Cloudflare Access が設定されていません。ACCESS_TEAM_DOMAIN / ACCESS_AUD を設定して再デプロイしてください（ADMIN_TOKEN は本番では使えません）。");
      }
      if (health && !health.accessConfigured) return unauthenticated("token");
    }
    session = await (await api("/api/admin/session")).json();
    if (token) sessionStorage.setItem("typefab-admin-token", token);
    $("#who").textContent = session.mode === "access" ? `Access: ${session.email ?? "認証済み"}` : "ローカル（ADMIN_TOKEN）";
    $("#retention-days").textContent = session.retentionDays;
    show("login", false);
    show("access-required", false);
    show("list-view", true);
    show("logout", session.mode === "token");
    if (!session.mailConfigured) alertMsg("メール送信（MAIL_API_KEY / MAIL_FROM）が設定されていないため、注文通知メールは送られません。");
    await load();
  } catch (e) {
    if (session === null && !$("#access-required").classList.contains("hidden")) return;
    alertMsg(e.message);
  }
}
async function load() {
  try {
    const res = await api(`/api/admin/orders${filter ? `?status=${filter}` : ""}`);
    orders = (await res.json()).orders;
    render();
  } catch (e) {
    alertMsg(e.message);
  }
}
function materialName(id) {
  return CATALOG.materials.find((m) => m.id === id)?.name ?? id;
}
function renderDetail(d) {
  const o = d.order;
  const shipping = o.shippingVisible
    ? `<div class="address"><b>配送先</b> ${esc(o.customerName)}（${esc(o.customerEmail)}）〒${esc(o.shippingPostalCode)} ${esc(o.shippingPrefecture)} ${esc(o.shippingAddress1)} ${esc(o.shippingAddress2 ?? "")} ${o.shippingPhone ? `☎ ${esc(o.shippingPhone)}` : ""}</div>`
    : `<div class="address note">${o.personalDataDeletedAt ? `個人情報とSVGは保持期限を過ぎたため ${when(o.personalDataDeletedAt)} に削除済みです。` : "この状態の注文では配送先を表示しません（発送が必要な PAID〜SHIPPED のみ表示）。"}</div>`;
  const notes = d.notifications.length
    ? d.notifications.map((n) => `<li>${esc(NOTIFICATION_LABEL[n.type] ?? n.type)}: ${n.sentAt ? `送信済み ${when(n.sentAt)}` : `<span class="overdue">未送信</span>${n.error ? `（${esc(n.error)}）` : ""}`}（${n.attempts} 回）</li>`).join("")
    : `<li>通知メールの記録はありません。</li>`;
  const canResend = ["PAID", "PROCESSING", "READY", "SHIPPED", "COMPLETED"].includes(o.status) && !o.personalDataDeletedAt && d.notifications.some((n) => !n.sentAt);
  const canNotify = ["PAID", "PROCESSING", "READY", "SHIPPED", "COMPLETED"].includes(o.status) && !o.personalDataDeletedAt && !d.notifications.length;
  return `${shipping}
  <div class="spec" style="margin-top:8px">
    <div><span>Stripe</span>${o.stripePaymentIntentId ? `PaymentIntent ${esc(o.stripePaymentIntentId)}` : "—"}${o.stripeChargeId ? ` · Charge ${esc(o.stripeChargeId)}` : ""}</div>
    <div><span>領収書</span>${o.receiptUrl ? `<a href="${esc(o.receiptUrl)}" target="_blank" rel="noopener">Stripeの領収書を開く</a>` : "未取得"}</div>
  </div>
  <div class="note" style="margin-top:8px"><b>通知メール</b><ul class="checks" style="margin:4px 0">${notes}</ul>${canResend || canNotify ? `<button data-action="notify">${canNotify ? "通知メールを送信" : "未送信の通知メールを再送"}</button>` : ""}</div>
  <div class="note" style="margin-top:8px"><b>履歴</b><ul class="checks" style="margin:4px 0">${d.events.map((e) => `<li class="info">${when(e.at)} ${esc(e.fromStatus ?? "—")} → ${esc(e.toStatus)}${e.note ? ` · ${esc(e.note)}` : ""}</li>`).join("")}</ul></div>`;
}
function render() {
  $("#filters").innerHTML =
    FILTERS.map(([v, label]) => `<button data-filter="${v}" aria-pressed="${filter === v}">${label}</button>`).join("") +
    `<button id="reload" style="margin-left:auto">↻ 更新</button>`;
  $("#count").textContent = `${orders.length} 件 · 特急は赤い帯、発送期限を過ぎたものは赤字。配送先は「詳細を表示」で開きます`;
  const now = Date.now();
  $("#orders").innerHTML = orders.length
    ? orders
        .map((o) => {
          const express = o.deliveryType === "EXPRESS";
          const overdue = o.shipBy && ["PAID", "PROCESSING", "READY"].includes(o.status) && new Date(o.shipBy).getTime() < now;
          const next = (TRANSITIONS[o.status] ?? []).filter((s) => LABELS[s]);
          const d = details.get(o.id);
          return `<article class="order ${express ? "express" : ""}" data-id="${esc(o.id)}">
  <div>
    <div class="id">#${esc(o.id)} <span class="badge status-${esc(o.status)}">${esc(o.status)}</span> <span class="badge ${express ? "express" : ""}">${express ? "特急" : "通常便"}</span>${o.personalDataDeletedAt ? ` <span class="badge">個人情報削除済み</span>` : ""}</div>
    <div class="meta"><span>注文日 <b>${day(o.createdAt)}</b></span><span>決済 <b>${day(o.paidAt)}</b></span><span class="deadline ${overdue ? "overdue" : ""}">発送期限 <b>${day(o.shipBy)}</b>${overdue ? " 超過" : ""}</span></div>
    <div class="spec">
      <div><span>購入者</span>${esc(o.customerName ?? "—")}</div>
      ${o.pieceWidthMm ? `<div><span>切り抜き後</span>${Number(o.pieceWidthMm).toFixed(1)} × ${Number(o.pieceHeightMm).toFixed(1)} mm</div>` : ""}
      <div><span>材料</span>${esc(materialName(o.material))} ${esc(o.thicknessMm)} mm</div>
      <div><span>サイズ</span>${Number(o.widthMm).toFixed(1)} × ${Number(o.heightMm).toFixed(1)} mm</div>
      <div><span>数量</span>${esc(o.quantity)}</div>
      <div><span>カット長 / パス</span>${Math.round(o.cutLengthMm ?? 0).toLocaleString("ja-JP")} mm / ${esc(o.pathCount ?? "—")}</div>
      <div><span>予測加工時間</span>${o.estimatedProcessingMinutes ?? "—"} 分</div>
      <div><span>ファイル</span>${esc(o.originalFileName)}</div>
    </div>
  </div>
  <div class="price">${yen(o.totalPrice)}<div class="note" style="margin:2px 0 0">加工 ${yen(o.processingPrice)} + 送料 ${yen(o.shippingPrice)}</div></div>
  <div class="address">${o.shippingTrackingNumber ? `追跡番号 <b>${esc(o.shippingTrackingNumber)}</b>${o.shippingCarrier ? `（${esc(o.shippingCarrier)}）` : ""} · ` : ""}${o.notes ? `メモ: ${esc(o.notes)}` : ""}</div>
  <div class="detail ${d ? "" : "hidden"}" data-detail>${d ? renderDetail(d) : ""}</div>
  <div class="buttons">
    <button data-action="detail">${d ? "詳細を閉じる" : "詳細を表示（配送先・通知・領収書）"}</button>
    ${o.personalDataDeletedAt ? "" : `<button data-action="view">SVGを表示</button><button data-action="download">SVGをダウンロード</button>`}
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
async function loadDetail(id) {
  details.set(id, await (await api(`/api/admin/orders/${id}`)).json());
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.filter !== undefined) {
    filter = b.dataset.filter;
    return load();
  }
  if (b.id === "reload") return load();
  if (b.id === "purge-dry" || b.id === "purge-run") {
    const dryRun = b.id === "purge-dry";
    if (!dryRun && !confirm("保持期限を過ぎた注文の個人情報とSVGを削除します。元に戻せません。実行しますか？")) return;
    try {
      const r = await (await api("/api/admin/maintenance/purge", { method: "POST", body: JSON.stringify({ dryRun }) })).json();
      $("#purge-result").textContent = `${dryRun ? "対象" : "削除済み"}: ${r.purged.length} 件（${r.retentionDays} 日、${r.before} より前に完了／キャンセル）${r.purged.length ? "\n" + r.purged.join("\n") : ""}`;
      if (!dryRun) await load();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }
  const article = b.closest("article[data-id]");
  if (!article) return;
  const id = article.dataset.id;
  try {
    if (b.dataset.action === "detail") {
      if (details.has(id)) details.delete(id);
      else await loadDetail(id);
      render();
    } else if (b.dataset.action === "notify") {
      await api(`/api/admin/orders/${id}/notify`, { method: "POST", body: "{}" });
      await loadDetail(id);
      render();
    } else if (b.dataset.action === "view") {
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
      if (details.has(id)) await loadDetail(id);
      await load();
    }
  } catch (err) {
    alertMsg(err.message);
  }
});
$("#enter").onclick = () => {
  token = $("#token").value.trim();
  if (!token) return alertMsg("トークンを入力してください。");
  start();
};
$("#token").addEventListener("keydown", (e) => e.key === "Enter" && $("#enter").click());
$("#logout").onclick = logout;
$("#retry").onclick = () => location.reload();
if (!API) alertMsg("注文APIのURL（VITE_ORDER_API_URL）が設定されていないため、注文を表示できません。README の「加工注文（EC）」を参照してください。");
else start();
