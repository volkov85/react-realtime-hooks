import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RealtimeErrorEvent, useEventSource } from "../../src";

// `useEventSource` defers `new EventSource(...)` by one microtask so
// that React Strict Mode's mount → cleanup → mount cycle never opens a
// real source. Tests that synchronously inspect
// `MockEventSource.instances` after `renderHook` therefore need to
// flush the microtask queue. We pin the helper here instead of
// inlining `await Promise.resolve()` so the intent is obvious at every
// call site.
const flushMicrotasks = async (): Promise<void> => {
  await act(async () => {});
};

class MockEventSource {
  static instances: MockEventSource[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  closeCalls = 0;
  listeners = new Map<string, Set<(event: Event) => void>>();
  readyState = MockEventSource.CONNECTING;
  url: string;
  withCredentials: boolean;

  constructor(url: string, init?: EventSourceInit) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (event: Event) => void): void {
    const current = this.listeners.get(type) ?? new Set();
    current.add(handler);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, handler: (event: Event) => void): void {
    this.listeners.get(type)?.delete(handler);
  }

  close(): void {
    this.closeCalls += 1;
    this.readyState = MockEventSource.CLOSED;
  }

  emit(type: string, event: Event): void {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }

  emitOpen(): void {
    this.readyState = MockEventSource.OPEN;
    this.emit("open", new Event("open"));
  }

  emitMessage(data: string, type = "message"): void {
    this.emit(type, new MessageEvent(type, { data }));
  }

  emitError(readyState = MockEventSource.CLOSED): void {
    this.readyState = readyState;
    this.emit("error", new Event("error"));
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

describe("useEventSource", () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    vi.useRealTimers();
    MockEventSource.instances = [];
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
  });

  it("connects and receives default messages", async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useEventSource<string>({
        onMessage,
        url: "http://localhost:3000/sse"
      })
    );

    await flushMicrotasks();
    const source = MockEventSource.instances[0];
    expect(source).toBeDefined();

    act(() => {
      source?.emitOpen();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      source?.emitMessage("hello");
    });

