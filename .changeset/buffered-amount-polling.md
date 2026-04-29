---
"react-realtime-hooks": minor
---

Add an opt-in `bufferedAmountPolling` option to `useWebSocket` so consumers can render real-time WebSocket backpressure UIs.

The native `WebSocket` interface does not emit any event when buffered bytes drain to the network, so by default `state.bufferedAmount` is only refreshed when the consumer calls `send(...)`, when a message arrives, or when the socket transitions to `open`. That is enough for many apps but leaves UIs that need a live "outbound queue" or "flushing..." indicator stuck on stale values.

The new option accepts:

- `false` (default) — no polling; behaviour is unchanged.
- `true` — poll once every 100 ms while the socket is `open`.
- `"raf"` — poll on every animation frame while the socket is `open`. Recommended for visual gauges that are tied to a render loop.
- `{ intervalMs: number }` — poll every `intervalMs` milliseconds. Values `<= 0` or non-finite are treated as "no polling".

Polling is automatically suspended when the socket is not in the `open` state and resumed when it returns to `open`. The hook diffs the polled value against the last committed `bufferedAmount` so identical readings never trigger a React re-render. The new effect runs under the global Strict Mode test wrapper added previously, so mount → cleanup → mount no longer leaks intervals or animation-frame requests.

No public API breaks: existing consumers that do not pass `bufferedAmountPolling` see the same behaviour as before.
