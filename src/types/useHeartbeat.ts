export type HeartbeatBeatFn = () => void | boolean | Promise<void | boolean>;

export type HeartbeatAckMatcher<TMessage> = (message: TMessage) => boolean;

export interface UseHeartbeatOptions<TOutgoing = unknown, TIncoming = TOutgoing> {
  enabled?: boolean;
  intervalMs: number;
  timeoutMs?: number;
  message?: TOutgoing | (() => TOutgoing);
  beat?: HeartbeatBeatFn;
  matchesAck?: HeartbeatAckMatcher<TIncoming>;
  startOnMount?: boolean;
  onBeat?: () => void;
  onTimeout?: () => void;
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
