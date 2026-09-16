import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
// Admin page build served by the Cloudflare Worker (worker/admin-dist) so
// that it and /api/admin/* sit behind the same Cloudflare Access
// application (issue #8). `npm run build:admin`.
export default defineConfig({
  base: "/",
  publicDir: false,
  build: {
    target: "esnext",
    outDir: fileURLToPath(new URL("./worker/admin-dist", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: { input: { admin: fileURLToPath(new URL("./admin/index.html", import.meta.url)) } },
  },
});
