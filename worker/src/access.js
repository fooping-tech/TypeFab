// Cloudflare Access: verifies the JWT that Access adds to requests reaching
// a protected application (header Cf-Access-Jwt-Assertion). Keys come from
// https://<team>.cloudflareaccess.com/cdn-cgi/access/certs and are cached
// for a while; a signature that fails with the cached keys triggers one
// refresh (key rotation).
const b64url = (s) => {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const decodeJson = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));

export function createAccessVerifier({ teamDomain, aud, fetch: fetchImpl = globalThis.fetch, now = () => Date.now(), cacheMs = 60 * 60 * 1000 }) {
  const issuer = `https://${teamDomain}`;
  let cache = { keys: null, at: 0 };
  async function keys(force = false) {
    if (!force && cache.keys && now() - cache.at < cacheMs) return cache.keys;
    const res = await fetchImpl(`${issuer}/cdn-cgi/access/certs`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw Error(`Access certs ${res.status}`);
    const body = await res.json();
    const list = (body.keys ?? []).filter((k) => k.kty === "RSA" && (!k.alg || k.alg === "RS256"));
    cache = { keys: list, at: now() };
    return list;
  }
  async function verifyWith(jwk, data, sig) {
    const key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data);
  }
  // Returns { email, sub, exp } for a valid token, null otherwise.
  return async function verify(token) {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let header, claims;
    try {
      header = decodeJson(parts[0]);
      claims = decodeJson(parts[1]);
    } catch {
      return null;
    }
    if (header.alg !== "RS256" || !header.kid) return null;
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig = b64url(parts[2]);
    let ok = false;
    for (const force of [false, true]) {
      const jwk = (await keys(force)).find((k) => k.kid === header.kid);
      if (jwk) {
        try {
          ok = await verifyWith(jwk, data, sig);
        } catch {
          ok = false;
        }
      }
      if (ok) break;
    }
    if (!ok) return null;
    const t = Math.floor(now() / 1000);
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!auds.includes(aud)) return null;
    if (claims.iss !== issuer) return null;
    if (!(Number(claims.exp) > t)) return null;
    if (claims.nbf !== undefined && Number(claims.nbf) > t + 60) return null;
    return { email: claims.email ?? null, sub: claims.sub ?? null, exp: Number(claims.exp) };
  };
}

// Test helper: builds an RS256 JWT with a freshly generated key and returns
// the JWKS document Access would serve for it.
export async function makeAccessTestKit({ teamDomain, aud, kid = "test-key" }) {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const enc = (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const certs = { keys: [{ kid, kty: "RSA", alg: "RS256", use: "sig", n: pub.n, e: pub.e }], public_cert: null, public_certs: [] };
  async function sign(claims, { kidOverride = kid } = {}) {
    const head = enc({ alg: "RS256", kid: kidOverride, typ: "JWT" });
    const body = enc({ aud: [aud], iss: `https://${teamDomain}`, type: "app", ...claims });
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${head}.${body}`));
    const s = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${head}.${body}.${s}`;
  }
  return { certs, sign };
}
