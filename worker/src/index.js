// Cloudflare Worker entry: wires bindings and secrets into the app, serves
// the admin page from the static assets binding, and runs the retention
// purge on the Cron Trigger.
//
// Two environments (issue #11), told apart by APP_ENV:
//   development  wrangler dev + worker/.dev.vars: local D1/R2, Stripe test
//                keys, MAIL_MODE=console, admin login with ADMIN_TOKEN.
//   production   wrangler.toml [vars] + `wrangler secret`: Cloudflare D1/R2,
//                Stripe live keys, Resend, admin login via Cloudflare Access
//                only (ADMIN_TOKEN is ignored).
import { createApp } from "./app.js";
import { d1Store } from "./store.js";

export function configFromEnv(env) {
  const list = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
    appEnv: String(env.APP_ENV || "production").trim().toLowerCase(),
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripeApiBase: env.STRIPE_API_BASE || undefined,
    adminToken: env.ADMIN_TOKEN,
    // Cloudflare Access (issue #8): when both are set, /api/admin/* accepts
    // only a valid Cf-Access-Jwt-Assertion and ADMIN_TOKEN is ignored.
    accessTeamDomain: env.ACCESS_TEAM_DOMAIN || undefined,
    accessAud: env.ACCESS_AUD || undefined,
    siteUrl: env.SITE_URL || "https://fooping-tech.github.io/TypeFab/",
    adminUrl: env.ADMIN_URL || undefined,
    contactUrl: env.CONTACT_URL || "https://github.com/fooping-tech/TypeFab/issues/new?title=%E5%A4%A7%E9%87%8F%E6%B3%A8%E6%96%87%E3%81%AE%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B",
    allowedOrigins: list(env.ALLOWED_ORIGINS || "https://fooping-tech.github.io,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173"),
    adminAllowedOrigins: list(env.ADMIN_ALLOWED_ORIGINS || ""),
    bulkThreshold: Number(env.BULK_THRESHOLD) || undefined,
    normalLeadTimeDays: Number(env.NORMAL_LEAD_TIME_DAYS) || undefined,
    expressLeadTimeDays: Number(env.EXPRESS_LEAD_TIME_DAYS) || undefined,
    personalDataRetentionDays: Number(env.PERSONAL_DATA_RETENTION_DAYS) || undefined,
    // Mail (issue #9): Resend. MAIL_MODE=console (issue #11) logs the mail
    // instead of sending it; only allowed in development.
    mailMode: String(env.MAIL_MODE || "resend").trim().toLowerCase(),
    mailApiKey: env.MAIL_API_KEY || undefined,
    mailApiBase: env.MAIL_API_BASE || undefined,
    mailFrom: env.MAIL_FROM || undefined,
    mailReplyTo: env.MAIL_REPLY_TO || undefined,
    adminNotificationEmail: env.ADMIN_NOTIFICATION_EMAIL || undefined,
  };
}

const LIVE_KEY = /^(sk|rk)_live_/;
// Configuration mistakes that must stop the Worker rather than run with a
// half-safe setup. Returns a list of messages (empty when everything is fine).
export function validateConfig(config) {
  const errors = [];
  if (!["development", "production"].includes(config.appEnv)) errors.push(`APP_ENV must be "development" or "production" (got "${config.appEnv}").`);
  if (!["resend", "console"].includes(config.mailMode)) errors.push(`MAIL_MODE must be "resend" or "console" (got "${config.mailMode}").`);
  if (config.appEnv === "development") {
    if (LIVE_KEY.test(config.stripeSecretKey ?? "")) errors.push("STRIPE_SECRET_KEY is a live key (sk_live_/rk_live_). Local development must use a Stripe test key (sk_test_…).");
  } else {
    if (config.mailMode === "console") errors.push("MAIL_MODE=console is only allowed in development (it prints customer e-mail addresses to the log).");
    if (config.stripeApiBase) errors.push("STRIPE_API_BASE (mock Stripe) is only allowed in development.");
    if (config.mailApiBase) errors.push("MAIL_API_BASE (mock mail API) is only allowed in development.");
  }
  return errors;
}
// Non-fatal notes printed once per isolate.
export function configWarnings(config) {
  const warnings = [];
  if (config.appEnv === "production" && config.adminToken) warnings.push("ADMIN_TOKEN is set but ignored in production; delete it with `wrangler secret delete ADMIN_TOKEN`.");
  if (config.appEnv === "production" && !(config.accessTeamDomain && config.accessAud)) warnings.push("Cloudflare Access (ACCESS_TEAM_DOMAIN / ACCESS_AUD) is not configured: /api/admin/* answers 503 until it is.");
  if (config.appEnv === "development") {
    if (config.stripeSecretKey && !/^(sk|rk)_test_/.test(config.stripeSecretKey) && !LIVE_KEY.test(config.stripeSecretKey)) warnings.push("STRIPE_SECRET_KEY does not look like a Stripe test key (sk_test_…).");
    if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//.test(String(config.siteUrl ?? ""))) warnings.push(`SITE_URL "${config.siteUrl}" is not a local address; Checkout will return customers to that site.`);
  }
  return warnings;
}

let reported = false;
function build(env) {
  const config = configFromEnv(env);
  const errors = validateConfig(config);
  if (!reported) {
    reported = true;
    for (const w of configWarnings(config)) console.warn(`typefab config: ${w}`);
    for (const e of errors) console.error(`typefab config error: ${e}`);
  }
  if (errors.length) {
    // Refuse to serve anything: a misconfigured Worker must not take orders.
    const refuse = () => new Response(JSON.stringify({ error: "Worker の設定に誤りがあります。", details: errors }), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
    refuse.purgeExpiredData = async () => {
      throw Error(errors.join(" "));
    };
    return refuse;
  }
  return createApp({ store: d1Store(env.DB), bucket: env.SVG_BUCKET, config });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return build(env)(request);
    // Everything else is the admin page (worker/admin-dist, built by
    // `npm run build:admin`); "/" redirects there.
    if (url.pathname === "/") return Response.redirect(`${url.origin}/admin/`, 302);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      build(env)
        .purgeExpiredData()
        .then((r) => console.log(`retention purge: ${r.purged.length}/${r.candidates} orders before ${r.before}`))
        .catch((e) => console.error(`retention purge skipped: ${e.message}`)),
    );
  },
};
