export type RealtimeErrorKind =
  | "heartbeat-error"
  | "heartbeat-timeout"
  | "parse-error";

export interface RealtimeErrorEventInit extends EventInit {
  cause?: unknown;
  kind: RealtimeErrorKind;
}

export class RealtimeErrorEvent extends Event {
  readonly cause: unknown;
  readonly kind: RealtimeErrorKind;

  constructor(type: string, init: RealtimeErrorEventInit) {
    super(type, init);
    this.cause = init.cause;
    this.kind = init.kind;
  }
}
