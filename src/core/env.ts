export interface RuntimeFeatureSupport {
  eventSource: boolean;
  navigatorOnLine: boolean;
  webSocket: boolean;
}

export const isBrowserRuntime = (): boolean =>
  typeof window !== "undefined" && typeof document !== "undefined";

export const isWebSocketSupported = (): boolean =>
  typeof WebSocket !== "undefined";

export const isEventSourceSupported = (): boolean =>
  typeof EventSource !== "undefined";

export const hasNavigatorOnLineSupport = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.onLine === "boolean";

export const hasDocumentVisibilitySupport = (): boolean =>
  typeof document !== "undefined" && typeof document.visibilityState === "string";

export const readOnlineStatus = (initialOnline = true): {
  isOnline: boolean;
  isSupported: boolean;
} => {
  if (!hasNavigatorOnLineSupport()) {
    return {
      isOnline: initialOnline,
      isSupported: false
    };
  }

  return {
    isOnline: navigator.onLine,
    isSupported: true
  };
};

export const readPageVisibility = (initialVisible = true): {
  isVisible: boolean;
  isSupported: boolean;
  visibilityState: DocumentVisibilityState | "visible";
} => {
  if (!hasDocumentVisibilitySupport()) {
    return {
      isVisible: initialVisible,
      isSupported: false,
      visibilityState: initialVisible ? "visible" : "hidden"
    };
  }

  return {
    isVisible: document.visibilityState === "visible",
    isSupported: true,
    visibilityState: document.visibilityState
  };
};

export const getRuntimeFeatureSupport = (): RuntimeFeatureSupport => ({
  eventSource: isEventSourceSupported(),
  navigatorOnLine: hasNavigatorOnLineSupport(),
  webSocket: isWebSocketSupported()
});
