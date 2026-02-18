from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any, Iterable

from django.db import transaction
from django.utils.dateparse import parse_datetime

from moss.models import (
    Game,
    GamePlayerFact,
    GameTeam,
    GameTeamFact,
    Scoresheet,
    ScoresheetSnapshot,
    TournamentPlayer,
    TournamentTeam,
)
from moss.reducer import initial_state
from moss.services.export_facts import reduce_scoresheet_export_to_facts


def sha256_bytes(data: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(data)
    return digest.hexdigest()


def _require_dict(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{path} must be an object")
    return value


def ingest_scoresheet_exports(
    *,
    tournament_id: int,
    exports: Iterable[tuple[Path, bytes, dict[str, Any]]],
    using: str = "default",
) -> None:
    """
    Ingest MoSS scoresheet export objects (v1/v2) into the MoSS fact tables.

    `exports` items are `(source_path, raw_bytes, parsed_export_obj)`.
    """

    for source_path, raw_bytes, export_obj in exports:
        file_hash = sha256_bytes(raw_bytes)
        import_reason = f"import_export:{file_hash}"

        export_facts = reduce_scoresheet_export_to_facts(export_obj)

        packet = _require_dict(export_obj.get("packet"), "packet")
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
            team_names.append(name)

        exported_at = export_obj.get("exported_at")
        exported_dt = parse_datetime(exported_at) if isinstance(exported_at, str) else None

        with transaction.atomic(using=using):
            game = Game.objects.using(using).create(
                tournament_id=tournament_id,
                status="COMPLETED",
                started_at=None,
                completed_at=exported_dt,
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
            for team_any in teams_any:
                team_dict = _require_dict(team_any, "game.teams[]")
                name = team_dict.get("name")
                if not isinstance(name, str) or not name.strip():
                    raise ValueError("game.teams[].name must be a non-empty string")
                players_any = team_dict.get("players")
                if not isinstance(players_any, list):
                    raise ValueError("game.teams[].players must be a list")
                roster: list[str] = []
                for player_any in players_any:
                    if isinstance(player_any, str) and player_any.strip():
                        roster.append(player_any)
                    elif isinstance(player_any, dict) and isinstance(player_any.get("name"), str):
                        roster.append(player_any["name"])
                roster_by_team[name] = roster

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

            # Persist facts.
            for team_fact in export_facts.team_facts:
                tteam = tournament_teams[team_fact.team_name]
                GameTeamFact.objects.using(using).create(
                    game=game,
                    tournament_team=tteam,
                    points=team_fact.points,
                    tossups_heard=team_fact.tossups_heard,
                    tossups_4=team_fact.tossups_4,
                    tossups_neg=team_fact.tossups_neg,
                    tossups_0=team_fact.tossups_0,
                    bonuses_heard=team_fact.bonuses_heard,
                    bonus_points=team_fact.bonus_points,
                )
                GameTeam.objects.using(using).filter(game=game, tournament_team=tteam).update(
                    score_cached=team_fact.points
                )

            for player_fact in export_facts.player_facts:
                tteam = tournament_teams[player_fact.team_name]
                player = tournament_players.get((player_fact.team_name, player_fact.player_name))
                if player is None:
                    player, _ = TournamentPlayer.objects.using(using).get_or_create(
                        tournament_team=tteam,
                        name=player_fact.player_name,
                        defaults={"grade_level": ""},
                    )
                GamePlayerFact.objects.using(using).create(
                    game=game,
                    tournament_player=player,
                    tournament_team=tteam,
                    tossups_heard=player_fact.tossups_heard,
                    tossups_4=player_fact.tossups_4,
                    tossups_neg=player_fact.tossups_neg,
                    tossups_0=player_fact.tossups_0,
                    tossup_points=player_fact.tossup_points,
                )
