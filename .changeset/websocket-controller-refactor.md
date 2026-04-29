---
"react-realtime-hooks": patch
---

Refactor the `useWebSocket` control plane: consolidate the six interacting mutable booleans/refs that used to live directly inside the hook (`manualCloseRef`, `manualOpenRef`, `suppressReconnectRef`, `skipCloseReconnectRef`, `pendingCloseActionRef`, `terminalErrorRef`) into a single `useWebSocketController` hook stored in one `useRef`. Each lifecycle event (`open()`, `close()`, `reconnect()`, `handleOpen`, `handleClose`, the parse-error path, the heartbeat-action paths, the deps-effect cleanup) now goes through a named transition method on the controller instead of mutating several refs in sequence.

Pure refactor: behaviour is identical, all 105 existing tests pass unchanged, and 13 new focused unit tests pin the controller's transition rules so any future regression in the control flow is loud. No public API changes.
