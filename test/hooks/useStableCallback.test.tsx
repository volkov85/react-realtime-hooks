import { renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useStableCallback } from "../../src/hooks/useStableCallback";

const StrictModeWrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>{children}</StrictMode>
);

describe("useStableCallback", () => {
  it("returns a wrapper with stable identity across re-renders", () => {
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => number }) => useStableCallback(cb),
      { initialProps: { cb: () => 1 } }
    );

    const initial = result.current;

    rerender({ cb: () => 2 });
    rerender({ cb: () => 3 });
    rerender({ cb: () => 4 });

    expect(result.current).toBe(initial);
  });

  it("invokes the latest callback after a re-render", () => {
    const first = vi.fn().mockReturnValue("first");
    const second = vi.fn().mockReturnValue("second");

    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => string }) => useStableCallback(cb),
      { initialProps: { cb: first } }
    );

    expect(result.current()).toBe("first");

    rerender({ cb: second });

    expect(result.current()).toBe("second");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("forwards arguments and return values verbatim", () => {
    const cb = vi.fn((a: number, b: string) => ({ a, b }));

    const { result } = renderHook(() => useStableCallback(cb));

    expect(result.current(7, "hi")).toEqual({ a: 7, b: "hi" });
    expect(cb).toHaveBeenCalledWith(7, "hi");
  });

  it("does not invoke the callback during render", () => {
    const cb = vi.fn();

    renderHook(() => useStableCallback(cb));

    expect(cb).not.toHaveBeenCalled();
  });

  it("never mutates the ref during render under StrictMode", () => {
    // Under StrictMode + concurrent rendering, the previous implementation
    // (`callbackRef.current = callback` during render) could leave the ref
    // pointing at a discarded-render's closure. With useInsertionEffect, the
    // ref is only updated for renders that actually commit, so the wrapper
    // identity stays stable and the latest committed callback is invoked.
    // The global vitest setup already enables `reactStrictMode: true`,
    // but this test passes `wrapper: StrictModeWrapper` explicitly so it
    // remains self-documenting and resilient to future config changes.
    const first = vi.fn().mockReturnValue("first");
    const second = vi.fn().mockReturnValue("second");

    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => string }) => useStableCallback(cb),
      {
        initialProps: { cb: first },
        wrapper: StrictModeWrapper
      }
    );

    const stableInitial = result.current;
    expect(result.current()).toBe("first");

    rerender({ cb: second });

    expect(result.current).toBe(stableInitial);
    expect(result.current()).toBe("second");
  });
});
