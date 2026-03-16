import { describe, expect, it } from "vitest";

import {
  getRuntimeFeatureSupport,
  hasNavigatorOnLineSupport,
  isBrowserRuntime,
  readOnlineStatus
} from "../../src/core/env";
import { resolveUrlProvider } from "../../src/core/url";

describe("env helpers", () => {
  it("reports runtime feature support", () => {
    expect(isBrowserRuntime()).toBe(true);
    expect(typeof hasNavigatorOnLineSupport()).toBe("boolean");
    expect(getRuntimeFeatureSupport()).toEqual({
      eventSource: typeof EventSource !== "undefined",
      navigatorOnLine: hasNavigatorOnLineSupport(),
      webSocket: typeof WebSocket !== "undefined"
    });
  });

  it("reads navigator online state with fallback", () => {
    expect(readOnlineStatus()).toEqual({
      isOnline: navigator.onLine,
      isSupported: hasNavigatorOnLineSupport()
    });
  });
});

describe("url helpers", () => {
  it("resolves string, URL, and function providers", () => {
    expect(resolveUrlProvider(" wss://example.com/socket ")).toBe(
      "wss://example.com/socket"
    );
    expect(resolveUrlProvider(new URL("https://example.com/sse"))).toBe(
      "https://example.com/sse"
    );
    expect(resolveUrlProvider(() => "ws://localhost:8080")).toBe(
      "ws://localhost:8080"
    );
  });

  it("returns null for empty or nullish values", () => {
    expect(resolveUrlProvider("   ")).toBeNull();
    expect(resolveUrlProvider(() => null)).toBeNull();
  });
});
