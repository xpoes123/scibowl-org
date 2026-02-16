from rest_framework import serializers

from . import event_types


def _raise(field: str, message: str) -> None:
    raise serializers.ValidationError({field: message})


def _require_dict(value: object, field: str) -> dict:
    if not isinstance(value, dict):
        _raise(field, "must be an object")
    return value


def _require_int(value: object, field: str, min_value: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        _raise(field, "must be an integer")
    if min_value is not None and value < min_value:
        _raise(field, f"must be >= {min_value}")
    return value


def _require_str(value: object, field: str, allowed: set[str] | None = None) -> str:
    if not isinstance(value, str):
        _raise(field, "must be a string")
    if allowed is not None and value not in allowed:
        _raise(field, f"must be one of {sorted(allowed)}")
    return value


def _require_bool(value: object, field: str) -> bool:
    if not isinstance(value, bool):
        _raise(field, "must be a boolean")
    return value


def _require_list_of_ints(value: object, field: str, min_len: int | None = None) -> list[int]:
    if not isinstance(value, list):
        _raise(field, "must be a list")
    if min_len is not None and len(value) < min_len:
        _raise(field, f"must have at least {min_len} item(s)")
    out: list[int] = []
    for idx, item in enumerate(value):
        if isinstance(item, bool) or not isinstance(item, int):
            _raise(field, f"item {idx} must be an integer")
        out.append(item)
    return out


def validate_event_payload(event_type: str, payload: object) -> None:
    if event_type not in event_types.EVENT_TYPES:
        _raise("type", "unsupported event type")

    payload_dict = _require_dict(payload, "payload")

    if event_type in {event_types.EVENT_GAME_STARTED, event_types.EVENT_GAME_COMPLETED}:
        return

    if event_type == event_types.EVENT_CURSOR_PAIR_INDEX_SET:
        pair_index = payload_dict.get("pair_index")
        _require_int(pair_index, "payload.pair_index", min_value=0)
        return

    if event_type == event_types.EVENT_ATTEMPT_RECORDED:
        _require_int(payload_dict.get("question_id"), "payload.question_id", min_value=1)
        _require_int(payload_dict.get("team_id"), "payload.team_id", min_value=1)
        player_id = payload_dict.get("player_id")
        if player_id is not None:
            _require_int(player_id, "payload.player_id", min_value=1)
        _require_str(payload_dict.get("result"), "payload.result", allowed={"correct", "incorrect"})
        _require_str(payload_dict.get("token"), "payload.token")
        _require_bool(payload_dict.get("is_end"), "payload.is_end")

        location = _require_dict(payload_dict.get("location"), "payload.location")
        kind = _require_str(location.get("kind"), "payload.location.kind", allowed={"question", "option", "end"})
        if kind == "question":
            _require_int(location.get("word_index"), "payload.location.word_index", min_value=0)
        elif kind == "option":
            _require_int(location.get("option_index"), "payload.location.option_index", min_value=0)
            _require_int(location.get("word_index"), "payload.location.word_index", min_value=0)
        return

    if event_type == event_types.EVENT_ATTEMPTS_QUESTION_CLEARED:
        _require_int(payload_dict.get("question_id"), "payload.question_id", min_value=1)
        return

    if event_type == event_types.EVENT_BONUS_RESULT_SET:
        _require_int(payload_dict.get("bonus_question_id"), "payload.bonus_question_id", min_value=1)
        _require_int(payload_dict.get("team_id"), "payload.team_id", min_value=1)
        _require_str(payload_dict.get("result"), "payload.result", allowed={"correct", "incorrect"})
        return

    if event_type == event_types.EVENT_MARKER_SET:
        _require_int(payload_dict.get("boundary_before_question"), "payload.boundary_before_question", min_value=1)
        _require_str(payload_dict.get("kind"), "payload.kind", allowed={"HALFTIME", "BREAK"})
        return

    if event_type == event_types.EVENT_MARKER_REMOVED:
        _require_int(payload_dict.get("boundary_before_question"), "payload.boundary_before_question", min_value=1)
        return

    if event_type == event_types.EVENT_LINEUP_SET:
        _require_int(payload_dict.get("team_id"), "payload.team_id", min_value=1)
        _require_int(payload_dict.get("boundary_before_question"), "payload.boundary_before_question", min_value=1)
        _require_list_of_ints(payload_dict.get("active_player_ids"), "payload.active_player_ids", min_len=1)
        return

    if event_type == event_types.EVENT_LINEUP_REMOVED:
        _require_int(payload_dict.get("team_id"), "payload.team_id", min_value=1)
        _require_int(payload_dict.get("boundary_before_question"), "payload.boundary_before_question", min_value=1)
        return
