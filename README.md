# react-realtime-hooks

React hooks for WebSocket, SSE, reconnect, heartbeat, and online status.

## Status

The repository is currently bootstrapped as a TypeScript-first npm library.
Hook implementations will be added incrementally:

- `useOnlineStatus`
- `useReconnect`
- `useHeartbeat`
- `useWebSocket`
- `useEventSource`

## Tooling

- TypeScript
- tsup
- Vitest
- ESLint (flat config)
- Changesets

## Scripts

```bash
npm run build
npm run lint
npm run typecheck
npm run test
npm run publint
```
