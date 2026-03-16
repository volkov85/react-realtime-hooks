import { describe, expect, it } from "vitest";

import {
  DEFAULT_RECONNECT_OPTIONS,
  applyJitterToDelay,
  calculateReconnectDelay,
  canScheduleReconnectAttempt,
  createReconnectAttempt,
  createReconnectDelayContext,
  defaultReconnectDelayStrategy,
  normalizeReconnectOptions
} from "../../src/core/reconnect";

describe("reconnect helpers", () => {
  it("normalizes reconnect defaults", () => {
    expect(normalizeReconnectOptions()).toEqual({
      ...DEFAULT_RECONNECT_OPTIONS,
      getDelayMs: undefined,
      onCancel: undefined,
      onReset: undefined,
      onSchedule: undefined
    });
  });

  it("sanitizes reconnect config", () => {
    expect(
      normalizeReconnectOptions({
        backoffFactor: 0,
        initialDelayMs: -100,
        jitterRatio: 4,
        maxAttempts: -2,
        maxDelayMs: 200
      })
    ).toEqual({
      backoffFactor: 1,
      enabled: true,
      getDelayMs: undefined,
      initialDelayMs: 0,
      jitterRatio: 1,
      maxAttempts: 0,
      maxDelayMs: 200,
      onCancel: undefined,
      onReset: undefined,
      onSchedule: undefined,
      resetOnSuccess: true
    });
  });

  it("calculates exponential backoff without jitter", () => {
    const context = createReconnectDelayContext(
      3,
      {
        backoffFactor: 2,
        initialDelayMs: 1_000,
        jitterRatio: 0,
        maxDelayMs: 30_000
      },
      2_000
    );

    expect(defaultReconnectDelayStrategy(context)).toBe(4_000);
    expect(calculateReconnectDelay(context)).toBe(4_000);
  });

  it("applies bounded jitter", () => {
    expect(applyJitterToDelay(1_000, 0.2, () => 0)).toBe(800);
    expect(applyJitterToDelay(1_000, 0.2, () => 1)).toBe(1_200);
  });

  it("respects max attempts and creates attempt payloads", () => {
    const options = normalizeReconnectOptions({
      initialDelayMs: 500,
      jitterRatio: 0,
      maxAttempts: 2
    });

    expect(options).not.toBeNull();
    expect(canScheduleReconnectAttempt(1, options!)).toBe(true);
    expect(canScheduleReconnectAttempt(3, options!)).toBe(false);
    expect(
      createReconnectAttempt(2, "error", options!, 500, {
        now: 123,
        random: () => 0.5
      })
    ).toEqual({
      attempt: 2,
      delayMs: 1_000,
      scheduledAt: 123,
      trigger: "error"
    });
    expect(createReconnectAttempt(3, "error", options!, 1_000)).toBeNull();
  });
});
