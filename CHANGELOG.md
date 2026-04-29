# react-realtime-hooks

## 1.4.1

### Patch Changes

- 929d073: Refactor the `useWebSocket` control plane: consolidate the six interacting mutable booleans/refs that used to live directly inside the hook (`manualCloseRef`, `manualOpenRef`, `suppressReconnectRef`, `skipCloseReconnectRef`, `pendingCloseActionRef`, `terminalErrorRef`) into a single `useWebSocketController` hook stored in one `useRef`. Each lifecycle event (`open()`, `close()`, `reconnect()`, `handleOpen`, `handleClose`, the parse-error path, the heartbeat-action paths, the deps-effect cleanup) now goes through a named transition method on the controller instead of mutating several refs in sequence.

  Pure refactor: behaviour is identical, all 105 existing tests pass unchanged, and 13 new focused unit tests pin the controller's transition rules so any future regression in the control flow is loud. No public API changes.

## 1.4.0

### Minor Changes

- 5b8e6c4: Add an opt-in `bufferedAmountPolling` option to `useWebSocket` so consumers can render real-time WebSocket backpressure UIs.

  The native `WebSocket` interface does not emit any event when buffered bytes drain to the network, so by default `state.bufferedAmount` is only refreshed when the consumer calls `send(...)`, when a message arrives, or when the socket transitions to `open`. That is enough for many apps but leaves UIs that need a live "outbound queue" or "flushing..." indicator stuck on stale values.

  The new option accepts:

  - `false` (default) — no polling; behaviour is unchanged.
  - `true` — poll once every 100 ms while the socket is `open`.
  - `"raf"` — poll on every animation frame while the socket is `open`. Recommended for visual gauges that are tied to a render loop.
  - `{ intervalMs: number }` — poll every `intervalMs` milliseconds. Values `<= 0` or non-finite are treated as "no polling".

  Polling is automatically suspended when the socket is not in the `open` state and resumed when it returns to `open`. The hook diffs the polled value against the last committed `bufferedAmount` so identical readings never trigger a React re-render. The new effect runs under the global Strict Mode test wrapper added previously, so mount → cleanup → mount no longer leaks intervals or animation-frame requests.

  No public API breaks: existing consumers that do not pass `bufferedAmountPolling` see the same behaviour as before.

## 1.3.4

### Patch Changes

- 8616242: Defer `new WebSocket(...)` and `new EventSource(...)` allocation by one microtask in `useWebSocket` and `useEventSource`. React Strict Mode in dev double-invokes effects (mount → cleanup → mount) before any microtask flushes; the cleanup now flips a `cancelled` flag so the discarded mount never opens a real connection. After the microtask queue drains, only the surviving mount instantiates the transport.

  This eliminates the dev-time double-connection that previously happened on every mount under `<React.StrictMode>` (relevant for Next.js dev mode, the demo app, and the global Strict Mode test wrapper added in the previous release). The synchronous status commit to `connecting` is unchanged, so consumer effects observing `state.status` see the transition in the same React commit as the call that triggered it.

  The `useWebSocket` and `useEventSource` test suites no longer opt out of `reactStrictMode: true`; both transports now run under the same Strict Mode safety net as every other hook in the suite. Two new regression tests pin the contract: exactly one socket/source is created under Strict Mode's mount cycle, and zero are created if the component unmounts before the microtask flush.

  No public API or runtime semantics change for users — the transport is created on the next microtask instead of synchronously, which is invisible to anything observing `status`, `result.current.send(...)`, listeners, or reconnect timing.

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
