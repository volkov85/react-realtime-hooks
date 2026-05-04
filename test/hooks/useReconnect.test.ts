import { act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReconnect } from "../../src";
import type { ReconnectAttempt, UseReconnectResult } from "../../src";

describe("useReconnect", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle by default", () => {
    const { result } = renderHook(() => useReconnect());

    expect(result.current.status).toBe("idle");
    expect(result.current.attempt).toBe(0);
    expect(result.current.nextDelayMs).toBeNull();
    expect(result.current.isActive).toBe(false);
    expect(result.current.isScheduled).toBe(false);
  });

  it("starts stopped when disabled", () => {
    const { result } = renderHook(() => useReconnect({ enabled: false }));

    expect(result.current.status).toBe("stopped");
    expect(result.current.isActive).toBe(false);
  });

  it("schedules and runs reconnect attempts", () => {
    vi.useFakeTimers();

    const onSchedule = vi.fn<(attempt: ReconnectAttempt) => void>();
    const { result } = renderHook(() =>
      useReconnect({
        initialDelayMs: 100,
        jitterRatio: 0,
        onSchedule
      })
    );

    act(() => {
      result.current.schedule();
    });

    const scheduledAttempt = onSchedule.mock.calls[0]?.[0];

    expect(result.current.status).toBe("scheduled");
    expect(result.current.attempt).toBe(1);
    expect(result.current.nextDelayMs).toBe(100);
    expect(result.current.isScheduled).toBe(true);
    expect(scheduledAttempt).toMatchObject({
      attempt: 1,
      delayMs: 100,
      trigger: "manual"
    });
    expect(typeof scheduledAttempt?.scheduledAt).toBe("number");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.status).toBe("running");
    expect(result.current.attempt).toBe(1);
    expect(result.current.nextDelayMs).toBeNull();
    expect(result.current.isActive).toBe(true);
  });

  it("applies exponential backoff across attempts", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useReconnect({
        backoffFactor: 2,
        initialDelayMs: 100,
        jitterRatio: 0
      })
    );

    act(() => {
      result.current.schedule();
    });

    expect(result.current.nextDelayMs).toBe(100);

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.schedule("error");
    });

    expect(result.current.attempt).toBe(2);
    expect(result.current.nextDelayMs).toBe(200);
  });

  it("cancels scheduled reconnects", () => {
    vi.useFakeTimers();

    const onCancel = vi.fn<() => void>();
    const { result } = renderHook(() =>
      useReconnect({
        initialDelayMs: 100,
        jitterRatio: 0,
        onCancel
      })
    );

    act(() => {
      result.current.schedule("error");
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.status).toBe("stopped");
    expect(result.current.nextDelayMs).toBeNull();
    expect(result.current.attempt).toBe(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("resets attempts and state", () => {
    vi.useFakeTimers();

    const onReset = vi.fn<() => void>();
    const { result } = renderHook(() =>
      useReconnect({
        initialDelayMs: 100,
        jitterRatio: 0,
        onReset
      })
    );

    act(() => {
      result.current.schedule();
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.attempt).toBe(0);
    expect(result.current.nextDelayMs).toBeNull();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("marks connected and resets by default", () => {
    vi.useFakeTimers();

    const onReset = vi.fn<() => void>();
    const { result } = renderHook(() =>
      useReconnect({
        initialDelayMs: 0,
        jitterRatio: 0,
        onReset
      })
    );

    act(() => {
      result.current.schedule();
      vi.advanceTimersByTime(0);
      result.current.markConnected();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.attempt).toBe(0);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("keeps attempt count when resetOnSuccess is false", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useReconnect({
        initialDelayMs: 0,
        jitterRatio: 0,
        resetOnSuccess: false
      })
    );

    act(() => {
      result.current.schedule();
      vi.advanceTimersByTime(0);
      result.current.markConnected();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.attempt).toBe(1);
    expect(result.current.nextDelayMs).toBeNull();
  });

  it("stops after the default 10 attempts", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useReconnect({
        initialDelayMs: 0,
        jitterRatio: 0
      })
    );

    for (let i = 0; i < 10; i += 1) {
      act(() => {
        result.current.schedule();
        vi.advanceTimersByTime(0);
      });
      expect(result.current.status).toBe("running");
    }

    act(() => {
      result.current.schedule();
    });

    expect(result.current.status).toBe("stopped");
    expect(result.current.attempt).toBe(10);
  });

  it("retries indefinitely when maxAttempts is explicitly null", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useReconnect({
        initialDelayMs: 0,
        jitterRatio: 0,
        maxAttempts: null
      })
    );

    for (let i = 0; i < 50; i += 1) {
      act(() => {
        result.current.schedule();
        vi.advanceTimersByTime(0);
      });
    }

    expect(result.current.status).toBe("running");
    expect(result.current.attempt).toBe(50);
  });

  it("stops when maxAttempts is exhausted", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useReconnect({
        initialDelayMs: 0,
        jitterRatio: 0,
        maxAttempts: 2
      })
    );

    act(() => {
      result.current.schedule();
      vi.advanceTimersByTime(0);
    });

    act(() => {
      result.current.schedule();
      vi.advanceTimersByTime(0);
    });

    act(() => {
      result.current.schedule();
    });

    expect(result.current.status).toBe("stopped");
    expect(result.current.attempt).toBe(2);
    expect(result.current.nextDelayMs).toBeNull();
  });

  it(
    "commits status updates at default priority so consumer effects run in the same commit",
    () => {
      // `reconnect.status` is a control signal that drives `useEffect`
      // dependencies in `useWebSocket` / `useEventSource`. Wrapping the
      // underlying setState in `startTransition` deprioritizes it and lets
      // higher-priority updates render in between, leaving transports with
      // a stale status. This test pins the contract: every distinct status
      // a consumer would observe via `useEffect([reconnect.status])` is
      // committed eagerly in the same React commit as the call that
      // produced it.
      vi.useFakeTimers();

      const observed: UseReconnectResult["status"][] = [];
      const recordStatus = (status: UseReconnectResult["status"]): void => {
        // Strict Mode runs effects mount → unmount → mount, which can
        // duplicate the very first observation. Coalesce consecutive
        // duplicates so the assertion still pins the *transition order*
        // (idle → scheduled → running → idle) rather than the count.
        if (observed[observed.length - 1] !== status) {
          observed.push(status);
        }
      };

      const { result } = renderHook(() => {
        const reconnect = useReconnect({
          initialDelayMs: 50,
          jitterRatio: 0
        });

        useEffect(() => {
          recordStatus(reconnect.status);
        }, [reconnect.status]);

        return reconnect;
      });

      expect(observed).toEqual(["idle"]);

      act(() => {
        result.current.schedule();
      });

      expect(observed).toEqual(["idle", "scheduled"]);

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(observed).toEqual(["idle", "scheduled", "running"]);

      act(() => {
        result.current.markConnected();
      });

      expect(observed).toEqual(["idle", "scheduled", "running", "idle"]);
    }
  );
});
