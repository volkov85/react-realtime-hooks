# react-realtime-hooks

Typed React hooks for realtime client state: WebSocket, SSE, reconnect, heartbeat, and online status.

`react-realtime-hooks` is built for apps that need transport state, retry strategy, and browser network signals without rewriting the same connection lifecycle in every component.

## Why This Package

- Realtime hooks usually stop at "open a socket". This package also models reconnect flow, heartbeat flow, browser online state, and transport snapshots.
- TypeScript support is first-class: generic payload types, custom parsers/serializers, and discriminated connection states.
- It is SSR-safe by default. The hooks avoid touching browser-only globals during server render.
- The package has no runtime dependencies beyond React.
- The repo is set up like a library product, not just a demo: tests, CI, publint, Changesets, and a demo app.

## Features

- `useWebSocket`
- `useEventSource`
- `useReconnect`
- `useHeartbeat`
- `useOnlineStatus`
- Type-safe connection snapshots
- Reconnect/backoff helpers
- Browser API mocks in tests
- Demo app for manual verification

## Install

```bash
npm install react-realtime-hooks
```

Peer dependency:

- `react@^18.3.0 || ^19.0.0`

## Quick Start

```tsx
import { useWebSocket } from "react-realtime-hooks";

export const Notifications = () => {
  const socket = useWebSocket<{ type: string; message: string }>({
    url: "ws://localhost:8080",
    reconnect: {
      initialDelayMs: 1_000,
      maxAttempts: 5
    }
  });

  if (socket.status === "open") {
    return <div>{socket.lastMessage?.message ?? "Connected"}</div>;
  }

  return <div>{socket.status}</div>;
};
```

## Examples

### useOnlineStatus

```tsx
import { useOnlineStatus } from "react-realtime-hooks";

export const NetworkIndicator = () => {
  const network = useOnlineStatus({
    trackTransitions: true
  });

  return (
    <span>
      {network.isOnline ? "Online" : "Offline"}
    </span>
  );
};
```

### useReconnect

```tsx
import { useReconnect } from "react-realtime-hooks";

export const RetryPanel = () => {
  const reconnect = useReconnect({
    initialDelayMs: 1_000,
    maxAttempts: 5,
    jitterRatio: 0
  });

  return (
    <button onClick={() => reconnect.schedule("manual")}>
      Retry now
    </button>
  );
};
```

### useHeartbeat

```tsx
import { useHeartbeat } from "react-realtime-hooks";

export const HeartbeatPanel = () => {
  const heartbeat = useHeartbeat<string, string>({
    intervalMs: 5_000,
    matchesAck: (message) => message === "pong",
    startOnMount: true,
    timeoutMs: 2_000
  });

  return (
    <div>
      running: {String(heartbeat.isRunning)} | latency: {heartbeat.latencyMs ?? "n/a"}
    </div>
  );
};
```

### useWebSocket

```tsx
import { useWebSocket } from "react-realtime-hooks";

type IncomingMessage = {
  type: "chat" | "system";
  text: string;
};

type OutgoingMessage = {
  type: "ping" | "chat";
  text?: string;
};

export const ChatSocket = () => {
  const socket = useWebSocket<IncomingMessage, OutgoingMessage>({
    url: "ws://localhost:8080",
    heartbeat: {
      intervalMs: 10_000,
      matchesAck: (message) => message.type === "system" && message.text === "pong",
      message: { type: "ping" },
      timeoutMs: 3_000
    },
    parseMessage: (event) => JSON.parse(String(event.data)) as IncomingMessage,
    reconnect: {
      initialDelayMs: 1_000,
      maxAttempts: null
    }
  });

  return (
    <button onClick={() => socket.send({ text: "Hello", type: "chat" })}>
      Send
    </button>
  );
};
```

### useEventSource

```tsx
import { useEventSource } from "react-realtime-hooks";

type FeedItem = {
  id: string;
  level: "info" | "warn";
  text: string;
};

export const LiveFeed = () => {
  const feed = useEventSource<FeedItem>({
    events: ["notice"],
    parseMessage: (event) => JSON.parse(event.data) as FeedItem,
    reconnect: {
      initialDelayMs: 1_000,
      maxAttempts: 10
    },
    url: "http://localhost:8080/sse"
  });

  return (
    <div>
      {feed.lastEventName}: {feed.lastMessage?.text ?? "Waiting for updates"}
    </div>
  );
};
```

## API

### useOnlineStatus

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `initialOnline` | `boolean` | `true` | Fallback value when `navigator.onLine` is unavailable |
| `trackTransitions` | `boolean` | `true` | Tracks `lastChangedAt`, `wentOnlineAt`, `wentOfflineAt` |

#### Result

