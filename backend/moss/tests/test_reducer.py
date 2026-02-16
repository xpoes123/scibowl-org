from django.test import TestCase

from moss import event_types
from moss.reducer import initial_state, reduce_events


class ReducerTestCase(TestCase):
    def test_apply_game_lifecycle_and_cursor(self):
        events = [
            {"seq": 1, "type": event_types.EVENT_GAME_STARTED, "payload": {}},
            {"seq": 2, "type": event_types.EVENT_CURSOR_PAIR_INDEX_SET, "payload": {"pair_index": 3}},
            {"seq": 3, "type": event_types.EVENT_GAME_COMPLETED, "payload": {}},
        ]
        state = reduce_events(events, initial_state())
        self.assertEqual(state["game"]["status"], "COMPLETED")
        self.assertEqual(state["pair_index"], 3)
        self.assertEqual(state["last_seq"], 3)

    def test_attempts_recorded_overwrite_by_team(self):
        events = [
            {
                "seq": 1,
                "type": event_types.EVENT_ATTEMPT_RECORDED,
                "payload": {
                    "question_id": 10,
                    "team_id": 1,
                    "player_id": 5,
                    "result": "incorrect",
                    "token": "alpha",
                    "is_end": False,
                    "location": {"kind": "question", "word_index": 1},
                },
            },
            {
                "seq": 2,
                "type": event_types.EVENT_ATTEMPT_RECORDED,
                "payload": {
                    "question_id": 10,
                    "team_id": 1,
                    "player_id": 5,
                    "result": "correct",
                    "token": "beta",
                    "is_end": False,
                    "location": {"kind": "question", "word_index": 2},
                },
            },
        ]
        state = reduce_events(events, initial_state())
        attempts = state["attempts_by_question_id"]["10"]
        self.assertEqual(len(attempts), 1)
        self.assertEqual(attempts[0]["result"], "correct")
        self.assertEqual(attempts[0]["token"], "beta")

    def test_attempts_cleared(self):
        events = [
            {
                "seq": 1,
                "type": event_types.EVENT_ATTEMPT_RECORDED,
                "payload": {
                    "question_id": 7,
                    "team_id": 2,
                    "player_id": None,
                    "result": "incorrect",
                    "token": "x",
                    "is_end": True,
                    "location": {"kind": "end"},
                },
            },
            {
                "seq": 2,
                "type": event_types.EVENT_ATTEMPTS_QUESTION_CLEARED,
                "payload": {"question_id": 7},
            },
        ]
        state = reduce_events(events, initial_state())
        self.assertNotIn("7", state["attempts_by_question_id"])

    def test_bonus_result_set(self):
        events = [
            {
                "seq": 1,
                "type": event_types.EVENT_BONUS_RESULT_SET,
                "payload": {
                    "bonus_question_id": 11,
                    "team_id": 4,
                    "result": "correct",
                },
            },
        ]
        state = reduce_events(events, initial_state())
        self.assertEqual(
            state["bonus_by_question_id"]["11"],
            {"team_id": 4, "result": "correct"},
        )

    def test_markers_and_lineups(self):
        events = [
            {
                "seq": 1,
                "type": event_types.EVENT_MARKER_SET,
                "payload": {"boundary_before_question": 5, "kind": "HALFTIME"},
            },
            {
                "seq": 2,
                "type": event_types.EVENT_MARKER_REMOVED,
                "payload": {"boundary_before_question": 5},
            },
            {
                "seq": 3,
                "type": event_types.EVENT_LINEUP_SET,
                "payload": {
                    "team_id": 9,
                    "boundary_before_question": 1,
                    "active_player_ids": [1, 2, 2, 3],
                },
            },
            {
                "seq": 4,
                "type": event_types.EVENT_LINEUP_REMOVED,
                "payload": {"team_id": 9, "boundary_before_question": 1},
            },
        ]
        state = reduce_events(events, initial_state())
        self.assertNotIn("5", state["markers"])
        self.assertNotIn("9", state["lineups"])
