import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// The organ library's playground, using the kit's own modules: from demo/, `npx vite --config vite.organs.config.js`.
export default defineConfig({
  root: path.resolve(here, "../organs-playground"),
  cacheDir: path.resolve(here, "../node_modules/.vite-organs"),
  plugins: [react()],
  publicDir: path.resolve(here, "../assets"),
  server: { fs: { allow: [path.resolve(here, "..")] } },
  // NiiVue is installed in the playground, not at the kit's root, until the root package.json takes it as a peer dependency. src/scan
  // sits outside the playground, so it needs telling where to look. Listed for pre-bundling so that opening the scan page does not
  // force a reload of every other open playground tab.
  resolve: { alias: { "@niivue/niivue": path.resolve(here, "../organs-playground/node_modules/@niivue/niivue/build/niivue/index.js") } },
  optimizeDeps: { include: ["@niivue/niivue"] },
});
