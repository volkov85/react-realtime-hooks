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
});
