---
"react-realtime-hooks": patch
---

Fix a concurrent-rendering hazard in `useStableCallback`. The internal latest-callback ref was previously written during render, which can desync from the committed tree when React discards a render under concurrent rendering or Strict Mode. The ref is now committed via `useInsertionEffect`, so the wrapper always invokes the callback that matches the committed render, while keeping the wrapper's referential identity stable across re-renders.

This is an internal correctness fix for `useReconnect`, `useWebSocket`, `useEventSource`, and `useHeartbeat` (all of which call `useStableCallback`); no public API or hook return shape changes.
