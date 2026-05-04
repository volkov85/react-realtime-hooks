---
"react-realtime-hooks": patch
---

Fix two `close()` race conditions in `useWebSocket` and `useEventSource`:

- `close()` called between mount and the deferred `new WebSocket(...)` /
  `new EventSource(...)` allocation could resurrect a transport the user
  had already asked to close. The microtask now checks the
  manual-close flag and bails out instead of allocating.
- `close()` called when no native socket exists (e.g. `connect: false,
  reconnect: false`, or before the deferred allocation) committed
  `status: "closing"` even though nothing was closing. The hook now
  commits `status: "closed"` directly when there is nothing in flight.

Adds three regression tests pinning both fixes plus the existing
"close while open commits 'closing'" path.

Also tightens the publish guard: `prepack` now runs `test:dist` between
`build` and `publint`, so the dist contract test must pass before the
tarball is created.
