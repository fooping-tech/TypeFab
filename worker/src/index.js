// Cloudflare Worker entry: wires bindings and secrets into the app.
import { createApp } from "./app.js";
import { d1Store } from "./store.js";

export function configFromEnv(env) {
  const list = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripeApiBase: env.STRIPE_API_BASE || undefined,
    adminToken: env.ADMIN_TOKEN,
    siteUrl: env.SITE_URL || "https://fooping-tech.github.io/TypeFab/",
    contactUrl: env.CONTACT_URL || "https://github.com/fooping-tech/TypeFab/issues/new?title=%E5%A4%A7%E9%87%8F%E6%B3%A8%E6%96%87%E3%81%AE%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B",
    allowedOrigins: list(env.ALLOWED_ORIGINS || "https://fooping-tech.github.io,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173"),
    bulkThreshold: Number(env.BULK_THRESHOLD) || undefined,
    normalLeadTimeDays: Number(env.NORMAL_LEAD_TIME_DAYS) || undefined,
    expressLeadTimeDays: Number(env.EXPRESS_LEAD_TIME_DAYS) || undefined,
  };
}
export default {
  async fetch(request, env) {
    const app = createApp({ store: d1Store(env.DB), bucket: env.SVG_BUCKET, config: configFromEnv(env) });
    return app(request);
  },
};
