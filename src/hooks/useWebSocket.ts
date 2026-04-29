import { useEffect, useMemo, useRef, useState } from "react";

import { createConnectionStateSnapshot } from "../core/connection-state";
import { RealtimeErrorEvent } from "../core/errors";
import { isWebSocketSupported } from "../core/env";
import { resolveUrlProvider } from "../core/url";
import { useHeartbeat } from "./useHeartbeat";
import { useReconnect } from "./useReconnect";
import { useStableCallback } from "./useStableCallback";
import type { UseHeartbeatOptions } from "../types/useHeartbeat";
import type {
  UseWebSocketHook,
  WebSocketHeartbeatAction,
  UseWebSocketHeartbeatOptions,
  UseWebSocketOptions,
  UseWebSocketResult
} from "../types/useWebSocket";

type WebSocketState<TIncoming> = {
  bufferedAmount: number;
  lastChangedAt: number | null;
  lastCloseEvent: CloseEvent | null;
  lastError: Event | null;
  lastMessage: TIncoming | null;
  lastMessageEvent: MessageEvent<unknown> | null;
  status: UseWebSocketResult<TIncoming>["status"];
};

const createInitialState = <TIncoming,>(
  status: UseWebSocketResult<TIncoming>["status"] = "idle"
): WebSocketState<TIncoming> => ({
  bufferedAmount: 0,
  lastChangedAt: null,
  lastCloseEvent: null,
  lastError: null,
  lastMessage: null,
  lastMessageEvent: null,
  status
});

const defaultParseMessage = <TIncoming,>(
  event: MessageEvent<unknown>
): TIncoming => event.data as TIncoming;

const defaultSerializeMessage = <TOutgoing,>(message: TOutgoing) => {
  if (
    typeof message === "string" ||
    message instanceof Blob ||
    message instanceof ArrayBuffer
  ) {
    return message;
  }

  if (ArrayBuffer.isView(message)) {
    return message;
  }

  return JSON.stringify(message);
};

const resolveFactoryValue = <TValue,>(
  value: TValue | (() => TValue)
): TValue =>
  typeof value === "function"
    ? (value as () => TValue)()
    : value;

const toProtocolsDependency = (protocols: string | string[] | undefined): string => {
  if (protocols === undefined) {
    return "";
  }

  return JSON.stringify(protocols);
};

const parseProtocolsDependency = (
  protocolsDependency: string
): string | string[] | undefined =>
  protocolsDependency === ""
    ? undefined
    : JSON.parse(protocolsDependency) as string | string[];

const toHeartbeatConfig = <TOutgoing, TIncoming>(
  heartbeat: UseWebSocketOptions<TIncoming, TOutgoing>["heartbeat"]
): UseWebSocketHeartbeatOptions<TOutgoing, TIncoming> | null =>
  heartbeat === undefined || heartbeat === false ? null : heartbeat;

const isSocketActive = (socket: WebSocket): boolean =>
  socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING;

export const useWebSocket: UseWebSocketHook = <
  TIncoming = unknown,
  TOutgoing = TIncoming
