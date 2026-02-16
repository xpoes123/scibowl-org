from __future__ import annotations

from typing import Any, Iterable

from . import event_types


def initial_state() -> dict[str, Any]:
    return {
        "version": 1,
        "game": {"status": "SCHEDULED"},
        "pair_index": 0,
        "attempts_by_question_id": {},
        "bonus_by_question_id": {},
        "markers": {},
        "lineups": {},
        "last_seq": 0,
    }


def _normalize_event(event: Any) -> dict[str, Any]:
    if hasattr(event, "event_type"):
        return {
            "type": event.event_type,
            "payload": event.payload,
            "seq": getattr(event, "seq", None),
        }
    if isinstance(event, dict):
        return {
            "type": event.get("type") or event.get("event_type"),
            "payload": event.get("payload"),
            "seq": event.get("seq"),
        }
    raise ValueError("Unsupported event shape")


def apply_event(state: dict[str, Any], event: Any) -> dict[str, Any]:
    normalized = _normalize_event(event)
    event_type = normalized.get("type")
    if event_type not in event_types.EVENT_TYPES:
        raise ValueError(f"Unsupported event type: {event_type}")

    payload = normalized.get("payload") or {}
    seq = normalized.get("seq")
    if isinstance(seq, int):
        state["last_seq"] = seq

    if event_type == event_types.EVENT_GAME_STARTED:
        state["game"]["status"] = "IN_PROGRESS"
        return state

    if event_type == event_types.EVENT_GAME_COMPLETED:
        state["game"]["status"] = "COMPLETED"
        return state

    if event_type == event_types.EVENT_CURSOR_PAIR_INDEX_SET:
        state["pair_index"] = int(payload.get("pair_index", 0))
        return state

    if event_type == event_types.EVENT_ATTEMPT_RECORDED:
        question_id = str(payload.get("question_id"))
        team_id = payload.get("team_id")
        attempts = list(state["attempts_by_question_id"].get(question_id, []))
        attempts = [att for att in attempts if att.get("team_id") != team_id]
        attempts.append({
            "team_id": team_id,
            "player_id": payload.get("player_id"),
            "result": payload.get("result"),
            "token": payload.get("token"),
            "is_end": payload.get("is_end"),
            "location": payload.get("location"),
        })
        state["attempts_by_question_id"][question_id] = attempts
        return state

    if event_type == event_types.EVENT_ATTEMPTS_QUESTION_CLEARED:
        question_id = str(payload.get("question_id"))
        state["attempts_by_question_id"].pop(question_id, None)
        return state

    if event_type == event_types.EVENT_BONUS_RESULT_SET:
        bonus_question_id = str(payload.get("bonus_question_id"))
        state["bonus_by_question_id"][bonus_question_id] = {
            "team_id": payload.get("team_id"),
            "result": payload.get("result"),
        }
        return state

    if event_type == event_types.EVENT_MARKER_SET:
        boundary = str(payload.get("boundary_before_question"))
        state["markers"][boundary] = payload.get("kind")
        return state

    if event_type == event_types.EVENT_MARKER_REMOVED:
        boundary = str(payload.get("boundary_before_question"))
        state["markers"].pop(boundary, None)
        return state

    if event_type == event_types.EVENT_LINEUP_SET:
        team_key = str(payload.get("team_id"))
        boundary = str(payload.get("boundary_before_question"))
        team_lineups = dict(state["lineups"].get(team_key, {}))
        active_player_ids = payload.get("active_player_ids") or []
        deduped = list(dict.fromkeys(active_player_ids))
        team_lineups[boundary] = deduped
        state["lineups"][team_key] = team_lineups
        return state

    if event_type == event_types.EVENT_LINEUP_REMOVED:
        team_key = str(payload.get("team_id"))
        boundary = str(payload.get("boundary_before_question"))
        team_lineups = dict(state["lineups"].get(team_key, {}))
        team_lineups.pop(boundary, None)
        if team_lineups:
            state["lineups"][team_key] = team_lineups
        else:
            state["lineups"].pop(team_key, None)
        return state

    return state


def reduce_events(events: Iterable[Any], base_state: dict[str, Any] | None = None) -> dict[str, Any]:
    state = base_state if base_state is not None else initial_state()
    for event in events:
        apply_event(state, event)
    return state
