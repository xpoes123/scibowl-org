from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any, Iterable

from django.db import transaction
from django.utils.dateparse import parse_datetime

from moss.models import (
    Game,
    GamePlayerLineupSegment,
    GameTeam,
    GameTeamQuestionOutcome,
    PacketQuestion,
    PacketVersion,
    Scoresheet,
    ScoresheetSnapshot,
    TournamentPlayer,
    TournamentTeam,
)
from moss.reducer import initial_state
from moss.services.export_facts import (
    reduce_scoresheet_export_to_question_outcomes,
)


def sha256_bytes(data: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(data)
    return digest.hexdigest()


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


def ingest_scoresheet_exports(
    *,
    tournament_id: int,
    exports: Iterable[tuple[Path, bytes, dict[str, Any]]],
    using: str = "default",
) -> None:
    """
    Ingest MoSS scoresheet export objects (v1/v2/v3) into the MoSS fact tables.

    `exports` items are `(source_path, raw_bytes, parsed_export_obj)`.
    """

    for source_path, raw_bytes, export_obj in exports:
        file_hash = sha256_bytes(raw_bytes)
        import_reason = f"import_export:{file_hash}"

        export_outcomes = reduce_scoresheet_export_to_question_outcomes(export_obj)

        packet = _require_dict(export_obj.get("packet"), "packet")
        packet_checksum = _require_dict(export_obj.get("packet_checksum"), "packet_checksum")
        checksum_algorithm = _require_str(packet_checksum.get("algorithm"), "packet_checksum.algorithm")
        checksum_canonicalization = _require_str(
            packet_checksum.get("canonicalization"), "packet_checksum.canonicalization"
        )
        checksum_value = _require_str(packet_checksum.get("value"), "packet_checksum.value")
        packet_year_any = packet.get("year")
        packet_year = packet_year_any if isinstance(packet_year_any, int) else None
        packet_name = packet.get("packet")
        packet_name_str = packet_name if isinstance(packet_name, str) else ""

        game_obj = _require_dict(export_obj.get("game"), "game")
        teams_any = game_obj.get("teams")
        if not isinstance(teams_any, list) or len(teams_any) != 2:
            raise ValueError("Expected exactly 2 teams in export game.teams")

        team_names: list[str] = []
        for team in teams_any:
            team_dict = _require_dict(team, "game.teams[]")
            name = team_dict.get("name")
            if not isinstance(name, str) or not name.strip():
                raise ValueError("game.teams[].name must be a non-empty string")
            team_names.append(name.strip())

        if len(set(team_names)) != 2:
            shown = ", ".join(repr(n) for n in team_names)
            raise ValueError(
                f"Export must contain exactly 2 distinct team names (got: {shown}) in {source_path}"
            )

        exported_at = export_obj.get("exported_at")
        exported_dt = parse_datetime(exported_at) if isinstance(exported_at, str) else None

        rules = _require_dict(export_obj.get("rules"), "rules")
        rules_tossup = _require_dict(rules.get("tossup"), "rules.tossup")
        rules_bonus = _require_dict(rules.get("bonus"), "rules.bonus")
        tossup_correct = _require_int(rules_tossup.get("correct"), "rules.tossup.correct")
        tossup_incorrect = _require_int(rules_tossup.get("incorrect"), "rules.tossup.incorrect")
        tossup_no_penalty = _require_int(rules_tossup.get("no_penalty"), "rules.tossup.no_penalty")
        bonus_correct = _require_int(rules_bonus.get("correct"), "rules.bonus.correct")
        bonus_incorrect = _require_int(rules_bonus.get("incorrect"), "rules.bonus.incorrect")

        with transaction.atomic(using=using):
            packet_version, _ = PacketVersion.objects.using(using).get_or_create(
                checksum_algorithm=checksum_algorithm,
                checksum_canonicalization=checksum_canonicalization,
                checksum_value=checksum_value,
                defaults={"year": packet_year, "packet_name": packet_name_str},
            )
            if packet_year is not None or packet_name_str:
                PacketVersion.objects.using(using).filter(id=packet_version.id).update(
                    year=packet_year,
                    packet_name=packet_name_str,
                )

            packet_questions = _require_list(packet.get("questions"), "packet.questions")
            for idx, question_any in enumerate(packet_questions):
                question = _require_dict(question_any, f"packet.questions[{idx}]")
                qid = _require_int(question.get("id"), f"packet.questions[{idx}].id")
                pair_id = _require_int(question.get("pair_id"), f"packet.questions[{idx}].pair_id")
                qtype = _require_str(question.get("question_type"), f"packet.questions[{idx}].question_type")
                category_any = question.get("category")
                category = category_any if isinstance(category_any, str) else ""
                qstyle_any = question.get("question_style")
                qstyle = qstyle_any if isinstance(qstyle_any, str) else ""
                source_any = question.get("source")
                source = source_any if isinstance(source_any, str) else ""

                PacketQuestion.objects.using(using).update_or_create(
                    packet_version=packet_version,
                    question_id=qid,
                    defaults={
                        "pair_id": pair_id,
                        "question_type": qtype,
                        "category": category,
                        "question_style": qstyle,
                        "source": source,
                    },
                )

            game = Game.objects.using(using).create(
                tournament_id=tournament_id,
                status="COMPLETED",
                started_at=None,
                completed_at=exported_dt,
                packet_version=packet_version,
                pairs_played=int(export_outcomes.pairs_played),
                tossup_points_correct=tossup_correct,
                tossup_points_incorrect=tossup_incorrect,
                tossup_points_no_penalty=tossup_no_penalty,
                bonus_points_correct=bonus_correct,
                bonus_points_incorrect=bonus_incorrect,
            )

            # Upsert tournament teams and game teams.
            tournament_teams: dict[str, TournamentTeam] = {}
            for name in team_names:
                team, _ = TournamentTeam.objects.using(using).get_or_create(
                    tournament_id=tournament_id,
                    name=name,
                    defaults={"school": "", "pool": ""},
                )
                tournament_teams[name] = team

            # game team slots follow the export's order.
            for slot, name in enumerate(team_names, start=1):
                GameTeam.objects.using(using).create(game=game, tournament_team=tournament_teams[name], slot=slot)

            # Players: accept either ["Name", ...] or [{"name": "Name"}, ...] just in case.
            roster_by_team: dict[str, list[str]] = {}
            player_name_by_id_by_team: dict[str, dict[str, str]] = {}
            for team_any in teams_any:
                team_dict = _require_dict(team_any, "game.teams[]")
                name = team_dict.get("name")
                if not isinstance(name, str) or not name.strip():
                    raise ValueError("game.teams[].name must be a non-empty string")
                players_any = team_dict.get("players")
                if not isinstance(players_any, list):
                    raise ValueError("game.teams[].players must be a list")
                roster: list[str] = []
                player_name_by_id: dict[str, str] = {}
                for player_any in players_any:
                    if isinstance(player_any, str) and player_any.strip():
                        roster.append(player_any)
                    elif isinstance(player_any, dict) and isinstance(player_any.get("name"), str):
                        pname = player_any["name"]
                        roster.append(pname)
                        if player_any.get("id") is not None:
                            player_name_by_id[str(player_any["id"])] = pname
                roster_by_team[name] = roster
                player_name_by_id_by_team[name] = player_name_by_id

            tournament_players: dict[tuple[str, str], TournamentPlayer] = {}
            for team_name, roster in roster_by_team.items():
                team = tournament_teams[team_name]
                for player_name in roster:
                    player, _ = TournamentPlayer.objects.using(using).get_or_create(
                        tournament_team=team,
                        name=player_name,
                        defaults={"grade_level": ""},
                    )
                    tournament_players[(team_name, player_name)] = player

            # Create scoresheet + snapshot for audit/debugging.
            scoresheet = Scoresheet.objects.using(using).create(
                game=game,
                schema_version=1,
                next_seq=1,
                latest_snapshot_seq=1,
            )
            ScoresheetSnapshot.objects.using(using).create(
                scoresheet=scoresheet,
                seq=1,
                reason=import_reason,
                state={
                    **initial_state(),
                    "pair_index": int((_require_dict(export_obj.get("state") or {}, "state").get("pair_index") or 0)),
                    "import_meta": {
                        "source_path": str(source_path),
                        "source_sha256": file_hash,
                        "packet": {"year": packet.get("year"), "packet": packet.get("packet")},
                        "packet_checksum": export_obj.get("packet_checksum"),
                        "exported_at": exported_at,
                    },
                    "export_state": export_obj.get("state") if isinstance(export_obj.get("state"), dict) else None,
                },
            )

            packet_question_by_id: dict[int, PacketQuestion] = {
                pq.question_id: pq
                for pq in PacketQuestion.objects.using(using).filter(packet_version=packet_version)
            }

            for outcome in export_outcomes.outcomes:
                tteam = tournament_teams[outcome.team_name]
                pq = packet_question_by_id.get(outcome.question_id)
                if pq is None:
                    raise ValueError(f"Missing PacketQuestion for question id {outcome.question_id}")

                buzzing_player = None
                if outcome.question_type == "TOSSUP" and outcome.buzzing_player_name:
                    buzzing_player = tournament_players.get((outcome.team_name, outcome.buzzing_player_name))

                GameTeamQuestionOutcome.objects.using(using).create(
                    game=game,
                    tournament_team=tteam,
                    packet_question=pq,
                    heard=bool(outcome.heard),
                    points=int(outcome.points),
                    tossup_result=outcome.tossup_result or "",
                    bonus_result=outcome.bonus_result or "",
                    buzzing_player=buzzing_player,
                )

            for team_any in teams_any:
                team_dict = _require_dict(team_any, "game.teams[]")
                team_name_any = team_dict.get("name")
                if not isinstance(team_name_any, str) or not team_name_any.strip():
                    continue
                team_name = team_name_any

                segments_any = team_dict.get("lineup_segments")
                if segments_any is None:
                    continue
                if not isinstance(segments_any, list):
                    raise ValueError("game.teams[].lineup_segments must be a list when present")
                if game.pairs_played <= 0:
                    continue

                for seg_idx, seg_any in enumerate(segments_any):
                    seg = _require_dict(seg_any, f"game.teams[].lineup_segments[{seg_idx}]")
                    start = _require_int(seg.get("start_tossup"), f"game.teams[].lineup_segments[{seg_idx}].start_tossup")
                    end_any = seg.get("end_tossup")
                    end = end_any if isinstance(end_any, int) else None
                    if start < 1:
                        continue
                    if end is not None and end < start:
                        continue

                    start_clamped = max(1, min(game.pairs_played, start))
                    end_clamped = (
                        max(1, min(game.pairs_played, end))
                        if end is not None
                        else None
                    )

                    active_any = seg.get("active_players")
                    active_is_ids = False
                    if active_any is None:
                        active_any = seg.get("active_player_ids")
                        active_is_ids = active_any is not None
                    if active_any is None:
                        active_any = []
                    if not isinstance(active_any, list):
                        raise ValueError(f"game.teams[].lineup_segments[{seg_idx}].active_players must be a list")

                    for player_any in active_any:
                        if active_is_ids:
                            pid = str(player_any).strip()
                            if not pid:
                                continue
                            player_name = player_name_by_id_by_team.get(team_name, {}).get(pid, pid)
                        else:
                            if not isinstance(player_any, str) or not player_any.strip():
                                continue
                            player_name = player_any
                        player = tournament_players.get((team_name, player_name))
                        if player is None:
                            player, _ = TournamentPlayer.objects.using(using).get_or_create(
                                tournament_team=tournament_teams[team_name],
                                name=player_name,
                                defaults={"grade_level": ""},
                            )
                            tournament_players[(team_name, player_name)] = player

                        GamePlayerLineupSegment.objects.using(using).create(
                            game=game,
                            tournament_team=tournament_teams[team_name],
                            tournament_player=player,
                            start_pair_id=start_clamped,
                            end_pair_id=end_clamped,
                        )

            # Cache final game score per team (derived from question outcomes).
            team_points: dict[str, int] = {name: 0 for name in team_names}
            for out in export_outcomes.outcomes:
                team_points[out.team_name] = team_points.get(out.team_name, 0) + int(out.points or 0)

            for team_name, points in team_points.items():
                tteam = tournament_teams[team_name]
                GameTeam.objects.using(using).filter(game=game, tournament_team=tteam).update(score_cached=points)
