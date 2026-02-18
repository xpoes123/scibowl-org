import hashlib
import json
import tempfile
from datetime import date
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from moss.models import Game as MossGame
from moss.models import Scoresheet, ScoresheetSnapshot
from tournaments.models import Tournament


class IngestMoSSExportsCommandTestCase(TestCase):
    def _export_obj(self, *, version: int) -> dict:
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
                ],
            },
            "packet_checksum": {
                "algorithm": "sha256",
                "canonicalization": "json_sorted_keys_utf8_no_ws",
                "value": "0" * 64,
            },
            "game": {
                "teams": [
                    {"name": "Team A", "players": ["Alice"]},
                    {"name": "Team B", "players": ["Bob"]},
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

    def test_overwrites_when_already_imported_with_yes(self):
        tournament = Tournament.objects.create(
            name="Pilot Scrimmage",
            slug="pilot-scrimmage",
            description="",
            division="HIGH_SCHOOL",
            format="ROUND_ROBIN",
            status="COMPLETED",
            tournament_date=date(2026, 2, 13),
            location="Test Location",
            venue="",
            host_organization="Test Org",
        )

        export_obj = self._export_obj(version=1)
        data = json.dumps(export_obj, sort_keys=True).encode("utf-8")
        file_hash = hashlib.sha256(data).hexdigest()
        import_reason = f"import_export:{file_hash}"

        # Simulate a previous import by creating a snapshot with the import reason.
        old_game = MossGame.objects.create(tournament=tournament, status="COMPLETED")
        old_scoresheet = Scoresheet.objects.create(
            game=old_game,
            schema_version=1,
            next_seq=10,
            latest_snapshot_seq=9,
        )
        ScoresheetSnapshot.objects.create(
            scoresheet=old_scoresheet,
            seq=9,
            reason=import_reason,
            state={"old": True},
        )

        with tempfile.TemporaryDirectory() as tmp:
            export_path = Path(tmp) / "export.json"
            export_path.write_bytes(data)

            call_command(
                "ingest_moss_exports",
                "--tournament-slug",
                "pilot-scrimmage",
                "--yes",
                str(export_path),
            )

        # The old snapshot should be deleted (overwrite path).
        self.assertFalse(ScoresheetSnapshot.objects.filter(reason=import_reason, seq=9).exists())
        # The newly imported snapshot uses seq=1.
        self.assertTrue(ScoresheetSnapshot.objects.filter(reason=import_reason, seq=1).exists())
        # Only one game remains after replacement.
        self.assertEqual(MossGame.objects.filter(tournament=tournament).count(), 1)

