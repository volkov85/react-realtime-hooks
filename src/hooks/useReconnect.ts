import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState
} from "react";

import {
  createReconnectAttempt,
  normalizeReconnectOptions
} from "../core/reconnect";
import { createManagedTimeout } from "../core/timers";
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
    startTransition(() => {
      setState(resolved);
    });
  };

  const runAttempt = useEffectEvent((attempt: number) => {
    commitState({
      attempt,
      nextDelayMs: null,
      status: "running"
    });
  });

  const emitSchedule = useEffectEvent((attempt: ReconnectAttempt) => {
    normalizedOptions.onSchedule?.(attempt);
  });

  const emitCancel = useEffectEvent(() => {
    normalizedOptions.onCancel?.();
  });

  const emitReset = useEffectEvent(() => {
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

  const schedule = (trigger: ReconnectTrigger = "manual"): void => {
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
  };

  const cancel = (): void => {
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
  };

  const reset = (): void => {
    timeoutRef.current.cancel();
    lastDelayRef.current = null;
    commitState(createInitialState(normalizedOptions.enabled));
    emitReset();
  };

  const markConnected = (): void => {
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
  };

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
