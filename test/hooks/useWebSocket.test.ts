import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RealtimeErrorEvent, useWebSocket } from "../../src";

// `useWebSocket` defers `new WebSocket(...)` by one microtask so that
// React Strict Mode's mount → cleanup → mount cycle never opens a real
// socket. Tests that synchronously inspect `MockWebSocket.instances`
// after `renderHook` therefore need to flush the microtask queue. We
// pin the helper here instead of inlining `await Promise.resolve()` so
// the intent is obvious at every call site.
const flushMicrotasks = async (): Promise<void> => {
  await act(async () => {});
};

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
  closeCalls = 0;
  closedWith: Array<{ code?: number; reason?: string }> = [];
  listeners = new Map<string, Set<(event: Event) => void>>();
  protocols?: string | string[];
  readyState = MockWebSocket.CONNECTING;
  sent: unknown[] = [];
  url: string;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    if (protocols !== undefined) {
      this.protocols = protocols;
    }
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (event: Event) => void): void {
    const current = this.listeners.get(type) ?? new Set();
    current.add(handler);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, handler: (event: Event) => void): void {
    this.listeners.get(type)?.delete(handler);
  }

  send(message: unknown): void {
    this.sent.push(message);
    this.bufferedAmount = this.sent.length;
  }

  close(code?: number, reason?: string): void {
    this.closeCalls += 1;
    const closedWith: { code?: number; reason?: string } = {};

    if (code !== undefined) {
      closedWith.code = code;
    }

    if (reason !== undefined) {
      closedWith.reason = reason;
    }

    this.closedWith.push(closedWith);
    this.readyState = MockWebSocket.CLOSED;
    const eventInit: CloseEventInit = {
      code: code ?? 1000
    };

    if (reason !== undefined) {
      eventInit.reason = reason;
    }

    this.emit("close", new CloseEvent("close", eventInit));
  }

  emit(type: string, event: Event): void {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }

  emitOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit("open", new Event("open"));
  }

  emitMessage(data: unknown): void {
    this.emit("message", new MessageEvent("message", { data }));
  }

  emitError(): void {
    this.emit("error", new Event("error"));
  }

  emitClose(code = 1006): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", new CloseEvent("close", { code }));
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

