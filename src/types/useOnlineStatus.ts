export interface UseOnlineStatusOptions {
  initialOnline?: boolean;
  trackTransitions?: boolean;
}

export interface UseOnlineStatusResult {
  isOnline: boolean;
  isSupported: boolean;
  lastChangedAt: number | null;
  wentOnlineAt: number | null;
  wentOfflineAt: number | null;
}

export type UseOnlineStatusHook = (
  options?: UseOnlineStatusOptions
) => UseOnlineStatusResult;
