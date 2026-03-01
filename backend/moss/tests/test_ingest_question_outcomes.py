import json
from datetime import date
from pathlib import Path

from django.test import TestCase

from moss.models import (
    Game,
    GamePlayerLineupSegment,
    GameTeamQuestionOutcome,
    PacketQuestion,
    PacketVersion,
)
from moss.services.ingest_exports import ingest_scoresheet_exports
from tournaments.models import Tournament


class IngestQuestionOutcomesTestCase(TestCase):
    def test_ingest_populates_packet_questions_and_outcomes(self):
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

        export_obj = {
            "format": "moss_scoresheet",
            "version": 1,
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
            "state": {
                "pair_index": 0,
                "attempts_by_question_id": {
                    "1": [
                        {
                            "team": "Team A",
                            "player": "Alice",
                            "result": "correct",
                            "token": "X",
                            "is_end": False,
                            "location": {"kind": "question", "word_index": 0},
                        }
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
                },
            },
        }

        raw = json.dumps(export_obj, sort_keys=True).encode("utf-8")
        ingest_scoresheet_exports(
            tournament_id=tournament.id,
            exports=[(Path("export.json"), raw, export_obj)],
        )

        self.assertEqual(PacketVersion.objects.count(), 1)
        pv = PacketVersion.objects.first()
        assert pv is not None
        self.assertEqual(pv.checksum_value, "0" * 64)

        self.assertEqual(PacketQuestion.objects.count(), 4)
        self.assertEqual(Game.objects.count(), 1)
        game = Game.objects.first()
        assert game is not None
        self.assertIsNotNone(game.packet_version_id)
        self.assertEqual(game.pairs_played, 1)
        self.assertEqual(game.tossup_points_correct, 4)
        self.assertEqual(game.bonus_points_correct, 10)

        self.assertEqual(GameTeamQuestionOutcome.objects.count(), 4)
        buzz = GameTeamQuestionOutcome.objects.filter(tossup_result="CORRECT").first()
        assert buzz is not None
        self.assertIsNotNone(buzz.buzzing_player_id)

        self.assertEqual(GamePlayerLineupSegment.objects.count(), 4)

    def test_ingest_v3_id_based_export(self):
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

        export_obj = {
            "format": "moss_scoresheet",
            "version": 3,
            "exported_at": "2026-02-13T00:00:00Z",
            "packet": {
                "packet": "Round 1",
                "year": 2022,
                "questions": [
                    {"id": 1, "pair_id": 1, "question_type": "TOSSUP"},
                    {"id": 2, "pair_id": 1, "question_type": "BONUS"},
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
                        "id": "team_a",
                        "name": "Team A",
                        "players": [
                            {"id": "p_alice", "name": "Alice"},
                            {"id": "p_bob", "name": "Bob"},
                        ],
                        "lineup_segments": [
                            {"start_tossup": 1, "end_tossup": None, "active_player_ids": ["p_alice", "p_bob"]}
                        ],
                    },
                    {
                        "id": "team_b",
                        "name": "Team B",
                        "players": [
                            {"id": "p_carol", "name": "Carol"},
                            {"id": "p_dan", "name": "Dan"},
                        ],
                        "lineup_segments": [
                            {"start_tossup": 1, "end_tossup": None, "active_player_ids": ["p_carol", "p_dan"]}
                        ],
                    },
                ]
            },
            "rules": {
                "tossup": {"correct": 4, "incorrect": -4, "no_penalty": 0},
                "bonus": {"correct": 10, "incorrect": 0},
            },
            "event_log": {"scoresheet_id": None, "next_seq": 1, "events": []},
            "state": {
                "pair_index": 0,
                "attempts_by_question_id": {
                    "1": [
                        {
                            "team_id": "team_a",
                            "player_id": "p_alice",
                            "result": "correct",
                            "token": "X",
                            "is_end": False,
                            "location": {"kind": "question", "word_index": 0},
                        }
                    ],
                    "2": [
                        {
                            "team_id": "team_a",
                            "player_id": None,
                            "result": "correct",
                            "token": "BONUS",
                            "is_end": True,
                            "location": {"kind": "end"},
                        }
                    ],
                },
            },
        }

        raw = json.dumps(export_obj, sort_keys=True).encode("utf-8")
        ingest_scoresheet_exports(
            tournament_id=tournament.id,
            exports=[(Path("export.json"), raw, export_obj)],
        )

        self.assertEqual(Game.objects.count(), 1)
        self.assertEqual(GameTeamQuestionOutcome.objects.count(), 4)
        buzz = GameTeamQuestionOutcome.objects.filter(tossup_result="CORRECT").first()
        assert buzz is not None
        self.assertIsNotNone(buzz.buzzing_player_id)

        self.assertEqual(GamePlayerLineupSegment.objects.count(), 4)
