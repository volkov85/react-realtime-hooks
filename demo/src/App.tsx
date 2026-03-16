import { useEffect, useState } from "react";

import { useOnlineStatus, useReconnect } from "../../src";

const formatTimestamp = (value: number | null): string =>
  value === null ? "not recorded" : new Date(value).toLocaleTimeString();

export const App = () => {
  const [trackTransitions, setTrackTransitions] = useState(true);
  const [initialOnline, setInitialOnline] = useState(true);
  const [reconnectEnabled, setReconnectEnabled] = useState(true);
  const [resetOnSuccess, setResetOnSuccess] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState("4");
  const [initialDelayMs, setInitialDelayMs] = useState("1200");
  const status = useOnlineStatus({
    initialOnline,
    trackTransitions,
  });
  const reconnect = useReconnect({
    enabled: reconnectEnabled,
    initialDelayMs: Number(initialDelayMs) || 0,
    jitterRatio: 0,
    maxAttempts: maxAttempts.trim().length === 0 ? null : Number(maxAttempts),
    resetOnSuccess,
  });

  const [events, setEvents] = useState<string[]>([]);
  const [reconnectEvents, setReconnectEvents] = useState<string[]>([]);

  useEffect(() => {
    const entry = `${new Date().toLocaleTimeString()} | ${
      status.isOnline ? "online" : "offline"
    } | supported: ${status.isSupported}`;

    setEvents((current) => [entry, ...current].slice(0, 8));
  }, [status.isOnline, status.isSupported]);

  useEffect(() => {
    const entry = `${new Date().toLocaleTimeString()} | ${
      reconnect.status
    } | attempt ${reconnect.attempt} | next delay: ${
      reconnect.nextDelayMs ?? "none"
    }`;

    setReconnectEvents((current) => [entry, ...current].slice(0, 8));
  }, [reconnect.attempt, reconnect.nextDelayMs, reconnect.status]);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">react-realtime-hooks</p>
        <h1>Realtime hooks playground</h1>
        <p className="lede">
          This playground now covers the first two hooks: the browser online
          state and the reconnect state machine. Use DevTools for the network
          demo and the control panel below to simulate retry flow.
        </p>
      </section>

      <section className="grid">
        <article className="panel panel-status">
          <div className="panel-header">
            <span className={`badge ${status.isOnline ? "online" : "offline"}`}>
              {status.isOnline ? "Online" : "Offline"}
            </span>
            <span className="support">
              API support: {status.isSupported ? "available" : "fallback"}
            </span>
          </div>

          <dl className="stats">
            <div>
              <dt>Last changed</dt>
              <dd>{formatTimestamp(status.lastChangedAt)}</dd>
            </div>
            <div>
              <dt>Went online</dt>
              <dd>{formatTimestamp(status.wentOnlineAt)}</dd>
            </div>
            <div>
              <dt>Went offline</dt>
              <dd>{formatTimestamp(status.wentOfflineAt)}</dd>
            </div>
          </dl>
        </article>

        <article className="panel panel-status reconnect-panel">
          <div className="panel-header">
            <span
              className={`badge ${
                reconnect.status === "running" ||
                reconnect.status === "scheduled"
                  ? "running"
                  : "idle"
              }`}
            >
              {reconnect.status}
            </span>
            <span className="support">
              attempt {reconnect.attempt} | next delay{" "}
              {reconnect.nextDelayMs ?? "none"}
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
          <h2>Online controls</h2>
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
            The fallback value is only used when the browser does not expose
            `navigator.onLine`.
          </p>
        </article>

        <article className="panel">
          <h2>Reconnect controls</h2>
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
          <h2>useOnlineStatus snapshot</h2>
          <pre className="code">{JSON.stringify(status, null, 2)}</pre>
        </article>

        <article className="panel">
          <h2>useReconnect snapshot</h2>
          <pre className="code">{JSON.stringify(reconnect, null, 2)}</pre>
        </article>

        <article className="panel">
          <h2>How to test</h2>
          <ol className="steps">
            <li>Run `npm run demo`.</li>
            <li>
              Use DevTools Network tab to switch browser offline and online.
            </li>
            <li>
              Use the reconnect buttons to schedule, cancel, reset, and complete
              attempts.
            </li>
            <li>
              Set max attempts to `1` or `2` to watch the hook move into
              `stopped`.
            </li>
          </ol>
        </article>

        <article className="panel panel-log">
          <h2>Online event log</h2>
          <ul className="log">
            {events.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </article>

        <article className="panel panel-log">
          <h2>Reconnect event log</h2>
          <ul className="log">
            {reconnectEvents.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
};
