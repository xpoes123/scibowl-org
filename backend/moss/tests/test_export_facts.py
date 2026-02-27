from django.test import TestCase

from moss.services.export_facts import (
    reduce_scoresheet_export_to_facts,
    reduce_scoresheet_export_to_question_outcomes,
)


class ExportFactsReducerTestCase(TestCase):
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

    def test_v1_basic_scoring_and_no_penalty(self):
        export_obj = self._base_export(version=1)
        export_obj["state"] = {
            "pair_index": 1,
            "attempts_by_question_id": {
                # Pair 1 tossup
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
                # Pair 1 bonus
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
                # Pair 2 tossup
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
                # Pair 2 bonus omitted for Team A (treated as 0 points)
            },
        }

        facts = reduce_scoresheet_export_to_facts(export_obj)
        self.assertEqual(facts.pairs_played, 2)

        team_a = next(t for t in facts.team_facts if t.team_name == "Team A")
        team_b = next(t for t in facts.team_facts if t.team_name == "Team B")

        self.assertEqual(team_a.tossups_heard, 2)
        self.assertEqual(team_a.tossups_4, 1)
        self.assertEqual(team_a.tossups_neg, 1)
        self.assertEqual(team_a.tossups_0, 0)
        self.assertEqual(team_a.bonuses_heard, 1)
        self.assertEqual(team_a.bonus_points, 10)
        self.assertEqual(team_a.points, 10)

        self.assertEqual(team_b.tossups_heard, 2)
        self.assertEqual(team_b.tossups_4, 0)
        self.assertEqual(team_b.tossups_neg, 0)
        self.assertEqual(team_b.tossups_0, 2)
        self.assertEqual(team_b.bonuses_heard, 0)
        self.assertEqual(team_b.bonus_points, 0)
        self.assertEqual(team_b.points, 0)

        alice = next(p for p in facts.player_facts if p.player_name == "Alice")
        bob = next(p for p in facts.player_facts if p.player_name == "Bob")
        self.assertEqual(alice.tossups_heard, 2)
        self.assertEqual(alice.tossups_4, 1)
        self.assertEqual(alice.tossups_neg, 0)
        self.assertEqual(alice.tossup_points, 4)
        self.assertEqual(bob.tossups_heard, 2)
        self.assertEqual(bob.tossups_4, 0)
        self.assertEqual(bob.tossups_neg, 1)
        self.assertEqual(bob.tossup_points, -4)

    def test_question_outcomes_per_pair(self):
        export_obj = self._base_export(version=1)
        export_obj["packet"]["questions"] = [
            {"id": 1, "pair_id": 1, "question_type": "TOSSUP", "category": "PHYSICS"},
            {"id": 2, "pair_id": 1, "question_type": "BONUS", "category": "PHYSICS"},
            {"id": 3, "pair_id": 2, "question_type": "TOSSUP", "category": "MATH"},
            {"id": 4, "pair_id": 2, "question_type": "BONUS", "category": "MATH"},
        ]
        export_obj["state"] = {
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

        out = reduce_scoresheet_export_to_question_outcomes(export_obj)
        self.assertEqual(out.pairs_played, 2)
        self.assertEqual(len(out.outcomes), 8)

        def pick(team: str, qid: int) -> dict:
            row = next(o for o in out.outcomes if o.team_name == team and o.question_id == qid)
            return row.__dict__

        a_tu1 = pick("Team A", 1)
        b_tu1 = pick("Team B", 1)
        self.assertEqual(a_tu1["question_type"], "TOSSUP")
        self.assertEqual(a_tu1["category"], "PHYSICS")
        self.assertEqual(a_tu1["heard"], True)
        self.assertEqual(a_tu1["points"], 4)
        self.assertEqual(a_tu1["tossup_result"], "CORRECT")
        self.assertEqual(a_tu1["buzzing_player_name"], "Alice")

        self.assertEqual(b_tu1["points"], 0)
        self.assertEqual(b_tu1["tossup_result"], "NO_PENALTY")
        self.assertEqual(b_tu1["buzzing_player_name"], None)

        a_b1 = pick("Team A", 2)
        b_b1 = pick("Team B", 2)
        self.assertEqual(a_b1["question_type"], "BONUS")
        self.assertEqual(a_b1["heard"], True)
        self.assertEqual(a_b1["bonus_result"], "CORRECT")
        self.assertEqual(a_b1["points"], 10)
        self.assertEqual(b_b1["heard"], False)
        self.assertEqual(b_b1["bonus_result"], "UNHEARD")
        self.assertEqual(b_b1["points"], 0)

        a_tu2 = pick("Team A", 3)
        b_tu2 = pick("Team B", 3)
        self.assertEqual(a_tu2["category"], "MATH")
        self.assertEqual(a_tu2["points"], -4)
        self.assertEqual(a_tu2["tossup_result"], "INCORRECT")
        self.assertEqual(a_tu2["buzzing_player_name"], "Bob")
        self.assertEqual(b_tu2["points"], 0)
        self.assertEqual(b_tu2["tossup_result"], "NO_PENALTY")

        a_b2 = pick("Team A", 4)
        b_b2 = pick("Team B", 4)
        self.assertEqual(a_b2["heard"], False)
        self.assertEqual(a_b2["bonus_result"], "UNHEARD")
        self.assertEqual(b_b2["heard"], False)
        self.assertEqual(b_b2["bonus_result"], "UNHEARD")

    def test_v2_uses_state_when_present(self):
        export_obj = self._base_export(version=2)
        export_obj["state"] = {
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
                ]
            },
        }
        export_obj["event_log"] = {"scoresheet_id": None, "next_seq": 1, "events": []}

        facts = reduce_scoresheet_export_to_facts(export_obj)
        self.assertEqual(facts.pairs_played, 1)
        team_a = next(t for t in facts.team_facts if t.team_name == "Team A")
        self.assertEqual(team_a.tossups_4, 1)

    def test_pairs_played_infers_from_attempts_when_cursor_missing(self):
        export_obj = self._base_export(version=1)
        export_obj["state"] = {
            "attempts_by_question_id": {
                "3": [
                    {
                        "team": "Team A",
                        "player": "Bob",
                        "result": "incorrect",
                        "token": "buzz",
                        "is_end": False,
                        "location": {"kind": "question", "word_index": 1},
                    }
                ]
            }
        }
        facts = reduce_scoresheet_export_to_facts(export_obj)
        self.assertEqual(facts.pairs_played, 2)

    def test_incorrect_at_end_counts_as_no_penalty(self):
        export_obj = self._base_export(version=1)
        export_obj["state"] = {
            "pair_index": 0,
            "attempts_by_question_id": {
                "1": [
                    {
                        "team": "Team A",
                        "player": "Alice",
                        "result": "incorrect",
                        "token": "END",
                        "is_end": True,
                        "location": {"kind": "end"},
                    }
                ]
            },
        }

        facts = reduce_scoresheet_export_to_facts(export_obj)
        team_a = next(t for t in facts.team_facts if t.team_name == "Team A")
        self.assertEqual(team_a.tossups_heard, 1)
        self.assertEqual(team_a.tossups_4, 0)
        self.assertEqual(team_a.tossups_neg, 0)
        self.assertEqual(team_a.tossups_0, 1)
        self.assertEqual(team_a.points, 0)

