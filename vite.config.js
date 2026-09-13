import { defineConfig } from "vite";
export default defineConfig({
  base: "/TypeFab/",
  build: { target: "esnext" },
  optimizeDeps: { exclude: ["harfbuzzjs"] },
});
