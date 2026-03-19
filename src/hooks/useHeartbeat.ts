import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  createManagedInterval,
  createManagedTimeout
} from "../core/timers";
import type {
  UseHeartbeatOptions,
  UseHeartbeatHook,
  UseHeartbeatResult
} from "../types/useHeartbeat";

type HeartbeatState = Pick<
  UseHeartbeatResult,
  "hasTimedOut" | "isRunning" | "lastAckAt" | "lastBeatAt" | "latencyMs"
>;

const createInitialState = (isRunning: boolean): HeartbeatState => ({
  hasTimedOut: false,
  isRunning,
  lastAckAt: null,
  lastBeatAt: null,
  latencyMs: null
});

export const useHeartbeat = <
  TOutgoing = unknown,
  TIncoming = TOutgoing
>(
  options: UseHeartbeatOptions<TOutgoing, TIncoming>
): UseHeartbeatResult<TIncoming> => {
  const enabled = options.enabled ?? true;
  const startOnMount = options.startOnMount ?? true;
  const intervalRef = useRef(createManagedInterval());
  const timeoutRef = useRef(createManagedTimeout());
  const generationRef = useRef(0);
  const [state, setState] = useState<HeartbeatState>(() =>
    createInitialState(enabled && startOnMount)
  );
  const stateRef = useRef(state);

  stateRef.current = state;

  const commitState = (
    next:
      | HeartbeatState
      | ((current: HeartbeatState) => HeartbeatState)
  ): void => {
    const resolved =
      typeof next === "function" ? next(stateRef.current) : next;

    stateRef.current = resolved;
    setState(resolved);
  };

  const handleTimeout = useEffectEvent(() => {
    commitState((current) => ({
      ...current,
      hasTimedOut: true
    }));
    options.onTimeout?.();
  });

  const scheduleTimeout = useEffectEvent(() => {
    if (options.timeoutMs === undefined) {
      timeoutRef.current.cancel();
      return;
    }

    timeoutRef.current.schedule(() => {
      handleTimeout();
    }, options.timeoutMs);
  });

  const handleBeatSuccess = useEffectEvent((performedAt: number) => {
    commitState((current) => ({
      ...current,
      hasTimedOut: false,
      lastBeatAt: performedAt
    }));

    scheduleTimeout();
    options.onBeat?.();
  });

  const handleBeatError = useEffectEvent((error: unknown) => {
    timeoutRef.current.cancel();
    options.onError?.(error);
  });

  const runBeat = useEffectEvent(() => {
    const generation = generationRef.current;

    const completeBeat = (result: void | boolean): void => {
      if (generation !== generationRef.current || result === false) {
        return;
      }

      handleBeatSuccess(Date.now());
    };

    const failBeat = (error: unknown): void => {
      if (generation !== generationRef.current) {
        return;
      }

      handleBeatError(error);
    };

    try {
      const result = options.beat?.();

      if (result !== null && typeof result === "object" && "then" in result) {
        void Promise.resolve(result).then(completeBeat, failBeat);
        return;
      }

      completeBeat(result);
    } catch (error) {
      failBeat(error);
    }
  });

  const start = (): void => {
    if (!enabled) {
      return;
    }

    if (!intervalRef.current.isActive()) {
      intervalRef.current.start(() => {
        runBeat();
      }, options.intervalMs);
    }

    commitState((current) => ({
      ...current,
      hasTimedOut: false,
      isRunning: true
    }));
  };

  const stop = (): void => {
    generationRef.current += 1;
    intervalRef.current.cancel();
    timeoutRef.current.cancel();
    commitState((current) => ({
      ...current,
      hasTimedOut: false,
      isRunning: false
    }));
  };

  const beat = (): void => {
    if (!enabled) {
      return;
    }

    runBeat();
  };

  const notifyAck = (message: TIncoming): boolean => {
    if (stateRef.current.lastBeatAt === null) {
      return false;
    }

    const matchesAck =
      options.matchesAck === undefined || options.matchesAck(message);

    if (!matchesAck) {
      return false;
    }

    const acknowledgedAt = Date.now();
    timeoutRef.current.cancel();

    commitState((current) => ({
      ...current,
      hasTimedOut: false,
      lastAckAt: acknowledgedAt,
      latencyMs:
        current.lastBeatAt === null
          ? null
          : acknowledgedAt - current.lastBeatAt
    }));

    return true;
  };

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    if (startOnMount) {
      start();
      return stop;
    }

    stop();
    return undefined;
  }, [enabled, options.intervalMs, startOnMount]);

  useEffect(() => () => {
    generationRef.current += 1;
    intervalRef.current.cancel();
    timeoutRef.current.cancel();
  }, []);

  return {
    beat,
    hasTimedOut: state.hasTimedOut,
    isRunning: state.isRunning,
    lastAckAt: state.lastAckAt,
    lastBeatAt: state.lastBeatAt,
    latencyMs: state.latencyMs,
    notifyAck,
    start,
    stop
  };
};

const _useHeartbeatTypecheck: UseHeartbeatHook = useHeartbeat;
void _useHeartbeatTypecheck;
