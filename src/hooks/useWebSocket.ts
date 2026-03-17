import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { createConnectionStateSnapshot } from "../core/connection-state";
import { isWebSocketSupported } from "../core/env";
import { resolveUrlProvider } from "../core/url";
import { useHeartbeat } from "./useHeartbeat";
import { useReconnect } from "./useReconnect";
import type { UseHeartbeatOptions } from "../types/useHeartbeat";
import type {
  UseWebSocketHook,
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

  return Array.isArray(protocols) ? protocols.join("|") : protocols;
};

const toHeartbeatConfig = <TOutgoing, TIncoming>(
  heartbeat: UseWebSocketOptions<TIncoming, TOutgoing>["heartbeat"]
): UseHeartbeatOptions<TOutgoing, TIncoming> | null =>
  heartbeat === undefined || heartbeat === false ? null : heartbeat;

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

  const socketRef = useRef<WebSocket | null>(null);
  const socketKeyRef = useRef<string | null>(null);
  const manualCloseRef = useRef(false);
  const manualOpenRef = useRef(false);
  const skipCloseReconnectRef = useRef(false);
  const suppressReconnectRef = useRef(false);
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

  const heartbeat = useHeartbeat<TOutgoing, TIncoming>(
    heartbeatHookOptions
  );

  const commitState = (
    next:
      | WebSocketState<TIncoming>
      | ((current: WebSocketState<TIncoming>) => WebSocketState<TIncoming>)
  ): void => {
    const resolved = typeof next === "function" ? next(stateRef.current) : next;
    stateRef.current = resolved;
    setState(resolved);
  };

  const closeSocket = useEffectEvent((code?: number, reason?: string) => {
    const socket = socketRef.current;

    if (socket === null) {
      return;
    }

    socketRef.current = null;
    socketKeyRef.current = null;

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(code, reason);
    }
  });

  const parseMessage = useEffectEvent((event: MessageEvent<unknown>) => {
    const parser = options.parseMessage ?? defaultParseMessage<TIncoming>;
    return parser(event);
  });

  const updateBufferedAmount = useEffectEvent(() => {
    commitState((current) => ({
      ...current,
      bufferedAmount: socketRef.current?.bufferedAmount ?? 0
    }));
  });

  const handleOpen = useEffectEvent((event: Event, socket: WebSocket) => {
    manualCloseRef.current = false;
    suppressReconnectRef.current = false;
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

  const handleMessage = useEffectEvent((event: MessageEvent<unknown>) => {
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
    } catch {
      const parseError = new Event("error");
      commitState((current) => ({
        ...current,
        lastError: parseError,
        status: "error"
      }));
    }
  });

  const handleError = useEffectEvent((event: Event) => {
    heartbeat.stop();
    commitState((current) => ({
      ...current,
      lastError: event,
      status: "error"
    }));

    options.onError?.(event);
  });

  const handleClose = useEffectEvent((event: CloseEvent) => {
    socketRef.current = null;
    socketKeyRef.current = null;
    heartbeat.stop();
    updateBufferedAmount();
    const skipCloseReconnect = skipCloseReconnectRef.current;
    skipCloseReconnectRef.current = false;

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

  const open = (): void => {
    manualCloseRef.current = false;
    manualOpenRef.current = true;
    suppressReconnectRef.current = false;
    reconnect.cancel();
    setOpenNonce((current) => current + 1);
  };

  const reconnectNow = (): void => {
    manualCloseRef.current = false;
    manualOpenRef.current = true;
    skipCloseReconnectRef.current = true;
    suppressReconnectRef.current = true;
    heartbeat.stop();
    closeSocket();
    suppressReconnectRef.current = false;
    reconnect.schedule("manual");
  };

  const close = (code?: number, reason?: string): void => {
    manualCloseRef.current = true;
    manualOpenRef.current = false;
    suppressReconnectRef.current = true;
    reconnect.cancel();
    heartbeat.stop();

    commitState((current) => ({
      ...current,
      lastChangedAt: Date.now(),
      status: "closing"
    }));

    closeSocket(code, reason);
  };

  const send = (message: TOutgoing): boolean => {
    const socket = socketRef.current;

    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const serializer = options.serializeMessage ?? defaultSerializeMessage<TOutgoing>;
    socket.send(serializer(message));
    updateBufferedAmount();
    return true;
  };

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
      (connect && !manualCloseRef.current) ||
      manualOpenRef.current ||
      reconnect.status === "running";
    const nextSocketKey = `${resolvedUrl}::${protocolsDependency}::${options.binaryType ?? "blob"}`;

    if (!shouldConnect) {
      if (socketRef.current !== null) {
        suppressReconnectRef.current = true;
        closeSocket();
      }

      socketKeyRef.current = null;
      commitState((current) => ({
        ...current,
        status: manualCloseRef.current ? "closed" : "idle"
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

    const socket = new WebSocket(resolvedUrl, options.protocols);
    socketRef.current = socket;
    socketKeyRef.current = nextSocketKey;
    socket.binaryType = options.binaryType ?? "blob";

    commitState((current) => ({
      ...current,
      bufferedAmount: socket.bufferedAmount,
      lastChangedAt: Date.now(),
      status:
        reconnect.status === "running" || reconnect.status === "scheduled"
          ? "reconnecting"
          : "connecting"
    }));

    const handleSocketOpen = (event: Event): void => {
      handleOpen(event, socket);
    };
    const handleSocketMessage = (event: MessageEvent<unknown>): void => {
      handleMessage(event);
    };
    const handleSocketError = (event: Event): void => {
      handleError(event);
    };
    const handleSocketClose = (event: CloseEvent): void => {
      handleClose(event);
    };

    socket.addEventListener("open", handleSocketOpen);
    socket.addEventListener("message", handleSocketMessage);
    socket.addEventListener("error", handleSocketError);
    socket.addEventListener("close", handleSocketClose);

    return () => {
      socket.removeEventListener("open", handleSocketOpen);
      socket.removeEventListener("message", handleSocketMessage);
      socket.removeEventListener("error", handleSocketError);
      socket.removeEventListener("close", handleSocketClose);
    };
  }, [
    connect,
    openNonce,
    options.binaryType,
    protocolsDependency,
    reconnect.status,
    resolvedUrl,
    supported
  ]);

  useEffect(() => () => {
    suppressReconnectRef.current = true;
    socketKeyRef.current = null;

    const socket = socketRef.current;
    socketRef.current = null;

    if (socket === null) {
      return;
    }

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }
  }, []);

  useEffect(() => {
    if (state.status !== "open") {
      heartbeat.stop();
    }
  }, [state.status]);

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
