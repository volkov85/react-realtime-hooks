export type RealtimeConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closing"
  | "closed"
  | "reconnecting"
  | "error";

export type RealtimeTransport = "websocket" | "eventsource";

export type Milliseconds = number;

export type UrlProvider = string | URL | (() => string | URL | null);

export interface ConnectionStateSnapshot {
  status: RealtimeConnectionStatus;
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isClosed: boolean;
  lastChangedAt: number | null;
}

export type MessageParser<TMessage> = (event: MessageEvent<unknown>) => TMessage;

export type MessageSerializer<TMessage> = (
  message: TMessage
) => string | ArrayBufferLike | Blob | ArrayBufferView;
