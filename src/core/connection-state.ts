import type {
  ConnectionStateSnapshot,
  RealtimeConnectionStatus
} from "../types/common";

export const isConnectedStatus = (
  status: RealtimeConnectionStatus
): boolean => status === "open";

export const isConnectingStatus = (
  status: RealtimeConnectionStatus
): boolean => status === "connecting" || status === "reconnecting";

export const isClosedStatus = (
  status: RealtimeConnectionStatus
): boolean => status === "closed" || status === "idle" || status === "error";

export const createConnectionStateSnapshot = (
  status: RealtimeConnectionStatus,
  config: {
    isSupported?: boolean;
    lastChangedAt?: number | null;
  } = {}
): ConnectionStateSnapshot => {
  const base = {
    isSupported: config.isSupported ?? true,
    lastChangedAt: config.lastChangedAt ?? null
  };

  switch (status) {
    case "open":
      return {
        ...base,
        isClosed: false,
        isConnected: true,
        isConnecting: false,
        status
      };
    case "connecting":
    case "reconnecting":
      return {
        ...base,
        isClosed: false,
        isConnected: false,
        isConnecting: true,
        status
      };
    case "closing":
      return {
        ...base,
        isClosed: false,
        isConnected: false,
        isConnecting: false,
        status
      };
    case "idle":
    case "closed":
    case "error":
      return {
        ...base,
        isClosed: true,
        isConnected: false,
        isConnecting: false,
        status
      };
  }
};