| Field | Type | Description |
| --- | --- | --- |
| `isOnline` | `boolean` | Current browser online state |
| `isSupported` | `boolean` | Whether `navigator.onLine` is available |
| `lastChangedAt` | `number \| null` | Timestamp of the last transition |
| `wentOnlineAt` | `number \| null` | Timestamp of the last online transition |
| `wentOfflineAt` | `number \| null` | Timestamp of the last offline transition |

### useReconnect

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Enables scheduling attempts |
| `initialDelayMs` | `number` | `1000` | Delay for the first attempt |
| `maxDelayMs` | `number` | `30000` | Delay cap |
| `backoffFactor` | `number` | `2` | Exponential multiplier |
| `jitterRatio` | `number` | `0.2` | Randomized variance ratio |
| `maxAttempts` | `number \| null` | `null` | Max attempts, `null` means unlimited |
| `getDelayMs` | `ReconnectDelayStrategy` | `undefined` | Custom delay strategy |
| `resetOnSuccess` | `boolean` | `true` | Resets attempt count after success |
| `onSchedule` | `(attempt) => void` | `undefined` | Called when an attempt is scheduled |
| `onCancel` | `() => void` | `undefined` | Called when scheduling is canceled |
| `onReset` | `() => void` | `undefined` | Called when state is reset |

#### Result

| Field | Type | Description |
| --- | --- | --- |
| `status` | `"idle" \| "scheduled" \| "running" \| "stopped"` | Current reconnect state |
| `attempt` | `number` | Current attempt number |
| `nextDelayMs` | `number \| null` | Delay of the scheduled attempt |
| `isActive` | `boolean` | `true` when scheduled or running |
| `isScheduled` | `boolean` | `true` when waiting for the next attempt |
| `schedule` | `(trigger?) => void` | Schedules an attempt |
| `cancel` | `() => void` | Cancels the current schedule |
| `reset` | `() => void` | Resets attempts and status |
| `markConnected` | `() => void` | Marks the transport as restored |

### useHeartbeat

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Enables the heartbeat loop |
| `intervalMs` | `number` | Required | Beat interval |
| `timeoutMs` | `number` | `undefined` | Timeout before `hasTimedOut` becomes `true` |
| `message` | `TOutgoing \| (() => TOutgoing)` | `undefined` | Optional heartbeat payload |
| `beat` | `() => void \| boolean \| Promise<void \| boolean>` | `undefined` | Custom beat side effect |
| `matchesAck` | `(message) => boolean` | `undefined` | Ack matcher |
| `startOnMount` | `boolean` | `true` | Starts immediately |
| `onBeat` | `() => void` | `undefined` | Called on every beat |
| `onTimeout` | `() => void` | `undefined` | Called on timeout |

#### Result

| Field | Type | Description |
| --- | --- | --- |
| `isRunning` | `boolean` | Whether the loop is active |
| `hasTimedOut` | `boolean` | Whether the latest beat timed out |
| `lastBeatAt` | `number \| null` | Last beat timestamp |
| `lastAckAt` | `number \| null` | Last ack timestamp |
| `latencyMs` | `number \| null` | Ack latency |
| `start` | `() => void` | Starts the loop |
| `stop` | `() => void` | Stops the loop |
| `beat` | `() => void` | Triggers a manual beat |
| `notifyAck` | `(message) => boolean` | Applies an incoming ack message |

### useWebSocket

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | `UrlProvider` | Required | String, `URL`, or lazy URL factory |
| `protocols` | `string \| string[]` | `undefined` | WebSocket subprotocols |
| `connect` | `boolean` | `true` | Auto-connect on mount |
| `binaryType` | `BinaryType` | `"blob"` | Socket binary mode |
| `parseMessage` | `(event) => TIncoming` | raw `event.data` | Incoming parser |
| `serializeMessage` | `(message) => ...` | JSON/string passthrough | Outgoing serializer |
| `reconnect` | `false \| UseReconnectOptions` | enabled | Reconnect configuration |
| `heartbeat` | `false \| UseHeartbeatOptions` | disabled unless configured | Heartbeat configuration |
| `shouldReconnect` | `(event) => boolean` | `true` | Reconnect gate on close |
| `onOpen` | `(event, socket) => void` | `undefined` | Open callback |
| `onMessage` | `(message, event) => void` | `undefined` | Message callback |
| `onError` | `(event) => void` | `undefined` | Error callback |
| `onClose` | `(event) => void` | `undefined` | Close callback |

#### Result

