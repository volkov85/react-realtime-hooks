---
"react-realtime-hooks": patch
---

Ignore stale WebSocket events from replaced connections to prevent old sockets from corrupting the current hook state during reconnects or transport reconfiguration.
