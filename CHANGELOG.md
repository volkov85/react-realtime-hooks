# react-realtime-hooks

## 1.3.3

### Patch Changes

- 8117b03: Wrap every render in the hook test suite in `<React.StrictMode>` via Testing Library's `configure({ reactStrictMode: true })`. Strict Mode double-invokes component bodies and runs effects mount → unmount → mount in dev, which is the most reliable automated way to surface cleanup leaks, write-during-render anti-patterns, and stale-closure bugs in custom hooks.

  This is a test-only change — no public API or runtime behavior is affected. `useWebSocket` and `useEventSource` are temporarily opted out of Strict Mode in their test files because they don't yet debounce transport creation across the Strict Mode mount cycle (audit Issue 6, scheduled for a follow-up PR).

## 1.3.2

### Patch Changes

- c327432: Fix a reconnect race window in `useReconnect`. The internal `commitState` previously wrapped its `setState` in `startTransition`, deprioritizing `reconnect.status` updates. Because `status` is a control signal that drives `useEffect` dependencies in `useWebSocket` and `useEventSource`, deferring it allowed higher-priority renders to interleave between the timer firing (`status: "running"`) and the consumer effect creating the next socket. The status transitions are now committed at default priority so transports see the new status in the same React commit as the call that produced it.

  Pure-correctness fix; no public API or hook return shape changes. The wrapper functions returned by `useReconnect` (`schedule`, `cancel`, `reset`, `markConnected`) keep the same signatures, identity, and side-effect ordering.

## 1.3.1

### Patch Changes

- 36b986a: Fix a concurrent-rendering hazard in `useStableCallback`. The internal latest-callback ref was previously written during render, which can desync from the committed tree when React discards a render under concurrent rendering or Strict Mode. The ref is now committed via `useInsertionEffect`, so the wrapper always invokes the callback that matches the committed render, while keeping the wrapper's referential identity stable across re-renders.

  This is an internal correctness fix for `useReconnect`, `useWebSocket`, `useEventSource`, and `useHeartbeat` (all of which call `useStableCallback`); no public API or hook return shape changes.

## 1.3.0

### Minor Changes

- 388db2c: Relax the React peer dependency to `>=18.0.0 <20.0.0` so the package can be installed alongside React 18.x as well as React 19.x. The library does not depend on any React 19.2-only API at runtime; the previous `^19.2.0` range unnecessarily blocked installs on React 18, 19.0, and 19.1.

  The CI quality gate now runs the full lint + typecheck + test + build matrix against React 18.3.1, 19.0.0, and 19.2.4, with matching `@types/react` and `@types/react-dom` versions to catch typing regressions on each major.

## 1.2.2

### Patch Changes

- 6f7c510: Harden realtime hooks behavior and React compatibility

## 1.2.1

### Patch Changes

- ffc144a: Ignore stale WebSocket events from replaced connections to prevent old sockets from corrupting the current hook state during reconnects or transport reconfiguration.

## 1.2.0

### Minor Changes

- 25d9e30: Add useConnectionGate, a new core hook that combines browser online state and page visibility into a single connect flag for useWebSocket and useEventSource. It supports hidden-tab grace periods, exposes a deterministic gate reason, and includes transition timestamps for ready/blocked state changes. README and demo were updated to cover the new hook.

## 1.1.0

### Minor Changes

- bac739a: Add usePageVisibility hook with transition timestamps and public exports

## 1.0.4

### Patch Changes

- 19add81: Narrow the React peer dependency to React 19, align the README with the supported version, and tighten realtime error handling. This update makes onError fire consistently for transport, heartbeat, and parse failures, updates lastChangedAt on native WebSocket errors, and clears heartbeat timing state on stop so reconnects start with fresh metrics.

## 1.0.3

### Patch Changes

- b221139: Improve heartbeat failure handling in useHeartbeat/useWebSocket by surfacing beat errors and adding timeout-driven close/reconnect behavior.

## 1.0.2

### Patch Changes

- aa534ba: Treat parseMessage failures as terminal transport errors by closing the current WebSocket or EventSource connection, stopping auto-reconnect, and requiring an explicit open() or reconnect() to recover.

## 1.0.1

### Patch Changes

- 7110259: Refresh README and move maintainer docs to CONTRIBUTING.md
