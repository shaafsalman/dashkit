import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// base is set for GitHub Pages: served at https://<user>.github.io/<repo>/
export default defineConfig({
  base: "/dashkit/",
  plugins: [react()],
  resolve: {
    alias: {
      dashkit: path.resolve(__dirname, "../src/index.js"),
    },
  },
});
