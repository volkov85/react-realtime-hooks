import type {
  ConnectionStateSnapshot,
  MessageParser,
  RealtimeTransport,
  UrlProvider
} from "./common";
import type { UseReconnectOptions, UseReconnectResult } from "./useReconnect";

export interface UseEventSourceOptions<TMessage = unknown> {
  url: UrlProvider;
  withCredentials?: boolean;
  connect?: boolean;
  events?: readonly string[];
  parseMessage?: MessageParser<TMessage>;
  reconnect?: false | UseReconnectOptions;
  shouldReconnect?: (event: Event | undefined) => boolean;
  onOpen?: (event: Event, source: EventSource) => void;
  onMessage?: (message: TMessage, event: MessageEvent<string>) => void;
  onError?: (event: Event) => void;
  onEvent?: (
    eventName: string,
    message: TMessage,
    event: MessageEvent<string>
  ) => void;
}

type UseEventSourceResultBase<TMessage> = {
  transport: Extract<RealtimeTransport, "eventsource">;
  lastEventName: string | null;
  lastMessage: TMessage | null;
  lastMessageEvent: MessageEvent<string> | null;
  lastError: Event | null;
  reconnectState: Pick<
    UseReconnectResult,
    "status" | "attempt" | "nextDelayMs" | "isScheduled"
  > | null;
  open: () => void;
  close: () => void;
  reconnect: () => void;
};

export type UseEventSourceResult<TMessage = unknown> =
  | (UseEventSourceResultBase<TMessage> &
      Extract<ConnectionStateSnapshot, { status: "open" }> & {
        eventSource: EventSource;
      })
  | (UseEventSourceResultBase<TMessage> &
      Extract<ConnectionStateSnapshot, { status: "connecting" | "reconnecting" }> & {
        eventSource: EventSource | null;
      })
  | (UseEventSourceResultBase<TMessage> &
      Extract<ConnectionStateSnapshot, { status: "closing" }> & {
        eventSource: EventSource | null;
      })
  | (UseEventSourceResultBase<TMessage> &
      Extract<ConnectionStateSnapshot, { status: "idle" | "closed" | "error" }> & {
        eventSource: EventSource | null;
      });

export type UseEventSourceHook = <TMessage = unknown>(
  options: UseEventSourceOptions<TMessage>
) => UseEventSourceResult<TMessage>;
