# react-realtime-hooks

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
