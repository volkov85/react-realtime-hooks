import { useEffect, useState } from "react";

import { useEventSource } from "../../../src";
import {
  createLogEntry,
  formatTimestamp,
  pushLogEntry,
  type LogEntry
} from "./shared";

export const EventSourceSection = () => {
  const [eventSourceUrl, setEventSourceUrl] = useState("http://localhost:8080/sse");
  const [eventSourceAutoConnect, setEventSourceAutoConnect] = useState(false);
  const [eventSourceReconnectEnabled, setEventSourceReconnectEnabled] = useState(true);
  const [eventSourceWithCredentials, setEventSourceWithCredentials] = useState(false);
  const [eventSourceEvents, setEventSourceEvents] = useState("notice");
  const [events, setEvents] = useState<LogEntry[]>([]);

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

  useEffect(() => {
    const details = [
      `event: ${eventSource.lastEventName ?? "none"}`,
      `message: ${eventSource.lastMessage ?? "none"}`,
      `reconnect attempt: ${eventSource.reconnectState?.attempt ?? "none"}`
    ].join(", ");

    setEvents((current) =>
      pushLogEntry(current, createLogEntry(eventSource.status, details))
    );
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
            {events.map((entry) => (
              <li key={entry.id}>{entry.text}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
};
