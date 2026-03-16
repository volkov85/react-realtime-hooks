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
- GitHub Actions quality gate

## Scripts

```bash
npm run build
npm run demo:build
npm run lint
npm run typecheck
npm run test
npm run publint
```

## CI

GitHub Actions runs the quality gate on pushes to `main`, feature branches, and pull requests into `main`.

Checks:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run demo:build`
- `npm run publint`
