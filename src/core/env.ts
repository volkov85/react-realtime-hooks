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

export const getRuntimeFeatureSupport = (): RuntimeFeatureSupport => ({
  eventSource: isEventSourceSupported(),
  navigatorOnLine: hasNavigatorOnLineSupport(),
  webSocket: isWebSocketSupported()
});
