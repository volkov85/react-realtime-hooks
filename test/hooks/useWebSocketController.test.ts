import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useWebSocketController } from "../../src/hooks/useWebSocketController";

describe("useWebSocketController", () => {
  it("starts with no manual state, no terminal error, and no pending action", () => {
    const { result } = renderHook(() => useWebSocketController());

    expect(result.current.hasManualCloseRequested()).toBe(false);
    expect(result.current.hasManualOpenRequested()).toBe(false);
    expect(result.current.peekTerminalError()).toBeNull();
    expect(result.current.isReconnectSuppressed()).toBe(false);
    expect(result.current.consumePendingCloseAction()).toBeNull();
    expect(result.current.consumeSkipNextCloseReconnect()).toBe(false);
  });

  it("returns the same controller instance across renders", () => {
    const { result, rerender } = renderHook(() => useWebSocketController());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it("noteUserOpenRequested clears manual-close, sets manual-open, clears suppress and terminal", () => {
    const { result } = renderHook(() => useWebSocketController());

    result.current.noteUserCloseRequested();
    result.current.noteParseError(new Event("parse"));
    expect(result.current.hasManualCloseRequested()).toBe(true);
    expect(result.current.peekTerminalError()).not.toBeNull();
    expect(result.current.isReconnectSuppressed()).toBe(true);

    result.current.noteUserOpenRequested();

    expect(result.current.hasManualCloseRequested()).toBe(false);
    expect(result.current.hasManualOpenRequested()).toBe(true);
    expect(result.current.isReconnectSuppressed()).toBe(false);
    expect(result.current.peekTerminalError()).toBeNull();
  });

  it("noteUserCloseRequested sets manual-close, clears manual-open and terminal, suppresses reconnect", () => {
    const { result } = renderHook(() => useWebSocketController());

    result.current.noteUserOpenRequested();
    result.current.noteUserCloseRequested();

    expect(result.current.hasManualCloseRequested()).toBe(true);
    expect(result.current.hasManualOpenRequested()).toBe(false);
    expect(result.current.isReconnectSuppressed()).toBe(true);
    expect(result.current.peekTerminalError()).toBeNull();
  });

  it("user reconnect: requested -> closed leaves only manual-open + skip-next set", () => {
    const { result } = renderHook(() => useWebSocketController());

    result.current.noteUserReconnectRequested();
    expect(result.current.isReconnectSuppressed()).toBe(true);
    expect(result.current.hasManualOpenRequested()).toBe(true);

    result.current.noteUserReconnectClosed();

    expect(result.current.isReconnectSuppressed()).toBe(false);
    expect(result.current.hasManualOpenRequested()).toBe(true);
    expect(result.current.consumeSkipNextCloseReconnect()).toBe(true);
    // Skip is one-shot.
    expect(result.current.consumeSkipNextCloseReconnect()).toBe(false);
  });

  it("noteSocketOpened clears every flag accumulated up to that point", () => {
    const { result } = renderHook(() => useWebSocketController());

    result.current.noteUserCloseRequested();
    result.current.noteParseError(new Event("parse"));

    result.current.noteSocketOpened();

    expect(result.current.hasManualCloseRequested()).toBe(false);
    expect(result.current.hasManualOpenRequested()).toBe(false);
    expect(result.current.isReconnectSuppressed()).toBe(false);
    expect(result.current.peekTerminalError()).toBeNull();
  });

  it("noteHeartbeatActiveSocketClose: with reconnectTrigger latches a pending action without sticky terminal", () => {
    const { result } = renderHook(() => useWebSocketController());
    const error = new Event("hb");

    result.current.noteHeartbeatActiveSocketClose({
      error,
      reconnectTrigger: "heartbeat-timeout"
    });

    expect(result.current.hasManualOpenRequested()).toBe(false);
    expect(result.current.isReconnectSuppressed()).toBe(true);
    expect(result.current.peekTerminalError()).toBeNull();

    const action = result.current.consumePendingCloseAction();
    expect(action).not.toBeNull();
    expect(action?.error).toBe(error);
    expect(action?.reconnectTrigger).toBe("heartbeat-timeout");

    // Pending action is consumed once.
    expect(result.current.consumePendingCloseAction()).toBeNull();
    // skip-next-close was set as part of this transition.
    expect(result.current.consumeSkipNextCloseReconnect()).toBe(true);
  });

  it("noteHeartbeatActiveSocketClose: without reconnectTrigger latches a sticky terminal error", () => {
    const { result } = renderHook(() => useWebSocketController());
    const error = new Event("hb-fatal");

    result.current.noteHeartbeatActiveSocketClose({
      error,
      reconnectTrigger: null
    });

    expect(result.current.peekTerminalError()).toBe(error);
    const action = result.current.consumePendingCloseAction();
    expect(action?.reconnectTrigger).toBeNull();
  });

  it("noteHeartbeatNoActiveSocket sets terminal error iff shouldReconnect is false", () => {
    const { result } = renderHook(() => useWebSocketController());
    const errorOne = new Event("a");
    const errorTwo = new Event("b");

    result.current.noteHeartbeatNoActiveSocket({
      error: errorOne,
      shouldReconnect: true
    });

    expect(result.current.peekTerminalError()).toBeNull();
    expect(result.current.hasManualOpenRequested()).toBe(false);

    result.current.noteUserOpenRequested();
    result.current.noteHeartbeatNoActiveSocket({
      error: errorTwo,
      shouldReconnect: false
    });

    expect(result.current.peekTerminalError()).toBe(errorTwo);
    expect(result.current.hasManualOpenRequested()).toBe(false);
  });

  it("noteParseError latches terminal error + skip + suppress", () => {
    const { result } = renderHook(() => useWebSocketController());
    const error = new Event("parse");

    result.current.noteUserOpenRequested();
    result.current.noteParseError(error);

    expect(result.current.peekTerminalError()).toBe(error);
    expect(result.current.hasManualOpenRequested()).toBe(false);
    expect(result.current.isReconnectSuppressed()).toBe(true);
    expect(result.current.consumeSkipNextCloseReconnect()).toBe(true);
  });

  it("clearReconnectSuppression turns off only the suppression flag", () => {
    const { result } = renderHook(() => useWebSocketController());
    const error = new Event("parse");

    result.current.noteParseError(error);
    expect(result.current.isReconnectSuppressed()).toBe(true);
    expect(result.current.peekTerminalError()).toBe(error);

    result.current.clearReconnectSuppression();

    expect(result.current.isReconnectSuppressed()).toBe(false);
    expect(result.current.peekTerminalError()).toBe(error);
  });

  it("noteEffectInitiatedClose only sets the suppression flag", () => {
    const { result } = renderHook(() => useWebSocketController());

    result.current.noteUserOpenRequested();
    result.current.noteEffectInitiatedClose();

    expect(result.current.isReconnectSuppressed()).toBe(true);
    expect(result.current.hasManualOpenRequested()).toBe(true);
    expect(result.current.hasManualCloseRequested()).toBe(false);
    expect(result.current.peekTerminalError()).toBeNull();
  });

  it("peekTerminalError is non-destructive", () => {
    const { result } = renderHook(() => useWebSocketController());
    const error = new Event("p");

    result.current.noteParseError(error);

    expect(result.current.peekTerminalError()).toBe(error);
    expect(result.current.peekTerminalError()).toBe(error);
    expect(result.current.peekTerminalError()).toBe(error);
  });
});
