import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["test/package-dist.test.ts", "node_modules/**"],
    setupFiles: ["test/setup.ts"]
  }
});
