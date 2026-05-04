export type HeartbeatBeatFn = () => void | boolean | Promise<void | boolean>;

export type HeartbeatAckMatcher<TMessage> = (message: TMessage) => boolean;

export interface UseHeartbeatOptions<TOutgoing = unknown, TIncoming = TOutgoing> {
  enabled?: boolean;
  intervalMs: number;
  /**
   * Time to wait for an ack after a beat before flipping `hasTimedOut` to
   * `true`. Default is `10_000` (10 seconds), changed from no default in
   * 2.0. Pass `null` explicitly to disable the timeout entirely.
   */
  timeoutMs?: number | null;
  message?: TOutgoing | (() => TOutgoing);
  beat?: HeartbeatBeatFn;
  matchesAck?: HeartbeatAckMatcher<TIncoming>;
  startOnMount?: boolean;
  onBeat?: () => void;
  onTimeout?: () => void;
  onError?: (error: unknown) => void;
}

export interface UseHeartbeatResult<TIncoming = unknown> {
  isRunning: boolean;
  hasTimedOut: boolean;
  lastBeatAt: number | null;
  lastAckAt: number | null;
  latencyMs: number | null;
  start: () => void;
  stop: () => void;
  beat: () => void;
  notifyAck: (message: TIncoming) => boolean;
}

export type UseHeartbeatHook = <TOutgoing = unknown, TIncoming = TOutgoing>(
  options: UseHeartbeatOptions<TOutgoing, TIncoming>
) => UseHeartbeatResult<TIncoming>;