>(
  options: UseWebSocketOptions<TIncoming, TOutgoing>
): UseWebSocketResult<TIncoming, TOutgoing> => {
  const connect = options.connect ?? true;
  const supported = isWebSocketSupported();
  const resolvedUrl = useMemo(() => resolveUrlProvider(options.url), [options.url]);
  const protocolsDependency = toProtocolsDependency(options.protocols);
  const protocols = useMemo(
    () => parseProtocolsDependency(protocolsDependency),
    [protocolsDependency]
  );

  const socketRef = useRef<WebSocket | null>(null);
  const socketKeyRef = useRef<string | null>(null);
  const activeSocketEpochRef = useRef<number | null>(null);
  const closingSocketEpochRef = useRef<number | null>(null);
  const nextSocketEpochRef = useRef(0);
  const manualCloseRef = useRef(false);
  const manualOpenRef = useRef(false);
  const skipCloseReconnectRef = useRef(false);
  const suppressReconnectRef = useRef(false);
  const pendingCloseActionRef = useRef<{
    error: Event | null;
    reconnectTrigger: "heartbeat-timeout" | "error" | null;
  } | null>(null);
  const terminalErrorRef = useRef<Event | null>(null);
  const [openNonce, setOpenNonce] = useState(0);
  const [state, setState] = useState<WebSocketState<TIncoming>>(() =>
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

  const heartbeatEnabled =
    options.heartbeat !== false && supported && resolvedUrl !== null;
  const heartbeatConfig = toHeartbeatConfig<TOutgoing, TIncoming>(
    options.heartbeat
  );
  const defaultHeartbeatAction: WebSocketHeartbeatAction =
    options.reconnect === false ? "close" : "reconnect";
  const heartbeatHookOptions: UseHeartbeatOptions<TOutgoing, TIncoming> =
    heartbeatConfig === null
      ? {
          enabled: false,
          intervalMs: 1_000,
          startOnMount: false
        }
      : {
          beat: () => {
            const socket = socketRef.current;
            if (socket === null || socket.readyState !== WebSocket.OPEN) {
              return false;
            }

            const heartbeatMessage = heartbeatConfig.message;

            if (heartbeatMessage !== undefined) {
              const serialized = (options.serializeMessage ?? defaultSerializeMessage)(
                resolveFactoryValue(heartbeatMessage)
              );
              socket.send(serialized);
            }

            return heartbeatConfig.beat?.() ?? true;
          },
          enabled: heartbeatEnabled && (heartbeatConfig.enabled ?? true),
          intervalMs: heartbeatConfig.intervalMs,
          startOnMount: false
        };

  if (heartbeatConfig !== null && heartbeatConfig.timeoutMs !== undefined) {
    heartbeatHookOptions.timeoutMs = heartbeatConfig.timeoutMs;
  }

  if (heartbeatConfig !== null && heartbeatConfig.matchesAck !== undefined) {
    heartbeatHookOptions.matchesAck = heartbeatConfig.matchesAck;
  }

  if (heartbeatConfig !== null && heartbeatConfig.onBeat !== undefined) {
    heartbeatHookOptions.onBeat = heartbeatConfig.onBeat;
  }

  if (heartbeatConfig !== null && heartbeatConfig.onTimeout !== undefined) {
    heartbeatHookOptions.onTimeout = heartbeatConfig.onTimeout;
  }

  if (heartbeatConfig !== null) {
    const onTimeout = heartbeatHookOptions.onTimeout;
    heartbeatHookOptions.onTimeout = () => {
      applyHeartbeatAction(
        heartbeatConfig.timeoutAction ?? defaultHeartbeatAction,
        new RealtimeErrorEvent("heartbeat-timeout", {
          kind: "heartbeat-timeout"
        }),
        "heartbeat-timeout"
      );
      onTimeout?.();
    };

    const onError = heartbeatConfig.onError;
    heartbeatHookOptions.onError = (error) => {
      const event = new RealtimeErrorEvent("heartbeat-error", {
        cause: error,
        kind: "heartbeat-error"
      });

      applyHeartbeatAction(
        heartbeatConfig.errorAction ??
          heartbeatConfig.timeoutAction ??
          defaultHeartbeatAction,
        event,
        "error"
      );
      onError?.(error);
    };
  }

  const heartbeat = useHeartbeat<TOutgoing, TIncoming>(
    heartbeatHookOptions
  );

  const commitState = useStableCallback((
    next:
      | WebSocketState<TIncoming>
      | ((current: WebSocketState<TIncoming>) => WebSocketState<TIncoming>)
  ): void => {
    const resolved = typeof next === "function" ? next(stateRef.current) : next;
    stateRef.current = resolved;
    setState(resolved);
  });

  const isActiveSocketEvent = useStableCallback((socketEpoch: number) => {
    return activeSocketEpochRef.current === socketEpoch;
  });

  const shouldHandleSocketClose = useStableCallback((socketEpoch: number) => {
    return (
      activeSocketEpochRef.current === socketEpoch ||
      closingSocketEpochRef.current === socketEpoch
    );
  });

  const closeSocket = useStableCallback(
    (
      config: {
        code?: number | undefined;
        reason?: string | undefined;
        trackClose?: boolean;
      } = {}
    ) => {
      const socket = socketRef.current;
      const socketEpoch = activeSocketEpochRef.current;

      if (socket === null || socketEpoch === null) {
        return;
      }

      socketRef.current = null;
      socketKeyRef.current = null;
      activeSocketEpochRef.current = null;
      closingSocketEpochRef.current = config.trackClose ? socketEpoch : null;

      if (isSocketActive(socket)) {
        socket.close(config.code, config.reason);
      }
    }
  );

  const applyHeartbeatAction = useStableCallback(
    (
      action: WebSocketHeartbeatAction,
      error: Event,
      reconnectTrigger: "heartbeat-timeout" | "error"
    ) => {
      heartbeat.stop();
      options.onError?.(error);

      if (action === "none") {
        commitState((current) => ({
          ...current,
          lastChangedAt: Date.now(),
          lastError: error
        }));
        return;
      }

      const shouldReconnect =
        action === "reconnect" &&
        reconnectEnabled &&
        (options.shouldReconnect?.(error) ?? true);
      manualOpenRef.current = false;
      terminalErrorRef.current = shouldReconnect ? null : error;
      const socket = socketRef.current;

      if (socket === null || !isSocketActive(socket)) {
        commitState((current) => ({
          ...current,
          lastChangedAt: Date.now(),
          lastError: error,
          status: shouldReconnect ? "reconnecting" : "error"
        }));

        if (shouldReconnect) {
          reconnect.schedule(reconnectTrigger);
        }

        return;
      }

      pendingCloseActionRef.current = {
        error,
        reconnectTrigger: shouldReconnect ? reconnectTrigger : null
      };
      skipCloseReconnectRef.current = true;
      suppressReconnectRef.current = true;
      closeSocket({ trackClose: true });
    }
  );

  const parseMessage = useStableCallback((event: MessageEvent<unknown>) => {
    const parser = options.parseMessage ?? defaultParseMessage<TIncoming>;
    return parser(event);
  });

  const updateBufferedAmount = useStableCallback(() => {
    commitState((current) => ({
      ...current,
      bufferedAmount: socketRef.current?.bufferedAmount ?? 0
    }));
  });

  const handleOpen = useStableCallback((event: Event, socket: WebSocket) => {
    manualCloseRef.current = false;
    manualOpenRef.current = false;
    suppressReconnectRef.current = false;
    terminalErrorRef.current = null;
    reconnect.markConnected();
    heartbeat.start();

    commitState((current) => ({
      ...current,
      bufferedAmount: socket.bufferedAmount,
      lastChangedAt: Date.now(),
      status: "open"
    }));

    options.onOpen?.(event, socket);
  });

  const handleMessage = useStableCallback((event: MessageEvent<unknown>) => {
    try {
      const message = parseMessage(event);
      heartbeat.notifyAck(message);

      commitState((current) => ({
        ...current,
        bufferedAmount: socketRef.current?.bufferedAmount ?? current.bufferedAmount,
        lastMessage: message,
        lastMessageEvent: event
      }));

      options.onMessage?.(message, event);
    } catch (error) {
      const parseError = new RealtimeErrorEvent("error", {
        cause: error,
        kind: "parse-error"
      });
      terminalErrorRef.current = parseError;
      manualOpenRef.current = false;
      skipCloseReconnectRef.current = true;
      suppressReconnectRef.current = true;
      reconnect.cancel();
      heartbeat.stop();
      options.onError?.(parseError);
      commitState((current) => ({
        ...current,
        lastChangedAt: Date.now(),
        lastError: parseError,
        status: "error"
      }));
      closeSocket({
        code: 1003,
        reason: "parse-error",
        trackClose: true
      });
    }
  });

  const handleError = useStableCallback((event: Event, socketEpoch: number) => {
    if (!isActiveSocketEvent(socketEpoch)) {
      return;
    }

    heartbeat.stop();
    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      lastError: event,
      status: "error"
    }));

    options.onError?.(event);
  });

  const handleClose = useStableCallback((event: CloseEvent, socketEpoch: number) => {
    if (!shouldHandleSocketClose(socketEpoch)) {
      return;
    }

    if (activeSocketEpochRef.current === socketEpoch) {
      socketRef.current = null;
      socketKeyRef.current = null;
      activeSocketEpochRef.current = null;
    }

    if (closingSocketEpochRef.current === socketEpoch) {
      closingSocketEpochRef.current = null;
    }

    heartbeat.stop();
    updateBufferedAmount();
    const pendingCloseAction = pendingCloseActionRef.current;
    pendingCloseActionRef.current = null;
    const terminalError = terminalErrorRef.current;
    const skipCloseReconnect = skipCloseReconnectRef.current;
    skipCloseReconnectRef.current = false;

    if (pendingCloseAction !== null) {
      suppressReconnectRef.current = false;

      commitState((current) => ({
        ...current,
        lastChangedAt: Date.now(),
        lastCloseEvent: event,
        lastError: pendingCloseAction.error ?? current.lastError,
        status:
          pendingCloseAction.reconnectTrigger === null ? "error" : "reconnecting"
      }));

      options.onClose?.(event);

      if (pendingCloseAction.reconnectTrigger !== null) {
        reconnect.schedule(pendingCloseAction.reconnectTrigger);
      }

      return;
    }

    if (terminalError !== null) {
      suppressReconnectRef.current = false;

      commitState((current) => ({
        ...current,
        lastChangedAt: Date.now(),
        lastCloseEvent: event,
        lastError: terminalError,
        status: "error"
      }));

      options.onClose?.(event);
      return;
    }

    const shouldReconnect =
      !suppressReconnectRef.current &&
      !skipCloseReconnect &&
      reconnectEnabled &&
      (options.shouldReconnect?.(event) ?? true);

    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      lastCloseEvent: event,
      status: shouldReconnect ? "reconnecting" : "closed"
    }));

    options.onClose?.(event);

    if (shouldReconnect) {
      reconnect.schedule("close");
    } else {
      suppressReconnectRef.current = false;
    }
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
    skipCloseReconnectRef.current = true;
    suppressReconnectRef.current = true;
    terminalErrorRef.current = null;
    heartbeat.stop();
    closeSocket();
    suppressReconnectRef.current = false;
    reconnect.schedule("manual");
  });

  const close = useStableCallback((code?: number, reason?: string): void => {
    manualCloseRef.current = true;
    manualOpenRef.current = false;
    suppressReconnectRef.current = true;
    terminalErrorRef.current = null;
    reconnect.cancel();
    heartbeat.stop();

    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      status: "closing"
    }));

    closeSocket({
      code,
      reason,
      trackClose: true
    });
  });

  const send = useStableCallback((message: TOutgoing): boolean => {
    const socket = socketRef.current;

    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const serializer = options.serializeMessage ?? defaultSerializeMessage<TOutgoing>;
    socket.send(serializer(message));
    updateBufferedAmount();
    return true;
  });

  useEffect(() => {
    if (!supported) {
      socketKeyRef.current = null;
      commitState((current) => ({
        ...current,
        status: "closed"
      }));
      return;
    }

    if (resolvedUrl === null) {
      socketKeyRef.current = null;
      closeSocket();
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
    const nextSocketKey = `${resolvedUrl}::${protocolsDependency}::${options.binaryType ?? "blob"}`;

    if (!shouldConnect) {
      if (socketRef.current !== null) {
        suppressReconnectRef.current = true;
        closeSocket();
      }

      socketKeyRef.current = null;
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

    if (socketRef.current !== null && socketKeyRef.current !== nextSocketKey) {
      suppressReconnectRef.current = true;
      closeSocket();
    }

    if (socketRef.current !== null) {
      return;
    }

    // Commit `connecting` synchronously so consumer effects (status
    // observers, snapshot reducers) see the transition in the same React
    // commit as the call that triggered the connect attempt.
    commitState((current) => ({
      ...current,
      bufferedAmount: 0,
      lastChangedAt: Date.now(),
      status:
        reconnect.status === "running" || reconnect.status === "scheduled"
          ? "reconnecting"
          : "connecting"
    }));

    // Defer the actual `new WebSocket(...)` allocation by a microtask.
    // Under React Strict Mode in dev, the effect runs mount → cleanup →
    // mount synchronously; the cleanup below flips `cancelled` so the
    // discarded mount never opens a real socket. After the microtask
    // queue flushes, only the surviving mount instantiates the socket.
    let cancelled = false;
    let detachListeners: (() => void) | null = null;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const socket = new WebSocket(resolvedUrl, protocols);
      const socketEpoch = nextSocketEpochRef.current + 1;
      socketRef.current = socket;
      socketKeyRef.current = nextSocketKey;
      activeSocketEpochRef.current = socketEpoch;
      closingSocketEpochRef.current = null;
      nextSocketEpochRef.current = socketEpoch;
      socket.binaryType = options.binaryType ?? "blob";

      commitState((current) => ({
        ...current,
        bufferedAmount: socket.bufferedAmount
      }));

      const handleSocketOpen = (event: Event): void => {
        if (!isActiveSocketEvent(socketEpoch)) {
          return;
        }

        handleOpen(event, socket);
      };
      const handleSocketMessage = (event: MessageEvent<unknown>): void => {
        if (!isActiveSocketEvent(socketEpoch)) {
          return;
        }

        handleMessage(event);
      };
      const handleSocketError = (event: Event): void => {
        handleError(event, socketEpoch);
      };
      const handleSocketClose = (event: CloseEvent): void => {
        handleClose(event, socketEpoch);
      };

      socket.addEventListener("open", handleSocketOpen);
      socket.addEventListener("message", handleSocketMessage);
      socket.addEventListener("error", handleSocketError);
      socket.addEventListener("close", handleSocketClose);

      detachListeners = () => {
        socket.removeEventListener("open", handleSocketOpen);
        socket.removeEventListener("message", handleSocketMessage);
        socket.removeEventListener("error", handleSocketError);
        socket.removeEventListener("close", handleSocketClose);
      };
    });

    return () => {
      cancelled = true;
      detachListeners?.();
    };
  }, [
    closeSocket,
    commitState,
    connect,
    handleClose,
    handleError,
    handleMessage,
    handleOpen,
    isActiveSocketEvent,
    openNonce,
    options.binaryType,
    protocols,
    protocolsDependency,
    reconnect.status,
    resolvedUrl,
    supported
  ]);

  useEffect(() => () => {
    suppressReconnectRef.current = true;
    socketKeyRef.current = null;
    activeSocketEpochRef.current = null;
    closingSocketEpochRef.current = null;
    terminalErrorRef.current = null;

    const socket = socketRef.current;
    socketRef.current = null;

    if (socket === null) {
      return;
    }

    if (isSocketActive(socket)) {
      socket.close();
    }
  }, []);

  const stopHeartbeat = heartbeat.stop;

  useEffect(() => {
    if (state.status !== "open") {
      stopHeartbeat();
    }
  }, [state.status, stopHeartbeat]);

  // `WebSocket.bufferedAmount` does not fire any event when bytes
  // drain to the network. Without polling, `state.bufferedAmount`
  // would only refresh when the consumer calls `send(...)`, when a
  // message arrives, or when the socket transitions to `open`. Opt-in
  // polling (`bufferedAmountPolling`) gives consumers a real-time view
  // for backpressure UIs.
  const rawBufferedAmountPolling = options.bufferedAmountPolling;
  const bufferedAmountPollingMode: "raf" | number | null = useMemo(() => {
    if (rawBufferedAmountPolling === undefined || rawBufferedAmountPolling === false) {
      return null;
    }

    if (rawBufferedAmountPolling === true) {
      return 100;
    }

    if (rawBufferedAmountPolling === "raf") {
      return "raf";
    }

    const intervalMs = rawBufferedAmountPolling.intervalMs;

    return Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : null;
  }, [rawBufferedAmountPolling]);

  const pollBufferedAmount = useStableCallback(() => {
    const socket = socketRef.current;

    if (socket === null) {
      return;
    }

    const next = socket.bufferedAmount;

    if (stateRef.current.bufferedAmount === next) {
      return;
    }

    commitState((current) => ({
      ...current,
      bufferedAmount: next
    }));
  });

  useEffect(() => {
    if (bufferedAmountPollingMode === null) {
      return;
    }

    if (state.status !== "open") {
      return;
    }

    if (bufferedAmountPollingMode === "raf") {
      if (typeof requestAnimationFrame !== "function") {
        return;
      }

      let frame = requestAnimationFrame(function loop() {
        pollBufferedAmount();
        frame = requestAnimationFrame(loop);
      });

      return () => {
        cancelAnimationFrame(frame);
      };
    }

    const intervalId = setInterval(pollBufferedAmount, bufferedAmountPollingMode);

    return () => {
      clearInterval(intervalId);
    };
  }, [bufferedAmountPollingMode, state.status, pollBufferedAmount]);

  const status =
    (reconnect.status === "scheduled" || reconnect.status === "running") &&
    state.status !== "open"
      ? "reconnecting"
      : state.status;

  const snapshot = createConnectionStateSnapshot(status, {
    isSupported: supported,
    lastChangedAt: state.lastChangedAt
  });
  const heartbeatState =
    options.heartbeat === false
      ? null
      : {
          hasTimedOut: heartbeat.hasTimedOut,
          isRunning: heartbeat.isRunning,
          lastAckAt: heartbeat.lastAckAt,
          lastBeatAt: heartbeat.lastBeatAt,
          latencyMs: heartbeat.latencyMs
        };
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
    bufferedAmount: state.bufferedAmount,
    close,
    heartbeatState,
    lastCloseEvent: state.lastCloseEvent,
    lastError: state.lastError,
    lastMessage: state.lastMessage,
    lastMessageEvent: state.lastMessageEvent,
    open,
    reconnect: reconnectNow,
    reconnectState,
    send,
    transport: "websocket" as const
  };
  const socket = socketRef.current;

  if (snapshot.status === "open") {
    return {
      ...snapshot,
      ...commonResult,
      socket: socket as WebSocket
    };
  }

  return {
    ...snapshot,
    ...commonResult,
    socket
  };
};
