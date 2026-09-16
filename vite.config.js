import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const page = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  base: "/TypeFab/",
  build: {
    target: "esnext",
    rollupOptions: {
      // Multi-page (issue #2 Phase 2): "/" is the landing page, "/app/" the
      // editor, plus the order and privacy pages. The admin page is built
      // separately (vite.admin.config.js) and served by the Worker (#8).
      input: {
        landing: page("index.html"),
        editor: page("app/index.html"),
        order: page("order/index.html"),
        privacy: page("privacy/index.html"),
      },
    },
  },
  optimizeDeps: { exclude: ["harfbuzzjs"] },
  // The Worker's build output and local D1/R2 state (worker/admin-dist,
  // worker/.wrangler) change while `npm run dev` runs; do not reload for them.
  server: { watch: { ignored: ["**/worker/admin-dist/**", "**/worker/.wrangler/**", "**/worker/node_modules/**"] } },
});
