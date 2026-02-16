import type { Attempt, ScoresheetMarkerKind } from "./scoresheetTypes";
import type { ScoresheetEvent } from "./scoresheetEvents";

export type ScoresheetState = {
  pairIndex: number;
  attemptsByQuestionId: Record<number, Attempt[]>;
  markers: Record<number, ScoresheetMarkerKind>;
  lineupsByTeamId: Record<string, Record<number, string[]>>;
  lastSeq: number;
};

export function initialScoresheetState(): ScoresheetState {
  return {
    pairIndex: 0,
    attemptsByQuestionId: {},
    markers: {},
    lineupsByTeamId: {},
    lastSeq: 0,
  };
}

function cloneScoresheetState(base: ScoresheetState): ScoresheetState {
  const attemptsByQuestionId: Record<number, Attempt[]> = {};
  for (const [key, value] of Object.entries(base.attemptsByQuestionId)) {
    attemptsByQuestionId[Number(key)] = value.map((attempt) => ({ ...attempt, location: { ...attempt.location } }));
  }

  const markers: Record<number, ScoresheetMarkerKind> = {};
  for (const [key, value] of Object.entries(base.markers)) {
    markers[Number(key)] = value;
  }

  const lineupsByTeamId: Record<string, Record<number, string[]>> = {};
  for (const [teamId, map] of Object.entries(base.lineupsByTeamId)) {
    const nextMap: Record<number, string[]> = {};
    for (const [boundary, ids] of Object.entries(map)) {
      nextMap[Number(boundary)] = [...ids];
    }
    lineupsByTeamId[teamId] = nextMap;
  }

  return {
    pairIndex: base.pairIndex,
    attemptsByQuestionId,
    markers,
    lineupsByTeamId,
    lastSeq: base.lastSeq,
  };
}

function upsertAttempt(
  current: Attempt[],
  attempt: Attempt,
  removeOtherCorrect: boolean
): Attempt[] {
  let next = current.filter((a) => a.teamId !== attempt.teamId && a.playerId !== attempt.playerId);
  if (removeOtherCorrect && attempt.result === "correct") {
    next = next.filter((a) => a.result !== "correct");
  }
  next.push(attempt);
  return next;
}

export function reduceScoresheetEvents(events: ScoresheetEvent[], baseState: ScoresheetState = initialScoresheetState()): ScoresheetState {
  const state = cloneScoresheetState(baseState);

  for (const event of events) {
    if (typeof event.seq === "number") state.lastSeq = event.seq;
    const payload = event.payload ?? {};

    switch (event.type) {
      case "cursor.pair_index_set": {
        const pairIndex = Number((payload as { pair_index: number }).pair_index ?? 0);
        state.pairIndex = Number.isFinite(pairIndex) ? pairIndex : state.pairIndex;
        break;
      }
      case "attempt.recorded": {
        const rec = payload as {
          question_id: number;
          team_id: string;
          player_id?: string;
          result: Attempt["result"];
          token: string;
          is_end: boolean;
          location: { kind: Attempt["location"]["kind"]; word_index?: number; option_index?: number };
        };
        const questionId = Number(rec.question_id);
        const current = state.attemptsByQuestionId[questionId] ?? [];
        const attempt: Attempt = {
          token: rec.token,
          isEnd: rec.is_end,
          result: rec.result,
          location: (() => {
            if (rec.location.kind === "question") {
              return { kind: "question", wordIndex: rec.location.word_index ?? 0 };
            }
            if (rec.location.kind === "option") {
              return {
                kind: "option",
                optionIndex: rec.location.option_index ?? 0,
                wordIndex: rec.location.word_index ?? 0,
              };
            }
            return { kind: "end" };
          })(),
          teamId: rec.team_id,
          playerId: rec.player_id,
        };
        const next = upsertAttempt(current, attempt, true);
        state.attemptsByQuestionId[questionId] = next;
        break;
      }
      case "attempts.question_cleared": {
        const questionId = Number((payload as { question_id: number }).question_id);
        delete state.attemptsByQuestionId[questionId];
        break;
      }
      case "bonus.result_set": {
        const rec = payload as { bonus_question_id: number; team_id: string; result: Attempt["result"] };
        const questionId = Number(rec.bonus_question_id);
        state.attemptsByQuestionId[questionId] = [
          {
            token: "BONUS",
            isEnd: true,
            result: rec.result,
            location: { kind: "end" },
            teamId: rec.team_id,
            playerId: undefined,
          },
        ];
        break;
      }
      case "marker.set": {
        const rec = payload as { boundary_before_question: number; kind: ScoresheetMarkerKind };
        state.markers[Number(rec.boundary_before_question)] = rec.kind;
        break;
      }
      case "marker.removed": {
        const rec = payload as { boundary_before_question: number };
        delete state.markers[Number(rec.boundary_before_question)];
        break;
      }
      case "lineup.set": {
        const rec = payload as { team_id: string; boundary_before_question: number; active_player_ids: string[] };
        const teamLineups = state.lineupsByTeamId[rec.team_id] ?? {};
        teamLineups[Number(rec.boundary_before_question)] = [...rec.active_player_ids];
        state.lineupsByTeamId[rec.team_id] = teamLineups;
        break;
      }
      case "lineup.removed": {
        const rec = payload as { team_id: string; boundary_before_question: number };
        const teamLineups = state.lineupsByTeamId[rec.team_id];
        if (teamLineups) {
          delete teamLineups[Number(rec.boundary_before_question)];
          if (!Object.keys(teamLineups).length) {
            delete state.lineupsByTeamId[rec.team_id];
          } else {
            state.lineupsByTeamId[rec.team_id] = teamLineups;
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return state;
}
