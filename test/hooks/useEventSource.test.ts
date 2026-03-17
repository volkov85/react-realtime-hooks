import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEventSource } from "../../src";

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

  it("supports manual open when connect is false", () => {
    const { result } = renderHook(() =>
      useEventSource({
        connect: false,
        url: "http://localhost:3000/sse"
      })
    );

    expect(MockEventSource.instances).toHaveLength(0);

    act(() => {
      result.current.open();
    });

    expect(MockEventSource.instances).toHaveLength(1);
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

  it("marks parse errors as error state", async () => {
    const { result } = renderHook(() =>
      useEventSource<number>({
        parseMessage: () => {
          throw new Error("invalid payload");
        },
        url: "http://localhost:3000/sse"
      })
    );

    const source = MockEventSource.instances[0];

    act(() => {
      source?.emitOpen();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      source?.emitMessage("bad");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.lastError).not.toBeNull();
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

  it("passes withCredentials to the transport", () => {
    renderHook(() =>
      useEventSource({
        url: "http://localhost:3000/sse",
        withCredentials: true
      })
    );

    expect(MockEventSource.instances[0]?.withCredentials).toBe(true);
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
