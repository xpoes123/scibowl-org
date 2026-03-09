from tempfile import TemporaryDirectory
from pathlib import Path

from django.test import SimpleTestCase

from django.core.management.base import CommandError

from moss.management.commands.generate_moss_static_stats import (
    _discover_reports_from_subdirs,
    _infer_round_assignments,
    _infer_round_assignments_from_report_structure,
)


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


class StructuredReportDiscoveryTestCase(SimpleTestCase):
    def test_discovers_reports_from_top_level_subdirectories(self):
        with TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "Prelims" / "Round 1").mkdir(parents=True)
            (root / "Playoffs" / "Double Elimination 1").mkdir(parents=True)
            (root / "Prelims" / "Round 1" / "a.json").write_text("{}", encoding="utf-8")
            (root / "Playoffs" / "Double Elimination 1" / "b.json").write_text("{}", encoding="utf-8")

            reports, all_paths, warnings = _discover_reports_from_subdirs(root)

        self.assertEqual([report["key"] for report in reports], ["playoffs", "prelims"])
        self.assertEqual(len(all_paths), 2)
        self.assertEqual(warnings, [])

    def test_rejects_json_files_in_root(self):
        with TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "orphan.json").write_text("{}", encoding="utf-8")

            with self.assertRaises(CommandError):
                _discover_reports_from_subdirs(root)


class StructuredRoundAssignmentsTestCase(SimpleTestCase):
    def test_per_report_round_names_come_from_round_folders(self):
        exports = [
            _export_input(
                "Prelims/Round 1/game_1.json",
                "ROUND ROBIN 1",
                "a" * 64,
            ),
            _export_input(
                "Prelims/Round 2/game_2.json",
                "ROUND ROBIN 2",
                "b" * 64,
            ),
        ]

        round_assignments, mode, warnings = _infer_round_assignments_from_report_structure(
            exports,
            root_dir=Path("Prelims"),
            combine_reports=False,
        )

        self.assertEqual(mode, "structured_folder")
        self.assertEqual(round_assignments[str(exports[0][0])]["round_number"], 1)
        self.assertEqual(round_assignments[str(exports[0][0])]["name"], "Round 1")
        self.assertEqual(round_assignments[str(exports[0][0])]["packet_name"], "ROUND ROBIN 1")
        self.assertEqual(round_assignments[str(exports[1][0])]["round_number"], 2)
        self.assertEqual(warnings, [])

    def test_combined_rounds_put_prelims_before_playoffs(self):
        exports = [
            _export_input(
                "SSB/Playoffs/Double Elimination 1/game_1.json",
                "DOUBLE ELIMINATION 1",
                "a" * 64,
            ),
            _export_input(
                "SSB/Prelims/Round 1/game_2.json",
                "ROUND ROBIN 1",
                "b" * 64,
            ),
            _export_input(
                "SSB/Prelims/Round 2/game_3.json",
                "ROUND ROBIN 2",
                "c" * 64,
            ),
        ]

        round_assignments, mode, warnings = _infer_round_assignments_from_report_structure(
            exports,
            root_dir=Path("SSB"),
            combine_reports=True,
        )

        self.assertEqual(mode, "structured_folder_combined")
        self.assertEqual(round_assignments[str(exports[1][0])]["round_number"], 1)
        self.assertEqual(round_assignments[str(exports[2][0])]["round_number"], 2)
        self.assertEqual(round_assignments[str(exports[0][0])]["round_number"], 3)
        self.assertEqual(round_assignments[str(exports[0][0])]["name"], "Double Elimination 1")
        self.assertEqual(warnings, [])
