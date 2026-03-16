import { useEffect, useState } from "react";

import {
  useHeartbeat,
  useOnlineStatus,
  useReconnect
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

  const [onlineEvents, setOnlineEvents] = useState<string[]>([]);
  const [reconnectEvents, setReconnectEvents] = useState<string[]>([]);
  const [heartbeatEvents, setHeartbeatEvents] = useState<string[]>([]);

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

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">react-realtime-hooks</p>
        <h1>Realtime hooks playground</h1>
        <p className="lede">
          The demo is split into dedicated blocks, one block per hook. You can
          test browser online state, reconnect scheduling, and heartbeat/ack
          flow independently.
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
    </main>
  );
};
