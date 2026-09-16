// Transactional e-mail for the order flow (issue #9). Provider: Resend
// (HTTPS JSON API, key kept as a Worker secret). Templates are plain text
// and never include the shipping address or phone number.
import { CATALOG } from "../../src/pricing.js";

const yen = (n) => `¥${Number(n).toLocaleString("ja-JP")}`;
const jpDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => p.find((x) => x.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const jpDateTime = (iso) => (iso ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—");
const materialName = (id) => CATALOG.materials.find((m) => m.id === id)?.name ?? id;
const deliveryLabel = (t) => (t === "EXPRESS" ? "特急" : "通常");

// "（切り抜き後 50.0 × 140.0 mm）" when the finished piece differs from the SVG.
const pieceNote = (o) =>
  o.pieceWidthMm > 0 && o.pieceHeightMm > 0 && (Math.abs(o.pieceWidthMm - o.widthMm) > 0.05 || Math.abs(o.pieceHeightMm - o.heightMm) > 0.05)
    ? `（切り抜き後 ${Number(o.pieceWidthMm).toFixed(1)} × ${Number(o.pieceHeightMm).toFixed(1)} mm）`
    : "";
export function orderSummaryLines(order) {
  return [
    `材料: ${materialName(order.material)} ${order.thicknessMm} mm`,
    `サイズ: ${Number(order.widthMm).toFixed(1)} × ${Number(order.heightMm).toFixed(1)} mm${pieceNote(order)}`,
    `数量: ${order.quantity}`,
    `納期: ${deliveryLabel(order.deliveryType)}`,
    `ファイル: ${order.originalFileName ?? "design.svg"}`,
  ];
}

// Customer: order accepted. `orderUrl` includes the access token; the page
// it opens never shows the address or e-mail.
export function customerPaidMail(order, { orderUrl, contactUrl }) {
  const subject = `【TypeFab】ご注文を承りました（${order.id}）`;
  const text = [
    "TypeFabをご利用いただきありがとうございます。",
    "お支払いを確認し、ご注文を承りました。",
    "",
    `注文番号: ${order.id}`,
    `決済日時: ${jpDateTime(order.paidAt)}`,
    "",
    "▼ ご注文内容",
    ...orderSummaryLines(order),
    "",
    `加工料金: ${yen(order.processingPrice)}`,
    `送料: ${yen(order.shippingPrice)}`,
    `合計（お支払い済み）: ${yen(order.totalPrice)}`,
    "",
    `発送予定: ${jpDate(order.shipBy)} まで`,
    "",
    "▼ 注文状況の確認・領収書",
    orderUrl,
    "上のページから注文の状況と領収書（Stripe）を確認できます。このURLは注文の確認用です。第三者に共有しないでください。",
    "領収書はStripeからも別途メールでお送りします。",
    "",
    "▼ お問い合わせ",
    contactUrl,
    "注文番号を添えてご連絡ください。",
    "",
    "このメールは自動送信です。",
    "TypeFab https://fooping-tech.github.io/TypeFab/",
  ].join("\n");
  return { subject, text };
}

// Admin: new paid order. No address or phone number — those are in the
// Access-protected admin page.
export function adminPaidMail(order, { adminUrl }) {
  const express = order.deliveryType === "EXPRESS";
  const subject = `${express ? "【特急】" : ""}新規注文 ${order.id} ${yen(order.totalPrice)}${express ? " ※特急" : ""}`;
  const text = [
    express ? "＝＝＝ 特急注文です。発送期限に注意してください ＝＝＝" : "新しい注文が入りました。",
    "",
    `注文番号: ${order.id}`,
    `購入者: ${order.customerName ?? ""}`,
    `金額: ${yen(order.totalPrice)}（加工 ${yen(order.processingPrice)} + 送料 ${yen(order.shippingPrice)}）`,
    `決済日時: ${jpDateTime(order.paidAt)}`,
    `発送期限: ${jpDate(order.shipBy)}${express ? "（特急）" : ""}`,
    "",
    ...orderSummaryLines(order),
    `カット長: ${Math.round(order.cutLengthMm ?? 0)} mm / パス ${order.pathCount ?? "—"}`,
    "",
    "配送先・SVGは管理画面で確認してください:",
    adminUrl,
  ].join("\n");
  return { subject, text };
}

// MAIL_MODE=console (development, issue #11): the text printed to the
// Worker log instead of calling Resend.
export function consoleMailText({ type, orderId, from, to, subject, text }) {
  const rule = "=".repeat(60);
  return [rule, `[mail:console] ${type} for order ${orderId}`, `From: ${from}`, `To: ${to}`, `Subject: ${subject}`, "", text, rule].join("\n");
}

// Sends one message through Resend. Resolves with { id }; throws on failure.
export async function sendMail({ apiKey, apiBase = "https://api.resend.com", from, replyTo }, { to, subject, text }, fetchImpl = fetch) {
  if (!apiKey || !from) throw Error("mail not configured");
  const res = await fetchImpl(`${apiBase}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(15000) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id) throw Error(body.message || body.error?.message || `mail provider error ${res.status}`);
  return { id: body.id };
}
