import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { createConnectionStateSnapshot } from "../core/connection-state";
import { isEventSourceSupported } from "../core/env";
import { resolveUrlProvider } from "../core/url";
import { useReconnect } from "./useReconnect";
import type {
  UseEventSourceHook,
  UseEventSourceOptions,
  UseEventSourceResult
} from "../types/useEventSource";

type EventSourceState<TMessage> = {
  lastChangedAt: number | null;
  lastError: Event | null;
  lastEventName: string | null;
  lastMessage: TMessage | null;
  lastMessageEvent: MessageEvent<string> | null;
  status: UseEventSourceResult<TMessage>["status"];
};

const createInitialState = <TMessage,>(
  status: UseEventSourceResult<TMessage>["status"] = "idle"
): EventSourceState<TMessage> => ({
  lastChangedAt: null,
  lastError: null,
  lastEventName: null,
  lastMessage: null,
  lastMessageEvent: null,
  status
});

const defaultParseMessage = <TMessage,>(
  event: MessageEvent<string>
): TMessage => event.data as TMessage;

const toEventsDependency = (events: readonly string[] | undefined): string => {
  if (events === undefined || events.length === 0) {
    return "";
  }

  return [...new Set(events)].sort().join("|");
};

const normalizeNamedEvents = (
  events: readonly string[] | undefined
): string[] => {
  if (events === undefined || events.length === 0) {
    return [];
  }

  return [...new Set(events)].filter((eventName) => eventName !== "message");
};

