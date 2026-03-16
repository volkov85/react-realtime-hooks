export type ReconnectStatus = "idle" | "scheduled" | "running" | "stopped";

export type ReconnectTrigger =
  | "mount"
  | "manual"
  | "close"
  | "error"
  | "heartbeat-timeout"
  | "offline"
  | "online"
  | "visibility";

export interface ReconnectAttempt {
  attempt: number;
  delayMs: number;
  trigger: ReconnectTrigger;
  scheduledAt: number;
}

export interface ReconnectDelayContext {
  attempt: number;
  lastDelayMs: number | null;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitterRatio: number;
}

export type ReconnectDelayStrategy = (
  context: ReconnectDelayContext
) => number;

export interface UseReconnectOptions {
  enabled?: boolean;
  maxAttempts?: number | null;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitterRatio?: number;
  getDelayMs?: ReconnectDelayStrategy;
  resetOnSuccess?: boolean;
  onSchedule?: (attempt: ReconnectAttempt) => void;
  onCancel?: () => void;
  onReset?: () => void;
}

export interface UseReconnectResult {
  status: ReconnectStatus;
  attempt: number;
  nextDelayMs: number | null;
  isActive: boolean;
  isScheduled: boolean;
  schedule: (trigger?: ReconnectTrigger) => void;
  cancel: () => void;
  reset: () => void;
  markConnected: () => void;
}

export type UseReconnectHook = (
  options?: UseReconnectOptions
) => UseReconnectResult;
