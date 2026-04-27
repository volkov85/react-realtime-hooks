---
"react-realtime-hooks": patch
---

Fix a reconnect race window in `useReconnect`. The internal `commitState` previously wrapped its `setState` in `startTransition`, deprioritizing `reconnect.status` updates. Because `status` is a control signal that drives `useEffect` dependencies in `useWebSocket` and `useEventSource`, deferring it allowed higher-priority renders to interleave between the timer firing (`status: "running"`) and the consumer effect creating the next socket. The status transitions are now committed at default priority so transports see the new status in the same React commit as the call that produced it.

Pure-correctness fix; no public API or hook return shape changes. The wrapper functions returned by `useReconnect` (`schedule`, `cancel`, `reset`, `markConnected`) keep the same signatures, identity, and side-effect ordering.
