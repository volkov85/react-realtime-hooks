import type {
  ReconnectAttempt,
  ReconnectDelayContext,
  ReconnectDelayStrategy,
  ReconnectTrigger,
  UseReconnectOptions
} from "../types/useReconnect";

export interface NormalizedReconnectOptions {
  backoffFactor: number;
  enabled: boolean;
  getDelayMs?: ReconnectDelayStrategy;
  initialDelayMs: number;
  jitterRatio: number;
  maxAttempts: number | null;
  maxDelayMs: number;
  onCancel?: () => void;
  onReset?: () => void;
  onSchedule?: (attempt: ReconnectAttempt) => void;
  resetOnSuccess: boolean;
}

export interface ReconnectDelayCalculationOptions {
  random?: () => number;
  strategy?: ReconnectDelayStrategy;
}

export interface CreateReconnectAttemptOptions
  extends ReconnectDelayCalculationOptions {
  now?: number;
}

export const DEFAULT_RECONNECT_OPTIONS: Readonly<
  Omit<NormalizedReconnectOptions, "getDelayMs" | "onCancel" | "onReset" | "onSchedule">
> = {
  backoffFactor: 2,
  enabled: true,
  initialDelayMs: 1_000,
  jitterRatio: 0.2,
  maxAttempts: null,
  maxDelayMs: 30_000,
  resetOnSuccess: true
};

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sanitizeDelay = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
};

const sanitizeBackoffFactor = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_RECONNECT_OPTIONS.backoffFactor;
  }

  return Math.max(1, value);
};

const sanitizeMaxAttempts = (
  value: number | null | undefined
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.floor(value));
};

const sanitizeJitterRatio = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_RECONNECT_OPTIONS.jitterRatio;
  }

  return clampNumber(value, 0, 1);
};

export const normalizeReconnectOptions = (
  options?: false | UseReconnectOptions
): NormalizedReconnectOptions | null => {
  if (options === false) {
    return null;
  }

  const initialDelayMs = sanitizeDelay(
    options?.initialDelayMs ?? DEFAULT_RECONNECT_OPTIONS.initialDelayMs
  );
  const maxDelayMs = Math.max(
    initialDelayMs,
    sanitizeDelay(options?.maxDelayMs ?? DEFAULT_RECONNECT_OPTIONS.maxDelayMs)
  );

  const normalized: NormalizedReconnectOptions = {
    backoffFactor: sanitizeBackoffFactor(
      options?.backoffFactor ?? DEFAULT_RECONNECT_OPTIONS.backoffFactor
    ),
    enabled: options?.enabled ?? DEFAULT_RECONNECT_OPTIONS.enabled,
    initialDelayMs,
    jitterRatio: sanitizeJitterRatio(
      options?.jitterRatio ?? DEFAULT_RECONNECT_OPTIONS.jitterRatio
    ),
    maxAttempts: sanitizeMaxAttempts(options?.maxAttempts),
    maxDelayMs,
    resetOnSuccess: options?.resetOnSuccess ?? DEFAULT_RECONNECT_OPTIONS.resetOnSuccess
  };

  if (options?.getDelayMs !== undefined) {
    normalized.getDelayMs = options.getDelayMs;
  }

  if (options?.onCancel !== undefined) {
    normalized.onCancel = options.onCancel;
  }

  if (options?.onReset !== undefined) {
    normalized.onReset = options.onReset;
  }

  if (options?.onSchedule !== undefined) {
    normalized.onSchedule = options.onSchedule;
  }

  return normalized;
};

export const createReconnectDelayContext = (
  attempt: number,
  options: Pick<
    NormalizedReconnectOptions,
    "backoffFactor" | "initialDelayMs" | "jitterRatio" | "maxDelayMs"
  >,
  lastDelayMs: number | null
): ReconnectDelayContext => ({
  attempt: Math.max(1, Math.floor(attempt)),
  backoffFactor: options.backoffFactor,
  initialDelayMs: options.initialDelayMs,
  jitterRatio: options.jitterRatio,
  lastDelayMs,
  maxDelayMs: options.maxDelayMs
});

export const defaultReconnectDelayStrategy = (
  context: ReconnectDelayContext
): number => {
  const exponent = Math.max(0, context.attempt - 1);
  const baseDelay = context.initialDelayMs * context.backoffFactor ** exponent;
  return Math.min(context.maxDelayMs, sanitizeDelay(baseDelay));
};

export const applyJitterToDelay = (
  delayMs: number,
  jitterRatio: number,
  random: () => number = Math.random
): number => {
  if (delayMs === 0 || jitterRatio === 0) {
    return delayMs;
  }

  const safeRandom = clampNumber(random(), 0, 1);
  const variance = delayMs * jitterRatio;
  const offset = (safeRandom * 2 - 1) * variance;
  return sanitizeDelay(delayMs + offset);
};

export const calculateReconnectDelay = (
  context: ReconnectDelayContext,
  options: ReconnectDelayCalculationOptions = {}
): number => {
  const baseDelay = sanitizeDelay(
    (options.strategy ?? defaultReconnectDelayStrategy)(context)
  );
  const cappedDelay = Math.min(context.maxDelayMs, baseDelay);
  return Math.min(
    context.maxDelayMs,
    applyJitterToDelay(cappedDelay, context.jitterRatio, options.random)
  );
};

export const canScheduleReconnectAttempt = (
  attempt: number,
  options: Pick<NormalizedReconnectOptions, "enabled" | "maxAttempts">
): boolean => {
  if (!options.enabled) {
    return false;
  }

  if (attempt < 1) {
    return false;
  }

  return options.maxAttempts === null || attempt <= options.maxAttempts;
};

export const createReconnectAttempt = (
  attempt: number,
  trigger: ReconnectTrigger,
  options: Pick<
    NormalizedReconnectOptions,
    "backoffFactor" | "enabled" | "getDelayMs" | "initialDelayMs" | "jitterRatio" | "maxAttempts" | "maxDelayMs"
  >,
  lastDelayMs: number | null,
  config: CreateReconnectAttemptOptions = {}
): ReconnectAttempt | null => {
  if (!canScheduleReconnectAttempt(attempt, options)) {
    return null;
  }

  const context = createReconnectDelayContext(attempt, options, lastDelayMs);
  const calculationOptions: ReconnectDelayCalculationOptions = {};

  if (config.random !== undefined) {
    calculationOptions.random = config.random;
  }

  if (options.getDelayMs !== undefined) {
    calculationOptions.strategy = options.getDelayMs;
  }

  return {
    attempt,
    delayMs: calculateReconnectDelay(context, calculationOptions),
    scheduledAt: config.now ?? Date.now(),
    trigger
  };
};
