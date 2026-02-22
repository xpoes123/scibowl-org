from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from moss.reducer import initial_state, reduce_events


@dataclass(frozen=True)
class TeamFacts:
    team_name: str
    points: int
    tossups_heard: int
    tossups_4: int
    tossups_neg: int
    tossups_0: int
    bonuses_heard: int
    bonus_points: int


@dataclass(frozen=True)
class PlayerFacts:
    team_name: str
    player_name: str
    tossups_heard: int
    tossups_4: int
    tossups_neg: int
    tossups_0: int
    tossup_points: int


@dataclass(frozen=True)
class ExportFacts:
    pairs_played: int
    team_facts: list[TeamFacts]
    player_facts: list[PlayerFacts]


def _require_dict(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{path} must be an object")
    return value


def _require_list(value: Any, path: str) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(f"{path} must be a list")
    return value


def _require_str(value: Any, path: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{path} must be a string")
    return value


def _require_int(value: Any, path: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{path} must be an integer")
    return value


def _maybe_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    return None


def _load_export_state(export_obj: dict[str, Any]) -> dict[str, Any]:
    state_obj = export_obj.get("state")
    if isinstance(state_obj, dict):
        return state_obj

    event_log = export_obj.get("event_log")
    if not isinstance(event_log, dict):
        raise ValueError("Export missing both state and event_log")

    events = event_log.get("events")
    if not isinstance(events, list):
        raise ValueError("event_log.events must be a list")

    # Best-effort: reduce events to the backend canonical state shape. This state uses numeric
    # team_id/player_id keys rather than names; the facts reducer supports both shapes.
    return reduce_events(events, initial_state())


def _attempts_map_from_state(state: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    attempts = state.get("attempts_by_question_id")
    if not isinstance(attempts, dict):
        return {}
    out: dict[str, list[dict[str, Any]]] = {}
    for key, value in attempts.items():
        qid = str(key)
        if not isinstance(value, list):
            continue
        normalized: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                normalized.append(item)
        out[qid] = normalized
    return out


def _packet_pair_maps(packet_questions: Iterable[dict[str, Any]]) -> tuple[dict[int, int], dict[int, int], int, dict[int, int]]:
    tossup_by_pair: dict[int, int] = {}
    bonus_by_pair: dict[int, int] = {}
    pair_id_by_question_id: dict[int, int] = {}
    max_pair_id = 0

    for idx, question in enumerate(packet_questions):
        if not isinstance(question, dict):
            raise ValueError(f"packet.questions[{idx}] must be an object")
        qid = _require_int(question.get("id"), f"packet.questions[{idx}].id")
        pair_id = _require_int(question.get("pair_id"), f"packet.questions[{idx}].pair_id")
        qtype = _require_str(question.get("question_type"), f"packet.questions[{idx}].question_type")
        pair_id_by_question_id[qid] = pair_id
        max_pair_id = max(max_pair_id, pair_id)
        if qtype == "TOSSUP":
            tossup_by_pair[pair_id] = qid
        elif qtype == "BONUS":
            bonus_by_pair[pair_id] = qid

    pairs_total = max_pair_id
    return tossup_by_pair, bonus_by_pair, pairs_total, pair_id_by_question_id


def _pairs_played_from_export(
    state: dict[str, Any],
    attempts_by_question_id: dict[str, list[dict[str, Any]]],
    pairs_total: int,
    pair_id_by_question_id: dict[int, int],
) -> int:
    pair_index = _maybe_int(state.get("pair_index")) or 0
    pairs_from_cursor = pair_index + 1 if pair_index >= 0 else 0

    pairs_from_attempts = 0
    for key in attempts_by_question_id.keys():
        try:
            qid = int(key)
        except ValueError:
            continue
        pair_id = pair_id_by_question_id.get(qid)
        if pair_id is not None:
            pairs_from_attempts = max(pairs_from_attempts, pair_id)

    pairs_played = max(pairs_from_cursor, pairs_from_attempts)
    return max(0, min(pairs_total, pairs_played))


def _is_no_penalty_marker(attempt: dict[str, Any]) -> bool:
    token = attempt.get("token")
    is_end = attempt.get("is_end")
    if not isinstance(token, str):
        return False
    if not isinstance(is_end, bool):
        return False
    return is_end and token.strip().lower() == "no penalty"


def _pick_team_attempt(attempts: list[dict[str, Any]], team_key: str, *, prefer_correct: bool = True) -> dict[str, Any] | None:
    team_attempts = [a for a in attempts if str(a.get("team") or a.get("team_id")) == team_key]
    if not team_attempts:
        return None

    if prefer_correct:
        correct = next((a for a in team_attempts if a.get("result") == "correct"), None)
        if correct:
            return correct

    # Prefer a non-marker (i.e. not the synthetic "NO PENALTY" end marker) if present.
    non_marker = next((a for a in team_attempts if not _is_no_penalty_marker(a)), None)
    return non_marker or team_attempts[0]


def _classify_tossup_attempt(
    attempt: dict[str, Any] | None,
    *,
    correct_points: int,
    incorrect_points: int,
    no_penalty_points: int,
) -> int:
    if not attempt:
        return no_penalty_points
    result = attempt.get("result")
    if result == "correct":
        return correct_points
    if result == "incorrect":
        # In exported state, late buzzes can be represented as `is_end: true`; those are treated
        # as "no penalty" even if `result` is "incorrect". (A legacy/synthetic representation
        # also exists as an explicit "NO PENALTY" end marker token.)
        if attempt.get("is_end") is True or _is_no_penalty_marker(attempt):
            return no_penalty_points
        return incorrect_points
    return no_penalty_points


def _iter_lineup_segments(team_obj: dict[str, Any]) -> list[dict[str, Any]]:
    segs = team_obj.get("lineup_segments")
    if segs is None:
        return []
    if not isinstance(segs, list):
        raise ValueError("game.teams[].lineup_segments must be a list when present")
    return [s for s in segs if isinstance(s, dict)]


def reduce_scoresheet_export_to_facts(export_obj: dict[str, Any]) -> ExportFacts:
    if export_obj.get("format") != "moss_scoresheet":
        raise ValueError("Unsupported export format (expected moss_scoresheet)")
    version = export_obj.get("version")
    if version not in {1, 2}:
        raise ValueError("Unsupported export version (expected 1 or 2)")

    packet = _require_dict(export_obj.get("packet"), "packet")
    packet_questions = _require_list(packet.get("questions"), "packet.questions")
    tossup_by_pair, bonus_by_pair, pairs_total, pair_id_by_question_id = _packet_pair_maps(packet_questions)

    rules = _require_dict(export_obj.get("rules"), "rules")
    rules_tossup = _require_dict(rules.get("tossup"), "rules.tossup")
    rules_bonus = _require_dict(rules.get("bonus"), "rules.bonus")
    tossup_correct = _require_int(rules_tossup.get("correct"), "rules.tossup.correct")
    tossup_incorrect = _require_int(rules_tossup.get("incorrect"), "rules.tossup.incorrect")
    tossup_no_penalty = _require_int(rules_tossup.get("no_penalty"), "rules.tossup.no_penalty")
    bonus_correct = _require_int(rules_bonus.get("correct"), "rules.bonus.correct")
    bonus_incorrect = _require_int(rules_bonus.get("incorrect"), "rules.bonus.incorrect")

    state = _load_export_state(export_obj)
    attempts_by_question_id = _attempts_map_from_state(state)
    pairs_played = _pairs_played_from_export(state, attempts_by_question_id, pairs_total, pair_id_by_question_id)

    game = _require_dict(export_obj.get("game"), "game")
    team_objs = _require_list(game.get("teams"), "game.teams")
    teams: list[dict[str, Any]] = []
    for idx, team_obj_any in enumerate(team_objs):
        team_obj = _require_dict(team_obj_any, f"game.teams[{idx}]")
        teams.append(team_obj)

    # Establish team identity for matching attempts: prefer "name"; fall back to "id".
    team_keys: list[str] = []
    team_names: list[str] = []
    for idx, team_obj in enumerate(teams):
        name = team_obj.get("name")
        team_id = team_obj.get("id")
        if isinstance(name, str) and name.strip():
            team_keys.append(name)
            team_names.append(name)
            continue
        if team_id is not None:
            team_keys.append(str(team_id))
            team_names.append(str(team_id))
            continue
        raise ValueError(f"game.teams[{idx}] missing name/id")

    if len(team_keys) != 2:
        raise ValueError("Expected exactly 2 teams in export")

    # Player roster per team (names). This is used for individual facts and as a fallback
    # for lineup segment validation.
    roster_by_team: dict[str, list[str]] = {}
    lineup_segments_by_team: dict[str, list[dict[str, Any]]] = {}
    for team_key, team_obj in zip(team_keys, teams, strict=True):
        players_any = team_obj.get("players") or []
        players_out: list[str] = []
        if isinstance(players_any, list):
            for item in players_any:
                if isinstance(item, str):
                    if item.strip():
                        players_out.append(item)
                elif isinstance(item, dict) and isinstance(item.get("name"), str):
                    players_out.append(item["name"])
        roster_by_team[team_key] = players_out
        lineup_segments_by_team[team_key] = _iter_lineup_segments(team_obj)

    # Compute per-player tossups heard using lineup_segments (preferred).
    player_tuh: dict[tuple[str, str], int] = {}
    for team_key in team_keys:
        for player_name in roster_by_team.get(team_key, []):
            player_tuh[(team_key, player_name)] = 0

        segments = lineup_segments_by_team.get(team_key, [])
        for seg_idx, seg in enumerate(segments):
            start = _maybe_int(seg.get("start_tossup"))
            end = _maybe_int(seg.get("end_tossup"))
            if start is None:
                raise ValueError(f"game.teams[].lineup_segments[{seg_idx}].start_tossup must be an integer")
            if start < 1:
                continue
            if end is None:
                end = pairs_played
            if end < start:
                continue
            start_clamped = max(1, min(pairs_played, start))
            end_clamped = max(1, min(pairs_played, end))
            length = max(0, end_clamped - start_clamped + 1)

            active_any = seg.get("active_players") or seg.get("active_player_ids") or []
            if not isinstance(active_any, list):
                raise ValueError(f"game.teams[].lineup_segments[{seg_idx}].active_players must be a list")

            for player_any in active_any:
                if isinstance(player_any, dict) and isinstance(player_any.get("name"), str):
                    player_name = player_any["name"]
                else:
                    player_name = str(player_any)
                if not player_name.strip():
                    continue
                key = (team_key, player_name)
                player_tuh[key] = player_tuh.get(key, 0) + length

    # Team-level aggregation.
    team_stats: dict[str, dict[str, int]] = {
        team_key: {
            "points": 0,
            "tossups_heard": 0,
            "tossups_4": 0,
            "tossups_neg": 0,
            "bonuses_heard": 0,
            "bonus_points": 0,
        }
        for team_key in team_keys
    }

    player_stats: dict[tuple[str, str], dict[str, int]] = {}
    for (team_key, player_name), heard in player_tuh.items():
        player_stats[(team_key, player_name)] = {
            "tossups_heard": heard,
            "tossups_4": 0,
            "tossups_neg": 0,
            "tossup_points": 0,
        }

    def attempts_for_question(qid: int) -> list[dict[str, Any]]:
        return attempts_by_question_id.get(str(qid), [])

    # Tossups.
    for pair in range(1, pairs_played + 1):
        qid = tossup_by_pair.get(pair)
        if not qid:
            continue
        attempts = attempts_for_question(qid)
        for team_key in team_keys:
            picked = _pick_team_attempt(attempts, team_key)
            outcome = _classify_tossup_attempt(
                picked,
                correct_points=tossup_correct,
                incorrect_points=tossup_incorrect,
                no_penalty_points=tossup_no_penalty,
            )
            team_stats[team_key]["tossups_heard"] += 1
            if outcome == tossup_correct:
                team_stats[team_key]["tossups_4"] += 1
                team_stats[team_key]["points"] += tossup_correct
            elif outcome == tossup_incorrect:
                team_stats[team_key]["tossups_neg"] += 1
                team_stats[team_key]["points"] += tossup_incorrect
            else:
                # no-penalty tossups don't affect points
                pass

            if outcome not in {tossup_no_penalty} and picked and not _is_no_penalty_marker(picked):
                player_name = picked.get("player")
                if isinstance(player_name, str) and player_name.strip():
                    ps = player_stats.get((team_key, player_name))
                    if ps is None:
                        player_stats[(team_key, player_name)] = {
                            "tossups_heard": player_tuh.get((team_key, player_name), 0),
                            "tossups_4": 0,
                            "tossups_neg": 0,
                            "tossup_points": 0,
                        }
                        ps = player_stats[(team_key, player_name)]
                    if outcome == tossup_correct:
                        ps["tossups_4"] += 1
                    elif outcome == tossup_incorrect:
                        ps["tossups_neg"] += 1
                    ps["tossup_points"] += outcome

    # Bonuses.
    for pair in range(1, pairs_played + 1):
        qid = bonus_by_pair.get(pair)
        if not qid:
            continue
        attempts = attempts_for_question(qid)
        for team_key in team_keys:
            picked = _pick_team_attempt(attempts, team_key, prefer_correct=False)
            if not picked:
                continue
            result = picked.get("result")
            if result == "correct":
                team_stats[team_key]["bonus_points"] += bonus_correct
                team_stats[team_key]["points"] += bonus_correct
            elif result == "incorrect":
                team_stats[team_key]["bonus_points"] += bonus_incorrect
                team_stats[team_key]["points"] += bonus_incorrect

    # Finalize derived fields.
    team_facts: list[TeamFacts] = []
    for team_key, team_name in zip(team_keys, team_names):
        stats = team_stats[team_key]
        tossups_heard = stats["tossups_heard"]
        tossups_4 = stats["tossups_4"]
        tossups_neg = stats["tossups_neg"]
        tossups_0 = max(0, tossups_heard - tossups_4 - tossups_neg)
        bonuses_heard = tossups_4
        team_facts.append(
            TeamFacts(
                team_name=team_name,
                points=stats["points"],
                tossups_heard=tossups_heard,
                tossups_4=tossups_4,
                tossups_neg=tossups_neg,
                tossups_0=tossups_0,
                bonuses_heard=bonuses_heard,
                bonus_points=stats["bonus_points"],
            )
        )

    player_facts: list[PlayerFacts] = []
    for (team_key, player_name), stats in player_stats.items():
        heard = stats["tossups_heard"]
        if heard <= 0 and stats["tossups_4"] == 0 and stats["tossups_neg"] == 0:
            continue
        tossups_4 = stats["tossups_4"]
        tossups_neg = stats["tossups_neg"]
        tossups_0 = max(0, heard - tossups_4 - tossups_neg)
        team_name = team_names[team_keys.index(team_key)]
        player_facts.append(
            PlayerFacts(
                team_name=team_name,
                player_name=player_name,
                tossups_heard=heard,
                tossups_4=tossups_4,
                tossups_neg=tossups_neg,
                tossups_0=tossups_0,
                tossup_points=stats["tossup_points"],
            )
        )

    player_facts.sort(key=lambda p: (p.team_name, p.player_name))
    team_facts.sort(key=lambda t: t.team_name)

    return ExportFacts(
        pairs_played=pairs_played,
        team_facts=team_facts,
        player_facts=player_facts,
    )
