import { useEffect, useState } from "react";

import { useReconnect } from "../../../src";
import { createLogEntry, pushLogEntry, type LogEntry } from "./shared";

export const ReconnectSection = () => {
  const [reconnectEnabled, setReconnectEnabled] = useState(true);
  const [resetOnSuccess, setResetOnSuccess] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState("4");
  const [initialDelayMs, setInitialDelayMs] = useState("1200");
  const [events, setEvents] = useState<LogEntry[]>([]);

  const reconnect = useReconnect({
    enabled: reconnectEnabled,
    initialDelayMs: Number(initialDelayMs) || 0,
    jitterRatio: 0,
    maxAttempts: maxAttempts.trim().length === 0 ? null : Number(maxAttempts),
    resetOnSuccess
  });

  useEffect(() => {
    setEvents((current) =>
      pushLogEntry(
        current,
        createLogEntry(
          reconnect.status,
          `attempt ${reconnect.attempt}, next delay ${reconnect.nextDelayMs ?? "none"}`
        )
      )
    );
  }, [reconnect.attempt, reconnect.nextDelayMs, reconnect.status]);

  return (
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
            {events.map((entry) => (
              <li key={entry.id}>{entry.text}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
};
