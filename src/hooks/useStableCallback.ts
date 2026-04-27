import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Returns a referentially stable wrapper around `callback` that always
 * invokes the most recent version of the function passed in.
 *
 * The latest reference is committed via `useInsertionEffect` instead of
 * being mutated during render. Mutating refs during render is unsafe
 * under concurrent rendering: a render may be discarded after writing
 * to the ref, leaving the ref out of sync with the committed tree.
 * `useInsertionEffect` runs synchronously after commit, before any
 * layout effect or paint, so the ref always matches the committed
 * callback by the time any effect, event handler, or subscription
 * reads from it.
 *
 * The returned wrapper itself never changes identity, which makes it
 * safe to pass into `useEffect` dependency arrays or to add as an
 * event listener without forcing teardown on every render.
 *
 * Note: the returned wrapper must not be invoked during render. It is
 * intended for event handlers, effects, and subscription callbacks.
 */
export const useStableCallback = <TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult
): ((...args: TArgs) => TResult) => {
  const callbackRef = useRef(callback);

  useInsertionEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((...args: TArgs) => callbackRef.current(...args), []);
};
