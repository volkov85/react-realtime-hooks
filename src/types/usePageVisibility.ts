export interface UsePageVisibilityOptions {
  initialVisible?: boolean;
  trackTransitions?: boolean;
}

export interface UsePageVisibilityResult {
  isVisible: boolean;
  visibilityState: DocumentVisibilityState | "visible";
  isSupported: boolean;
  lastChangedAt: number | null;
  becameVisibleAt: number | null;
  becameHiddenAt: number | null;
}

export type UsePageVisibilityHook = (
  options?: UsePageVisibilityOptions
) => UsePageVisibilityResult;
