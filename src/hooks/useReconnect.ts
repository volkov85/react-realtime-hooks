import { useEffect, useRef, useState } from "react";

import {
  createReconnectAttempt,
  normalizeReconnectOptions
} from "../core/reconnect";
import { createManagedTimeout } from "../core/timers";
import { useStableCallback } from "./useStableCallback";
import type {
  ReconnectAttempt,
  ReconnectTrigger,
  UseReconnectHook,
  UseReconnectResult
} from "../types/useReconnect";

type ReconnectState = Pick<
  UseReconnectResult,
  "attempt" | "nextDelayMs" | "status"
>;

const createInitialState = (enabled: boolean): ReconnectState => ({
  attempt: 0,
  nextDelayMs: null,
  status: enabled ? "idle" : "stopped"
});

export const useReconnect: UseReconnectHook = (options = {}) => {
  const normalizedOptions = normalizeReconnectOptions(options) ??
    normalizeReconnectOptions()!;
  const timeoutRef = useRef(createManagedTimeout());
  const lastDelayRef = useRef<number | null>(null);
  const [state, setState] = useState<ReconnectState>(() =>
    createInitialState(normalizedOptions.enabled)
  );
  const stateRef = useRef(state);

  stateRef.current = state;

  const commitState = (
    next:
      | ReconnectState
      | ((current: ReconnectState) => ReconnectState)
  ): void => {
    const resolved =
      typeof next === "function"
        ? next(stateRef.current)
        : next;

    stateRef.current = resolved;
    // `status` is a control signal read by `useEffect` dependencies in
    // `useWebSocket` / `useEventSource`. It must commit at the default
    // priority so the consumer effect runs in the same React commit as
    // the timer callback that triggered the transition; deprioritizing
    // it via `startTransition` opens a window where the transport sees
    // a stale status while higher-priority updates render.
    setState(resolved);
  };

  const runAttempt = useStableCallback((attempt: number) => {
    commitState({
      attempt,
      nextDelayMs: null,
      status: "running"
    });
  });

  const emitSchedule = useStableCallback((attempt: ReconnectAttempt) => {
    normalizedOptions.onSchedule?.(attempt);
  });

  const emitCancel = useStableCallback(() => {
    normalizedOptions.onCancel?.();
  });

  const emitReset = useStableCallback(() => {
    normalizedOptions.onReset?.();
  });

  useEffect(() => {
    if (!normalizedOptions.enabled) {
      timeoutRef.current.cancel();
      commitState((current) => ({
        ...current,
        nextDelayMs: null,
        status: "stopped"
      }));
      return;
    }

    commitState((current) =>
      current.status === "stopped"
        ? {
            ...current,
            status: "idle"
          }
        : current
    );
  }, [normalizedOptions.enabled]);

  useEffect(() => () => {
    timeoutRef.current.cancel();
  }, []);

  const schedule = useStableCallback((trigger: ReconnectTrigger = "manual"): void => {
    const current = stateRef.current;
    const nextAttempt = current.attempt + 1;
    const attempt = createReconnectAttempt(
      nextAttempt,
      trigger,
      normalizedOptions,
      lastDelayRef.current
    );

    timeoutRef.current.cancel();

    if (attempt === null) {
      commitState((snapshot) => ({
        ...snapshot,
        nextDelayMs: null,
        status: "stopped"
      }));
      return;
    }

    lastDelayRef.current = attempt.delayMs;
    timeoutRef.current.schedule(() => {
      runAttempt(attempt.attempt);
    }, attempt.delayMs);

    commitState({
      attempt: attempt.attempt,
      nextDelayMs: attempt.delayMs,
      status: "scheduled"
    });

    emitSchedule(attempt);
  });

  const cancel = useStableCallback((): void => {
    const current = stateRef.current;
    const shouldEmitCancel =
      timeoutRef.current.isActive() ||
      current.status === "scheduled" ||
      current.status === "running";

    timeoutRef.current.cancel();
    commitState((snapshot) => ({
      ...snapshot,
      nextDelayMs: null,
      status: "stopped"
    }));

    if (shouldEmitCancel) {
      emitCancel();
    }
  });

  const reset = useStableCallback((): void => {
    timeoutRef.current.cancel();
    lastDelayRef.current = null;
    commitState(createInitialState(normalizedOptions.enabled));
    emitReset();
  });

  const markConnected = useStableCallback((): void => {
    timeoutRef.current.cancel();

    if (normalizedOptions.resetOnSuccess) {
      lastDelayRef.current = null;
      commitState(createInitialState(normalizedOptions.enabled));
      emitReset();
      return;
    }

    commitState((current) => ({
      ...current,
      nextDelayMs: null,
      status: normalizedOptions.enabled ? "idle" : "stopped"
    }));
  });

  return {
    attempt: state.attempt,
    cancel,
    isActive: state.status === "scheduled" || state.status === "running",
    isScheduled: state.status === "scheduled",
    markConnected,
    nextDelayMs: state.nextDelayMs,
    reset,
    schedule,
    status: state.status
  };
};
