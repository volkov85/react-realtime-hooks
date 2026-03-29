import { useEffect, useState } from "react";

import { usePageVisibility } from "../../src";

type LogEntry = {
  id: string;
  text: string;
};

const formatTimestamp = (value: number | null): string =>
  value === null ? "not recorded" : new Date(value).toLocaleTimeString();

const createLogEntry = (label: string, details: string): LogEntry => ({
  id: `${Date.now()}-${crypto.randomUUID()}`,
  text: `${new Date().toLocaleTimeString()} | ${label} | ${details}`
});

export const PageVisibilitySection = () => {
  const [trackTransitions, setTrackTransitions] = useState(true);
  const [initialVisible, setInitialVisible] = useState(true);
  const pageVisibility = usePageVisibility({
    initialVisible,
    trackTransitions
  });
  const [events, setEvents] = useState<LogEntry[]>([]);

  useEffect(() => {
    const entry = createLogEntry(
      pageVisibility.isVisible ? "visible" : "hidden",
      `state: ${pageVisibility.visibilityState}, supported: ${pageVisibility.isSupported}`
    );

    setEvents((current) => [entry, ...current].slice(0, 8));
  }, [
    pageVisibility.isSupported,
    pageVisibility.isVisible,
    pageVisibility.visibilityState
  ]);

  return (
    <section className="hook-section">
      <div className="section-heading">
        <p className="section-kicker">Hook block</p>
        <h2>usePageVisibility</h2>
        <p>
          Switch tabs, minimize the browser, or return to this page and watch
          the hook track visibility state and transition timestamps without
          touching the server render path.
        </p>
      </div>

      <div className="grid">
        <article className="panel panel-status">
          <div className="panel-header">
            <span className={`badge ${pageVisibility.isVisible ? "open" : "closed"}`}>
              {pageVisibility.isVisible ? "Visible" : "Hidden"}
            </span>
            <span className="support">
              state {pageVisibility.visibilityState} | support{" "}
              {pageVisibility.isSupported ? "available" : "fallback"}
            </span>
          </div>

          <dl className="stats">
            <div>
              <dt>Last changed</dt>
              <dd>{formatTimestamp(pageVisibility.lastChangedAt)}</dd>
            </div>
            <div>
              <dt>Became visible</dt>
              <dd>{formatTimestamp(pageVisibility.becameVisibleAt)}</dd>
            </div>
            <div>
              <dt>Became hidden</dt>
              <dd>{formatTimestamp(pageVisibility.becameHiddenAt)}</dd>
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
              checked={initialVisible}
              onChange={(event) => {
                setInitialVisible(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Fallback initialVisible value</span>
          </label>

          <p className="hint">
            Open another tab or app window, then come back here to trigger
            <strong> visibilitychange</strong> in the browser.
          </p>
        </article>

        <article className="panel">
          <h3>Snapshot</h3>
          <pre className="code">{JSON.stringify(pageVisibility, null, 2)}</pre>
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
