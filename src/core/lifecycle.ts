export type Cleanup = () => void;

export interface CleanupBag {
  add: (cleanup: Cleanup) => Cleanup;
  cleanup: () => void;
  size: () => number;
}

export const createCleanupBag = (): CleanupBag => {
  const cleanups = new Set<Cleanup>();

  return {
    add(cleanup) {
      cleanups.add(cleanup);
      return cleanup;
    },
    cleanup() {
      for (const cleanup of Array.from(cleanups).reverse()) {
        cleanups.delete(cleanup);
        cleanup();
      }
    },
    size() {
      return cleanups.size;
    }
  };
};
