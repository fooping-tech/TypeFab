import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const page = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  base: "/TypeFab/",
  build: {
    target: "esnext",
    rollupOptions: {
      // Multi-page (issue #2 Phase 2): "/" is the landing page, "/app/" the
      // editor, plus the order and admin pages.
      input: {
        landing: page("index.html"),
        editor: page("app/index.html"),
        order: page("order/index.html"),
        admin: page("admin/index.html"),
      },
    },
  },
  optimizeDeps: { exclude: ["harfbuzzjs"] },
});
