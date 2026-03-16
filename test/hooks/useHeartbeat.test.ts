import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHeartbeat } from "../../src";

describe("useHeartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts automatically by default", () => {
    const { result } = renderHook(() =>
      useHeartbeat({
        intervalMs: 1_000
      })
    );

    expect(result.current.isRunning).toBe(true);
    expect(result.current.hasTimedOut).toBe(false);
  });

  it("does not auto-start when startOnMount is false", () => {
    const { result } = renderHook(() =>
      useHeartbeat({
        intervalMs: 1_000,
        startOnMount: false
      })
    );

    expect(result.current.isRunning).toBe(false);
  });

  it("runs beat on interval and records timestamps", () => {
    vi.useFakeTimers();

    const onBeat = vi.fn();
    const beat = vi.fn();
    const { result } = renderHook(() =>
      useHeartbeat({
        beat,
        intervalMs: 100,
        onBeat
      })
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(beat).toHaveBeenCalledTimes(1);
    expect(onBeat).toHaveBeenCalledTimes(1);
    expect(result.current.lastBeatAt).not.toBeNull();
  });

  it("supports manual start and stop", () => {
    vi.useFakeTimers();

    const beat = vi.fn();
    const { result } = renderHook(() =>
      useHeartbeat({
        beat,
        intervalMs: 100,
        startOnMount: false
      })
    );

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isRunning).toBe(true);
    expect(beat).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.stop();
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isRunning).toBe(false);
    expect(beat).toHaveBeenCalledTimes(1);
  });

  it("tracks ack and latency", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useHeartbeat<string, string>({
        intervalMs: 1_000,
        startOnMount: false
      })
    );

    act(() => {
      result.current.start();
      result.current.beat();
      vi.advanceTimersByTime(250);
    });

    act(() => {
      const matched = result.current.notifyAck("pong");
      expect(matched).toBe(true);
    });

    expect(result.current.lastAckAt).not.toBeNull();
    expect(result.current.latencyMs).toBe(250);
    expect(result.current.hasTimedOut).toBe(false);
  });

  it("uses matchesAck when provided", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useHeartbeat<string, string>({
        intervalMs: 1_000,
        matchesAck: (message) => message === "pong",
        startOnMount: false
      })
    );

    act(() => {
      result.current.start();
      result.current.beat();
    });

    act(() => {
      const matched = result.current.notifyAck("noop");
      expect(matched).toBe(false);
    });

    expect(result.current.lastAckAt).toBeNull();

    act(() => {
      const matched = result.current.notifyAck("pong");
      expect(matched).toBe(true);
    });

    expect(result.current.lastAckAt).not.toBeNull();
  });

  it("marks timeout when ack does not arrive", () => {
    vi.useFakeTimers();

    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useHeartbeat({
        intervalMs: 1_000,
        onTimeout,
        startOnMount: false,
        timeoutMs: 200
      })
    );

    act(() => {
      result.current.start();
      result.current.beat();
      vi.advanceTimersByTime(200);
    });

    expect(result.current.hasTimedOut).toBe(true);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled", () => {
    vi.useFakeTimers();

    const beat = vi.fn();
    const { result } = renderHook(() =>
      useHeartbeat({
        beat,
        enabled: false,
        intervalMs: 100
      })
    );

    act(() => {
      result.current.start();
      result.current.beat();
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isRunning).toBe(false);
    expect(beat).not.toHaveBeenCalled();
  });
});
