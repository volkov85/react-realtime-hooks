export interface ManagedTimeout {
  cancel: () => void;
  isActive: () => boolean;
  schedule: (callback: () => void, delayMs: number) => void;
}

export interface ManagedInterval {
  cancel: () => void;
  isActive: () => boolean;
  start: (callback: () => void, intervalMs: number) => void;
}

const sanitizeTimerDelay = (delayMs: number): number => {
  if (!Number.isFinite(delayMs)) {
    return 0;
  }

  return Math.max(0, Math.round(delayMs));
};

export const createManagedTimeout = (): ManagedTimeout => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    cancel() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    isActive() {
      return timeoutId !== null;
    },
    schedule(callback, delayMs) {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        timeoutId = null;
        callback();
      }, sanitizeTimerDelay(delayMs));
    }
  };
};

export const createManagedInterval = (): ManagedInterval => {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  return {
    cancel() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    isActive() {
      return intervalId !== null;
    },
    start(callback, intervalMs) {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }

      intervalId = setInterval(callback, sanitizeTimerDelay(intervalMs));
    }
  };
};
