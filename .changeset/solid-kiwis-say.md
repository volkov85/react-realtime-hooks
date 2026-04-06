---
"react-realtime-hooks": minor
---

Add useConnectionGate, a new core hook that combines browser online state and page visibility into a single connect flag for useWebSocket and useEventSource. It supports hidden-tab grace periods, exposes a deterministic gate reason, and includes transition timestamps for ready/blocked state changes. README and demo were updated to cover the new hook.
