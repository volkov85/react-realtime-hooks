import { useEffect, useState } from "react";

import { useOnlineStatus } from "react-realtime-hooks";

const formatTimestamp = (value: number | null): string =>
  value === null ? "not recorded" : new Date(value).toLocaleTimeString();

export const App = () => {
  const [trackTransitions, setTrackTransitions] = useState(true);
  const [initialOnline, setInitialOnline] = useState(true);
  const status = useOnlineStatus({
    initialOnline,
    trackTransitions
  });

  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const entry = `${new Date().toLocaleTimeString()} | ${
      status.isOnline ? "online" : "offline"
    } | supported: ${status.isSupported}`;

    setEvents((current) => [entry, ...current].slice(0, 8));
  }, [status.isOnline, status.isSupported]);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">react-realtime-hooks</p>
        <h1>useOnlineStatus demo</h1>
        <p className="lede">
          This playground reads the real browser online state through your hook.
          Open DevTools and switch the network tab to <strong>Offline</strong> to
          verify live transitions.
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

        <article className="panel">
          <h2>Controls</h2>
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
          <h2>Hook snapshot</h2>
          <pre className="code">
            {JSON.stringify(status, null, 2)}
          </pre>
        </article>

        <article className="panel">
          <h2>How to test</h2>
          <ol className="steps">
            <li>Run `npm run demo`.</li>
            <li>Open browser DevTools.</li>
            <li>Go to the Network tab.</li>
            <li>Switch throttling to `Offline`, then back to `Online`.</li>
          </ol>
        </article>

        <article className="panel panel-log">
          <h2>Event log</h2>
          <ul className="log">
            {events.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
};
