---
"react-realtime-hooks": major
---

Two new sane defaults make `useWebSocket`, `useEventSource`, `useReconnect`,
and `useHeartbeat` safer to drop into a real product without configuration.
Both are observable behaviour changes — see [`MIGRATING.md`](./MIGRATING.md)
for migration steps if you depend on the old defaults.

- **`reconnect.maxAttempts` defaults to `10`** (was `null` / unlimited).
  After 10 failed attempts, the transport hook commits `status: "error"` and
  the underlying reconnect hook commits `status: "stopped"`. To restore the
  previous behaviour, pass `reconnect: { maxAttempts: null }` explicitly.

- **`heartbeat.timeoutMs` defaults to `10_000`** (was no default — timeouts
  never fired unless you set the option). After 10 seconds without an ack,
  `hasTimedOut` flips to `true`, `onTimeout` fires, and on `useWebSocket` the
  `timeoutAction` policy runs (`"reconnect"` by default). Pass
  `heartbeat: { timeoutMs: null }` to restore the old "no timeout" behaviour.
  The `timeoutMs` option type relaxes from `number` to `number | null`.
