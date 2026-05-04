import {
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { createConnectionStateSnapshot } from "../core/connection-state";
import { RealtimeErrorEvent } from "../core/errors";
import { isEventSourceSupported } from "../core/env";
import { resolveUrlProvider } from "../core/url";
import { useReconnect } from "./useReconnect";
import { useStableCallback } from "./useStableCallback";
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

const normalizeNamedEvents = (
  events: readonly string[] | undefined
): string[] => {
  if (events === undefined || events.length === 0) {
    return [];
  }

  return [...new Set(events)]
    .filter((eventName) => eventName !== "message")
    .sort();
};

const toEventsDependency = (events: readonly string[] | undefined): string =>
  JSON.stringify(normalizeNamedEvents(events));

const parseEventsDependency = (eventsDependency: string): string[] =>
  JSON.parse(eventsDependency) as string[];

export const useEventSource: UseEventSourceHook = <TMessage = unknown>(
  options: UseEventSourceOptions<TMessage>
): UseEventSourceResult<TMessage> => {
  const connect = options.connect ?? true;
  const supported = isEventSourceSupported();
  const resolvedUrl = useMemo(() => resolveUrlProvider(options.url), [options.url]);
  const eventsDependency = toEventsDependency(options.events);
  const namedEvents = useMemo(
    () => parseEventsDependency(eventsDependency),
    [eventsDependency]
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventSourceKeyRef = useRef<string | null>(null);
  const activeEventSourceEpochRef = useRef<number | null>(null);
  const nextEventSourceEpochRef = useRef(0);
  const manualCloseRef = useRef(false);
  const manualOpenRef = useRef(false);
  const skipErrorReconnectRef = useRef(false);
  const suppressReconnectRef = useRef(false);
  const terminalErrorRef = useRef<Event | null>(null);
  const [openNonce, setOpenNonce] = useState(0);
  const initialStatus: EventSourceState<TMessage>["status"] =
    !supported || resolvedUrl === null
      ? "closed"
      : connect
        ? "connecting"
        : "idle";
  const [state, setState] = useState<EventSourceState<TMessage>>(() =>
    createInitialState(initialStatus)
  );
  const stateRef = useRef(state);
  useInsertionEffect(() => {
    stateRef.current = state;
  });

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

  const commitState = useStableCallback((
    next:
      | EventSourceState<TMessage>
      | ((current: EventSourceState<TMessage>) => EventSourceState<TMessage>)
  ): void => {
    const resolved = typeof next === "function" ? next(stateRef.current) : next;
    stateRef.current = resolved;
    setState(resolved);
  });

  const closeEventSource = useStableCallback(() => {
    const source = eventSourceRef.current;

    if (source === null) {
      return;
    }

    eventSourceRef.current = null;
    eventSourceKeyRef.current = null;
    activeEventSourceEpochRef.current = null;
    source.close();
  });

  const isActiveEventSourceEvent = useStableCallback((sourceEpoch: number) => {
    return activeEventSourceEpochRef.current === sourceEpoch;
  });

  const parseMessage = useStableCallback((event: MessageEvent<string>) => {
    const parser = options.parseMessage ?? defaultParseMessage<TMessage>;
    return parser(event);
  });

  const handleOpen = useStableCallback((event: Event, source: EventSource) => {
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

  const commitParsedMessage = useStableCallback(
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
      } catch (error) {
        const parseError = new RealtimeErrorEvent("error", {
          cause: error,
          kind: "parse-error"
        });
        terminalErrorRef.current = parseError;
        manualOpenRef.current = false;
        suppressReconnectRef.current = true;
        reconnect.cancel();
        closeEventSource();
        options.onError?.(parseError);
        commitState((current) => ({
          ...current,
          lastChangedAt: Date.now(),
          lastError: parseError,
          status: "error"
        }));
      }
    }
  );

  const handleError = useStableCallback((
    event: Event,
    source: EventSource,
    sourceEpoch: number
  ) => {
    if (!isActiveEventSourceEvent(sourceEpoch)) {
      return;
    }

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

    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      lastError: event,
      status: shouldReconnect ? "reconnecting" : "closed"
    }));

    options.onError?.(event);

    if (!shouldReconnect) {
      suppressReconnectRef.current = false;
      closeEventSource();
      return;
    }

    closeEventSource();
    reconnect.schedule("error");
  });

  const open = useStableCallback((): void => {
    manualCloseRef.current = false;
    manualOpenRef.current = true;
    suppressReconnectRef.current = false;
    terminalErrorRef.current = null;
    reconnect.cancel();
    setOpenNonce((current) => current + 1);
  });

  const reconnectNow = useStableCallback((): void => {
    manualCloseRef.current = false;
    manualOpenRef.current = true;
    skipErrorReconnectRef.current = true;
    suppressReconnectRef.current = true;
    terminalErrorRef.current = null;
    closeEventSource();
    suppressReconnectRef.current = false;
    reconnect.schedule("manual");
  });

  const close = useStableCallback((): void => {
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
  });

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
      (reconnect.status === "running" ||
      (reconnect.status !== "scheduled" &&
        ((connect && !manualCloseRef.current) || manualOpenRef.current)));
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

    // Commit `connecting` synchronously so consumer effects (status
    // observers, snapshot reducers) see the transition in the same React
    // commit as the call that triggered the connect attempt.
    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      status:
        reconnect.status === "running" || reconnect.status === "scheduled"
          ? "reconnecting"
          : "connecting"
    }));

    // Defer the actual `new EventSource(...)` allocation by a microtask.
    // Under React Strict Mode in dev, the effect runs mount → cleanup →
    // mount synchronously; the cleanup below flips `cancelled` so the
    // discarded mount never opens a real source. After the microtask
    // queue flushes, only the surviving mount instantiates the source.
    let cancelled = false;
    let detachListeners: (() => void) | null = null;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      // The user can call `close()` between the synchronous effect body
      // and this microtask. `close()` flips `manualCloseRef.current`;
      // honour it here so the deferred allocation does not resurrect a
      // transport the user already asked to close.
      if (manualCloseRef.current) {
        commitState((current) => ({
          ...current,
          lastChangedAt: Date.now(),
          status: "closed"
        }));
        return;
      }

      const source = new EventSource(resolvedUrl, {
        withCredentials: options.withCredentials ?? false
      });
      const sourceEpoch = nextEventSourceEpochRef.current + 1;

      eventSourceRef.current = source;
      eventSourceKeyRef.current = nextEventSourceKey;
      activeEventSourceEpochRef.current = sourceEpoch;
      nextEventSourceEpochRef.current = sourceEpoch;

      const handleSourceOpen = (event: Event): void => {
        if (!isActiveEventSourceEvent(sourceEpoch)) {
          return;
        }

        handleOpen(event, source);
      };
      const handleSourceMessage = (event: Event): void => {
        if (!isActiveEventSourceEvent(sourceEpoch)) {
          return;
        }

        commitParsedMessage("message", event as MessageEvent<string>, false);
      };
      const namedEventHandlers = new Map<
        string,
        (event: Event) => void
      >();
      const handleSourceError = (event: Event): void => {
        handleError(event, source, sourceEpoch);
      };

      source.addEventListener("open", handleSourceOpen);
      source.addEventListener("message", handleSourceMessage);

      for (const eventName of namedEvents) {
        const handler = (event: Event): void => {
          if (!isActiveEventSourceEvent(sourceEpoch)) {
            return;
          }

          commitParsedMessage(eventName, event as MessageEvent<string>, true);
        };

        namedEventHandlers.set(eventName, handler);
        source.addEventListener(eventName, handler);
      }

      source.addEventListener("error", handleSourceError);

      detachListeners = () => {
        source.removeEventListener("open", handleSourceOpen);
        source.removeEventListener("message", handleSourceMessage);

        for (const [eventName, handler] of namedEventHandlers) {
          source.removeEventListener(eventName, handler);
        }

        source.removeEventListener("error", handleSourceError);
      };
    });

    return () => {
      cancelled = true;
      detachListeners?.();
    };
  }, [
    closeEventSource,
    commitParsedMessage,
    commitState,
    connect,
    eventsDependency,
    handleError,
    handleOpen,
    isActiveEventSourceEvent,
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
    activeEventSourceEpochRef.current = null;
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
