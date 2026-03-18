---
"react-realtime-hooks": patch
---

Treat parseMessage failures as terminal transport errors by closing the current WebSocket or EventSource connection, stopping auto-reconnect, and requiring an explicit open() or reconnect() to recover.