describe("useWebSocket", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.useRealTimers();
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it("connects and receives messages", async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket<string>({
        onMessage,
        url: "ws://localhost:1234"
      })
    );

    await flushMicrotasks();
    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    act(() => {
      socket?.emitOpen();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      socket?.emitMessage("hello");
    });

    expect(result.current.lastMessage).toBe("hello");
    expect(onMessage).toHaveBeenCalledWith(
      "hello",
      expect.any(MessageEvent)
    );
  });

  it("serializes and sends messages", async () => {
    const { result } = renderHook(() =>
      useWebSocket<{ ok: boolean }, { ping: boolean }>({
        url: "ws://localhost:1234"
      })
    );

    await flushMicrotasks();
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      const sent = result.current.send({ ping: true });
      expect(sent).toBe(true);
    });

    expect(socket?.sent).toEqual(['{"ping":true}']);
  });

  it("supports manual open when connect is false", async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        connect: false,
        url: "ws://localhost:1234"
      })
    );

    await flushMicrotasks();
    expect(MockWebSocket.instances).toHaveLength(0);

    act(() => {
      result.current.open();
    });

    await flushMicrotasks();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("distinguishes protocol arrays that would collide with joined keys", async () => {
    const { rerender } = renderHook(
      ({ protocols }: { protocols: string[] }) =>
        useWebSocket({
          protocols,
          url: "ws://localhost:1234"
        }),
      {
        initialProps: {
          protocols: ["a|b", "c"]
        }
      }
    );

    await flushMicrotasks();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]?.protocols).toEqual(["a|b", "c"]);

    rerender({
      protocols: ["a", "b|c"]
    });

    await flushMicrotasks();
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1]?.protocols).toEqual(["a", "b|c"]);
  });

  it("keeps imperative methods stable across renders", async () => {
    const { result, rerender } = renderHook(() =>
      useWebSocket({
        url: "ws://localhost:1234"
      })
    );

    await flushMicrotasks();

    const methods = {
      close: result.current.close,
      open: result.current.open,
      reconnect: result.current.reconnect,
      send: result.current.send
    };

    rerender();

    expect(result.current.close).toBe(methods.close);
    expect(result.current.open).toBe(methods.open);
    expect(result.current.reconnect).toBe(methods.reconnect);
    expect(result.current.send).toBe(methods.send);
  });

  it("schedules reconnect after close", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useWebSocket({
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const firstSocket = MockWebSocket.instances[0];

    act(() => {
      firstSocket?.emitOpen();
    });

    act(() => {
      firstSocket?.emitClose();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(MockWebSocket.instances.length).toBe(2);
    expect(result.current.reconnectState?.attempt).toBe(1);
    expect(result.current.status).toBe("reconnecting");
  });

  it("supports manual reconnect", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useWebSocket({
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const firstSocket = MockWebSocket.instances[0];

    act(() => {
      firstSocket?.emitOpen();
      result.current.reconnect();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(firstSocket?.closeCalls).toBe(1);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(result.current.reconnectState?.attempt).toBe(1);
    expect(result.current.status).toBe("reconnecting");
  });

  it("ignores stale events from the previous socket during manual reconnect", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket({
        onError,
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const firstSocket = MockWebSocket.instances[0];

    act(() => {
      firstSocket?.emitOpen();
      result.current.reconnect();
      firstSocket?.emitError();
    });

    expect(onError).not.toHaveBeenCalled();
    expect(result.current.lastError).toBeNull();
    expect(result.current.status).toBe("reconnecting");

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("supports manual close without reconnecting", async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "ws://localhost:1234"
      })
    );

    await flushMicrotasks();
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      result.current.close(4001, "manual-close");
    });

    expect(socket?.closeCalls).toBe(1);
    expect(socket?.closedWith[0]).toEqual({
      code: 4001,
      reason: "manual-close"
    });
    expect(result.current.status).toBe("closed");
    expect(result.current.reconnectState?.status).toBe("stopped");
  });

  it("integrates heartbeat ack state", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useWebSocket<string, string>({
        heartbeat: {
          intervalMs: 100,
          matchesAck: (message: string) => message === "pong",
          message: "ping",
          timeoutMs: 500
        },
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
      vi.advanceTimersByTime(100);
    });

    expect(socket?.sent).toContain("ping");

    act(() => {
      socket?.emitMessage("pong");
    });

    expect(result.current.heartbeatState?.lastAckAt).not.toBeNull();
  });

  it("stops heartbeat after manual close", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useWebSocket<string, string>({
        heartbeat: {
          intervalMs: 100,
          message: "ping",
          timeoutMs: 500
        },
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
      vi.advanceTimersByTime(100);
    });

    expect(socket?.sent).toEqual(["ping"]);

    act(() => {
      result.current.close();
      vi.advanceTimersByTime(300);
    });

    expect(result.current.heartbeatState?.isRunning).toBe(false);
    expect(socket?.sent).toEqual(["ping"]);
  });

  it("reconnects on heartbeat timeout by default", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket<string, string>({
        heartbeat: {
          intervalMs: 100,
          message: "ping",
          timeoutMs: 50
        },
        onError,
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
      vi.advanceTimersByTime(150);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(socket?.closeCalls).toBe(1);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.lastError).toBeInstanceOf(RealtimeErrorEvent);
    expect(result.current.lastError?.type).toBe("heartbeat-timeout");
    expect((result.current.lastError as RealtimeErrorEvent).kind).toBe(
      "heartbeat-timeout"
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "heartbeat-timeout" })
    );
  });

  it("moves to error on heartbeat timeout when reconnect is disabled", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useWebSocket<string, string>({
        heartbeat: {
          intervalMs: 100,
          message: "ping",
          timeoutMs: 50
        },
        reconnect: false,
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
      vi.advanceTimersByTime(150);
    });

    expect(socket?.closeCalls).toBe(1);
    expect(result.current.status).toBe("error");
    expect(result.current.lastError).toBeInstanceOf(RealtimeErrorEvent);
    expect(result.current.lastError?.type).toBe("heartbeat-timeout");
    expect((result.current.lastError as RealtimeErrorEvent).kind).toBe(
      "heartbeat-timeout"
    );
  });

  it("reconnects when the heartbeat beat throws", async () => {
    vi.useFakeTimers();
    const heartbeatCause = new Error("beat failed");

    const { result } = renderHook(() =>
      useWebSocket<string, string>({
        heartbeat: {
          beat: () => {
            throw heartbeatCause;
          },
          intervalMs: 100,
          timeoutMs: 50
        },
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(socket?.closeCalls).toBe(1);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.lastError).toBeInstanceOf(RealtimeErrorEvent);
    expect(result.current.lastError?.type).toBe("heartbeat-error");
    expect((result.current.lastError as RealtimeErrorEvent).kind).toBe(
      "heartbeat-error"
    );
    expect((result.current.lastError as RealtimeErrorEvent).cause).toBe(
      heartbeatCause
    );
  });

  it("closes the socket and stops reconnect after parse errors", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const parseCause = new Error("invalid payload");

    const { result } = renderHook(() =>
      useWebSocket<number>({
        onError,
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        parseMessage: () => {
          throw parseCause;
        },
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
    });

    expect(result.current.status).toBe("open");

    act(() => {
      socket?.emitMessage("bad");
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
    expect(socket?.closeCalls).toBe(1);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: parseCause,
        kind: "parse-error",
        type: "error"
      })
    );
  });

  it("updates lastChangedAt when the socket emits an error", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({
        onError,
        url: "ws://localhost:1234"
      })
    );

    await flushMicrotasks();
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    const openedAt = result.current.lastChangedAt;

    act(() => {
      socket?.emitError();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.lastChangedAt).not.toBeNull();
    expect(result.current.lastChangedAt).not.toBe(openedAt);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" })
    );
  });

  it("cleans up listeners and timers on unmount", async () => {
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() =>
      useWebSocket<string, string>({
        heartbeat: {
          intervalMs: 100,
          message: "ping"
        },
        reconnect: {
          initialDelayMs: 0,
          jitterRatio: 0
        },
        url: "ws://localhost:1234"
      })
    );

    await act(async () => {});
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket?.emitOpen();
    });

    expect(result.current.status).toBe("open");

    expect(socket?.listenerCount("open")).toBe(1);
    expect(socket?.listenerCount("message")).toBe(1);
    expect(socket?.listenerCount("error")).toBe(1);
    expect(socket?.listenerCount("close")).toBe(1);

    unmount();

    expect(socket?.closeCalls).toBe(1);
    expect(socket?.listenerCount("open")).toBe(0);
    expect(socket?.listenerCount("message")).toBe(0);
    expect(socket?.listenerCount("error")).toBe(0);
    expect(socket?.listenerCount("close")).toBe(0);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("opens exactly one socket under React Strict Mode's mount cycle", async () => {
    // Strict Mode in dev double-invokes the effect mount → cleanup →
    // mount before any microtask flushes. The cleanup's `cancelled`
    // flag must prevent the discarded mount's queued `new WebSocket(...)`
    // from ever running, so only the surviving mount opens a socket.
    // This is enforced globally for every test in this file via
    // `configure({ reactStrictMode: true })` in `test/setup.ts`, but
    // we pin the contract explicitly here so a regression in the
    // microtask debounce is loud and locally diagnosable.
    renderHook(() =>
      useWebSocket({
        url: "ws://localhost:1234"
      })
    );

    await flushMicrotasks();

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("opens no socket if the component unmounts before the microtask flush", async () => {
    // Strict-Mode-style mount → unmount in the same synchronous batch
    // is the worst-case timing for any deferred-allocation scheme. The
    // microtask must observe `cancelled === true` and skip
    // `new WebSocket(...)` entirely.
    const { unmount } = renderHook(() =>
      useWebSocket({
        url: "ws://localhost:1234"
      })
    );
    unmount();

    await flushMicrotasks();

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("reports unsupported runtime", () => {
    globalThis.WebSocket = undefined as unknown as typeof WebSocket;

    const { result } = renderHook(() =>
      useWebSocket({
        url: "ws://localhost:1234"
      })
    );

    expect(result.current.isSupported).toBe(false);
    expect(result.current.status).toBe("closed");
  });
});
