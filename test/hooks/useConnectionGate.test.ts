import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConnectionGate } from "../../src";

const setNavigatorOnline = (value: boolean | undefined): void => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value
  });
};

const setDocumentVisibilityState = (
  value: DocumentVisibilityState | undefined
): void => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value
  });
};

describe("useConnectionGate", () => {
  beforeEach(() => {
    vi.useRealTimers();
    setNavigatorOnline(true);
    setDocumentVisibilityState("visible");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setNavigatorOnline(true);
    setDocumentVisibilityState("visible");
  });

  it("returns a ready connect flag by default", () => {
    const { result } = renderHook(() => useConnectionGate());

    expect(result.current.connect).toBe(true);
    expect(result.current.isBlocked).toBe(false);
    expect(result.current.reason).toBe("ready");
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isVisible).toBe(true);
  });

  it("blocks when the browser goes offline", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const { result } = renderHook(() =>
      useConnectionGate({
        trackTransitions: true
      })
    );

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => {
      expect(result.current.connect).toBe(false);
    });

    expect(result.current.reason).toBe("offline");
    expect(result.current.lastChangedAt).toBe(1_000);
    expect(result.current.becameBlockedAt).toBe(1_000);
    expect(result.current.becameReadyAt).toBeNull();

    nowSpy.mockReturnValue(2_000);

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(result.current.connect).toBe(true);
    });

    expect(result.current.reason).toBe("ready");
    expect(result.current.lastChangedAt).toBe(2_000);
    expect(result.current.becameReadyAt).toBe(2_000);
  });

  it("blocks hidden tabs when requireVisible is enabled", async () => {
    const { result } = renderHook(() =>
      useConnectionGate({
        requireVisible: true
      })
    );

    act(() => {
      setDocumentVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.connect).toBe(false);
    });

    expect(result.current.reason).toBe("hidden");
    expect(result.current.isVisible).toBe(false);
  });

  it("waits for the hidden grace period before blocking visibility", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useConnectionGate({
        hiddenGraceMs: 500,
        requireVisible: true
      })
    );

    act(() => {
      setDocumentVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.connect).toBe(true);
    expect(result.current.reason).toBe("ready");
    expect(result.current.isWaitingForVisibleGrace).toBe(true);

    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(result.current.connect).toBe(true);
    expect(result.current.isWaitingForVisibleGrace).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.connect).toBe(false);
    expect(result.current.reason).toBe("hidden");
    expect(result.current.isWaitingForVisibleGrace).toBe(false);
  });

  it("prefers manual disable over environment checks", () => {
    const { result } = renderHook(() =>
      useConnectionGate({
        enabled: false,
        requireVisible: true
      })
    );

    expect(result.current.connect).toBe(false);
    expect(result.current.reason).toBe("manual");
  });

  it("clears transition timestamps when tracking is disabled", async () => {
    const { result } = renderHook(() =>
      useConnectionGate({
        trackTransitions: false
      })
    );

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => {
      expect(result.current.connect).toBe(false);
    });

    expect(result.current.lastChangedAt).toBeNull();
    expect(result.current.becameBlockedAt).toBeNull();
    expect(result.current.becameReadyAt).toBeNull();
  });

  it("supports server rendering without touching browser globals", () => {
    const ConnectionGateIndicator = (): ReturnType<typeof createElement> => {
      const gate = useConnectionGate({
        initialOnline: false,
        initialVisible: false,
        requireVisible: true
      });

      return createElement("span", null, gate.connect ? "connect" : gate.reason);
    };

    vi.stubGlobal("document", undefined);
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);

    try {
      const render = (): string => renderToString(createElement(ConnectionGateIndicator));

      expect(render).not.toThrow();
      expect(render()).toContain("offline");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
