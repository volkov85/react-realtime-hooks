import { describe, expectTypeOf, it } from "vitest";

import type {
  RealtimeConnectionStatus,
  UseEventSourceOptions,
  UseEventSourceResult,
  UseHeartbeatOptions,
  UseOnlineStatusResult,
  UseReconnectOptions,
  UseReconnectResult,
  UseWebSocketOptions,
  UseWebSocketResult
} from "../src";

describe("api contracts", () => {
  it("keeps the public type surface stable", () => {
    expectTypeOf<RealtimeConnectionStatus>().toEqualTypeOf<
      | "idle"
      | "connecting"
      | "open"
      | "closing"
      | "closed"
      | "reconnecting"
      | "error"
    >();

    expectTypeOf<UseReconnectOptions["maxAttempts"]>().toEqualTypeOf<
      number | null | undefined
    >();

    expectTypeOf<UseReconnectResult["schedule"]>().toMatchTypeOf<
      (trigger?: "manual" | "close" | "error") => void
    >();

    expectTypeOf<
      UseWebSocketOptions<string, { type: "ping" }>["heartbeat"]
    >().toEqualTypeOf<
      false | UseHeartbeatOptions<{ type: "ping" }, string> | undefined
    >();

    expectTypeOf<UseWebSocketResult<string>["transport"]>().toEqualTypeOf<"websocket">();
    expectTypeOf<UseEventSourceOptions<number>["events"]>().toEqualTypeOf<
      readonly string[] | undefined
    >();
    expectTypeOf<UseEventSourceResult<number>["transport"]>().toEqualTypeOf<"eventsource">();
    expectTypeOf<UseOnlineStatusResult["isOnline"]>().toEqualTypeOf<boolean>();
  });

  it("narrows connection snapshots by status", () => {
    const assertWebSocketNarrowing = (
      result: UseWebSocketResult<string, { type: "ping" }>
    ): void => {
      if (result.status === "open") {
        expectTypeOf(result.isConnected).toEqualTypeOf<true>();
        expectTypeOf(result.isConnecting).toEqualTypeOf<false>();
        expectTypeOf(result.isClosed).toEqualTypeOf<false>();
        expectTypeOf(result.socket).toEqualTypeOf<WebSocket>();
      }

      if (result.status === "connecting" || result.status === "reconnecting") {
        expectTypeOf(result.isConnected).toEqualTypeOf<false>();
        expectTypeOf(result.isConnecting).toEqualTypeOf<true>();
        expectTypeOf(result.isClosed).toEqualTypeOf<false>();
      }

      if (result.status === "idle" || result.status === "closed" || result.status === "error") {
        expectTypeOf(result.isConnected).toEqualTypeOf<false>();
        expectTypeOf(result.isConnecting).toEqualTypeOf<false>();
        expectTypeOf(result.isClosed).toEqualTypeOf<true>();
      }
    };

    const assertEventSourceNarrowing = (
      result: UseEventSourceResult<number>
    ): void => {
      if (result.status === "open") {
        expectTypeOf(result.eventSource).toEqualTypeOf<EventSource>();
        expectTypeOf(result.isConnected).toEqualTypeOf<true>();
      }

      if (result.status === "connecting" || result.status === "reconnecting") {
        expectTypeOf(result.isConnecting).toEqualTypeOf<true>();
      }

      if (result.status === "idle" || result.status === "closed" || result.status === "error") {
        expectTypeOf(result.isClosed).toEqualTypeOf<true>();
      }
    };

    void assertWebSocketNarrowing;
    void assertEventSourceNarrowing;
  });
});
