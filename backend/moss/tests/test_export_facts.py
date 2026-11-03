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

    def test_v3_id_based_state_resolves_team_and_player_names(self):
        export_obj = self._base_export(version=3)
        export_obj["game"] = {
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
        }
        export_obj["state"] = {
            "pair_index": 1,
            "attempts_by_question_id": {
                # Pair 1 tossup
                "1": [
                    {
                        "team_id": "team_a",
                        "player_id": "p_alice",
                        "result": "correct",
                        "token": "X",
                        "is_end": False,
                        "location": {"kind": "question", "word_index": 0},
                    },
                    {
                        "team_id": "team_b",
                        "player_id": "p_carol",
                        "result": "incorrect",
                        "token": "NO PENALTY",
                        "is_end": True,
                        "location": {"kind": "end"},
                    },
                ],
                # Pair 1 bonus
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
                # Pair 2 tossup
                "3": [
                    {
                        "team_id": "team_a",
                        "player_id": "p_bob",
                        "result": "incorrect",
                        "token": "buzz",
                        "is_end": False,
                        "location": {"kind": "question", "word_index": 1},
                    },
                    {
                        "team_id": "team_b",
                        "player_id": "p_dan",
                        "result": "incorrect",
                        "token": "NO PENALTY",
                        "is_end": True,
                        "location": {"kind": "end"},
                    },
                ],
            },
        }
        export_obj["event_log"] = {"scoresheet_id": None, "next_seq": 1, "events": []}

        facts = reduce_scoresheet_export_to_facts(export_obj)
        self.assertEqual(facts.pairs_played, 2)

        team_a = next(t for t in facts.team_facts if t.team_name == "Team A")
        team_b = next(t for t in facts.team_facts if t.team_name == "Team B")
        self.assertEqual(team_a.tossups_heard, 2)
        self.assertEqual(team_a.tossups_4, 1)
        self.assertEqual(team_a.tossups_neg, 1)
        self.assertEqual(team_b.tossups_heard, 2)
        self.assertEqual(team_b.tossups_4, 0)
        self.assertEqual(team_b.tossups_neg, 0)

        alice = next(p for p in facts.player_facts if p.player_name == "Alice")
        bob = next(p for p in facts.player_facts if p.player_name == "Bob")
        self.assertEqual(alice.team_name, "Team A")
        self.assertEqual(alice.tossups_heard, 2)
        self.assertEqual(alice.tossups_4, 1)
        self.assertEqual(alice.tossups_neg, 0)
        self.assertEqual(alice.tossup_points, 4)
        self.assertEqual(bob.team_name, "Team A")
        self.assertEqual(bob.tossups_heard, 2)
        self.assertEqual(bob.tossups_4, 0)
        self.assertEqual(bob.tossups_neg, 1)
        self.assertEqual(bob.tossup_points, -4)

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

    def test_duplicate_team_names_rejected(self):
        export_obj = self._base_export(version=1)
        export_obj["game"]["teams"][1]["name"] = "Team A"
        export_obj["state"] = {"pair_index": 0, "attempts_by_question_id": {}}

        with self.assertRaises(ValueError):
            reduce_scoresheet_export_to_facts(export_obj)

        with self.assertRaises(ValueError):
            reduce_scoresheet_export_to_question_outcomes(export_obj)



