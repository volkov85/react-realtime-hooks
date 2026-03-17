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

type ConnectionStateSnapshotBase = {
  isSupported: boolean;
  lastChangedAt: number | null;
};

export type ConnectionStateSnapshot =
  | (ConnectionStateSnapshotBase & {
      isClosed: false;
      isConnected: true;
      isConnecting: false;
      status: "open";
    })
  | (ConnectionStateSnapshotBase & {
      isClosed: false;
      isConnected: false;
      isConnecting: true;
      status: "connecting" | "reconnecting";
    })
  | (ConnectionStateSnapshotBase & {
      isClosed: false;
      isConnected: false;
      isConnecting: false;
      status: "closing";
    })
  | (ConnectionStateSnapshotBase & {
      isClosed: true;
      isConnected: false;
      isConnecting: false;
      status: "idle" | "closed" | "error";
    });

export type MessageParser<TMessage> = (event: MessageEvent<unknown>) => TMessage;

export type MessageSerializer<TMessage> = (
  message: TMessage
) => string | ArrayBufferLike | Blob | ArrayBufferView;
