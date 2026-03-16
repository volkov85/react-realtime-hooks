import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  resolve: {
    alias: {
      "react-realtime-hooks": resolve(__dirname, "../src/index.ts")
    }
  },
  server: {
    open: true,
    port: 4173
  }
});
