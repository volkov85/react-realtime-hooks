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

export interface UseWebSocketOptions<TIncoming = unknown, TOutgoing = TIncoming> {
  url: UrlProvider;
  protocols?: string | string[];
  connect?: boolean;
  binaryType?: BinaryType;
  parseMessage?: MessageParser<TIncoming>;
  serializeMessage?: MessageSerializer<TOutgoing>;
  reconnect?: false | UseReconnectOptions;
  heartbeat?: false | UseHeartbeatOptions<TOutgoing, TIncoming>;
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
