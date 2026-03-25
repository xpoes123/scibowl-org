from django.test import TestCase

from moss import event_types
from moss.models import (
    Game,
    GameTeam,
    Scoresheet,
    ScoresheetEvent,
    ScoresheetSnapshot,
)
from moss.services.snapshots import build_state, maybe_write_snapshot, SNAPSHOT_INTERVAL
from tournaments.models import Team, Tournament


class SnapshotTestCase(TestCase):
    def setUp(self):
        self.tournament = Tournament.objects.create(
            name="Test Tournament",
            divisions=["HS"],
            format="ROUND_ROBIN",
            status="UPCOMING",
            mode="IN_PERSON",
            timezone="America/New_York",
            start_date="2026-02-01",
            location_city="Test City",
        )

        team1 = Team.objects.create(
            tournament=self.tournament,
            name="Team A",
            school="Test School",
            pool="A",
        )
        team2 = Team.objects.create(
            tournament=self.tournament,
            name="Team B",
            school="Test School",
            pool="A",
        )

        self.game = Game.objects.create(
            tournament=self.tournament,
            status="SCHEDULED",
        )
        GameTeam.objects.create(game=self.game, tournament_team=team1, slot=1)
        GameTeam.objects.create(game=self.game, tournament_team=team2, slot=2)
        self.scoresheet = Scoresheet.objects.create(game=self.game)

    def _append_event(self, seq: int, event_type: str, payload: dict) -> ScoresheetEvent:
        return ScoresheetEvent.objects.create(
            scoresheet=self.scoresheet,
            seq=seq,
            client_event_id=f"00000000-0000-0000-0000-{seq:012d}",
            event_type=event_type,
            event_version=1,
            payload=payload,
        )

    def test_build_state_from_events(self):
        self._append_event(1, event_types.EVENT_GAME_STARTED, {})
        self._append_event(2, event_types.EVENT_CURSOR_PAIR_INDEX_SET, {"pair_index": 4})
        self._append_event(3, event_types.EVENT_ATTEMPT_RECORDED, {
            "question_id": 12,
            "team_id": 1,
            "player_id": None,
            "result": "correct",
            "token": "alpha",
            "is_end": False,
            "location": {"kind": "question", "word_index": 2},
        })

        state = build_state(self.scoresheet)
        self.assertEqual(state["game"]["status"], "IN_PROGRESS")
        self.assertEqual(state["pair_index"], 4)
        self.assertIn("12", state["attempts_by_question_id"])

    def test_maybe_write_snapshot_interval(self):
        for seq in range(1, SNAPSHOT_INTERVAL):
            self._append_event(seq, event_types.EVENT_CURSOR_PAIR_INDEX_SET, {"pair_index": seq})

        snapshot = maybe_write_snapshot(self.scoresheet.id, SNAPSHOT_INTERVAL - 1)
        self.assertIsNone(snapshot)
        self.assertEqual(ScoresheetSnapshot.objects.count(), 0)

        self._append_event(SNAPSHOT_INTERVAL, event_types.EVENT_CURSOR_PAIR_INDEX_SET, {"pair_index": SNAPSHOT_INTERVAL})
        snapshot = maybe_write_snapshot(self.scoresheet.id, SNAPSHOT_INTERVAL)
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot.seq, SNAPSHOT_INTERVAL)
        self.scoresheet.refresh_from_db()
        self.assertEqual(self.scoresheet.latest_snapshot_seq, SNAPSHOT_INTERVAL)

    def test_build_state_uses_snapshot(self):
        self._append_event(1, event_types.EVENT_CURSOR_PAIR_INDEX_SET, {"pair_index": 1})
        snapshot = maybe_write_snapshot(self.scoresheet.id, 1, reason="test")
        self.assertIsNotNone(snapshot)

        self._append_event(2, event_types.EVENT_CURSOR_PAIR_INDEX_SET, {"pair_index": 2})
        state = build_state(self.scoresheet)
        self.assertEqual(state["pair_index"], 2)
