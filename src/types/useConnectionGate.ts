export type ConnectionGateReason = "ready" | "manual" | "offline" | "hidden";

export interface UseConnectionGateOptions {
  enabled?: boolean;
  requireOnline?: boolean;
  requireVisible?: boolean;
  hiddenGraceMs?: number;
  initialOnline?: boolean;
  initialVisible?: boolean;
  trackTransitions?: boolean;
}

export interface UseConnectionGateResult {
  connect: boolean;
  isBlocked: boolean;
  isWaitingForVisibleGrace: boolean;
  reason: ConnectionGateReason;
  isOnline: boolean;
  isOnlineSupported: boolean;
  isVisible: boolean;
  isVisibilitySupported: boolean;
  visibilityState: DocumentVisibilityState | "visible";
  lastChangedAt: number | null;
  becameReadyAt: number | null;
  becameBlockedAt: number | null;
}

export type UseConnectionGateHook = (
  options?: UseConnectionGateOptions
) => UseConnectionGateResult;
