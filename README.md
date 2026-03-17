# react-realtime-hooks

[![npm version](https://img.shields.io/npm/v/react-realtime-hooks?color=0f766e)](https://www.npmjs.com/package/react-realtime-hooks)
[![Quality Gate](https://img.shields.io/github/actions/workflow/status/volkov85/react-realtime-hooks/quality-gate.yml?branch=main&label=quality%20gate)](https://github.com/volkov85/react-realtime-hooks/actions/workflows/quality-gate.yml)
[![Demo](https://img.shields.io/github/actions/workflow/status/volkov85/react-realtime-hooks/pages.yml?branch=main&label=demo)](https://github.com/volkov85/react-realtime-hooks/actions/workflows/pages.yml)
[![license](https://img.shields.io/npm/l/react-realtime-hooks)](https://github.com/volkov85/react-realtime-hooks/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-typed-3178c6)](https://www.typescriptlang.org/)
[![react](https://img.shields.io/badge/react-18.3%2B%20%7C%2019-149eca)](https://www.npmjs.com/package/react)

Production-ready React hooks for WebSocket and SSE with auto-reconnect, heartbeat, typed connection state, and browser network awareness.

`react-realtime-hooks` is for apps that need more than "open a socket and hope for the best". It gives you composable hooks for transport lifecycle, retry strategy, heartbeat, and online status, so your UI can react to realtime state without rebuilding the same connection logic in every screen.

Live demo: https://volkov85.github.io/react-realtime-hooks/

## Why This Library

Most realtime helpers stop at transport setup.

Real apps need:

- explicit `connecting` / `reconnecting` / `closed` / `error` states
- reconnect strategy with caps, jitter, and manual control
- heartbeat and timeout tracking
- clean SSR behavior
- browser network awareness
- typed message parsing and sending

`react-realtime-hooks` packages those concerns into small hooks that compose cleanly in React.

## Killer Features

- `useWebSocket` and `useEventSource` return state you can render, not just transport instances.
- Built-in reconnect flow with exponential backoff, jitter, attempt limits, and manual restart.
- Heartbeat support with ack matching, timeout detection, and latency measurement.
- Discriminated connection snapshots: `idle`, `connecting`, `open`, `reconnecting`, `closing`, `closed`, `error`.
- First-class TypeScript support with generic message types and custom parsers/serializers.
- SSR-safe by default. No browser-only globals are touched during server render.
- Zero runtime dependencies beyond React.
- Manual controls stay available when you need them: `open()`, `close()`, `reconnect()`, `send()`.

## Raw WebSocket vs This Library

| Concern           | Raw WebSocket                      | `react-realtime-hooks`                           |
| ----------------- | ---------------------------------- | ------------------------------------------------ |
| Connection state  | You model it yourself              | Built-in status model you can render directly    |
| Reconnect flow    | Manual timers and teardown         | `useReconnect` with backoff, jitter, and limits  |
| Heartbeat         | Custom ping/pong loop              | `heartbeat` support with timeout and latency     |
| Network awareness | Separate browser event wiring      | `useOnlineStatus` for online/offline state       |
| SSR safety        | Easy to break during render        | Browser-only behavior stays out of server render |
| UI ergonomics     | Event handlers and refs everywhere | Hook result already shaped for product UI        |

The point is not to hide WebSocket. The point is to stop rewriting the same lifecycle machinery around it.

## Install

```bash
npm install react-realtime-hooks
```

Peer dependency:

- `react@^18.3.0 || ^19.0.0`

## How It Feels

```tsx
import { useOnlineStatus, useWebSocket } from "react-realtime-hooks";

type IncomingMessage =
  | { type: "notification"; text: string }
  | { type: "pong" };

type OutgoingMessage = { type: "ack"; id: string } | { type: "ping" };

export function NotificationsPanel() {
  const network = useOnlineStatus();
  const socket = useWebSocket<IncomingMessage, OutgoingMessage>({
    url: "ws://localhost:8080/notifications",
    parseMessage: (event) => JSON.parse(String(event.data)) as IncomingMessage,
    reconnect: {
      initialDelayMs: 1_000,
      maxAttempts: null,
    },
    heartbeat: {
      intervalMs: 10_000,
      timeoutMs: 3_000,
      message: { type: "ping" },
      matchesAck: (message) => message.type === "pong",
    },
  });

  return (
    <section>
      <p>
        Network: {network.isOnline ? "online" : "offline"} | Transport:{" "}
        {socket.status}
      </p>

      {socket.status === "reconnecting" && (
        <p>Retrying in {socket.reconnectState?.nextDelayMs ?? 0}ms</p>
      )}

      {socket.heartbeatState?.hasTimedOut && <p>Heartbeat timed out</p>}

      <button
        disabled={socket.status !== "open"}
        onClick={() => socket.send({ type: "ack", id: "msg-42" })}
      >
        Ack latest
      </button>

      <pre>{JSON.stringify(socket.lastMessage, null, 2)}</pre>
    </section>
  );
}
```

You are not wiring raw `onopen`, `onclose`, and timer cleanup by hand. You render the current transport state and keep moving.

## Status-First UX

The transport hooks return a discriminated status model, so UI states stay explicit instead of collapsing into a vague `isConnected` boolean.

- `idle`: auto-connect is off and nothing is opening
- `connecting`: first connection attempt is in progress
- `open`: transport is live
- `reconnecting`: retry flow is active
- `closing`: explicit close is in progress
- `closed`: transport is stopped and will not continue
- `error`: an unrecoverable parse/runtime error occurred

That makes product UI straightforward:

- show a retry banner on `reconnecting`
- disable send buttons unless `status === "open"`
- show offline or degraded indicators without guessing
- surface heartbeat timeout separately from transport close

## Architecture Idea

This library is built as layered primitives, not one giant "magic realtime client".

```text
Browser APIs
  WebSocket / EventSource / navigator.onLine

Core hooks
  useReconnect / useHeartbeat / useOnlineStatus

Transport hooks
  useWebSocket / useEventSource

UI
  banners, badges, retry states, feed views, chat inputs
```

That separation matters:

- you can use `useReconnect` and `useHeartbeat` outside the transport hooks
- transport hooks stay predictable instead of hiding lifecycle decisions
- the UI gets a stable state model instead of raw event listeners

## Real-World Use Cases

- Chat and support widgets that need reconnect and delivery-aware UI
- Notification centers and activity feeds over WebSocket
- Live dashboards and ops consoles consuming SSE streams
- Trading, analytics, and monitoring UIs with explicit connection states
- Device and IoT panels that need heartbeat and timeout visibility
- Collaborative tools that must reflect degraded or reconnecting transport state

## Anti-Features

This package is intentionally not trying to be a full client platform.

- No bundled transport polyfills
- No opinionated server protocol
- No hidden global singleton connection manager
- No built-in auth refresh flow
- No state management framework or cache layer
- No "smart" abstractions that erase transport state details

If you need a predictable hook layer for realtime UI, that is the point. If you need a full messaging platform, this is a lower-level building block.

## Why Not Write It Yourself?

Because "just a socket hook" turns into more work than it looks like:

- reconnect timers need careful cleanup and manual-close semantics
- heartbeat loops need ack matching, timeout handling, and teardown discipline
- URL changes and remounts create subtle race conditions
- SSR breaks if browser globals leak into render
- a single `isOpen` flag is not enough for real UI states
- parse failures and transport errors need consistent state transitions

This library already models those edges in a reusable way.

## API At A Glance

| Hook              | Use it for                           | Returns                                                                      |
| ----------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `useWebSocket`    | Bidirectional realtime channels      | `status`, `socket`, `lastMessage`, `send()`, `reconnect()`, `heartbeatState` |
| `useEventSource`  | Server-Sent Events streams           | `status`, `eventSource`, `lastMessage`, `lastEventName`, `reconnect()`       |
| `useReconnect`    | Reusable retry and backoff logic     | `schedule()`, `cancel()`, `reset()`, `attempt`, `status`                     |
| `useHeartbeat`    | Liveness checks and timeout tracking | `start()`, `stop()`, `beat()`, `notifyAck()`, `latencyMs`                    |
| `useOnlineStatus` | Browser online/offline state         | `isOnline`, `isSupported`, transition timestamps                             |

## Transport Examples

### `useWebSocket`

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

export function ChatSocket() {
  const socket = useWebSocket<IncomingMessage, OutgoingMessage>({
    url: "ws://localhost:8080",
    parseMessage: (event) => JSON.parse(String(event.data)) as IncomingMessage,
    reconnect: {
      initialDelayMs: 1_000,
      maxAttempts: null,
    },
    heartbeat: {
      intervalMs: 10_000,
      timeoutMs: 3_000,
      message: { type: "ping" },
      matchesAck: (message) =>
        message.type === "system" && message.text === "pong",
    },
  });

  return (
    <button onClick={() => socket.send({ type: "chat", text: "Hello" })}>
      Send
    </button>
  );
}
```

### `useEventSource`

```tsx
import { useEventSource } from "react-realtime-hooks";

type FeedItem = {
  id: string;
  level: "info" | "warn";
  text: string;
};

export function LiveFeed() {
  const feed = useEventSource<FeedItem>({
    url: "http://localhost:8080/sse",
    events: ["notice"],
    parseMessage: (event) => JSON.parse(event.data) as FeedItem,
    reconnect: {
      initialDelayMs: 1_000,
      maxAttempts: 10,
    },
  });

  return (
    <div>
      {feed.lastEventName}: {feed.lastMessage?.text ?? "Waiting for updates"}
    </div>
  );
}
```

## Core Hook Examples

### `useReconnect`

```tsx
import { useReconnect } from "react-realtime-hooks";

export function RetryPanel() {
  const reconnect = useReconnect({
    initialDelayMs: 1_000,
    maxAttempts: 5,
    jitterRatio: 0,
  });

  return (
    <button onClick={() => reconnect.schedule("manual")}>Retry now</button>
  );
}
```

### `useHeartbeat`

```tsx
import { useHeartbeat } from "react-realtime-hooks";

export function HeartbeatPanel() {
  const heartbeat = useHeartbeat<string, string>({
    intervalMs: 5_000,
    timeoutMs: 2_000,
    startOnMount: true,
    matchesAck: (message) => message === "pong",
  });

  return (
    <div>
      running: {String(heartbeat.isRunning)} | latency:{" "}
      {heartbeat.latencyMs ?? "n/a"}
    </div>
  );
}
```

### `useOnlineStatus`

```tsx
import { useOnlineStatus } from "react-realtime-hooks";

export function NetworkIndicator() {
  const network = useOnlineStatus({
    trackTransitions: true,
  });

  return <span>{network.isOnline ? "Online" : "Offline"}</span>;
}
```

## API Reference

<details>
<summary><strong>useWebSocket</strong></summary>

### Options

| Option             | Type                           | Default                    | Description                        |
| ------------------ | ------------------------------ | -------------------------- | ---------------------------------- |
| `url`              | `UrlProvider`                  | Required                   | String, `URL`, or lazy URL factory |
| `protocols`        | `string \| string[]`           | `undefined`                | WebSocket subprotocols             |
| `connect`          | `boolean`                      | `true`                     | Auto-connect on mount              |
| `binaryType`       | `BinaryType`                   | `"blob"`                   | Socket binary mode                 |
| `parseMessage`     | `(event) => TIncoming`         | raw `event.data`           | Incoming parser                    |
| `serializeMessage` | `(message) => ...`             | JSON/string passthrough    | Outgoing serializer                |
| `reconnect`        | `false \| UseReconnectOptions` | enabled                    | Reconnect configuration            |
| `heartbeat`        | `false \| UseHeartbeatOptions` | disabled unless configured | Heartbeat configuration            |
| `shouldReconnect`  | `(event) => boolean`           | `true`                     | Reconnect gate on close            |
| `onOpen`           | `(event, socket) => void`      | `undefined`                | Open callback                      |
| `onMessage`        | `(message, event) => void`     | `undefined`                | Message callback                   |
| `onError`          | `(event) => void`              | `undefined`                | Error callback                     |
| `onClose`          | `(event) => void`              | `undefined`                | Close callback                     |

### Result

| Field              | Type                         | Description                                                                |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------- |
| `status`           | connection union             | `idle`, `connecting`, `open`, `closing`, `closed`, `reconnecting`, `error` |
| `socket`           | `WebSocket \| null`          | Current transport instance                                                 |
| `lastMessage`      | `TIncoming \| null`          | Last parsed message                                                        |
| `lastMessageEvent` | `MessageEvent \| null`       | Last raw message event                                                     |
| `lastCloseEvent`   | `CloseEvent \| null`         | Last close event                                                           |
| `lastError`        | `Event \| null`              | Last error                                                                 |
| `bufferedAmount`   | `number`                     | Current socket buffer size                                                 |
| `reconnectState`   | reconnect snapshot or `null` | Current reconnect data                                                     |
| `heartbeatState`   | heartbeat snapshot or `null` | Current heartbeat data                                                     |
| `open`             | `() => void`                 | Manual connect                                                             |
| `close`            | `(code?, reason?) => void`   | Manual close                                                               |
| `reconnect`        | `() => void`                 | Manual reconnect                                                           |
| `send`             | `(message) => boolean`       | Sends an outgoing payload                                                  |

</details>

<details>
<summary><strong>useEventSource</strong></summary>

### Options

| Option            | Type                                  | Default          | Description                         |
| ----------------- | ------------------------------------- | ---------------- | ----------------------------------- |
| `url`             | `UrlProvider`                         | Required         | String, `URL`, or lazy URL factory  |
| `withCredentials` | `boolean`                             | `false`          | Passes credentials to `EventSource` |
| `connect`         | `boolean`                             | `true`           | Auto-connect on mount               |
| `events`          | `readonly string[]`                   | `undefined`      | Named SSE events to subscribe to    |
| `parseMessage`    | `(event) => TMessage`                 | raw `event.data` | Incoming parser                     |
| `reconnect`       | `false \| UseReconnectOptions`        | enabled          | Reconnect configuration             |
| `shouldReconnect` | `(event) => boolean`                  | `true`           | Reconnect gate on error             |
| `onOpen`          | `(event, source) => void`             | `undefined`      | Open callback                       |
| `onMessage`       | `(message, event) => void`            | `undefined`      | Default `message` callback          |
| `onError`         | `(event) => void`                     | `undefined`      | Error callback                      |
| `onEvent`         | `(eventName, message, event) => void` | `undefined`      | Named event callback                |

### Result

| Field              | Type                         | Description                                                                |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------- |
| `status`           | connection union             | `idle`, `connecting`, `open`, `closing`, `closed`, `reconnecting`, `error` |
| `eventSource`      | `EventSource \| null`        | Current transport instance                                                 |
| `lastEventName`    | `string \| null`             | Last SSE event name                                                        |
| `lastMessage`      | `TMessage \| null`           | Last parsed payload                                                        |
| `lastMessageEvent` | `MessageEvent \| null`       | Last raw message event                                                     |
| `lastError`        | `Event \| null`              | Last error                                                                 |
| `reconnectState`   | reconnect snapshot or `null` | Current reconnect data                                                     |
| `open`             | `() => void`                 | Manual connect                                                             |
| `close`            | `() => void`                 | Manual close                                                               |
| `reconnect`        | `() => void`                 | Manual reconnect                                                           |

</details>

<details>
<summary><strong>useReconnect</strong></summary>

### Options

| Option           | Type                     | Default     | Description                          |
| ---------------- | ------------------------ | ----------- | ------------------------------------ |
| `enabled`        | `boolean`                | `true`      | Enables scheduling attempts          |
| `initialDelayMs` | `number`                 | `1000`      | Delay for the first attempt          |
| `maxDelayMs`     | `number`                 | `30000`     | Delay cap                            |
| `backoffFactor`  | `number`                 | `2`         | Exponential multiplier               |
| `jitterRatio`    | `number`                 | `0.2`       | Randomized variance ratio            |
| `maxAttempts`    | `number \| null`         | `null`      | Max attempts, `null` means unlimited |
| `getDelayMs`     | `ReconnectDelayStrategy` | `undefined` | Custom delay strategy                |
| `resetOnSuccess` | `boolean`                | `true`      | Resets attempt count after success   |
| `onSchedule`     | `(attempt) => void`      | `undefined` | Called when an attempt is scheduled  |
| `onCancel`       | `() => void`             | `undefined` | Called when scheduling is canceled   |
| `onReset`        | `() => void`             | `undefined` | Called when state is reset           |

### Result

| Field           | Type                                              | Description                              |
| --------------- | ------------------------------------------------- | ---------------------------------------- |
| `status`        | `"idle" \| "scheduled" \| "running" \| "stopped"` | Current reconnect state                  |
| `attempt`       | `number`                                          | Current attempt number                   |
| `nextDelayMs`   | `number \| null`                                  | Delay of the scheduled attempt           |
| `isActive`      | `boolean`                                         | `true` when scheduled or running         |
| `isScheduled`   | `boolean`                                         | `true` when waiting for the next attempt |
| `schedule`      | `(trigger?) => void`                              | Schedules an attempt                     |
| `cancel`        | `() => void`                                      | Cancels the current schedule             |
| `reset`         | `() => void`                                      | Resets attempts and status               |
| `markConnected` | `() => void`                                      | Marks the transport as restored          |

</details>

<details>
<summary><strong>useHeartbeat</strong></summary>

### Options

| Option         | Type                                                | Default     | Description                                 |
| -------------- | --------------------------------------------------- | ----------- | ------------------------------------------- |
| `enabled`      | `boolean`                                           | `true`      | Enables the heartbeat loop                  |
| `intervalMs`   | `number`                                            | Required    | Beat interval                               |
| `timeoutMs`    | `number`                                            | `undefined` | Timeout before `hasTimedOut` becomes `true` |
| `message`      | `TOutgoing \| (() => TOutgoing)`                    | `undefined` | Optional heartbeat payload                  |
| `beat`         | `() => void \| boolean \| Promise<void \| boolean>` | `undefined` | Custom beat side effect                     |
| `matchesAck`   | `(message) => boolean`                              | `undefined` | Ack matcher                                 |
| `startOnMount` | `boolean`                                           | `true`      | Starts immediately                          |
| `onBeat`       | `() => void`                                        | `undefined` | Called on every beat                        |
| `onTimeout`    | `() => void`                                        | `undefined` | Called on timeout                           |

### Result

| Field         | Type                   | Description                       |
| ------------- | ---------------------- | --------------------------------- |
| `isRunning`   | `boolean`              | Whether the loop is active        |
| `hasTimedOut` | `boolean`              | Whether the latest beat timed out |
| `lastBeatAt`  | `number \| null`       | Last beat timestamp               |
| `lastAckAt`   | `number \| null`       | Last ack timestamp                |
| `latencyMs`   | `number \| null`       | Ack latency                       |
| `start`       | `() => void`           | Starts the loop                   |
| `stop`        | `() => void`           | Stops the loop                    |
| `beat`        | `() => void`           | Triggers a manual beat            |
| `notifyAck`   | `(message) => boolean` | Applies an incoming ack message   |

</details>

<details>
<summary><strong>useOnlineStatus</strong></summary>

### Options

| Option             | Type      | Default | Description                                             |
| ------------------ | --------- | ------- | ------------------------------------------------------- |
| `initialOnline`    | `boolean` | `true`  | Fallback value when `navigator.onLine` is unavailable   |
| `trackTransitions` | `boolean` | `true`  | Tracks `lastChangedAt`, `wentOnlineAt`, `wentOfflineAt` |

### Result

| Field           | Type             | Description                              |
| --------------- | ---------------- | ---------------------------------------- |
| `isOnline`      | `boolean`        | Current browser online state             |
| `isSupported`   | `boolean`        | Whether `navigator.onLine` is available  |
| `lastChangedAt` | `number \| null` | Timestamp of the last transition         |
| `wentOnlineAt`  | `number \| null` | Timestamp of the last online transition  |
| `wentOfflineAt` | `number \| null` | Timestamp of the last offline transition |

</details>

## Limitations And Edge Cases

- `useEventSource` is receive-only by design. SSE is not a bidirectional transport.
- `useWebSocket` heartbeat support is client-side. You still define your own server ping/pong protocol.
- If `parseMessage` throws, the hook moves into `error` and stores `lastError`.
- `connect: false` keeps the hook in `idle` until `open()` is called.
- Manual `close()` is sticky. The hook stays closed until `open()` or `reconnect()` is called.
- No transport polyfills are bundled. Provide your own runtime support where needed.
- Browser-native transport constraints still apply: auth, proxy, CORS, and network policy are outside the hook's control.

## Testing And Quality

The package includes behavior tests for:

- connect / disconnect / reconnect
- exponential backoff
- timer and listener cleanup
- heartbeat start / stop / timeout
- browser offline / online transitions
- invalid payload and parse errors
- manual reconnect and manual close

`WebSocket` and `EventSource` are tested through mocked browser APIs.

## Demo

- Live demo: https://volkov85.github.io/react-realtime-hooks/
- Repository: https://github.com/volkov85/react-realtime-hooks

Run the local playground:

```bash
npm run demo
```

## Contributing

Development and release workflow live in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
