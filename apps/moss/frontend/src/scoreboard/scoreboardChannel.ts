export const SCOREBOARD_CHANNEL_NAME = "moss_scoreboard_display_v1" as const;

export type ScoreboardDisplayMessage<TSnapshot> =
  | { kind: "moss.scoreboard.hello"; client_id: string }
  | { kind: "moss.scoreboard.snapshot"; client_id?: string; snapshot: TSnapshot };

export function makeScoreboardClientId(): string {
  if ("crypto" in window && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

export function safePostScoreboardMessage<TSnapshot>(
  channel: BroadcastChannel,
  message: ScoreboardDisplayMessage<TSnapshot>
): void {
  try {
    channel.postMessage(message);
  } catch (e) {
    console.warn("Scoreboard display channel postMessage failed", e);
  }
}

