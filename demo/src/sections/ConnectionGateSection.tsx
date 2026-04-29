import { useEffect, useState } from "react";

import { useConnectionGate } from "../../../src";

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

export const ConnectionGateSection = () => {
  const [enabled, setEnabled] = useState(true);
  const [requireOnline, setRequireOnline] = useState(true);
  const [requireVisible, setRequireVisible] = useState(true);
  const [trackTransitions, setTrackTransitions] = useState(true);
  const [initialOnline, setInitialOnline] = useState(true);
  const [initialVisible, setInitialVisible] = useState(true);
  const [hiddenGraceMs, setHiddenGraceMs] = useState("3000");
  const [events, setEvents] = useState<LogEntry[]>([]);

  const parsedHiddenGraceMs = Number(hiddenGraceMs);
  const gate = useConnectionGate({
    enabled,
    hiddenGraceMs:
      Number.isFinite(parsedHiddenGraceMs) && parsedHiddenGraceMs > 0
        ? parsedHiddenGraceMs
        : 0,
    initialOnline,
    initialVisible,
    requireOnline,
    requireVisible,
    trackTransitions
  });

  useEffect(() => {
    const details = [
      `connect: ${gate.connect}`,
      `online: ${gate.isOnline}`,
      `visible: ${gate.isVisible}`,
      `waiting grace: ${gate.isWaitingForVisibleGrace}`
    ].join(", ");

    const entry = createLogEntry(gate.reason, details);
    setEvents((current) => [entry, ...current].slice(0, 8));
  }, [
    gate.connect,
    gate.isOnline,
    gate.isVisible,
    gate.isWaitingForVisibleGrace,
    gate.reason
  ]);

  return (
    <section className="hook-section">
      <div className="section-heading">
        <p className="section-kicker">Hook block</p>
        <h2>useConnectionGate</h2>
        <p>
          This block composes browser online and visibility state into a single
          <code> connect</code> flag you can pass into <code>useWebSocket</code>
          or <code>useEventSource</code>. It is the missing orchestration layer
          between browser awareness and transport hooks.
        </p>
      </div>

      <div className="grid">
        <article className="panel panel-status gate-panel">
          <div className="panel-header">
            <span className={`badge ${gate.reason}`}>
              {gate.connect ? "Ready" : gate.reason}
            </span>
            <span className="support">
              connect {gate.connect ? "enabled" : "blocked"} | waiting grace{" "}
              {gate.isWaitingForVisibleGrace ? "yes" : "no"}
            </span>
          </div>

          <dl className="stats reconnect-stats">
            <div>
              <dt>Last changed</dt>
              <dd>{formatTimestamp(gate.lastChangedAt)}</dd>
            </div>
            <div>
              <dt>Became ready</dt>
              <dd>{formatTimestamp(gate.becameReadyAt)}</dd>
            </div>
            <div>
              <dt>Became blocked</dt>
              <dd>{formatTimestamp(gate.becameBlockedAt)}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <h3>Controls</h3>
          <label className="toggle">
            <input
              checked={enabled}
              onChange={(event) => {
                setEnabled(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Gate enabled</span>
          </label>

          <label className="toggle">
            <input
              checked={requireOnline}
              onChange={(event) => {
                setRequireOnline(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Require online browser state</span>
          </label>

          <label className="toggle">
            <input
              checked={requireVisible}
              onChange={(event) => {
                setRequireVisible(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Require visible tab</span>
          </label>

          <label className="toggle">
            <input
              checked={trackTransitions}
              onChange={(event) => {
                setTrackTransitions(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Track gate transition timestamps</span>
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

          <label className="field">
            <span>Hidden grace (ms)</span>
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) => {
                setHiddenGraceMs(event.target.value);
              }}
              value={hiddenGraceMs}
            />
          </label>

          <p className="hint">
            Toggle browser offline in DevTools or move this page into the
            background to see the gate switch between <code>ready</code>,
            <code>offline</code>, and <code>hidden</code>.
          </p>
        </article>

        <article className="panel">
          <h3>Snapshot</h3>
          <pre className="code">{JSON.stringify(gate, null, 2)}</pre>
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
