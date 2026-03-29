import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  hasDocumentVisibilitySupport,
  readPageVisibility
} from "../core/env";
import type {
  UsePageVisibilityHook,
  UsePageVisibilityOptions,
  UsePageVisibilityResult
} from "../types/usePageVisibility";

const subscribeToPageVisibility = (
  onStoreChange: () => void
): (() => void) => {
  if (typeof document === "undefined" || !hasDocumentVisibilitySupport()) {
    return () => {};
  }

  document.addEventListener("visibilitychange", onStoreChange);

  return () => {
    document.removeEventListener("visibilitychange", onStoreChange);
  };
};

const createEmptyTransitionState = (): Pick<
  UsePageVisibilityResult,
  "lastChangedAt" | "becameVisibleAt" | "becameHiddenAt"
> => ({
  lastChangedAt: null,
  becameHiddenAt: null,
  becameVisibleAt: null
});

export const usePageVisibility: UsePageVisibilityHook = (
  options: UsePageVisibilityOptions = {}
) => {
  const initialVisible = options.initialVisible ?? true;
  const trackTransitions = options.trackTransitions ?? true;

  const visibilityState = useSyncExternalStore(
    subscribeToPageVisibility,
    () => readPageVisibility(initialVisible).visibilityState,
    () => (initialVisible ? "visible" : "hidden")
  );

  const isVisible = visibilityState === "visible";
  const previousVisibleRef = useRef(isVisible);
  const [transitions, setTransitions] = useState(createEmptyTransitionState);

  useEffect(() => {
    if (!trackTransitions) {
      previousVisibleRef.current = isVisible;
      setTransitions(createEmptyTransitionState);
      return;
    }

    if (previousVisibleRef.current === isVisible) {
      return;
    }

    const changedAt = Date.now();
    previousVisibleRef.current = isVisible;

    setTransitions((current) => ({
      lastChangedAt: changedAt,
      becameHiddenAt: isVisible ? current.becameHiddenAt : changedAt,
      becameVisibleAt: isVisible ? changedAt : current.becameVisibleAt
    }));
  }, [isVisible, trackTransitions]);

  return {
    isSupported: hasDocumentVisibilitySupport(),
    isVisible,
    visibilityState,
    ...transitions
  };
};
