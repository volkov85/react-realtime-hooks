import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePageVisibility } from "../../src";

const setDocumentVisibilityState = (
  value: DocumentVisibilityState | undefined
): void => {
  if (typeof document === "undefined") {
    return;
  }

  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value
  });
};

describe("usePageVisibility", () => {
  beforeEach(() => {
    setDocumentVisibilityState("visible");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setDocumentVisibilityState("visible");
    vi.restoreAllMocks();
  });

  it("reads the current visibility state when the API is available", () => {
    setDocumentVisibilityState("hidden");

    const { result } = renderHook(() =>
      usePageVisibility({ initialVisible: true })
    );

    expect(result.current.isVisible).toBe(false);
    expect(result.current.visibilityState).toBe("hidden");
    expect(result.current.isSupported).toBe(true);
    expect(result.current.lastChangedAt).toBeNull();
  });

  it("falls back to the provided initialVisible value when the API is unavailable", () => {
    setDocumentVisibilityState(undefined);

    const { result } = renderHook(() =>
      usePageVisibility({ initialVisible: false })
    );

    expect(result.current.isVisible).toBe(false);
    expect(result.current.visibilityState).toBe("hidden");
    expect(result.current.isSupported).toBe(false);
  });

  it("reacts to visible and hidden transitions", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);

    const { result } = renderHook(() => usePageVisibility());

    act(() => {
      setDocumentVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.isVisible).toBe(false);
    });

    expect(result.current.visibilityState).toBe("hidden");
    expect(result.current.lastChangedAt).toBe(1_000);
    expect(result.current.becameHiddenAt).toBe(1_000);
    expect(result.current.becameVisibleAt).toBeNull();

    nowSpy.mockReturnValue(2_000);

    act(() => {
      setDocumentVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.isVisible).toBe(true);
    });

    expect(result.current.visibilityState).toBe("visible");
    expect(result.current.lastChangedAt).toBe(2_000);
    expect(result.current.becameHiddenAt).toBe(1_000);
    expect(result.current.becameVisibleAt).toBe(2_000);
  });

  it("disables timestamps when trackTransitions is false", async () => {
    const { result } = renderHook(() =>
      usePageVisibility({ trackTransitions: false })
    );

    act(() => {
      setDocumentVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.isVisible).toBe(false);
    });

    expect(result.current.lastChangedAt).toBeNull();
    expect(result.current.becameHiddenAt).toBeNull();
    expect(result.current.becameVisibleAt).toBeNull();
  });

  it("cleans up visibilitychange listeners on unmount", () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => usePageVisibility());

    const addCalls = addEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === "visibilitychange"
    );

    expect(addCalls).toHaveLength(1);

    const handler = addCalls[0]?.[1];

    unmount();

    const removedHandler = removeEventListenerSpy.mock.calls.some(
      ([eventName, candidate]) =>
        eventName === "visibilitychange" && candidate === handler
    );

    expect(removedHandler).toBe(true);
  });

  it("supports server rendering without touching document", () => {
    const VisibilityIndicator = (): ReturnType<typeof createElement> => {
      const visibility = usePageVisibility({ initialVisible: false });
      return createElement(
        "span",
        null,
        visibility.isVisible ? "visible" : "hidden"
      );
    };

    vi.stubGlobal("document", undefined);
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);

    try {
      const render = (): string => renderToString(createElement(VisibilityIndicator));

      expect(render).not.toThrow();
      expect(render()).toContain("hidden");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
