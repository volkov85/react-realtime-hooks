import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWebSocket } from "../../src";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
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

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", new CloseEvent("close", { code: 1000 }));
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

  it("supports manual open when connect is false", () => {
    const { result } = renderHook(() =>
      useWebSocket({
        connect: false,
        url: "ws://localhost:1234"
      })
    );

    expect(MockWebSocket.instances).toHaveLength(0);

    act(() => {
      result.current.open();
    });

    expect(MockWebSocket.instances).toHaveLength(1);
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

  it("integrates heartbeat ack state", () => {
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