export const useEventSource: UseEventSourceHook = <TMessage = unknown>(
  options: UseEventSourceOptions<TMessage>
): UseEventSourceResult<TMessage> => {
  const connect = options.connect ?? true;
  const supported = isEventSourceSupported();
  const resolvedUrl = useMemo(() => resolveUrlProvider(options.url), [options.url]);
  const eventsDependency = toEventsDependency(options.events);
  const namedEvents = useMemo(
    () => normalizeNamedEvents(options.events),
    [eventsDependency]
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventSourceKeyRef = useRef<string | null>(null);
  const manualCloseRef = useRef(false);
  const manualOpenRef = useRef(false);
  const skipErrorReconnectRef = useRef(false);
  const suppressReconnectRef = useRef(false);
  const terminalErrorRef = useRef<Event | null>(null);
  const [openNonce, setOpenNonce] = useState(0);
  const [state, setState] = useState<EventSourceState<TMessage>>(() =>
    createInitialState(connect ? "connecting" : "idle")
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const reconnectEnabled =
    options.reconnect !== false && supported && resolvedUrl !== null;
  const reconnect = useReconnect(
    options.reconnect === false
      ? { enabled: false }
      : {
          ...options.reconnect,
          enabled: reconnectEnabled && (options.reconnect?.enabled ?? true)
        }
  );

  const commitState = (
    next:
      | EventSourceState<TMessage>
      | ((current: EventSourceState<TMessage>) => EventSourceState<TMessage>)
  ): void => {
    const resolved = typeof next === "function" ? next(stateRef.current) : next;
    stateRef.current = resolved;
    setState(resolved);
  };

  const closeEventSource = useEffectEvent(() => {
    const source = eventSourceRef.current;

    if (source === null) {
      return;
    }

    eventSourceRef.current = null;
    eventSourceKeyRef.current = null;
    source.close();
  });

  const parseMessage = useEffectEvent((event: MessageEvent<string>) => {
    const parser = options.parseMessage ?? defaultParseMessage<TMessage>;
    return parser(event);
  });

  const handleOpen = useEffectEvent((event: Event, source: EventSource) => {
    manualCloseRef.current = false;
    manualOpenRef.current = false;
    suppressReconnectRef.current = false;
    terminalErrorRef.current = null;
    reconnect.markConnected();

    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      status: "open"
    }));

    options.onOpen?.(event, source);
  });

  const commitParsedMessage = useEffectEvent(
    (eventName: string, event: MessageEvent<string>, isNamedEvent: boolean) => {
      try {
        const message = parseMessage(event);

        commitState((current) => ({
          ...current,
          lastEventName: eventName,
          lastMessage: message,
          lastMessageEvent: event
        }));

        if (isNamedEvent) {
          options.onEvent?.(eventName, message, event);
          return;
        }

        options.onMessage?.(message, event);
      } catch {
        const parseError = new Event("error");
        terminalErrorRef.current = parseError;
        manualOpenRef.current = false;
        suppressReconnectRef.current = true;
        reconnect.cancel();
        closeEventSource();
        commitState((current) => ({
          ...current,
          lastChangedAt: Date.now(),
          lastError: parseError,
          status: "error"
        }));
      }
    }
  );

  const handleError = useEffectEvent((event: Event, source: EventSource) => {
    const terminalError = terminalErrorRef.current;

    if (terminalError !== null) {
      suppressReconnectRef.current = false;

      commitState((current) => ({
        ...current,
        lastChangedAt: Date.now(),
        lastError: terminalError,
        status: "error"
      }));

      return;
    }

    const skipErrorReconnect = skipErrorReconnectRef.current;
    skipErrorReconnectRef.current = false;
    const shouldReconnect =
      !suppressReconnectRef.current &&
      !skipErrorReconnect &&
      reconnectEnabled &&
      (options.shouldReconnect?.(event) ?? true);

    const readyState = source.readyState;

    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      lastError: event,
      status:
        readyState === EventSource.OPEN
          ? "open"
          : shouldReconnect
            ? "reconnecting"
            : "closed"
    }));

    options.onError?.(event);

    if (!shouldReconnect) {
      suppressReconnectRef.current = false;
      closeEventSource();
      return;
    }

    if (readyState === EventSource.CLOSED) {
      eventSourceRef.current = null;
      eventSourceKeyRef.current = null;
      reconnect.schedule("error");
    }
  });

  const open = (): void => {
    manualCloseRef.current = false;
    manualOpenRef.current = true;
    suppressReconnectRef.current = false;
    terminalErrorRef.current = null;
    reconnect.cancel();
    setOpenNonce((current) => current + 1);
  };

  const reconnectNow = (): void => {
    manualCloseRef.current = false;
    manualOpenRef.current = true;
    skipErrorReconnectRef.current = true;
    suppressReconnectRef.current = true;
    terminalErrorRef.current = null;
    closeEventSource();
    suppressReconnectRef.current = false;
    reconnect.schedule("manual");
  };

  const close = (): void => {
    manualCloseRef.current = true;
    manualOpenRef.current = false;
    suppressReconnectRef.current = true;
    terminalErrorRef.current = null;
    reconnect.cancel();
    closeEventSource();

    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      status: "closed"
    }));
  };

  useEffect(() => {
    if (!supported) {
      eventSourceKeyRef.current = null;
      commitState((current) => ({
        ...current,
        status: "closed"
      }));
      return;
    }

    if (resolvedUrl === null) {
      eventSourceKeyRef.current = null;
      closeEventSource();
      commitState((current) => ({
        ...current,
        status: "closed"
      }));
      return;
    }

    const shouldConnect =
      terminalErrorRef.current === null &&
      ((connect && !manualCloseRef.current) ||
      manualOpenRef.current ||
      reconnect.status === "running");
    const nextEventSourceKey = [
      resolvedUrl,
      options.withCredentials ? "credentials" : "anonymous",
      eventsDependency
    ].join("::");

    if (!shouldConnect) {
      if (eventSourceRef.current !== null) {
        suppressReconnectRef.current = true;
        closeEventSource();
      }

      eventSourceKeyRef.current = null;
      commitState((current) => ({
        ...current,
        status:
          terminalErrorRef.current !== null
            ? "error"
            : manualCloseRef.current
              ? "closed"
              : "idle"
      }));
      return;
    }

    if (
      eventSourceRef.current !== null &&
      eventSourceKeyRef.current !== nextEventSourceKey
    ) {
      suppressReconnectRef.current = true;
      closeEventSource();
    }

    if (eventSourceRef.current !== null) {
      return;
    }

    const source = new EventSource(resolvedUrl, {
      withCredentials: options.withCredentials ?? false
    });

    eventSourceRef.current = source;
    eventSourceKeyRef.current = nextEventSourceKey;

    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      status:
        reconnect.status === "running" || reconnect.status === "scheduled"
          ? "reconnecting"
          : "connecting"
    }));

    const handleSourceOpen = (event: Event): void => {
      handleOpen(event, source);
    };
    const handleSourceMessage = (event: Event): void => {
      commitParsedMessage("message", event as MessageEvent<string>, false);
    };
    const namedEventHandlers = new Map<
      string,
      (event: Event) => void
    >();
    const handleSourceError = (event: Event): void => {
      handleError(event, source);
    };

    source.addEventListener("open", handleSourceOpen);
    source.addEventListener("message", handleSourceMessage);

    for (const eventName of namedEvents) {
      const handler = (event: Event): void => {
        commitParsedMessage(eventName, event as MessageEvent<string>, true);
      };

      namedEventHandlers.set(eventName, handler);
      source.addEventListener(eventName, handler);
    }

    source.addEventListener("error", handleSourceError);

    return () => {
      source.removeEventListener("open", handleSourceOpen);
      source.removeEventListener("message", handleSourceMessage);

      for (const [eventName, handler] of namedEventHandlers) {
        source.removeEventListener(eventName, handler);
      }

      source.removeEventListener("error", handleSourceError);
    };
  }, [
    connect,
    eventsDependency,
    namedEvents,
    openNonce,
    options.withCredentials,
    reconnect.status,
    resolvedUrl,
    supported
  ]);

  useEffect(() => () => {
    suppressReconnectRef.current = true;
    eventSourceKeyRef.current = null;
    terminalErrorRef.current = null;

    const source = eventSourceRef.current;
    eventSourceRef.current = null;

    if (source !== null) {
      source.close();
    }
  }, []);

  const status =
    (reconnect.status === "scheduled" || reconnect.status === "running") &&
    state.status !== "open"
      ? "reconnecting"
      : state.status;

  const snapshot = createConnectionStateSnapshot(status, {
    isSupported: supported,
    lastChangedAt: state.lastChangedAt
  });
  const reconnectState =
    options.reconnect === false
      ? null
      : {
          attempt: reconnect.attempt,
          isScheduled: reconnect.isScheduled,
          nextDelayMs: reconnect.nextDelayMs,
          status: reconnect.status
        };
  const commonResult = {
    close,
    lastError: state.lastError,
    lastEventName: state.lastEventName,
    lastMessage: state.lastMessage,
    lastMessageEvent: state.lastMessageEvent,
    open,
    reconnect: reconnectNow,
    reconnectState,
    transport: "eventsource" as const
  };
  const eventSource = eventSourceRef.current;

  if (snapshot.status === "open") {
    return {
      ...snapshot,
      ...commonResult,
      eventSource: eventSource as EventSource
    };
  }

  return {
    ...snapshot,
    ...commonResult,
    eventSource
  };
};
