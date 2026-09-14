import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const page = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  base: "/TypeFab/",
  build: {
    target: "esnext",
    rollupOptions: {
      // Multi-page: "/" is the editor, "/landing/" the landing page (Phase 1
      // of issue #2). Phase 2 swaps them to "/" (landing) and "/app/" (editor).
      input: { editor: page("index.html"), landing: page("landing/index.html") },
    },
  },
  optimizeDeps: { exclude: ["harfbuzzjs"] },
});
