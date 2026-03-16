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
): ConnectionStateSnapshot => ({
  isClosed: isClosedStatus(status),
  isConnected: isConnectedStatus(status),
  isConnecting: isConnectingStatus(status),
  isSupported: config.isSupported ?? true,
  lastChangedAt: config.lastChangedAt ?? null,
  status
});