class ExportFactsEndBoundaryTestCase(TestCase):
    """Early game end via end.set / end.cleared in the event log."""

    def _attempt(self, team_id: str, player_id: str | None, result: str) -> dict:
        return {
            "team_id": team_id,
            "player_id": player_id,
            "result": result,
            "token": "X",
            "is_end": False,
            "location": {"kind": "question", "word_index": 0},
        }

    def _export(self, end_events: list[dict], team_a_segments: list[dict] | None = None) -> dict:
        # Three pairs. The cursor sits on pair 3 and pair 3 has a buzz, so without an
        # early end the inferred pairs played is 3.
        return {
            "format": "moss_scoresheet",
            "version": 3,
            "exported_at": "2026-02-13T00:00:00Z",
            "packet": {
                "packet": "Round 1",
                "year": 2022,
                "questions": [
                    {"id": 1, "pair_id": 1, "question_type": "TOSSUP", "category": "PHYSICS"},
                    {"id": 2, "pair_id": 1, "question_type": "BONUS", "category": "PHYSICS"},
                    {"id": 3, "pair_id": 2, "question_type": "TOSSUP", "category": "PHYSICS"},
                    {"id": 4, "pair_id": 2, "question_type": "BONUS", "category": "PHYSICS"},
                    {"id": 5, "pair_id": 3, "question_type": "TOSSUP", "category": "PHYSICS"},
                    {"id": 6, "pair_id": 3, "question_type": "BONUS", "category": "PHYSICS"},
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
                            {"id": "p_eve", "name": "Eve"},
                        ],
                        "lineup_segments": team_a_segments
                        or [{"start_tossup": 1, "end_tossup": None, "active_player_ids": ["p_alice", "p_bob"]}],
                    },
                    {
                        "id": "team_b",
                        "name": "Team B",
                        "players": [{"id": "p_carol", "name": "Carol"}],
                        "lineup_segments": [
                            {"start_tossup": 1, "end_tossup": None, "active_player_ids": ["p_carol"]}
                        ],
                    },
                ]
            },
            "rules": {
                "tossup": {"correct": 4, "incorrect": -4, "no_penalty": 0},
                "bonus": {"correct": 10, "incorrect": 0},
            },
            "event_log": {"scoresheet_id": None, "next_seq": len(end_events) + 1, "events": end_events},
            "state": {
                "pair_index": 2,
                "attempts_by_question_id": {
                    "1": [self._attempt("team_a", "p_alice", "correct")],
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
                    "5": [self._attempt("team_b", "p_carol", "correct")],
                },
            },
        }

    def _end_set(self, seq: int, boundary) -> dict:
        return {"seq": seq, "type": "end.set", "version": 1, "payload": {"boundary_before_question": boundary}}

    def _end_cleared(self, seq: int) -> dict:
        return {"seq": seq, "type": "end.cleared", "version": 1, "payload": {}}

    def test_end_set_cuts_off_later_pairs(self):
        export_obj = self._export([self._end_set(1, 3)])

        facts = reduce_scoresheet_export_to_facts(export_obj)
        self.assertEqual(facts.pairs_played, 2)

        team_a = next(t for t in facts.team_facts if t.team_name == "Team A")
        team_b = next(t for t in facts.team_facts if t.team_name == "Team B")
        self.assertEqual(team_a.tossups_heard, 2)
        self.assertEqual(team_a.points, 14)
        # Team B's buzz on pair 3 is after the end and is ignored.
        self.assertEqual(team_b.tossups_heard, 2)
        self.assertEqual(team_b.tossups_4, 0)
        self.assertEqual(team_b.points, 0)

        heard = {p.player_name: p.tossups_heard for p in facts.player_facts}
        self.assertEqual(heard, {"Alice": 2, "Bob": 2, "Carol": 2})

        outcomes = reduce_scoresheet_export_to_question_outcomes(export_obj)
        self.assertEqual(outcomes.pairs_played, 2)
        self.assertEqual({o.pair_id for o in outcomes.outcomes}, {1, 2})

    def test_last_end_event_wins_in_seq_order(self):
        moved = self._export([self._end_set(1, 3), self._end_set(2, 2)])
        self.assertEqual(reduce_scoresheet_export_to_facts(moved).pairs_played, 1)

        # Listed out of order: end.cleared has the higher seq, so the game is not ended early.
        cleared = self._export([self._end_cleared(2), self._end_set(1, 2)])
        self.assertEqual(reduce_scoresheet_export_to_facts(cleared).pairs_played, 3)

    def test_out_of_range_end_falls_back_to_inference(self):
        for boundary in (1, 4, 99, "2", None):
            with self.subTest(boundary=boundary):
                export_obj = self._export([self._end_set(1, boundary)])
                self.assertEqual(reduce_scoresheet_export_to_facts(export_obj).pairs_played, 3)

    def test_no_end_events_keeps_inference(self):
        export_obj = self._export([])
        self.assertEqual(reduce_scoresheet_export_to_facts(export_obj).pairs_played, 3)

        del export_obj["event_log"]
        self.assertEqual(reduce_scoresheet_export_to_facts(export_obj).pairs_played, 3)

    def test_lineup_segment_starting_after_end_counts_nothing(self):
        # Eve subs in for Bob at pair 2 only; the game ends before pair 2.
        segments = [
            {"start_tossup": 1, "end_tossup": 1, "active_player_ids": ["p_alice", "p_bob"]},
            {"start_tossup": 2, "end_tossup": 2, "active_player_ids": ["p_alice", "p_eve"]},
            {"start_tossup": 3, "end_tossup": None, "active_player_ids": ["p_alice", "p_bob"]},
        ]
        export_obj = self._export([self._end_set(1, 2)], team_a_segments=segments)

        facts = reduce_scoresheet_export_to_facts(export_obj)
        self.assertEqual(facts.pairs_played, 1)
        heard = {p.player_name: p.tossups_heard for p in facts.player_facts}
        self.assertEqual(heard, {"Alice": 1, "Bob": 1, "Carol": 1})
