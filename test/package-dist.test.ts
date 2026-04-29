import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Verify that the published artifact (`dist/`) actually contains every
// public symbol the source and README promise. This is a regression
// guard against tsup config drift, broken exports, or stale builds:
// `npm pack` and `npm publish` both run through the `prepack` script,
// so a fresh `dist/` is built first and *this* test then asserts the
// shape of that build. Excluded from the default vitest run because it
// requires `npm run build` to have run first; CI invokes it via
// `npm run test:dist` after the build step.

const distDir = resolve(__dirname, "..", "dist");

const requireDist = (relative: string): string => {
  const path = resolve(distDir, relative);
  if (!existsSync(path)) {
    throw new Error(
      `Expected ${path} to exist. Run \`npm run build\` before \`npm run test:dist\`.`
    );
  }
  return readFileSync(path, "utf8");
};

const REQUIRED_FILES = [
  "index.js",
  "index.cjs",
  "index.d.ts",
  "index.d.cts"
] as const;

const PUBLIC_HOOKS = [
  "useWebSocket",
  "useEventSource",
  "useReconnect",
  "useHeartbeat",
  "useOnlineStatus",
  "usePageVisibility",
  "useConnectionGate"
] as const;

const PUBLIC_TYPES = [
  "UseWebSocketOptions",
  "UseWebSocketResult",
  "UseEventSourceOptions",
  "UseEventSourceResult",
  "BufferedAmountPolling",
  "RealtimeConnectionStatus",
  "ConnectionStateSnapshot",
  "UseReconnectOptions",
  "UseHeartbeatOptions",
  "UseOnlineStatusResult",
  "UsePageVisibilityResult",
  "UseConnectionGateOptions"
] as const;

describe("package dist contract", () => {
  it("emits every required artifact file", () => {
    for (const file of REQUIRED_FILES) {
      expect(existsSync(resolve(distDir, file)), `dist/${file}`).toBe(true);
    }
  });

  it.each(PUBLIC_HOOKS)("exports the %s hook from dist/index.js", (hook) => {
    const js = requireDist("index.js");
    expect(js).toContain(hook);
  });

  it.each(PUBLIC_HOOKS)("declares the %s hook in dist/index.d.ts", (hook) => {
    const dts = requireDist("index.d.ts");
    expect(dts).toContain(hook);
  });

  it.each(PUBLIC_TYPES)("declares the %s type in dist/index.d.ts", (type) => {
    const dts = requireDist("index.d.ts");
    expect(dts).toContain(type);
  });

  it("imports cleanly via dynamic ESM import", async () => {
    const mod = (await import(
      /* @vite-ignore */ resolve(distDir, "index.js")
    )) as Record<string, unknown>;
    for (const hook of PUBLIC_HOOKS) {
      expect(typeof mod[hook]).toBe("function");
    }
  });
});
