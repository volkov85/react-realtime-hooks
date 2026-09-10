---
"react-realtime-hooks": patch
---

Keep WebSocket and EventSource listeners attached across reconnect state changes so restored connections continue receiving messages and transport events. Remove listeners when the transport closes, is replaced, or the hook unmounts, while preserving pending WebSocket close callbacks.
