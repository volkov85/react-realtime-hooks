import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { hasNavigatorOnLineSupport, readOnlineStatus } from "../core/env";
import type {
  UseOnlineStatusHook,
  UseOnlineStatusOptions,
  UseOnlineStatusResult
} from "../types/useOnlineStatus";

const subscribeToOnlineStatus = (onStoreChange: () => void): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
};

const createEmptyTransitionState = (): Pick<
  UseOnlineStatusResult,
  "lastChangedAt" | "wentOfflineAt" | "wentOnlineAt"
> => ({
  lastChangedAt: null,
  wentOfflineAt: null,
  wentOnlineAt: null
});

export const useOnlineStatus: UseOnlineStatusHook = (
  options: UseOnlineStatusOptions = {}
) => {
  const initialOnline = options.initialOnline ?? true;
  const trackTransitions = options.trackTransitions ?? true;

  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    () => readOnlineStatus(initialOnline).isOnline,
    () => initialOnline
  );

  const previousOnlineRef = useRef(isOnline);
  const [transitions, setTransitions] = useState(createEmptyTransitionState);

  useEffect(() => {
    if (!trackTransitions) {
      previousOnlineRef.current = isOnline;
      setTransitions(createEmptyTransitionState);
      return;
    }

    if (previousOnlineRef.current === isOnline) {
      return;
    }

    const changedAt = Date.now();
    previousOnlineRef.current = isOnline;

    setTransitions((current) => ({
      lastChangedAt: changedAt,
      wentOfflineAt: isOnline ? current.wentOfflineAt : changedAt,
      wentOnlineAt: isOnline ? changedAt : current.wentOnlineAt
    }));
  }, [isOnline, trackTransitions]);

  return {
    isOnline,
    isSupported: hasNavigatorOnLineSupport(),
    ...transitions
  };
};
