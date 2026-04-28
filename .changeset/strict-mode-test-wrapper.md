---
"react-realtime-hooks": patch
---

Wrap every render in the hook test suite in `<React.StrictMode>` via Testing Library's `configure({ reactStrictMode: true })`. Strict Mode double-invokes component bodies and runs effects mount → unmount → mount in dev, which is the most reliable automated way to surface cleanup leaks, write-during-render anti-patterns, and stale-closure bugs in custom hooks.

This is a test-only change — no public API or runtime behavior is affected. `useWebSocket` and `useEventSource` are temporarily opted out of Strict Mode in their test files because they don't yet debounce transport creation across the Strict Mode mount cycle (audit Issue 6, scheduled for a follow-up PR).
