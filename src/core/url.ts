import type { UrlProvider } from "../types/common";

const normalizeResolvedUrl = (value: string | URL | null): string | null => {
  if (value === null) {
    return null;
  }

  if (value instanceof URL) {
    return value.toString();
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveUrlProvider = (url: UrlProvider): string | null => {
  const resolved = typeof url === "function" ? url() : url;
  return normalizeResolvedUrl(resolved ?? null);
};