    expect(result.current.lastMessage).toBe("hello");
    expect(result.current.lastEventName).toBe("message");
    expect(onMessage).toHaveBeenCalledWith(
      "hello",
      expect.any(MessageEvent)
    );
  });

  it("handles named events", async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() =>
      useEventSource<string>({
        events: ["notice"],
        onEvent,
        url: "http://localhost:3000/sse"
      })
    );

    await flushMicrotasks();
    const source = MockEventSource.instances[0];

    act(() => {
      source?.emitOpen();
      source?.emitMessage("named payload", "notice");
    });

    await waitFor(() => {
      expect(result.current.lastEventName).toBe("notice");
    });

    expect(result.current.lastMessage).toBe("named payload");
    expect(onEvent).toHaveBeenCalledWith(
      "notice",
      "named payload",
      expect.any(MessageEvent)
    );
  });

  it("supports manual open when connect is false", async () => {
    const { result } = renderHook(() =>
      useEventSource({
        connect: false,
        url: "http://localhost:3000/sse"
      })
    );

    await flushMicrotasks();
    expect(MockEventSource.instances).toHaveLength(0);

    act(() => {
      result.current.open();
    });

    await flushMicrotasks();
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("keeps imperative methods stable across renders", async () => {
    const { result, rerender } = renderHook(() =>
      useEventSource({
        url: "http://localhost:3000/sse"
      })
    );

    await flushMicrotasks();

    const methods = {
      close: result.current.close,
      open: result.current.open,
      reconnect: result.current.reconnect
    };

    rerender();

    expect(result.current.close).toBe(methods.close);
    expect(result.current.open).toBe(methods.open);
    expect(result.current.reconnect).toBe(methods.reconnect);
  });

  it("distinguishes event arrays that would collide with joined keys", async () => {
    const { rerender } = renderHook(
      ({ events }: { events: string[] }) =>
        useEventSource({
          events,
          url: "http://localhost:3000/sse"
        }),
      {
        initialProps: {
          events: ["a|b", "c"]
        }
      }
    );

    await flushMicrotasks();
    const firstSource = MockEventSource.instances[0];

    expect(MockEventSource.instances).toHaveLength(1);
    expect(firstSource?.listenerCount("a|b")).toBe(1);
    expect(firstSource?.listenerCount("c")).toBe(1);

    rerender({
      events: ["a", "b|c"]
    });

    await flushMicrotasks();
    const secondSource = MockEventSource.instances[1];

    expect(firstSource?.closeCalls).toBe(1);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(secondSource?.listenerCount("a")).toBe(1);
    expect(secondSource?.listenerCount("b|c")).toBe(1);
  });

  it("does not reconnect for event list ordering, duplicates, or message aliases", async () => {
    const { rerender } = renderHook(
      ({ events }: { events: string[] }) =>
        useEventSource({
          events,
          url: "http://localhost:3000/sse"
        }),
      {
        initialProps: {
          events: ["notice", "message", "notice"]
        }
      }
    );

    await flushMicrotasks();

    rerender({
      events: ["message", "notice"]
    });

    await flushMicrotasks();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.listenerCount("message")).toBe(1);
    expect(MockEventSource.instances[0]?.listenerCount("notice")).toBe(1);
  });

  it("reconnects after a closed error", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useEventSource({
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "http://localhost:3000/sse"
      })
    );

    await act(async () => {});
    const firstSource = MockEventSource.instances[0];

    act(() => {
      firstSource?.emitOpen();
      firstSource?.emitError(MockEventSource.CLOSED);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(MockEventSource.instances.length).toBe(2);
    expect(result.current.reconnectState?.attempt).toBe(1);
    expect(result.current.status).toBe("reconnecting");
  });

  it("uses the reconnect strategy instead of native EventSource retry", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useEventSource({
        reconnect: {
          initialDelayMs: 1_000,
          jitterRatio: 0
        },
        url: "http://localhost:3000/sse"
      })
    );

    await act(async () => {});
    const firstSource = MockEventSource.instances[0];

    act(() => {
      firstSource?.emitOpen();
      firstSource?.emitError(MockEventSource.CONNECTING);
    });

    expect(firstSource?.closeCalls).toBe(1);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.reconnectState?.status).toBe("scheduled");
    expect(result.current.reconnectState?.nextDelayMs).toBe(1_000);

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(MockEventSource.instances).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(result.current.reconnectState?.attempt).toBe(1);
    expect(result.current.status).toBe("reconnecting");
  });

  it("supports manual reconnect", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useEventSource({
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "http://localhost:3000/sse"
      })
    );

    await act(async () => {});
    const firstSource = MockEventSource.instances[0];

    act(() => {
      firstSource?.emitOpen();
      result.current.reconnect();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(firstSource?.closeCalls).toBe(1);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(result.current.reconnectState?.attempt).toBe(1);
    expect(result.current.status).toBe("reconnecting");
  });

  it("ignores stale events from the previous source during manual reconnect", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const onMessage = vi.fn();

    const { result } = renderHook(() =>
      useEventSource<string>({
        onError,
        onMessage,
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "http://localhost:3000/sse"
      })
    );

    await act(async () => {});
    const firstSource = MockEventSource.instances[0];

    act(() => {
      firstSource?.emitOpen();
      result.current.reconnect();
      firstSource?.emitError(MockEventSource.CLOSED);
      firstSource?.emitMessage("stale payload");
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
    expect(result.current.lastError).toBeNull();
    expect(result.current.lastMessage).toBeNull();
    expect(result.current.status).toBe("reconnecting");

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("supports manual close without reconnecting", async () => {
    const { result } = renderHook(() =>
      useEventSource({
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "http://localhost:3000/sse"
      })
    );

    await flushMicrotasks();
    const source = MockEventSource.instances[0];

    act(() => {
      source?.emitOpen();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      result.current.close();
    });

    expect(source?.closeCalls).toBe(1);
    expect(result.current.status).toBe("closed");
    expect(result.current.reconnectState?.status).toBe("stopped");
  });

  it("closes the source and stops reconnect after parse errors", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const parseCause = new Error("invalid payload");

    const { result } = renderHook(() =>
      useEventSource<number>({
        onError,
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        parseMessage: () => {
          throw parseCause;
        },
        url: "http://localhost:3000/sse"
      })
    );

    await act(async () => {});
    const source = MockEventSource.instances[0];

    act(() => {
      source?.emitOpen();
    });

    expect(result.current.status).toBe("open");

    act(() => {
      source?.emitMessage("bad");
    });

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.lastError).toBeInstanceOf(RealtimeErrorEvent);
    expect((result.current.lastError as RealtimeErrorEvent).kind).toBe(
      "parse-error"
    );
    expect((result.current.lastError as RealtimeErrorEvent).cause).toBe(
      parseCause
    );
    expect(result.current.reconnectState?.status).toBe("stopped");
    expect(source?.closeCalls).toBe(1);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: parseCause,
        kind: "parse-error",
        type: "error"
      })
    );
  });

  it("cleans up listeners on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useEventSource({
        events: ["notice"],
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "http://localhost:3000/sse"
      })
    );

    await flushMicrotasks();
    const source = MockEventSource.instances[0];

    act(() => {
      source?.emitOpen();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    expect(source?.listenerCount("open")).toBe(1);
    expect(source?.listenerCount("message")).toBe(1);
    expect(source?.listenerCount("notice")).toBe(1);
    expect(source?.listenerCount("error")).toBe(1);

    unmount();

    expect(source?.closeCalls).toBe(1);
    expect(source?.listenerCount("open")).toBe(0);
    expect(source?.listenerCount("message")).toBe(0);
    expect(source?.listenerCount("notice")).toBe(0);
    expect(source?.listenerCount("error")).toBe(0);
  });

  it("passes withCredentials to the transport", async () => {
    renderHook(() =>
      useEventSource({
        url: "http://localhost:3000/sse",
        withCredentials: true
      })
    );

    await flushMicrotasks();
    expect(MockEventSource.instances[0]?.withCredentials).toBe(true);
  });

  it("opens exactly one source under React Strict Mode's mount cycle", async () => {
    // Strict Mode in dev double-invokes the effect mount → cleanup →
    // mount before any microtask flushes. The cleanup's `cancelled`
    // flag must prevent the discarded mount's queued
    // `new EventSource(...)` from ever running, so only the surviving
    // mount opens a source.
    renderHook(() =>
      useEventSource({
        url: "http://localhost:3000/sse"
      })
    );

    await flushMicrotasks();

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("close() called before the deferred allocation does not open a source", async () => {
    const { result } = renderHook(() =>
      useEventSource({
        reconnect: false,
        url: "http://localhost:3000/sse"
      })
    );

    act(() => {
      result.current.close();
    });

    await flushMicrotasks();

    expect(MockEventSource.instances).toHaveLength(0);
    expect(result.current.status).toBe("closed");
  });

  it("opens no source if the component unmounts before the microtask flush", async () => {
    // Mount → unmount in the same synchronous batch is the worst-case
    // timing for any deferred-allocation scheme. The microtask must
    // observe `cancelled === true` and skip `new EventSource(...)`
    // entirely.
    const { unmount } = renderHook(() =>
      useEventSource({
        url: "http://localhost:3000/sse"
      })
    );
    unmount();

    await flushMicrotasks();

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("reports unsupported runtime", () => {
    globalThis.EventSource = undefined as unknown as typeof EventSource;

    const { result } = renderHook(() =>
      useEventSource({
        url: "http://localhost:3000/sse"
      })
    );

    expect(result.current.isSupported).toBe(false);
    expect(result.current.status).toBe("closed");
  });
});
