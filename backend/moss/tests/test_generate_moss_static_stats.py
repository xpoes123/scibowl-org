from pathlib import Path

from django.test import SimpleTestCase

from moss.management.commands.generate_moss_static_stats import _infer_round_assignments


def _export_input(path: str, packet_name: str, checksum: str) -> tuple[Path, bytes, dict[str, object]]:
    return (
        Path(path),
        b"{}",
        {
            "packet": {"packet": packet_name},
            "packet_checksum": {"value": checksum},
        },
    )


class InferRoundAssignmentsTestCase(SimpleTestCase):
    def test_mixed_phase_round_numbers_are_reassigned_uniquely(self):
        exports = [
            _export_input(
                "SSB/Prelims/Round 1/game_1.json",
                "ROUND ROBIN 1",
                "a" * 64,
            ),
            _export_input(
                "SSB/Prelims/Round 2/game_2.json",
                "ROUND ROBIN 2",
                "b" * 64,
            ),
            _export_input(
                "SSB/Playoffs/Double Elimination 1/game_3.json",
                "DOUBLE ELIMINATION 1",
                "c" * 64,
            ),
            _export_input(
                "SSB/Playoffs/Double Elimination 2/game_4.json",
                "DOUBLE ELIMINATION 2",
                "d" * 64,
            ),
        ]

        round_assignments, mode, warnings = _infer_round_assignments(exports)

        self.assertEqual(mode, "folder")
        self.assertEqual(
            round_assignments[str(exports[0][0])]["round_number"],
            1,
        )
        self.assertEqual(
            round_assignments[str(exports[1][0])]["round_number"],
            2,
        )
        self.assertEqual(
            round_assignments[str(exports[2][0])]["round_number"],
            3,
        )
        self.assertEqual(
            round_assignments[str(exports[3][0])]["round_number"],
            4,
        )
        self.assertTrue(
            any("assigning unique round numbers by phase order" in warning for warning in warnings)
        )

    def test_single_phase_round_numbers_are_preserved(self):
        exports = [
            _export_input(
                "Pilot/Round 3/game_1.json",
                "ROUND ROBIN 3",
                "a" * 64,
            ),
            _export_input(
                "Pilot/Round 4/game_2.json",
                "ROUND ROBIN 4",
                "b" * 64,
            ),
        ]

        round_assignments, mode, warnings = _infer_round_assignments(exports)

        self.assertEqual(mode, "folder")
        self.assertEqual(
            round_assignments[str(exports[0][0])]["round_number"],
            3,
        )
        self.assertEqual(
            round_assignments[str(exports[1][0])]["round_number"],
            4,
        )
        self.assertFalse(
            any("assigning unique round numbers by phase order" in warning for warning in warnings)
        )
