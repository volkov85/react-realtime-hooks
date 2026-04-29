---
"react-realtime-hooks": patch
---

Commit `stateRef` latest snapshot in `useInsertionEffect` instead of writing to the ref during render in `useWebSocket`, `useEventSource`, `useReconnect`, and `useHeartbeat`. Mutating refs during render is unsafe under concurrent rendering — a render that gets discarded would leave the ref out of sync with the committed state. Observable behavior is unchanged.
