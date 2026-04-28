import { getConfig, renderHook } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";

describe("Strict Mode test wrapper", () => {
  it("is enabled by default for the hook test suite", () => {
    expect(getConfig().reactStrictMode).toBe(true);
  });

  it("double-invokes hook bodies and effects under the wrapper", () => {
    let renderCount = 0;
    let effectMount = 0;
    let effectCleanup = 0;

    renderHook(() => {
      renderCount += 1;
      // Reads from a ref to keep the hook deterministic across renders.
      const ref = useRef(0);
      ref.current += 1;

      useEffect(() => {
        effectMount += 1;
        return () => {
          effectCleanup += 1;
        };
      }, []);
    });

    // Under <React.StrictMode> in dev, React 18 and 19 both render the
    // component body twice and run effects mount → unmount → mount on
    // the initial render. If this assertion ever drops to renderCount
    // === 1, the global Strict Mode wrapper has stopped applying and
    // the rest of the safety net is silently disabled.
    expect(renderCount).toBeGreaterThanOrEqual(2);
    expect(effectMount).toBeGreaterThanOrEqual(2);
    expect(effectCleanup).toBeGreaterThanOrEqual(1);
  });
});
