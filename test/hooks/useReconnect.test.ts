import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReconnect } from "../../src";
import type { ReconnectAttempt } from "../../src";

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
});
