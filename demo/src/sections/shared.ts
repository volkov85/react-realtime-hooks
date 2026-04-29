export type LogEntry = {
  id: string;
  text: string;
};

export const formatTimestamp = (value: number | null): string =>
  value === null ? "not recorded" : new Date(value).toLocaleTimeString();

export const createLogEntry = (label: string, details: string): LogEntry => ({
  id: `${Date.now()}-${crypto.randomUUID()}`,
  text: `${new Date().toLocaleTimeString()} | ${label} | ${details}`
});

export const pushLogEntry = (
  current: LogEntry[],
  entry: LogEntry,
  limit = 8
): LogEntry[] => [entry, ...current].slice(0, limit);
