import type { ScoresheetEvent } from "./scoresheetEvents";

const API_BASE_URL = (import.meta.env.VITE_MOSS_API_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000") as string;

type PostEventResponse = {
  scoresheet_id: number;
  duplicate: boolean;
  event: {
    seq: number;
    client_event_id: string;
    type: string;
    version: number;
    payload: unknown;
    client_ts?: string | null;
    created_at: string;
  };
  next_seq: number;
};

export async function postScoresheetEvent(
  scoresheetId: number,
  event: ScoresheetEvent,
  expectedNextSeq?: number
): Promise<PostEventResponse> {
  const payload = normalizePayload(event.payload);
  const response = await fetch(`${API_BASE_URL}/api/moss/scoresheets/${scoresheetId}/events/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expected_next_seq: expectedNextSeq,
      event: {
        client_event_id: event.id,
        type: event.type,
        version: 1,
        client_ts: event.clientTs ?? null,
        payload,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Failed to post scoresheet event");
  }

  return response.json();
}

function normalizePayload(payload: ScoresheetEvent["payload"]): ScoresheetEvent["payload"] {
  if (!payload || typeof payload !== "object") return payload;
  const clone: Record<string, unknown> = Array.isArray(payload) ? [...payload] as unknown as Record<string, unknown> : { ...(payload as Record<string, unknown>) };

  const toNumber = (value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      const num = Number(value);
      return Number.isFinite(num) ? num : value;
    }
    return value;
  };

  if ("team_id" in clone) clone.team_id = toNumber(clone.team_id);
  if ("player_id" in clone) clone.player_id = toNumber(clone.player_id);
  if ("question_id" in clone) clone.question_id = toNumber(clone.question_id);
  if ("bonus_question_id" in clone) clone.bonus_question_id = toNumber(clone.bonus_question_id);
  if ("boundary_before_question" in clone) clone.boundary_before_question = toNumber(clone.boundary_before_question);
  if ("pair_index" in clone) clone.pair_index = toNumber(clone.pair_index);
  if ("active_player_ids" in clone && Array.isArray(clone.active_player_ids)) {
    clone.active_player_ids = clone.active_player_ids.map(toNumber);
  }
  if ("ordered_player_ids" in clone && Array.isArray(clone.ordered_player_ids)) {
    clone.ordered_player_ids = clone.ordered_player_ids.map(toNumber);
  }

  return clone as ScoresheetEvent["payload"];
}

export async function fetchScoresheetEvents(scoresheetId: number, afterSeq = 0, limit = 500) {
  const response = await fetch(
    `${API_BASE_URL}/api/moss/scoresheets/${scoresheetId}/events/?after_seq=${afterSeq}&limit=${limit}`,
    { headers: { "Content-Type": "application/json" } }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Failed to fetch scoresheet events");
  }
  return response.json();
}

export async function createScoresheet(
  tournamentSlug: string,
  teamAName: string,
  teamBName: string
): Promise<{ scoresheet_id: number; game_id: number } | null> {
  const token = import.meta.env.VITE_MOSS_API_TOKEN as string | undefined;
  try {
    const response = await fetch(`${API_BASE_URL}/api/moss/scoresheets/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-MOSS-API-TOKEN": token } : {}),
      },
      body: JSON.stringify({
        tournament_slug: tournamentSlug,
        team_a_name: teamAName,
        team_b_name: teamBName,
      }),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export function getRemoteScoresheetId(): number | null {
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("scoresheet_id");
  const envValue = import.meta.env.VITE_MOSS_SCORESHEET_ID;
  const raw = queryValue ?? envValue ?? "";
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : null;
}
