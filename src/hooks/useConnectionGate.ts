import { useEffect, useRef, useState } from "react";

import { createManagedTimeout } from "../core/timers";
import { useOnlineStatus } from "./useOnlineStatus";
import { usePageVisibility } from "./usePageVisibility";
import type {
  ConnectionGateReason,
  UseConnectionGateHook,
  UseConnectionGateResult
} from "../types/useConnectionGate";

type ConnectionGateTransitionState = Pick<
  UseConnectionGateResult,
  "becameBlockedAt" | "becameReadyAt" | "lastChangedAt"
>;

const createEmptyTransitionState = (): ConnectionGateTransitionState => ({
  becameBlockedAt: null,
  becameReadyAt: null,
  lastChangedAt: null
});

const normalizeHiddenGraceMs = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
};

export const useConnectionGate: UseConnectionGateHook = (options = {}) => {
  const enabled = options.enabled ?? true;
  const requireOnline = options.requireOnline ?? true;
  const requireVisible = options.requireVisible ?? false;
  const hiddenGraceMs = normalizeHiddenGraceMs(options.hiddenGraceMs);
  const trackTransitions = options.trackTransitions ?? true;
  const onlineStatus = useOnlineStatus({
    ...(options.initialOnline === undefined
      ? {}
      : { initialOnline: options.initialOnline }),
    trackTransitions: false
  });
  const pageVisibility = usePageVisibility({
    ...(options.initialVisible === undefined
      ? {}
      : { initialVisible: options.initialVisible }),
    trackTransitions: false
  });
  const hiddenGraceTimeoutRef = useRef(createManagedTimeout());
  const hiddenSinceRef = useRef<number | null>(null);
  const previousStateRef = useRef<{
    connect: boolean;
    reason: ConnectionGateReason;
  } | null>(null);
  const [hasExceededHiddenGrace, setHasExceededHiddenGrace] = useState(false);
  const [isWaitingForVisibleGrace, setIsWaitingForVisibleGrace] = useState(false);
  const [transitions, setTransitions] = useState(createEmptyTransitionState);

  useEffect(() => () => {
    hiddenGraceTimeoutRef.current.cancel();
  }, []);

  useEffect(() => {
    hiddenGraceTimeoutRef.current.cancel();

    if (!requireVisible || pageVisibility.isVisible) {
      hiddenSinceRef.current = null;
      setHasExceededHiddenGrace(false);
      setIsWaitingForVisibleGrace(false);
      return;
    }

    const hiddenSince = hiddenSinceRef.current ?? Date.now();
    hiddenSinceRef.current = hiddenSince;

    if (hiddenGraceMs <= 0) {
      setHasExceededHiddenGrace(true);
      setIsWaitingForVisibleGrace(false);
      return;
    }

    const elapsedMs = Date.now() - hiddenSince;

    if (elapsedMs >= hiddenGraceMs) {
      setHasExceededHiddenGrace(true);
      setIsWaitingForVisibleGrace(false);
      return;
    }

    setHasExceededHiddenGrace(false);
    setIsWaitingForVisibleGrace(true);
    hiddenGraceTimeoutRef.current.schedule(() => {
      setHasExceededHiddenGrace(true);
      setIsWaitingForVisibleGrace(false);
    }, hiddenGraceMs - elapsedMs);
  }, [hiddenGraceMs, pageVisibility.isVisible, requireVisible]);

  let reason: ConnectionGateReason = "ready";

  if (!enabled) {
    reason = "manual";
  } else if (requireOnline && !onlineStatus.isOnline) {
    reason = "offline";
  } else if (
    requireVisible &&
    !pageVisibility.isVisible &&
    hasExceededHiddenGrace
  ) {
    reason = "hidden";
  }

  const connect = reason === "ready";
  const isBlocked = !connect;

  useEffect(() => {
    if (!trackTransitions) {
      previousStateRef.current = {
        connect,
        reason
      };
      setTransitions(createEmptyTransitionState);
      return;
    }

    const previousState = previousStateRef.current;

    if (previousState === null) {
      previousStateRef.current = {
        connect,
        reason
      };
      return;
    }

    if (
      previousState.connect === connect &&
      previousState.reason === reason
    ) {
      return;
    }

    const changedAt = Date.now();
    previousStateRef.current = {
      connect,
      reason
    };

    setTransitions((current) => ({
      becameBlockedAt: connect ? current.becameBlockedAt : changedAt,
      becameReadyAt: connect ? changedAt : current.becameReadyAt,
      lastChangedAt: changedAt
    }));
  }, [connect, reason, trackTransitions]);

  return {
    becameBlockedAt: transitions.becameBlockedAt,
    becameReadyAt: transitions.becameReadyAt,
    connect,
    isBlocked,
    isOnline: onlineStatus.isOnline,
    isOnlineSupported: onlineStatus.isSupported,
    isVisibilitySupported: pageVisibility.isSupported,
    isVisible: pageVisibility.isVisible,
    isWaitingForVisibleGrace,
    lastChangedAt: transitions.lastChangedAt,
    reason,
    visibilityState: pageVisibility.visibilityState
  };
};
