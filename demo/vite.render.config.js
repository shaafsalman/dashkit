// Static build of the headless render page. Relative base so it loads over
// file://, and no dev server means no HMR websocket — which is what stops
// headless Chrome's virtual-time budget from ever settling.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { dashkit: path.resolve(__dirname, "../src/index.js") } },
  build: {
    outDir: "dist-render",
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, "render.html") },
  },
});
