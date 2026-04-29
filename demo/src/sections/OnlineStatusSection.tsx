import { useEffect, useState } from "react";

import { useOnlineStatus } from "../../../src";
import {
  createLogEntry,
  formatTimestamp,
  pushLogEntry,
  type LogEntry
} from "./shared";

export const OnlineStatusSection = () => {
  const [trackTransitions, setTrackTransitions] = useState(true);
  const [initialOnline, setInitialOnline] = useState(true);
  const [events, setEvents] = useState<LogEntry[]>([]);

  const onlineStatus = useOnlineStatus({
    initialOnline,
    trackTransitions
  });

  useEffect(() => {
    setEvents((current) =>
      pushLogEntry(
        current,
        createLogEntry(
          onlineStatus.isOnline ? "online" : "offline",
          `supported: ${onlineStatus.isSupported}`
        )
      )
    );
  }, [onlineStatus.isOnline, onlineStatus.isSupported]);

  return (
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
            {events.map((entry) => (
              <li key={entry.id}>{entry.text}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
};
