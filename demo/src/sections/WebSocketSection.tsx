import { useEffect, useState } from "react";

import { useWebSocket } from "../../../src";
import {
  createLogEntry,
  formatTimestamp,
  pushLogEntry,
  type LogEntry
} from "./shared";
import type {
  BufferedAmountPolling,
  UseHeartbeatOptions
} from "../../../src";

type PollingMode = "off" | "100ms" | "raf" | "custom";

const DEFAULT_BUFFER_PAYLOAD_KB = "256";

const buildBigPayload = (sizeKb: number): string => {
  const bytes = Math.max(1, Math.floor(sizeKb)) * 1024;
  return "x".repeat(bytes);
};

export const WebSocketSection = () => {
  const [webSocketUrl, setWebSocketUrl] = useState("ws://localhost:8080");
  const [webSocketAutoConnect, setWebSocketAutoConnect] = useState(false);
  const [webSocketReconnectEnabled, setWebSocketReconnectEnabled] = useState(true);
  const [webSocketHeartbeatEnabled, setWebSocketHeartbeatEnabled] = useState(false);
  const [webSocketHeartbeatIntervalMs, setWebSocketHeartbeatIntervalMs] = useState("5000");
  const [webSocketHeartbeatTimeoutMs, setWebSocketHeartbeatTimeoutMs] = useState("2000");
  const [webSocketMessage, setWebSocketMessage] = useState("hello from demo");
  const [pollingMode, setPollingMode] = useState<PollingMode>("100ms");
  const [customIntervalMs, setCustomIntervalMs] = useState("50");
  const [bigPayloadKb, setBigPayloadKb] = useState(DEFAULT_BUFFER_PAYLOAD_KB);
  const [events, setEvents] = useState<LogEntry[]>([]);

  const webSocketHeartbeatOptions: false | UseHeartbeatOptions<string, string> =
    webSocketHeartbeatEnabled
      ? {
          intervalMs: Number(webSocketHeartbeatIntervalMs) || 0,
          matchesAck: (message) => message.toLowerCase() === "pong",
          message: "ping",
          startOnMount: false
        }
      : false;

  const parsedWebSocketHeartbeatTimeoutMs = Number(webSocketHeartbeatTimeoutMs);

  if (
    webSocketHeartbeatOptions !== false &&
    Number.isFinite(parsedWebSocketHeartbeatTimeoutMs) &&
    parsedWebSocketHeartbeatTimeoutMs > 0
  ) {
    webSocketHeartbeatOptions.timeoutMs = parsedWebSocketHeartbeatTimeoutMs;
  }

  const bufferedAmountPolling: BufferedAmountPolling = (() => {
    if (pollingMode === "off") {
      return false;
    }
    if (pollingMode === "100ms") {
      return true;
    }
    if (pollingMode === "raf") {
      return "raf";
    }

    const parsed = Number(customIntervalMs);
    return Number.isFinite(parsed) && parsed > 0 ? { intervalMs: parsed } : false;
  })();

  const webSocket = useWebSocket<string, string>({
    bufferedAmountPolling,
    connect: webSocketAutoConnect,
    heartbeat: webSocketHeartbeatOptions,
    reconnect: webSocketReconnectEnabled
      ? {
          initialDelayMs: 1_000,
          jitterRatio: 0,
          maxAttempts: 5
        }
      : false,
    shouldReconnect: (event) => !(event instanceof CloseEvent) || event.code !== 1_000,
    url: webSocketUrl.trim().length === 0 ? () => null : webSocketUrl.trim()
  });

  useEffect(() => {
    const details = [
      `message: ${webSocket.lastMessage ?? "none"}`,
      `close: ${webSocket.lastCloseEvent?.code ?? "none"}`,
      `reconnect attempt: ${webSocket.reconnectState?.attempt ?? "none"}`,
      `timed out: ${webSocket.heartbeatState?.hasTimedOut ?? false}`
    ].join(", ");

    setEvents((current) =>
      pushLogEntry(current, createLogEntry(webSocket.status, details))
    );
  }, [
    webSocket.heartbeatState?.hasTimedOut,
    webSocket.lastCloseEvent?.code,
    webSocket.lastMessage,
    webSocket.reconnectState?.attempt,
    webSocket.status
  ]);

  const webSocketSnapshot = {
    ...webSocket,
    socket:
      webSocket.socket === null
        ? null
        : {
            binaryType: webSocket.socket.binaryType,
            bufferedAmount: webSocket.socket.bufferedAmount,
            readyState: webSocket.socket.readyState,
            url: webSocket.socket.url
          }
  };

  const bufferedKb = (webSocket.bufferedAmount / 1024).toFixed(1);

  return (
    <section className="hook-section">
      <div className="section-heading">
        <p className="section-kicker">Hook block</p>
        <h2>useWebSocket</h2>
        <p>
          Point this block at your own WebSocket endpoint, then manually
          open, send, close, and reconnect while watching transport,
          reconnect, heartbeat, and live <code>bufferedAmount</code> state in
          one place.
        </p>
      </div>

      <div className="grid">
        <article className="panel panel-status websocket-panel">
          <div className="panel-header">
            <span className={`badge ${webSocket.status}`}>
              {webSocket.status}
            </span>
            <span className="support">
              buffered {webSocket.bufferedAmount} | connected{" "}
              {webSocket.isConnected ? "yes" : "no"}
            </span>
          </div>

          <dl className="stats reconnect-stats">
            <div>
              <dt>Last changed</dt>
              <dd>{formatTimestamp(webSocket.lastChangedAt)}</dd>
            </div>
            <div>
              <dt>Last message</dt>
              <dd>{webSocket.lastMessage ?? "none"}</dd>
            </div>
            <div>
              <dt>Close code</dt>
              <dd>{webSocket.lastCloseEvent?.code ?? "none"}</dd>
            </div>
          </dl>

          <div className="buffered-meter">
            <div className="buffered-meter-header">
              <span className="buffered-meter-label">
                bufferedAmount (live)
              </span>
              <span className="buffered-meter-value">{bufferedKb} KB</span>
            </div>
            <div
              aria-valuemax={1}
              aria-valuemin={0}
              aria-valuenow={Math.min(1, webSocket.bufferedAmount / (512 * 1024))}
              className="buffered-meter-bar"
              role="progressbar"
            >
              <div
                className="buffered-meter-fill"
                style={{
                  width: `${Math.min(
                    100,
                    (webSocket.bufferedAmount / (512 * 1024)) * 100
                  )}%`
                }}
              />
            </div>
            <p className="hint buffered-meter-hint">
              Polling mode:{" "}
              <strong>
                {pollingMode === "off"
                  ? "off (stale between sends)"
                  : pollingMode === "100ms"
                    ? "100ms interval"
                    : pollingMode === "raf"
                      ? "requestAnimationFrame"
                      : `custom ${customIntervalMs}ms`}
              </strong>
              . Press <em>Send big payload</em> to flood the buffer and watch
              it drain.
            </p>
          </div>
        </article>

        <article className="panel">
          <h3>Controls</h3>
          <label className="field">
            <span>Endpoint URL</span>
            <input
              className="input"
              onChange={(event) => {
                setWebSocketUrl(event.target.value);
              }}
              placeholder="ws://localhost:8080"
              value={webSocketUrl}
            />
          </label>

          <label className="toggle">
            <input
              checked={webSocketAutoConnect}
              onChange={(event) => {
                setWebSocketAutoConnect(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Connect automatically</span>
          </label>

          <label className="toggle">
            <input
              checked={webSocketReconnectEnabled}
              onChange={(event) => {
                setWebSocketReconnectEnabled(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Enable reconnect</span>
          </label>

          <label className="toggle">
            <input
              checked={webSocketHeartbeatEnabled}
              onChange={(event) => {
                setWebSocketHeartbeatEnabled(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Enable heartbeat ping/pong</span>
          </label>

          <label className="field">
            <span>Heartbeat interval (ms)</span>
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) => {
                setWebSocketHeartbeatIntervalMs(event.target.value);
              }}
              value={webSocketHeartbeatIntervalMs}
            />
          </label>

          <label className="field">
            <span>Heartbeat timeout (ms)</span>
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) => {
                setWebSocketHeartbeatTimeoutMs(event.target.value);
              }}
              value={webSocketHeartbeatTimeoutMs}
            />
          </label>

          <fieldset className="fieldset">
            <legend>bufferedAmountPolling</legend>
            <div className="radio-row">
              {(
                [
                  ["off", "Off"],
                  ["100ms", "true (100ms)"],
                  ["raf", `"raf"`],
                  ["custom", "custom interval"]
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="radio">
                  <input
                    checked={pollingMode === value}
                    name="polling-mode"
                    onChange={() => {
                      setPollingMode(value);
                    }}
                    type="radio"
                    value={value}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {pollingMode === "custom" ? (
              <label className="field">
                <span>Custom interval (ms)</span>
                <input
                  className="input"
                  inputMode="numeric"
                  onChange={(event) => {
                    setCustomIntervalMs(event.target.value);
                  }}
                  value={customIntervalMs}
                />
              </label>
            ) : null}
          </fieldset>

          <label className="field">
            <span>Outgoing message</span>
            <textarea
              className="input textarea"
              onChange={(event) => {
                setWebSocketMessage(event.target.value);
              }}
              rows={4}
              value={webSocketMessage}
            />
          </label>

          <label className="field">
            <span>Big payload size (KB)</span>
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) => {
                setBigPayloadKb(event.target.value);
              }}
              value={bigPayloadKb}
            />
          </label>

          <div className="actions">
            <button
              className="button"
              onClick={() => {
                webSocket.open();
              }}
              type="button"
            >
              Open
            </button>
            <button
              className="button button-ghost"
              onClick={() => {
                webSocket.send(webSocketMessage);
              }}
              type="button"
            >
              Send
            </button>
            <button
              className="button button-ghost"
              onClick={() => {
                const sizeKb = Number(bigPayloadKb);
                const payload = buildBigPayload(
                  Number.isFinite(sizeKb) && sizeKb > 0 ? sizeKb : 256
                );
                webSocket.send(payload);
              }}
              type="button"
            >
              Send big payload
            </button>
            <button
              className="button button-ghost"
              onClick={() => {
                webSocket.reconnect();
              }}
              type="button"
            >
              Reconnect
            </button>
            <button
              className="button button-success"
              onClick={() => {
                webSocket.close(1_000, "demo-close");
              }}
              type="button"
            >
              Close
            </button>
          </div>

          <p className="hint">
            Use a local or remote echo-capable endpoint. Big-payload sends
            spike <code>bufferedAmount</code>; live polling shows the buffer
            draining as the OS flushes it.
          </p>
        </article>

        <article className="panel">
          <h3>Snapshot</h3>
          <pre className="code">{JSON.stringify(webSocketSnapshot, null, 2)}</pre>
        </article>

        <article className="panel panel-log">
          <h3>Event log</h3>
          <ul className="log">
            {events.map((entry) => (
              <li key={entry.id}>{entry.text}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
};
