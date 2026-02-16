import type { AttemptLocation, AttemptResult, ScoresheetMarkerKind } from "./scoresheetTypes";

export type ScoresheetEventType =
  | "game.started"
  | "game.completed"
  | "cursor.pair_index_set"
  | "attempt.recorded"
  | "attempts.question_cleared"
  | "bonus.result_set"
  | "marker.set"
  | "marker.removed"
  | "lineup.set"
  | "lineup.removed";

export type ScoresheetEventPayload =
  | { pair_index: number }
  | {
      question_id: number;
      team_id: string;
      player_id?: string;
      result: AttemptResult;
      token: string;
      is_end: boolean;
      location: {
        kind: AttemptLocation["kind"];
        word_index?: number;
        option_index?: number;
      };
    }
  | { question_id: number }
  | { bonus_question_id: number; team_id: string; result: AttemptResult }
  | { boundary_before_question: number; kind: ScoresheetMarkerKind }
  | { boundary_before_question: number }
  | { team_id: string; boundary_before_question: number; active_player_ids: string[] };

export type ScoresheetEvent = {
  id: string;
  type: ScoresheetEventType;
  payload: ScoresheetEventPayload | Record<string, never>;
  clientTs?: string;
  seq?: number;
};

export function encodeLocationForEvent(location: AttemptLocation) {
  if (location.kind === "end") return { kind: "end" as const };
  if (location.kind === "question") {
    return { kind: "question" as const, word_index: location.wordIndex };
  }
  return {
    kind: "option" as const,
    option_index: location.optionIndex,
    word_index: location.wordIndex,
  };
}

export function makeEventId(): string {
  if ("crypto" in window && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

export function buildScoresheetEvent(type: ScoresheetEventType, payload: ScoresheetEventPayload | Record<string, never>): ScoresheetEvent {
  return {
    id: makeEventId(),
    type,
    payload,
    clientTs: new Date().toISOString(),
  };
}
