import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useOnlineStatus } from "../../src";

const setNavigatorOnline = (value: boolean | undefined): void => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value
  });
};

describe("useOnlineStatus", () => {
  beforeEach(() => {
    setNavigatorOnline(true);
  });

  afterEach(() => {
    setNavigatorOnline(true);
  });

  it("reads the current online state", () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isSupported).toBe(true);
    expect(result.current.lastChangedAt).toBeNull();
  });

  it("reacts to offline and online events", async () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(false);
    });

    expect(result.current.lastChangedAt).not.toBeNull();
    expect(result.current.wentOfflineAt).toBe(result.current.lastChangedAt);

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
    });

    expect(result.current.wentOnlineAt).toBe(result.current.lastChangedAt);
  });

  it("disables timestamps when trackTransitions is false", async () => {
    const { result } = renderHook(() =>
      useOnlineStatus({ trackTransitions: false })
    );

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(false);
    });

    expect(result.current.lastChangedAt).toBeNull();
    expect(result.current.wentOfflineAt).toBeNull();
    expect(result.current.wentOnlineAt).toBeNull();
  });

  it("falls back to the provided initialOnline value when navigator support is unavailable", () => {
    setNavigatorOnline(undefined);

    const { result } = renderHook(() =>
      useOnlineStatus({ initialOnline: false })
    );

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isSupported).toBe(false);
  });
});
