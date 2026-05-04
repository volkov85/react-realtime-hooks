# Migrating from 1.x to 2.0

`react-realtime-hooks` 2.0 changes two defaults so the library is safe to drop
into a real product without configuration. **No public API was removed.** Both
changes are observable at runtime; neither breaks TypeScript compilation.

If you have not configured `reconnect.maxAttempts` or `heartbeat.timeoutMs` on
any of your hooks, you will see a behaviour change. Read on.

## What changed

### 1. `reconnect.maxAttempts` defaults to `10`

Before 2.0, the default was `null` (retry indefinitely). A mounted hook could
sit in a `reconnecting` loop forever, retrying a dead backend until the page
was closed.

In 2.0, the default is `10`. After 10 failed attempts:

- `useReconnect` commits `status: "stopped"` and `nextDelayMs: null`.
- `useWebSocket` / `useEventSource` commit `status: "error"`.
- The underlying timer is cancelled. No more network attempts will be made
  until your code calls `reconnect()` (transport hooks) or `schedule()` /
  `reset()` (the bare `useReconnect` hook), or until a dependency change
  forces a remount.

The exponential backoff defaults are unchanged (`initialDelayMs: 1_000`,
`backoffFactor: 2`, `maxDelayMs: 30_000`, `jitterRatio: 0.2`). With 10
attempts and a 30s cap, the hook spends roughly 3–4 minutes attempting to
recover before giving up — long enough to ride out transient failures, short
enough to surface a permanent outage to the UI.

### 2. `heartbeat.timeoutMs` defaults to `10_000`

Before 2.0, `timeoutMs` had no default. If you did not set it, the hook would
send beats forever and never flip `hasTimedOut`, so a server that silently
stopped responding looked indistinguishable from a healthy one.

In 2.0, the default is `10_000` (10 seconds). After a beat is sent, the hook
waits 10 seconds for an ack:

- If the ack arrives in time, the timeout is cleared and the cycle resumes.
- If it does not, `hasTimedOut` flips to `true`, `onTimeout` fires, and on
  `useWebSocket` the `timeoutAction` policy runs (`"reconnect"` by default,
  configurable to `"close"` or `"none"`).

The option type relaxes from `number` to `number | null` so you can opt out
explicitly.

## How to restore the old behaviour

If you were relying on the old defaults, set them explicitly. The TypeScript
type for both options has been widened (or kept) to accept the legacy values,
so this is a runtime-only migration.

### Restore unlimited reconnects

```diff
 useWebSocket({
   url,
   reconnect: {
     initialDelayMs: 1_000,
+    maxAttempts: null,
   },
 });
```

The same applies to `useEventSource` and the bare `useReconnect` hook.

### Disable heartbeat timeouts

```diff
 useWebSocket({
   url,
   heartbeat: {
     intervalMs: 10_000,
+    timeoutMs: null,
     message: { type: "ping" },
     matchesAck: (message) => message.type === "pong",
   },
 });
```

Same on the bare `useHeartbeat` hook.

## Recommended UI updates

If you adopt the new defaults, two states deserve explicit UI handling:

1. **`status === "error"` after `maxAttempts` exhausted.** Show a retry
   button that calls `result.reconnect()` and surface a meaningful message
   (e.g. "Connection lost. Reload to retry."). The hook will not retry on
   its own.
2. **`heartbeatState.hasTimedOut === true`.** With the default
   `timeoutAction: "reconnect"` the transport will already roll over into
   `reconnecting`, but you may want to show a "stale data" indicator while
   the reconnect is in flight.

Both transitions were always reachable by passing custom options; 2.0 just
makes them reachable out of the box.

## Nothing else changed

- All public hook signatures, option names, and result shapes are identical.
- All public types are exported from the same paths.
- All other reconnect, heartbeat, online, visibility, and gate options keep
  their previous defaults.
- `bufferedAmountPolling`, `useInsertionEffect`-based `useStableCallback`,
  microtask-debounced transport creation, SSR initial-state handling, and
  Strict Mode safety all stay the same as 1.4.x.

If you hit any other behaviour change, please open an issue — that would be
a regression, not an intended part of the 2.0 release.
