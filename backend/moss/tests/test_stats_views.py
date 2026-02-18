import json
from datetime import date
from pathlib import Path

from django.test import TestCase

from moss.services.ingest_exports import ingest_scoresheet_exports
from moss.services.stats_views import build_tournament_standings_view
from tournaments.models import Tournament


class StatsViewsTestCase(TestCase):
    def _base_export(self, *, version: int) -> dict:
        return {
            "format": "moss_scoresheet",
            "version": version,
            "exported_at": "2026-02-13T00:00:00Z",
            "packet": {
                "packet": "Round 1",
                "year": 2022,
                "questions": [
                    {"id": 1, "pair_id": 1, "question_type": "TOSSUP"},
                    {"id": 2, "pair_id": 1, "question_type": "BONUS"},
                    {"id": 3, "pair_id": 2, "question_type": "TOSSUP"},
                    {"id": 4, "pair_id": 2, "question_type": "BONUS"},
                ],
            },
            "packet_checksum": {
                "algorithm": "sha256",
                "canonicalization": "json_sorted_keys_utf8_no_ws",
                "value": "0" * 64,
            },
            "game": {
                "teams": [
                    {
                        "name": "Team A",
                        "players": ["Alice", "Bob"],
                        "lineup_segments": [
                            {"start_tossup": 1, "end_tossup": None, "active_players": ["Alice", "Bob"]}
                        ],
                    },
                    {
                        "name": "Team B",
                        "players": ["Carol", "Dan"],
                        "lineup_segments": [
                            {"start_tossup": 1, "end_tossup": None, "active_players": ["Carol", "Dan"]}
                        ],
                    },
                ]
            },
            "rules": {
                "tossup": {"correct": 4, "incorrect": -4, "no_penalty": 0},
                "bonus": {"correct": 10, "incorrect": 0},
            },
        }

    def test_standings_view_from_fact_tables_mixed_versions(self):
        tournament = Tournament.objects.create(
            name="Pilot Scrimmage",
            slug="pilot-scrimmage",
            description="",
            division="HIGH_SCHOOL",
            format="ROUND_ROBIN",
            status="COMPLETED",
            tournament_date=date(2026, 2, 13),
            registration_deadline=None,
            location="",
            venue="",
            host_organization="",
            tournament_director=None,
            max_teams=None,
            current_teams=0,
            website_url="",
            registration_url="",
        )

        # Game 1 (v1): Team A wins 10–0.
        export1 = self._base_export(version=1)
        export1["state"] = {
            "pair_index": 1,
            "attempts_by_question_id": {
                "1": [
                    {
                        "team": "Team A",
                        "player": "Alice",
                        "result": "correct",
                        "token": "X",
                        "is_end": False,
                        "location": {"kind": "question", "word_index": 0},
                    },
                    {
                        "team": "Team B",
                        "player": "Carol",
                        "result": "incorrect",
                        "token": "NO PENALTY",
                        "is_end": True,
                        "location": {"kind": "end"},
                    },
                ],
                "2": [
                    {
                        "team": "Team A",
                        "player": None,
                        "result": "correct",
                        "token": "BONUS",
                        "is_end": True,
                        "location": {"kind": "end"},
                    }
                ],
                "3": [
                    {
                        "team": "Team A",
                        "player": "Bob",
                        "result": "incorrect",
                        "token": "buzz",
                        "is_end": False,
                        "location": {"kind": "question", "word_index": 1},
                    },
                    {
                        "team": "Team B",
                        "player": "Dan",
                        "result": "incorrect",
                        "token": "NO PENALTY",
                        "is_end": True,
                        "location": {"kind": "end"},
                    },
                ],
            },
        }

        # Game 2 (v2): Team B wins 14–0.
        export2 = self._base_export(version=2)
        export2["state"] = {
            "pair_index": 0,
            "attempts_by_question_id": {
                "1": [
                    {
                        "team": "Team B",
                        "player": "Carol",
                        "result": "correct",
                        "token": "X",
                        "is_end": False,
                        "location": {"kind": "question", "word_index": 0},
                    }
                ],
                "2": [
                    {
                        "team": "Team B",
                        "player": None,
                        "result": "correct",
                        "token": "BONUS",
                        "is_end": True,
                        "location": {"kind": "end"},
                    }
                ],
            },
        }
        export2["event_log"] = {"scoresheet_id": None, "next_seq": 1, "events": []}

        def dump_bytes(obj: dict) -> bytes:
            return json.dumps(obj, sort_keys=True).encode("utf-8")

        ingest_scoresheet_exports(
            tournament_id=tournament.id,
            exports=[
                (Path("export1.json"), dump_bytes(export1), export1),
                (Path("export2.json"), dump_bytes(export2), export2),
            ],
        )

        view = build_tournament_standings_view(tournament=tournament)
        team_rows = view["team_standings"]
        player_rows = view["individual_standings"]

        self.assertEqual([r["name"] for r in team_rows], ["Team B", "Team A"])
        self.assertEqual(team_rows[0]["wins"], 1)
        self.assertEqual(team_rows[0]["losses"], 1)
        self.assertEqual(team_rows[0]["points_per_game"], 7.0)

        self.assertEqual(team_rows[1]["wins"], 1)
        self.assertEqual(team_rows[1]["losses"], 1)
        self.assertEqual(team_rows[1]["points_per_game"], 5.0)

        self.assertEqual(player_rows[0]["name"], "Alice")
        self.assertEqual(player_rows[0]["tossup_points"], 4)
        self.assertEqual(player_rows[1]["name"], "Carol")
        self.assertEqual(player_rows[1]["tossup_points"], 4)

