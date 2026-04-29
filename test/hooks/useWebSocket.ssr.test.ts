import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWebSocket } from "../../src";

// In SSR, the browser's `WebSocket` constructor is unavailable. The hook
// must commit a coherent initial snapshot — `status: "closed"` together
// with `isSupported: false` — instead of claiming `connecting:false`,
// which would be a logically impossible combination and trigger a
// hydration-time visual jump on the client.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useWebSocket SSR", () => {
  it("renders status='closed' when WebSocket is undefined", () => {
    vi.stubGlobal("WebSocket", undefined);

    const Probe = (): string => {
      const ws = useWebSocket<unknown, unknown>({ url: "ws://example/" });
      return `${ws.status}:${String(ws.isSupported)}`;
    };

    const html = renderToString(createElement(Probe));

    expect(html).toBe("closed:false");
  });

  it("renders status='closed' when the URL provider returns null", () => {
    const Probe = (): string => {
      const ws = useWebSocket<unknown, unknown>({ url: () => null });
      return `${ws.status}:${String(ws.isSupported)}`;
    };

    const html = renderToString(createElement(Probe));

    expect(html).toBe("closed:true");
  });

  it("renders status='connecting' on SSR only when transport and URL are both ready", () => {
    const Probe = (): string => {
      const ws = useWebSocket<unknown, unknown>({ url: "ws://example/" });
      return `${ws.status}:${String(ws.isSupported)}`;
    };

    const html = renderToString(createElement(Probe));

    expect(html).toBe("connecting:true");
  });

  it("renders status='idle' when connect=false even on SSR", () => {
    const Probe = (): string => {
      const ws = useWebSocket<unknown, unknown>({
        connect: false,
        url: "ws://example/"
      });
      return `${ws.status}:${String(ws.isSupported)}`;
    };

    const html = renderToString(createElement(Probe));

    expect(html).toBe("idle:true");
  });
});
