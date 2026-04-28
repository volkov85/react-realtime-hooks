---
"react-realtime-hooks": patch
---

Defer `new WebSocket(...)` and `new EventSource(...)` allocation by one microtask in `useWebSocket` and `useEventSource`. React Strict Mode in dev double-invokes effects (mount → cleanup → mount) before any microtask flushes; the cleanup now flips a `cancelled` flag so the discarded mount never opens a real connection. After the microtask queue drains, only the surviving mount instantiates the transport.

This eliminates the dev-time double-connection that previously happened on every mount under `<React.StrictMode>` (relevant for Next.js dev mode, the demo app, and the global Strict Mode test wrapper added in the previous release). The synchronous status commit to `connecting` is unchanged, so consumer effects observing `state.status` see the transition in the same React commit as the call that triggered it.

The `useWebSocket` and `useEventSource` test suites no longer opt out of `reactStrictMode: true`; both transports now run under the same Strict Mode safety net as every other hook in the suite. Two new regression tests pin the contract: exactly one socket/source is created under Strict Mode's mount cycle, and zero are created if the component unmounts before the microtask flush.

No public API or runtime semantics change for users — the transport is created on the next microtask instead of synchronously, which is invisible to anything observing `status`, `result.current.send(...)`, listeners, or reconnect timing.
