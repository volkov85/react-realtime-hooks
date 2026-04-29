import { defineConfig } from "vitest/config";

// Separate config for tests that exercise the built artifact in `dist/`.
// These are excluded from the default config so that `npm test` does not
// require a build to have happened first. CI runs them via
// `npm run test:dist` after the `Build library` step.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/package-dist.test.ts"]
  }
});
