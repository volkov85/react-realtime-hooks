import { afterEach, describe, expect, it, vi } from "vitest";

import { createCleanupBag } from "../../src/core/lifecycle";
import {
  createManagedInterval,
  createManagedTimeout
} from "../../src/core/timers";

describe("timer helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules and cancels managed timeouts", () => {
    vi.useFakeTimers();

    const timeout = createManagedTimeout();
    const callback = vi.fn();

    timeout.schedule(callback, 100);
    expect(timeout.isActive()).toBe(true);

    vi.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(timeout.isActive()).toBe(false);
  });

  it("restarts managed intervals", () => {
    vi.useFakeTimers();

    const interval = createManagedInterval();
    const callback = vi.fn();

    interval.start(callback, 50);
    vi.advanceTimersByTime(120);
    expect(callback).toHaveBeenCalledTimes(2);

    interval.start(callback, 100);
    vi.advanceTimersByTime(99);
    expect(callback).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(3);

    interval.cancel();
    expect(interval.isActive()).toBe(false);
  });
});

describe("cleanup bag", () => {
  it("runs cleanups in reverse registration order and clears itself", () => {
    const calls: string[] = [];
    const bag = createCleanupBag();

    bag.add(() => {
      calls.push("first");
    });
    bag.add(() => {
      calls.push("second");
    });

    expect(bag.size()).toBe(2);
    bag.cleanup();

    expect(calls).toEqual(["second", "first"]);
    expect(bag.size()).toBe(0);
  });
});
