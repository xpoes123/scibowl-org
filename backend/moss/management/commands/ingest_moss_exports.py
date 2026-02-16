from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from tournaments.models import Tournament
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


def _sha256_bytes(data: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(data)
    return digest.hexdigest()


def _require_dict(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CommandError(f"{path} must be an object")
    return value


class Command(BaseCommand):
    help = "Ingest MoSS scoresheet export JSON files (v1/v2) into moss fact tables."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--tournament-id",
            type=int,
            help="tournaments.Tournament id to attach the imported games to.",
        )
        parser.add_argument(
            "--tournament-slug",
            type=str,
            required=False,
            help="tournaments.Tournament slug to attach the imported games to.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and reduce files, but do not write any database rows.",
        )
        parser.add_argument(
            "paths",
            nargs="+",
            help="One or more moss_scoresheet export JSON files.",
        )

    def handle(self, *args, **options) -> None:
        tournament_id: int | None = options.get("tournament_id")
        tournament_slug: str | None = options.get("tournament_slug")
        dry_run: bool = options["dry_run"]
        paths: list[str] = options["paths"]

        if tournament_id is None and not tournament_slug:
            raise CommandError("One of --tournament-id or --tournament-slug is required")

        if tournament_id is None and tournament_slug:
            tournament = Tournament.objects.filter(slug=tournament_slug).first()
            if not tournament:
                raise CommandError(f'Tournament not found for slug "{tournament_slug}"')
            tournament_id = tournament.id

        total = 0
        created = 0
        skipped = 0

        for raw_path in paths:
            path = Path(raw_path)
            if not path.exists():
                raise CommandError(f"File not found: {path}")
            data = path.read_bytes()
            file_hash = _sha256_bytes(data)
            import_reason = f"import_export:{file_hash}"

            export_obj = json.loads(data)
            if not isinstance(export_obj, dict):
                raise CommandError(f"Top-level JSON must be an object: {path}")

            # Idempotency: if we've already imported this exact file bytes, skip.
            if ScoresheetSnapshot.objects.filter(reason=import_reason).exists():
                skipped += 1
                total += 1
                self.stdout.write(f"SKIP {path.name} (already imported)")
                continue

            export_facts = reduce_scoresheet_export_to_facts(export_obj)

            packet = _require_dict(export_obj.get("packet"), "packet")
            game_obj = _require_dict(export_obj.get("game"), "game")
            teams_any = game_obj.get("teams")
            if not isinstance(teams_any, list) or len(teams_any) != 2:
                raise CommandError("Expected exactly 2 teams in export game.teams")

            team_names: list[str] = []
            for team in teams_any:
                team_dict = _require_dict(team, "game.teams[]")
                name = team_dict.get("name")
                if not isinstance(name, str) or not name.strip():
                    raise CommandError("game.teams[].name must be a non-empty string")
                team_names.append(name)

            exported_at = export_obj.get("exported_at")
            exported_dt = parse_datetime(exported_at) if isinstance(exported_at, str) else None

            if dry_run:
                total += 1
                self.stdout.write(
                    f"DRY {path.name}: pairs_played={export_facts.pairs_played} teams={team_names}"
                )
                continue

            with transaction.atomic():
                game = Game.objects.create(
                    tournament_id=tournament_id,
                    status="COMPLETED",
                    started_at=None,
                    completed_at=exported_dt,
                )

                # Upsert tournament teams and game teams.
                tournament_teams: dict[str, TournamentTeam] = {}
                for slot, team_name in enumerate(team_names, start=1):
                    tteam, _ = TournamentTeam.objects.get_or_create(
                        tournament_id=tournament_id,
                        name=team_name,
                        defaults={"school": "", "pool": ""},
                    )
                    tournament_teams[team_name] = tteam
                    GameTeam.objects.get_or_create(
                        game=game,
                        tournament_team=tteam,
                        defaults={"slot": slot, "score_cached": 0},
                    )

                # Upsert tournament players from roster.
                roster_by_team: dict[str, list[str]] = {}
                for team in teams_any:
                    team_dict = _require_dict(team, "game.teams[]")
                    name = _require_str(team_dict.get("name"), "game.teams[].name")
                    players_any = team_dict.get("players") or []
                    if not isinstance(players_any, list):
                        raise CommandError("game.teams[].players must be a list")
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
                        player, _ = TournamentPlayer.objects.get_or_create(
                            tournament_team=team,
                            name=player_name,
                            defaults={"grade_level": ""},
                        )
                        tournament_players[(team_name, player_name)] = player

                # Create scoresheet + snapshot for audit/idempotency. We store the export's
                # minimal state as a sub-object so it doesn't interfere with backend reducers.
                scoresheet = Scoresheet.objects.create(game=game, schema_version=1, next_seq=1, latest_snapshot_seq=1)
                ScoresheetSnapshot.objects.create(
                    scoresheet=scoresheet,
                    seq=1,
                    reason=import_reason,
                    state={
                        **initial_state(),
                        "pair_index": int((_require_dict(export_obj.get("state") or {}, "state").get("pair_index") or 0)),
                        "import_meta": {
                            "source_path": str(path),
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
                    GameTeamFact.objects.update_or_create(
                        game=game,
                        tournament_team=tteam,
                        defaults={
                            "points": team_fact.points,
                            "tossups_heard": team_fact.tossups_heard,
                            "tossups_4": team_fact.tossups_4,
                            "tossups_neg": team_fact.tossups_neg,
                            "tossups_0": team_fact.tossups_0,
                            "bonuses_heard": team_fact.bonuses_heard,
                            "bonus_points": team_fact.bonus_points,
                        },
                    )
                    GameTeam.objects.filter(game=game, tournament_team=tteam).update(score_cached=team_fact.points)

                for player_fact in export_facts.player_facts:
                    tteam = tournament_teams[player_fact.team_name]
                    player = tournament_players.get((player_fact.team_name, player_fact.player_name))
                    if player is None:
                        player, _ = TournamentPlayer.objects.get_or_create(
                            tournament_team=tteam,
                            name=player_fact.player_name,
                            defaults={"grade_level": ""},
                        )
                    GamePlayerFact.objects.update_or_create(
                        game=game,
                        tournament_player=player,
                        defaults={
                            "tournament_team": tteam,
                            "tossups_heard": player_fact.tossups_heard,
                            "tossups_4": player_fact.tossups_4,
                            "tossups_neg": player_fact.tossups_neg,
                            "tossups_0": player_fact.tossups_0,
                            "tossup_points": player_fact.tossup_points,
                        },
                    )

            created += 1
            total += 1
            self.stdout.write(f"OK   {path.name} -> game_id={game.id}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. files={total} created={created} skipped={skipped} dry_run={dry_run}"
            )
        )


def _require_str(value: Any, path: str) -> str:
    if not isinstance(value, str):
        raise CommandError(f"{path} must be a string")
    return value