| Field | Type | Description |
| --- | --- | --- |
| `status` | connection union | `idle`, `connecting`, `open`, `closing`, `closed`, `reconnecting`, `error` |
| `socket` | `WebSocket \| null` | Current transport instance |
| `lastMessage` | `TIncoming \| null` | Last parsed message |
| `lastCloseEvent` | `CloseEvent \| null` | Last close event |
| `lastError` | `Event \| null` | Last error |
| `bufferedAmount` | `number` | Current socket buffer size |
| `reconnectState` | reconnect snapshot or `null` | Current reconnect data |
| `heartbeatState` | heartbeat snapshot or `null` | Current heartbeat data |
| `open` | `() => void` | Manual connect |
| `close` | `(code?, reason?) => void` | Manual close |
| `reconnect` | `() => void` | Manual reconnect |
| `send` | `(message) => boolean` | Sends an outgoing payload |

### useEventSource

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | `UrlProvider` | Required | String, `URL`, or lazy URL factory |
| `withCredentials` | `boolean` | `false` | Passes credentials to `EventSource` |
| `connect` | `boolean` | `true` | Auto-connect on mount |
| `events` | `readonly string[]` | `undefined` | Named SSE events to subscribe to |
| `parseMessage` | `(event) => TMessage` | raw `event.data` | Incoming parser |
| `reconnect` | `false \| UseReconnectOptions` | enabled | Reconnect configuration |
| `shouldReconnect` | `(event) => boolean` | `true` | Reconnect gate on error |
| `onOpen` | `(event, source) => void` | `undefined` | Open callback |
| `onMessage` | `(message, event) => void` | `undefined` | Default `message` callback |
| `onError` | `(event) => void` | `undefined` | Error callback |
| `onEvent` | `(eventName, message, event) => void` | `undefined` | Named event callback |

#### Result

| Field | Type | Description |
| --- | --- | --- |
| `status` | connection union | `idle`, `connecting`, `open`, `closing`, `closed`, `reconnecting`, `error` |
| `eventSource` | `EventSource \| null` | Current transport instance |
| `lastEventName` | `string \| null` | Last SSE event name |
| `lastMessage` | `TMessage \| null` | Last parsed payload |
| `lastError` | `Event \| null` | Last error |
| `reconnectState` | reconnect snapshot or `null` | Current reconnect data |
| `open` | `() => void` | Manual connect |
| `close` | `() => void` | Manual close |
| `reconnect` | `() => void` | Manual reconnect |

## Status Model

The transport hooks return discriminated connection snapshots:

- `open`: connected
- `connecting`: opening the first connection
- `reconnecting`: reconnect flow is in progress
- `closing`: explicit close is in progress
- `closed`: transport was explicitly closed or cannot continue
- `idle`: auto-connect is disabled and nothing is currently opening
- `error`: the hook encountered an unrecoverable parse/runtime error

## Limitations And Edge Cases

- `useEventSource` is receive-only by design. SSE is not a bidirectional transport.
- `useWebSocket` heartbeat logic is client-side. It does not define your server ping/pong protocol for you.
- If `parseMessage` throws, the hook moves into `error` and stores `lastError`.
- `connect: false` means the hook stays idle until `open()` is called.
- Manual `close()` is sticky: the hook stays closed until you call `open()` or `reconnect()`.
- On the server, transport hooks do not open real connections. They stay SSR-safe and connect only in the browser.
- Browser-native `WebSocket` and `EventSource` behavior still applies: proxy issues, auth constraints, and network policies are outside the hook’s control.
- `EventSource` named events are additive. The hook always listens to the default `message` channel.
- No transport polyfills are bundled. If you target unsupported environments, provide your own runtime/polyfill.

## Testing

The package includes behavior tests for:

- connect / disconnect / reconnect
- exponential backoff
- cleanup of timers and listeners
- heartbeat start / stop / timeout
- browser offline / online transitions
- invalid payload / parse errors
- manual reconnect / manual close

`WebSocket` and `EventSource` are tested through mocked browser APIs.

## Demo

Run the local playground:

```bash
npm run demo
```

The demo includes separate blocks for:

- `useOnlineStatus`
- `useReconnect`
- `useHeartbeat`
- `useWebSocket`
- `useEventSource`

## Development

Available scripts:

```bash
npm run build
npm run demo
npm run demo:build
npm run lint
npm run typecheck
npm run test
npm run publint
```

## Changelog And Releases

This repo uses Changesets for versioning, changelog generation, and npm publishing.

### Local workflow

Create a changeset for user-facing changes:

```bash
npm run changeset
```

Version packages locally:

```bash
npm run version-packages
```

Publish manually:

```bash
npm run release
```

### CI release workflow

- Feature work lands in `main`
- A Changesets release PR is created automatically
- When that PR is merged, Changesets publishes to npm
- Changelog entries are generated from the changeset summaries

Required GitHub secrets:

- `NPM_TOKEN`

## CI

Quality gate runs on pushes and pull requests:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run demo:build`
- `npm run publint`

## License

MIT
