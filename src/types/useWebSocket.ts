import type {
  ConnectionStateSnapshot,
  MessageParser,
  MessageSerializer,
  RealtimeTransport,
  UrlProvider
} from "./common";
import type {
  UseHeartbeatOptions,
  UseHeartbeatResult
} from "./useHeartbeat";
import type { UseReconnectOptions, UseReconnectResult } from "./useReconnect";

export type WebSocketHeartbeatAction = "none" | "close" | "reconnect";

export interface UseWebSocketHeartbeatOptions<
  TOutgoing = unknown,
  TIncoming = TOutgoing
> extends UseHeartbeatOptions<TOutgoing, TIncoming> {
  timeoutAction?: WebSocketHeartbeatAction;
  errorAction?: WebSocketHeartbeatAction;
}

/**
 * Controls how the hook surfaces the live `WebSocket.bufferedAmount`
 * value through `state.bufferedAmount`.
 *
 * The native `WebSocket` does not emit any event when buffered bytes
 * drain to the network, so by default `state.bufferedAmount` is only
 * refreshed when the consumer calls `send(...)`, when a message
 * arrives, or when the socket transitions to `open`. For UIs that need
 * to display real-time backpressure (e.g. an outbound queue meter,
 * a "flushing..." indicator, or a flow-control gauge), enable polling.
 *
 * - `false` (default): no polling. `state.bufferedAmount` updates only
 *   on the natural lifecycle events listed above.
 * - `true`: poll once every 100ms while the socket is `open`.
 * - `"raf"`: poll on every animation frame while the socket is `open`.
 *   Recommended for visual gauges that are tied to a render loop.
 * - `{ intervalMs: N }`: poll every `N` milliseconds. `N` must be a
 *   positive integer; values <= 0 disable polling.
 *
 * Polling is automatically suspended when the socket is not in the
 * `open` state and resumed when it returns to `open`. The hook diffs
 * the polled value against the last committed one, so identical
 * readings do not trigger React re-renders.
 */
export type BufferedAmountPolling =
  | false
  | true
  | "raf"
  | { intervalMs: number };

export interface UseWebSocketOptions<TIncoming = unknown, TOutgoing = TIncoming> {
  url: UrlProvider;
  protocols?: string | string[];
  connect?: boolean;
  binaryType?: BinaryType;
  bufferedAmountPolling?: BufferedAmountPolling;
  parseMessage?: MessageParser<TIncoming>;
  serializeMessage?: MessageSerializer<TOutgoing>;
  reconnect?: false | UseReconnectOptions;
  heartbeat?: false | UseWebSocketHeartbeatOptions<TOutgoing, TIncoming>;
  shouldReconnect?: (event: CloseEvent | Event | undefined) => boolean;
  onOpen?: (event: Event, socket: WebSocket) => void;
  onMessage?: (message: TIncoming, event: MessageEvent<unknown>) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

type UseWebSocketResultBase<TIncoming, TOutgoing> = {
  transport: Extract<RealtimeTransport, "websocket">;
  lastMessage: TIncoming | null;
  lastMessageEvent: MessageEvent<unknown> | null;
  lastCloseEvent: CloseEvent | null;
  lastError: Event | null;
  bufferedAmount: number;
  reconnectState: Pick<
    UseReconnectResult,
    "status" | "attempt" | "nextDelayMs" | "isScheduled"
  > | null;
  heartbeatState: Pick<
    UseHeartbeatResult<TIncoming>,
    "isRunning" | "hasTimedOut" | "lastBeatAt" | "lastAckAt" | "latencyMs"
  > | null;
  open: () => void;
  close: (code?: number, reason?: string) => void;
  reconnect: () => void;
  send: (message: TOutgoing) => boolean;
};

export type UseWebSocketResult<
  TIncoming = unknown,
  TOutgoing = TIncoming
> =
  | (UseWebSocketResultBase<TIncoming, TOutgoing> &
      Extract<ConnectionStateSnapshot, { status: "open" }> & {
        socket: WebSocket;
      })
  | (UseWebSocketResultBase<TIncoming, TOutgoing> &
      Extract<ConnectionStateSnapshot, { status: "connecting" | "reconnecting" }> & {
        socket: WebSocket | null;
      })
  | (UseWebSocketResultBase<TIncoming, TOutgoing> &
      Extract<ConnectionStateSnapshot, { status: "closing" }> & {
        socket: WebSocket | null;
      })
  | (UseWebSocketResultBase<TIncoming, TOutgoing> &
      Extract<ConnectionStateSnapshot, { status: "idle" | "closed" | "error" }> & {
        socket: WebSocket | null;
      });

export type UseWebSocketHook = <TIncoming = unknown, TOutgoing = TIncoming>(
  options: UseWebSocketOptions<TIncoming, TOutgoing>
) => UseWebSocketResult<TIncoming, TOutgoing>;
