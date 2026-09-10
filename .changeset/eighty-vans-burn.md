---
"react-realtime-hooks": patch
---

Fix WebSocket and EventSource listeners being removed after reconnects, preventing restored connections from receiving messages and transport events. Preserve listeners across reconnect state changes and clean them up when transports close, are replaced, or hooks unmount.
