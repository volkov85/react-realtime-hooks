---
"react-realtime-hooks": patch
---

Fix `useWebSocket` and `useEventSource` initial render committing `status: "connecting"` while `isSupported` was `false`. The initial state now derives from runtime support and the resolved URL: when the transport global is unavailable (e.g. SSR) or the URL provider returns `null`, the hook renders `status: "closed"` instead of an "impossible" combination of `isConnecting: true` with `isSupported: false`.

In a browser with the transport available, behavior is unchanged — initial status is still `connecting` (or `idle` when `connect: false`). The fix is observable on the server-rendered HTML and on the very first client render in environments without the transport global.
