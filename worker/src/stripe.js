// Stripe without the SDK: Checkout Sessions via the REST API (form encoded)
// and webhook signature verification with Web Crypto (HMAC-SHA256).
const enc = new TextEncoder();
const hex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}
const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
// Flattens { a: { b: [x] } } into Stripe's a[b][0]=x form encoding.
export function formEncode(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}
export async function createCheckoutSession(
  { secretKey, apiBase = "https://api.stripe.com" },
  params,
  fetchImpl = fetch,
) {
  const res = await fetchImpl(`${apiBase}/v1/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": params.client_reference_id,
    },
    body: formEncode(params).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url)
    throw Error(body.error?.message || `Stripe error ${res.status}`);
  return body;
}
// Builds a Stripe-Signature header for a payload (tests and local mocks).
export async function signStripePayload(payload, secret, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${await hmac(secret, `${t}.${payload}`)}`;
}
// Verifies the Stripe-Signature header against the raw request body.
export async function verifyStripeSignature(
  payload,
  header,
  secret,
  { now = Math.floor(Date.now() / 1000), tolerance = 300 } = {},
) {
  if (!header || !secret) return false;
  const parts = Object.create(null);
  for (const p of header.split(",")) {
    const [k, v] = p.split("=").map((s) => s.trim());
    if (!k || !v) continue;
    (parts[k] ??= []).push(v);
  }
  const t = Number(parts.t?.[0]);
  if (!Number.isFinite(t) || !parts.v1?.length) return false;
  if (Math.abs(now - t) > tolerance) return false;
  const expected = await hmac(secret, `${t}.${payload}`);
  return parts.v1.some((sig) => timingSafeEqual(sig, expected));
}
export { timingSafeEqual };
