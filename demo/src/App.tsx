import { useEffect, useState } from "react";

import {
  useEventSource,
  useHeartbeat,
  useOnlineStatus,
  useReconnect,
  useWebSocket
} from "../../src";
import type { UseHeartbeatOptions } from "../../src";

const formatTimestamp = (value: number | null): string =>
  value === null ? "not recorded" : new Date(value).toLocaleTimeString();

const createLogEntry = (label: string, details: string): string =>
  `${new Date().toLocaleTimeString()} | ${label} | ${details}`;

export const App = () => {
  const [trackTransitions, setTrackTransitions] = useState(true);
  const [initialOnline, setInitialOnline] = useState(true);

  const [reconnectEnabled, setReconnectEnabled] = useState(true);
  const [resetOnSuccess, setResetOnSuccess] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState("4");
  const [initialDelayMs, setInitialDelayMs] = useState("1200");

  const [heartbeatEnabled, setHeartbeatEnabled] = useState(true);
  const [startHeartbeatOnMount, setStartHeartbeatOnMount] = useState(true);
  const [heartbeatIntervalMs, setHeartbeatIntervalMs] = useState("1500");
  const [heartbeatTimeoutMs, setHeartbeatTimeoutMs] = useState("900");

  const [webSocketUrl, setWebSocketUrl] = useState("ws://localhost:8080");
  const [webSocketAutoConnect, setWebSocketAutoConnect] = useState(false);
  const [webSocketReconnectEnabled, setWebSocketReconnectEnabled] = useState(true);
  const [webSocketHeartbeatEnabled, setWebSocketHeartbeatEnabled] = useState(false);
  const [webSocketHeartbeatIntervalMs, setWebSocketHeartbeatIntervalMs] = useState("5000");
  const [webSocketHeartbeatTimeoutMs, setWebSocketHeartbeatTimeoutMs] = useState("2000");
  const [webSocketMessage, setWebSocketMessage] = useState("hello from demo");

  const [eventSourceUrl, setEventSourceUrl] = useState("http://localhost:8080/sse");
  const [eventSourceAutoConnect, setEventSourceAutoConnect] = useState(false);
  const [eventSourceReconnectEnabled, setEventSourceReconnectEnabled] = useState(true);
  const [eventSourceWithCredentials, setEventSourceWithCredentials] = useState(false);
  const [eventSourceEvents, setEventSourceEvents] = useState("notice");

  const onlineStatus = useOnlineStatus({
    initialOnline,
    trackTransitions
  });

  const heartbeatOptions: UseHeartbeatOptions<string, string> = {
    enabled: heartbeatEnabled,
    intervalMs: Number(heartbeatIntervalMs) || 0,
    matchesAck: (message) => message === "pong",
    startOnMount: startHeartbeatOnMount
  };

  const parsedHeartbeatTimeoutMs = Number(heartbeatTimeoutMs);

  if (Number.isFinite(parsedHeartbeatTimeoutMs) && parsedHeartbeatTimeoutMs > 0) {
    heartbeatOptions.timeoutMs = parsedHeartbeatTimeoutMs;
  }

  const reconnect = useReconnect({
    enabled: reconnectEnabled,
    initialDelayMs: Number(initialDelayMs) || 0,
    jitterRatio: 0,
    maxAttempts: maxAttempts.trim().length === 0 ? null : Number(maxAttempts),
    resetOnSuccess
  });

  const heartbeat = useHeartbeat<string, string>(heartbeatOptions);

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

  const webSocket = useWebSocket<string, string>({
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

  const eventSourceNamedEvents = eventSourceEvents
    .split(",")
    .map((eventName) => eventName.trim())
    .filter((eventName) => eventName.length > 0);

  const eventSource = useEventSource<string>({
    connect: eventSourceAutoConnect,
    events: eventSourceNamedEvents,
    reconnect: eventSourceReconnectEnabled
      ? {
          initialDelayMs: 1_000,
          jitterRatio: 0,
          maxAttempts: 5
        }
      : false,
    url: eventSourceUrl.trim().length === 0 ? () => null : eventSourceUrl.trim(),
    withCredentials: eventSourceWithCredentials
  });

  const [onlineEvents, setOnlineEvents] = useState<string[]>([]);
  const [reconnectEvents, setReconnectEvents] = useState<string[]>([]);
  const [heartbeatEvents, setHeartbeatEvents] = useState<string[]>([]);
  const [webSocketEvents, setWebSocketEvents] = useState<string[]>([]);
  const [eventSourceLog, setEventSourceLog] = useState<string[]>([]);

  useEffect(() => {
    const entry = createLogEntry(
      onlineStatus.isOnline ? "online" : "offline",
      `supported: ${onlineStatus.isSupported}`
    );

    setOnlineEvents((current) => [entry, ...current].slice(0, 8));
  }, [onlineStatus.isOnline, onlineStatus.isSupported]);

  useEffect(() => {
    const entry = createLogEntry(
      reconnect.status,
      `attempt ${reconnect.attempt}, next delay ${reconnect.nextDelayMs ?? "none"}`
    );

    setReconnectEvents((current) => [entry, ...current].slice(0, 8));
  }, [reconnect.attempt, reconnect.nextDelayMs, reconnect.status]);

  useEffect(() => {
    const entry = createLogEntry(
      heartbeat.isRunning ? "running" : "stopped",
      `timed out: ${heartbeat.hasTimedOut}, latency: ${heartbeat.latencyMs ?? "none"}`
    );

    setHeartbeatEvents((current) => [entry, ...current].slice(0, 8));
  }, [heartbeat.hasTimedOut, heartbeat.isRunning, heartbeat.latencyMs]);

  useEffect(() => {
    const details = [
      `message: ${webSocket.lastMessage ?? "none"}`,
      `close: ${webSocket.lastCloseEvent?.code ?? "none"}`,
      `reconnect attempt: ${webSocket.reconnectState?.attempt ?? "none"}`,
      `timed out: ${webSocket.heartbeatState?.hasTimedOut ?? false}`
    ].join(", ");

    const entry = createLogEntry(webSocket.status, details);
    setWebSocketEvents((current) => [entry, ...current].slice(0, 8));
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

  useEffect(() => {
    const details = [
      `event: ${eventSource.lastEventName ?? "none"}`,
      `message: ${eventSource.lastMessage ?? "none"}`,
      `reconnect attempt: ${eventSource.reconnectState?.attempt ?? "none"}`
    ].join(", ");

    const entry = createLogEntry(eventSource.status, details);
    setEventSourceLog((current) => [entry, ...current].slice(0, 8));
  }, [
    eventSource.lastEventName,
    eventSource.lastMessage,
    eventSource.reconnectState?.attempt,
    eventSource.status
  ]);

  const eventSourceSnapshot = {
    ...eventSource,
    eventSource:
      eventSource.eventSource === null
        ? null
        : {
            readyState: eventSource.eventSource.readyState,
            url: eventSource.eventSource.url,
            withCredentials: eventSource.eventSource.withCredentials
          }
  };

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">react-realtime-hooks</p>
        <h1>Realtime hooks playground</h1>
        <p className="lede">
          The demo is split into dedicated blocks, one block per hook. You can
          test browser online state, reconnect scheduling, heartbeat/ack flow,
          live WebSocket transport, and EventSource/SSE behavior independently.
        </p>
      </section>

      <section className="hook-section">
        <div className="section-heading">
          <p className="section-kicker">Hook block</p>
          <h2>useOnlineStatus</h2>
          <p>
            Toggle browser network state in DevTools and watch the hook update
            the status card, timestamps, snapshot, and event log.
          </p>
        </div>

        <div className="grid">
          <article className="panel panel-status">
            <div className="panel-header">
              <span
                className={`badge ${onlineStatus.isOnline ? "online" : "offline"}`}
              >
                {onlineStatus.isOnline ? "Online" : "Offline"}
              </span>
              <span className="support">
                API support: {onlineStatus.isSupported ? "available" : "fallback"}
              </span>
            </div>

            <dl className="stats">
              <div>
                <dt>Last changed</dt>
                <dd>{formatTimestamp(onlineStatus.lastChangedAt)}</dd>
              </div>
              <div>
                <dt>Went online</dt>
                <dd>{formatTimestamp(onlineStatus.wentOnlineAt)}</dd>
              </div>
              <div>
                <dt>Went offline</dt>
                <dd>{formatTimestamp(onlineStatus.wentOfflineAt)}</dd>
              </div>
            </dl>
          </article>

          <article className="panel">
            <h3>Controls</h3>
            <label className="toggle">
              <input
                checked={trackTransitions}
                onChange={(event) => {
                  setTrackTransitions(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Track transition timestamps</span>
            </label>

            <label className="toggle">
              <input
                checked={initialOnline}
                onChange={(event) => {
                  setInitialOnline(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Fallback initialOnline value</span>
            </label>

            <p className="hint">
              Open DevTools, go to the Network tab, and switch the browser to
              <strong> Offline</strong> and back.
            </p>
          </article>

          <article className="panel">
            <h3>Snapshot</h3>
            <pre className="code">{JSON.stringify(onlineStatus, null, 2)}</pre>
          </article>

          <article className="panel panel-log">
            <h3>Event log</h3>
            <ul className="log">
              {onlineEvents.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="hook-section">
        <div className="section-heading">
          <p className="section-kicker">Hook block</p>
          <h2>useReconnect</h2>
          <p>
            Simulate retry scheduling manually. This block is useful for seeing
            state transitions like <code>scheduled</code>, <code>running</code>,
            <code>idle</code>, and <code>stopped</code>.
          </p>
        </div>

        <div className="grid">
          <article className="panel panel-status reconnect-panel">
            <div className="panel-header">
              <span
                className={`badge ${
                  reconnect.status === "running" || reconnect.status === "scheduled"
                    ? "running"
                    : "idle"
                }`}
              >
                {reconnect.status}
              </span>
              <span className="support">
                attempt {reconnect.attempt} | next delay {reconnect.nextDelayMs ?? "none"}
              </span>
            </div>

            <dl className="stats reconnect-stats">
              <div>
                <dt>Active</dt>
                <dd>{reconnect.isActive ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Scheduled</dt>
                <dd>{reconnect.isScheduled ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Reset on success</dt>
                <dd>{resetOnSuccess ? "enabled" : "disabled"}</dd>
              </div>
            </dl>
          </article>

          <article className="panel">
            <h3>Controls</h3>
            <label className="toggle">
              <input
                checked={reconnectEnabled}
                onChange={(event) => {
                  setReconnectEnabled(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Enable reconnect flow</span>
            </label>

            <label className="toggle">
              <input
                checked={resetOnSuccess}
                onChange={(event) => {
                  setResetOnSuccess(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Reset attempts on success</span>
            </label>

            <label className="field">
              <span>Initial delay (ms)</span>
              <input
                className="input"
                inputMode="numeric"
                onChange={(event) => {
                  setInitialDelayMs(event.target.value);
                }}
                value={initialDelayMs}
              />
            </label>

            <label className="field">
              <span>Max attempts (blank = infinite)</span>
              <input
                className="input"
                inputMode="numeric"
                onChange={(event) => {
                  setMaxAttempts(event.target.value);
                }}
                value={maxAttempts}
              />
            </label>

            <div className="actions">
              <button
                className="button"
                onClick={() => {
                  reconnect.schedule();
                }}
                type="button"
              >
                Schedule
              </button>
              <button
                className="button button-ghost"
                onClick={() => {
                  reconnect.cancel();
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-ghost"
                onClick={() => {
                  reconnect.reset();
                }}
                type="button"
              >
                Reset
              </button>
              <button
                className="button button-success"
                onClick={() => {
                  reconnect.markConnected();
                }}
                type="button"
              >
                Mark connected
              </button>
            </div>
          </article>

          <article className="panel">
            <h3>Snapshot</h3>
            <pre className="code">{JSON.stringify(reconnect, null, 2)}</pre>
          </article>

          <article className="panel panel-log">
            <h3>Event log</h3>
            <ul className="log">
              {reconnectEvents.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="hook-section">
        <div className="section-heading">
          <p className="section-kicker">Hook block</p>
          <h2>useHeartbeat</h2>
          <p>
            This block lets you start and stop the heartbeat loop, trigger a
            manual beat, acknowledge it with a synthetic <code>pong</code>, and
            observe timeout and latency behavior.
          </p>
        </div>

        <div className="grid">
          <article className="panel panel-status heartbeat-panel">
            <div className="panel-header">
              <span className={`badge ${heartbeat.isRunning ? "running" : "idle"}`}>
                {heartbeat.isRunning ? "running" : "stopped"}
              </span>
              <span className="support">
                latency {heartbeat.latencyMs ?? "none"} | timeout{" "}
                {heartbeat.hasTimedOut ? "yes" : "no"}
              </span>
            </div>

            <dl className="stats reconnect-stats">
              <div>
                <dt>Last beat</dt>
                <dd>{formatTimestamp(heartbeat.lastBeatAt)}</dd>
              </div>
              <div>
                <dt>Last ack</dt>
                <dd>{formatTimestamp(heartbeat.lastAckAt)}</dd>
              </div>
              <div>
                <dt>Latency (ms)</dt>
                <dd>{heartbeat.latencyMs ?? "none"}</dd>
              </div>
            </dl>
          </article>

          <article className="panel">
            <h3>Controls</h3>
            <label className="toggle">
              <input
                checked={heartbeatEnabled}
                onChange={(event) => {
                  setHeartbeatEnabled(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Enable heartbeat</span>
            </label>

            <label className="toggle">
              <input
                checked={startHeartbeatOnMount}
                onChange={(event) => {
                  setStartHeartbeatOnMount(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Start on mount</span>
            </label>

            <label className="field">
              <span>Interval (ms)</span>
              <input
                className="input"
                inputMode="numeric"
                onChange={(event) => {
                  setHeartbeatIntervalMs(event.target.value);
                }}
                value={heartbeatIntervalMs}
              />
            </label>

            <label className="field">
              <span>Timeout (ms)</span>
              <input
                className="input"
                inputMode="numeric"
                onChange={(event) => {
                  setHeartbeatTimeoutMs(event.target.value);
                }}
                value={heartbeatTimeoutMs}
              />
            </label>

            <div className="actions">
              <button
                className="button"
                onClick={() => {
                  heartbeat.start();
                }}
                type="button"
              >
                Start
              </button>
              <button
                className="button button-ghost"
                onClick={() => {
                  heartbeat.stop();
                }}
                type="button"
              >
                Stop
              </button>
              <button
                className="button button-ghost"
                onClick={() => {
                  heartbeat.beat();
                }}
                type="button"
              >
                Manual beat
              </button>
              <button
                className="button button-success"
                onClick={() => {
                  heartbeat.notifyAck("pong");
                }}
                type="button"
              >
                Ack with pong
              </button>
            </div>
          </article>

          <article className="panel">
            <h3>Snapshot</h3>
            <pre className="code">{JSON.stringify(heartbeat, null, 2)}</pre>
          </article>

          <article className="panel panel-log">
            <h3>Event log</h3>
            <ul className="log">
              {heartbeatEvents.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="hook-section">
        <div className="section-heading">
          <p className="section-kicker">Hook block</p>
          <h2>useWebSocket</h2>
          <p>
            Point this block at your own WebSocket endpoint, then manually
            open, send, close, and reconnect while watching transport,
            reconnect, and heartbeat state in one place.
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
              Use a local or remote echo-capable endpoint. If heartbeat is
              enabled, the hook sends <code>ping</code> and expects{" "}
              <code>pong</code>.
            </p>
          </article>

          <article className="panel">
            <h3>Snapshot</h3>
            <pre className="code">{JSON.stringify(webSocketSnapshot, null, 2)}</pre>
          </article>

          <article className="panel panel-log">
            <h3>Event log</h3>
            <ul className="log">
              {webSocketEvents.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="hook-section">
        <div className="section-heading">
          <p className="section-kicker">Hook block</p>
          <h2>useEventSource</h2>
          <p>
            Point this block at your SSE endpoint, listen to the default
            <code> message</code> event plus optional named events, and inspect
            reconnect behavior without mixing it with WebSocket state.
          </p>
        </div>

        <div className="grid">
          <article className="panel panel-status eventsource-panel">
            <div className="panel-header">
              <span className={`badge ${eventSource.status}`}>
                {eventSource.status}
              </span>
              <span className="support">
                event {eventSource.lastEventName ?? "none"} | connected{" "}
                {eventSource.isConnected ? "yes" : "no"}
              </span>
            </div>

            <dl className="stats reconnect-stats">
              <div>
                <dt>Last changed</dt>
                <dd>{formatTimestamp(eventSource.lastChangedAt)}</dd>
              </div>
              <div>
                <dt>Last message</dt>
                <dd>{eventSource.lastMessage ?? "none"}</dd>
              </div>
              <div>
                <dt>Reconnect attempt</dt>
                <dd>{eventSource.reconnectState?.attempt ?? "none"}</dd>
              </div>
            </dl>
          </article>

          <article className="panel">
            <h3>Controls</h3>
            <label className="field">
              <span>Endpoint URL</span>
              <input
                className="input"
                onChange={(event) => {
                  setEventSourceUrl(event.target.value);
                }}
                placeholder="http://localhost:8080/sse"
                value={eventSourceUrl}
              />
            </label>

            <label className="toggle">
              <input
                checked={eventSourceAutoConnect}
                onChange={(event) => {
                  setEventSourceAutoConnect(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Connect automatically</span>
            </label>

            <label className="toggle">
              <input
                checked={eventSourceReconnectEnabled}
                onChange={(event) => {
                  setEventSourceReconnectEnabled(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Enable reconnect</span>
            </label>

            <label className="toggle">
              <input
                checked={eventSourceWithCredentials}
                onChange={(event) => {
                  setEventSourceWithCredentials(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Use credentials</span>
            </label>

            <label className="field">
              <span>Named events (comma-separated)</span>
              <input
                className="input"
                onChange={(event) => {
                  setEventSourceEvents(event.target.value);
                }}
                placeholder="notice, stats"
                value={eventSourceEvents}
              />
            </label>

            <div className="actions">
              <button
                className="button"
                onClick={() => {
                  eventSource.open();
                }}
                type="button"
              >
                Open
              </button>
              <button
                className="button button-ghost"
                onClick={() => {
                  eventSource.reconnect();
                }}
                type="button"
              >
                Reconnect
              </button>
              <button
                className="button button-success"
                onClick={() => {
                  eventSource.close();
                }}
                type="button"
              >
                Close
              </button>
            </div>

            <p className="hint">
              This block expects an SSE endpoint. Named events are optional;
              the hook always listens to the standard <code>message</code>{" "}
              channel.
            </p>
          </article>

          <article className="panel">
            <h3>Snapshot</h3>
            <pre className="code">{JSON.stringify(eventSourceSnapshot, null, 2)}</pre>
          </article>

          <article className="panel panel-log">
            <h3>Event log</h3>
            <ul className="log">
              {eventSourceLog.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
};
