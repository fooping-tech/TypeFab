#!/usr/bin/env node
// `npm run dev` (issue #11): starts the Vite dev server (landing page,
// editor, order and admin pages) and the order API Worker (`wrangler dev`
// with local D1 and R2) together, with prefixed output. Nothing here talks
// to Cloudflare: the Worker reads worker/.dev.vars and keeps its state in
// worker/.wrangler/state.
//
//   npm run dev            both
//   npm run dev:web        Vite only
//   npm run dev:worker     Worker only
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = path.join(root, "worker");
const devVars = path.join(workerDir, ".dev.vars");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const color = (n, s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
const say = (msg) => console.log(color(36, "[dev]"), msg);

// Reads KEY=value lines of a .dev.vars file (no interpolation, like wrangler).
function readDevVars(file) {
  const vars = {};
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    vars[line.slice(0, i).trim()] = v;
  }
  return vars;
}

// Decides whether the Worker can be started; returns a reason when not.
function workerBlocker() {
  if (!existsSync(path.join(workerDir, "node_modules", ".bin", "wrangler"))) return "worker/node_modules がありません。`cd worker && npm ci` を実行してください。";
  if (!existsSync(devVars)) return "worker/.dev.vars がありません。`cp worker/.dev.vars.example worker/.dev.vars` を実行し、Stripe のテストキーを入れてください。";
  const vars = readDevVars(devVars);
  if (/^(sk|rk)_live_/.test(vars.STRIPE_SECRET_KEY ?? "")) {
    console.error(color(31, "[dev] worker/.dev.vars の STRIPE_SECRET_KEY が本番キー（sk_live_）です。ローカル開発では Stripe のテストキー（sk_test_…）だけを使ってください。"));
    process.exit(1);
  }
  if ((vars.APP_ENV ?? "development") !== "development") {
    console.error(color(31, `[dev] worker/.dev.vars の APP_ENV は development にしてください（現在: ${vars.APP_ENV}）。`));
    process.exit(1);
  }
  return null;
}

const children = [];
function run(name, args, cwd, colorCode) {
  const child = spawn(npm, args, { cwd, env: { ...process.env, FORCE_COLOR: process.stdout.isTTY ? "1" : "0" }, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = color(colorCode, `[${name}]`);
  const pipe = (stream, out) => {
    let rest = "";
    stream.on("data", (chunk) => {
      rest += chunk.toString();
      const lines = rest.split(/\r?\n/);
      rest = lines.pop();
      for (const l of lines) out.write(`${prefix} ${l}\n`);
    });
    stream.on("end", () => rest && out.write(`${prefix} ${rest}\n`));
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    say(`${name} が終了しました（${signal ?? `code ${code}`}）。もう一方も止めます。`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}
let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500).unref();
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const blocker = workerBlocker();
say("Vite: http://127.0.0.1:5173/TypeFab/ （紹介ページ） · /TypeFab/app/ （エディタ） · /TypeFab/order/ · /TypeFab/admin/");
run("web", ["run", "dev:web"], root, 32);
if (blocker) {
  console.warn(color(33, `[dev] Worker（注文API）は起動しません: ${blocker}`));
  console.warn(color(33, "[dev] エディタは使えます。注文ページは概算のみになります。初回セットアップは README の「ローカル開発」を参照してください。"));
} else {
  say("Worker: http://127.0.0.1:8787/api/health · 管理画面 http://127.0.0.1:8787/admin/ （D1・R2 はローカル、Stripe はテストモード）");
  run("worker", ["run", "dev"], workerDir, 35);
}
