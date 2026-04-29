import { useEffect, useState } from "react";

import { useHeartbeat } from "../../../src";
import {
  createLogEntry,
  formatTimestamp,
  pushLogEntry,
  type LogEntry
} from "./shared";
import type { UseHeartbeatOptions } from "../../../src";

export const HeartbeatSection = () => {
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(true);
  const [startHeartbeatOnMount, setStartHeartbeatOnMount] = useState(true);
  const [heartbeatIntervalMs, setHeartbeatIntervalMs] = useState("1500");
  const [heartbeatTimeoutMs, setHeartbeatTimeoutMs] = useState("900");
  const [events, setEvents] = useState<LogEntry[]>([]);

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

  const heartbeat = useHeartbeat<string, string>(heartbeatOptions);

  useEffect(() => {
    setEvents((current) =>
      pushLogEntry(
        current,
        createLogEntry(
          heartbeat.isRunning ? "running" : "stopped",
          `timed out: ${heartbeat.hasTimedOut}, latency: ${heartbeat.latencyMs ?? "none"}`
        )
      )
    );
  }, [heartbeat.hasTimedOut, heartbeat.isRunning, heartbeat.latencyMs]);

  return (
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
            {events.map((entry) => (
              <li key={entry.id}>{entry.text}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
};
