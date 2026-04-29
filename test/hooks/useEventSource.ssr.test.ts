import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEventSource } from "../../src";

// Mirror of useWebSocket.ssr.test.ts. Same contract: when no transport
// global is present (SSR), the hook must commit `status: "closed"` so
// the rendered HTML and the snapshot's `isSupported`/`isConnecting`
// flags stay consistent.
//
// jsdom does not implement `EventSource`, so for the "supported" cases
// we stub a minimal constructor — the hook only checks
// `typeof EventSource !== "undefined"` for SSR-time decisions.

class MockEventSource {
  // Constructor body is never invoked during SSR; the hook only checks
  // `typeof EventSource !== "undefined"`. Args omitted to keep ESLint
  // (no-unused-vars) happy.
  constructor() {
    /* no-op */
  }
}

beforeEach(() => {
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useEventSource SSR", () => {
  it("renders status='closed' when EventSource is undefined", () => {
    vi.stubGlobal("EventSource", undefined);

    const Probe = (): string => {
      const es = useEventSource<unknown>({ url: "https://example/" });
      return `${es.status}:${String(es.isSupported)}`;
    };

    const html = renderToString(createElement(Probe));

    expect(html).toBe("closed:false");
  });

  it("renders status='closed' when the URL provider returns null", () => {
    const Probe = (): string => {
      const es = useEventSource<unknown>({ url: () => null });
      return `${es.status}:${String(es.isSupported)}`;
    };

    const html = renderToString(createElement(Probe));

    expect(html).toBe("closed:true");
  });

  it("renders status='connecting' on SSR only when transport and URL are both ready", () => {
    const Probe = (): string => {
      const es = useEventSource<unknown>({ url: "https://example/" });
      return `${es.status}:${String(es.isSupported)}`;
    };

    const html = renderToString(createElement(Probe));

    expect(html).toBe("connecting:true");
  });

  it("renders status='idle' when connect=false even on SSR", () => {
    const Probe = (): string => {
      const es = useEventSource<unknown>({
        connect: false,
        url: "https://example/"
      });
      return `${es.status}:${String(es.isSupported)}`;
    };

    const html = renderToString(createElement(Probe));

    expect(html).toBe("idle:true");
  });
});
