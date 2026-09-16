// Cloudflare Worker entry: wires bindings and secrets into the app, serves
// the admin page from the static assets binding, and runs the retention
// purge on the Cron Trigger.
import { createApp } from "./app.js";
import { d1Store } from "./store.js";

export function configFromEnv(env) {
  const list = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
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
    // Mail (issue #9): Resend.
    mailApiKey: env.MAIL_API_KEY || undefined,
    mailApiBase: env.MAIL_API_BASE || undefined,
    mailFrom: env.MAIL_FROM || undefined,
    mailReplyTo: env.MAIL_REPLY_TO || undefined,
    adminNotificationEmail: env.ADMIN_NOTIFICATION_EMAIL || undefined,
  };
}
function build(env) {
  const config = configFromEnv(env);
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
        .then((r) => console.log(`retention purge: ${r.purged.length}/${r.candidates} orders before ${r.before}`)),
    );
  },
};
