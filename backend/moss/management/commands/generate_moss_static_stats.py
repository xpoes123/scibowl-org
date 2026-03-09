from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
import csv
import subprocess
import re
from uuid import uuid4
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.utils.timezone import now

from moss.services.ingest_exports import ingest_scoresheet_exports
from tournaments.models import Tournament
from tournaments.models import Round as TournamentRound


def _sha256_bytes(data: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(data)
    return digest.hexdigest()


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _require_dict(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CommandError(f"{path} must be an object")
    return value


def _prompt_yes_no(*, prompt: str, default: bool = False) -> bool:
    suffix = " [Y/n] " if default else " [y/N] "
    raw = input(prompt + suffix).strip().lower()
    if not raw:
        return default
    return raw in {"y", "yes"}


def _safe_wipe_output_dir(
    output_dir: Path,
    *,
    protected_top_level_names: set[str] | None = None,
) -> None:
    """
    Remove previously generated artifacts so stale files don't linger.

    Keeps common human-authored placeholder files.
    """
    keep_names = {"README.md", ".gitkeep", "field.json"}
    protected = protected_top_level_names or set()

    if not output_dir.exists():
        return

    # Delete files first.
    for path in sorted(output_dir.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if path.is_dir():
            continue
        rel_parts = path.relative_to(output_dir).parts
        if rel_parts and rel_parts[0] in protected:
            continue
        if path.name in keep_names:
            continue
        try:
            path.unlink()
        except OSError as e:
            raise CommandError(f"Failed to delete file: {path} ({e})") from e

    # Then delete empty directories (but keep the root).
    for path in sorted(output_dir.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if not path.is_dir():
            continue
        rel_parts = path.relative_to(output_dir).parts
        if rel_parts and rel_parts[0] in protected:
            continue
        try:
            next(path.iterdir())
        except StopIteration:
            try:
                path.rmdir()
            except OSError:
                # Best-effort: ignore dirs that aren't empty due to kept files.
                pass


def _safe_category_file_stem(category: str) -> str:
    """
    Convert an arbitrary category label into a filesystem-friendly, stable stem.
    """
    raw = (category or "").strip()
    if not raw:
        return "UNCATEGORIZED"

    stem = re.sub(r"[^A-Za-z0-9]+", "_", raw).strip("_").lower()
    if not stem:
        return "UNCATEGORIZED"
    return stem[:80]


def _normalize_report_key(raw: str | None) -> str:
    key = (raw or "").strip()
    if not key:
        return "combined"

    if "/" in key or "\\" in key or ".." in key:
        raise CommandError("--report-key must be a single path segment.")

    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", key):
        raise CommandError(
            "--report-key must match [A-Za-z0-9][A-Za-z0-9_-]{0,63} (example: prelims)."
        )

    return key.lower()


def _default_report_label(report_key: str) -> str:
    if report_key == "combined":
        return "Combined"
    words = re.split(r"[^A-Za-z0-9]+", report_key)
    words = [w for w in words if w]
    if not words:
        return report_key
    return " ".join(w[:1].upper() + w[1:] for w in words)


def _infer_slug_from_output_dir(*, repo_root: Path, output_dir: Path) -> str:
    """
    Infer tournament slug from output_dir.

    Handles both:
      - <repo>/stats/<slug>
      - <repo>/stats/<slug>/reports/<report_key>
    """
    stats_root = repo_root / "stats"
    try:
        rel = output_dir.resolve().relative_to(stats_root.resolve())
    except Exception:
        return output_dir.name

    if not rel.parts:
        return output_dir.name
    return rel.parts[0]


def _update_reports_index(
    *,
    repo_root: Path,
    slug: str,
    report_key: str,
    report_label: str,
    output_dir: Path,
    pretty: bool,
) -> None:
    stats_root = repo_root / "stats"
    tournament_root = stats_root / slug

    try:
        manifest_rel = (output_dir / "manifest.json").resolve().relative_to(
            tournament_root.resolve()
        )
    except Exception:
        # If output_dir is not under stats/<slug>/..., we can't produce stable relative paths.
        return

    index_path = tournament_root / "reports.json"
    existing: dict[str, Any] | None = None
    if index_path.exists():
        try:
            obj_any = json.loads(index_path.read_text(encoding="utf-8"))
            if isinstance(obj_any, dict):
                existing = obj_any
        except json.JSONDecodeError:
            existing = None

    reports_by_key: dict[str, dict[str, str]] = {}
    if existing:
        reports_any = existing.get("reports")
        if isinstance(reports_any, list):
            for item in reports_any:
                if not isinstance(item, dict):
                    continue
                key_any = item.get("key")
                label_any = item.get("label")
                manifest_any = item.get("manifest_path")
                if not (
                    isinstance(key_any, str)
                    and isinstance(label_any, str)
                    and isinstance(manifest_any, str)
                ):
                    continue
                reports_by_key[key_any] = {
                    "key": key_any,
                    "label": label_any,
                    "manifest_path": manifest_any,
                }

    # Upsert the current report entry.
    reports_by_key[report_key] = {
        "key": report_key,
        "label": report_label,
        "manifest_path": manifest_rel.as_posix(),
    }

    # Ensure we include Combined if its manifest exists (or we just generated it).
    combined_manifest = tournament_root / "manifest.json"
    if report_key == "combined" or combined_manifest.exists():
        combined_label = reports_by_key.get("combined", {}).get("label") or "Combined"
        reports_by_key.setdefault(
            "combined",
            {"key": "combined", "label": combined_label, "manifest_path": "manifest.json"},
        )

    # Choose a default that exists.
    default_key = "combined" if "combined" in reports_by_key else report_key

    reports_sorted = sorted(
        reports_by_key.values(),
        key=lambda r: (0 if r["key"] == "combined" else 1, r["key"]),
    )

    payload = {
        "schema_version": 1,
        "default_report_key": default_key,
        "reports": reports_sorted,
    }

    indent = 2 if pretty else None
    index_path.write_text(
        json.dumps(payload, indent=indent, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _packet_label_from_export_obj(export_obj: dict[str, Any]) -> str:
    snapshot_meta_any = export_obj.get("snapshot_meta")
    if isinstance(snapshot_meta_any, dict):
        packet_name_any = snapshot_meta_any.get("packet_name")
        if isinstance(packet_name_any, str) and packet_name_any.strip():
            return packet_name_any.strip()
    packet_any = export_obj.get("packet")
    if isinstance(packet_any, dict):
        packet_name_any = packet_any.get("packet")
        if isinstance(packet_name_any, str) and packet_name_any.strip():
            return packet_name_any.strip()
    return ""


def _packet_checksum_from_export_obj(export_obj: dict[str, Any]) -> str:
    packet_checksum_any = export_obj.get("packet_checksum")
    if isinstance(packet_checksum_any, dict):
        value_any = packet_checksum_any.get("value")
        if isinstance(value_any, str) and value_any.strip():
            return value_any.strip()
    return ""


def _expand_export_input_paths(raw_paths: list[str]) -> tuple[list[Path], list[str]]:
    """
    Expand user-provided path arguments into a list of JSON file paths.

    Supports passing:
      - individual export files
      - directories (recursively searches for *.json under them)

    Returns (paths, warnings).
    """
    warnings: list[str] = []
    expanded: list[Path] = []

    for raw in raw_paths:
        path = Path(raw).expanduser()
        if not path.exists():
            raise CommandError(f"File not found: {path}")

        if path.is_dir():
            json_files = sorted(p for p in path.rglob("*.json") if p.is_file())
            if not json_files:
                warnings.append(f"Directory contains no .json files: {path}")
                continue
            expanded.extend(json_files)
            continue

        if path.is_file():
            expanded.append(path)
            continue

        warnings.append(f"Skipping non-file, non-directory path: {path}")

    # Deterministic order even across mixed inputs.
    expanded_unique: list[Path] = []
    seen: set[str] = set()
    for p in sorted(expanded, key=lambda x: str(x)):
        key = str(p)
        if key in seen:
            continue
        seen.add(key)
        expanded_unique.append(p)

    return expanded_unique, warnings


def _normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _parse_round_number_from_name(name: str) -> int | None:
    tokens = [t for t in re.split(r"[^A-Za-z0-9]+", name) if t]
    for tok in tokens:
        m = re.fullmatch(r"(?i)(?:r|round)(\d{1,3})", tok)
        if m:
            value = int(m.group(1))
            if 1 <= value <= 200:
                return value
        if tok.isdigit():
            value = int(tok)
            if 1 <= value <= 200:
                return value
    return None


def _parse_round_descriptor_from_path(source_path: Path) -> dict[str, Any] | None:
    """
    Best-effort folder-based round inference.

    Scans upwards from the file's parent dir, returning the nearest round-like folder and
    its immediate parent phase label when available.
    """
    max_search_levels = 8
    parents = list(source_path.parents)
    for depth, parent in enumerate(parents[:max_search_levels]):
        name = _normalize_space(parent.name)
        if not name:
            continue

        round_number = _parse_round_number_from_name(name)
        if round_number is None:
            continue

        phase_name = ""
        if depth + 1 < len(parents):
            phase_name = _normalize_space(parents[depth + 1].name)

        return {
            "round_number": round_number,
            "round_folder_name": name,
            "phase_name": phase_name,
        }

    return None


def _round_phase_rank(*labels: str) -> int:
    text = " ".join(part for part in (_normalize_space(label) for label in labels) if part)
    if not text:
        return 0

    if re.search(r"(?i)\b(prelim|prelims|round robin|pool|swiss|seeding)\b", text):
        return 0
    if re.search(
        r"(?i)\b(playoff|playoffs|bracket|double elimination|single elimination|quarterfinal|semifinal|final|championship|consolation|tiebreak)\b",
        text,
    ):
        return 1
    return 0


def _report_phase_rank(report_label: str) -> int:
    normalized = _normalize_space(report_label).casefold()
    if normalized.startswith("prelim"):
        return 0
    if normalized.startswith("playoff"):
        return 1
    return 50


def _is_advancement_report_label(report_label: str) -> bool:
    return _normalize_space(report_label).casefold().startswith("playoff")


def _discover_reports_from_subdirs(
    root_dir: Path,
) -> tuple[list[dict[str, Any]], list[Path], list[str]]:
    warnings: list[str] = []
    if not root_dir.exists():
        raise CommandError(f"File not found: {root_dir}")
    if not root_dir.is_dir():
        raise CommandError(
            f"--reports-from-subdirs expects a directory root, got: {root_dir}"
        )

    direct_json_files = sorted(p for p in root_dir.glob("*.json") if p.is_file())
    if direct_json_files:
        raise CommandError(
            "--reports-from-subdirs does not allow export JSON files directly in the root folder. "
            "Place exports inside per-report subdirectories."
        )

    reports: list[dict[str, Any]] = []
    all_paths: list[Path] = []
    seen_report_keys: set[str] = set()

    for child in sorted(root_dir.iterdir(), key=lambda p: p.name.casefold()):
        if not child.is_dir():
            continue
        json_files = sorted(p for p in child.rglob("*.json") if p.is_file())
        if not json_files:
            continue

        report_label = _normalize_space(child.name)
        if not report_label:
            raise CommandError(f"Invalid empty report folder name: {child}")

        report_key = _normalize_report_key(report_label)
        if report_key in seen_report_keys:
            raise CommandError(
                f"Multiple report folders normalize to the same report key: {report_key}"
            )
        seen_report_keys.add(report_key)

        reports.append(
            {
                "key": report_key,
                "label": report_label,
                "root_dir": child,
                "paths": json_files,
            }
        )
        all_paths.extend(json_files)

    if not reports:
        raise CommandError(
            f"No report folders containing export JSON files were found under: {root_dir}"
        )

    return reports, all_paths, warnings


def _infer_round_assignments_from_report_structure(
    export_inputs: list[tuple[Path, bytes, dict[str, Any]]],
    *,
    root_dir: Path,
    combine_reports: bool,
) -> tuple[dict[str, dict[str, Any]], str, list[str]]:
    round_assignments: dict[str, dict[str, Any]] = {}
    warnings: list[str] = []
    report_rounds: dict[str, dict[str, Any]] = {}

    for source_path, _raw, export_obj in export_inputs:
        try:
            rel = source_path.resolve().relative_to(root_dir.resolve())
        except Exception as e:
            raise CommandError(
                f"Structured report input is not under the expected root {root_dir}: {source_path}"
            ) from e

        if combine_reports:
            if len(rel.parts) < 3:
                raise CommandError(
                    "Expected structured report paths like <report>/<round>/<file>.json in "
                    f"{root_dir}, got: {source_path}"
                )
            report_label = _normalize_space(rel.parts[0])
            round_folder_name = _normalize_space(rel.parts[1])
        else:
            if len(rel.parts) < 2:
                raise CommandError(
                    "Expected per-report paths like <round>/<file>.json in "
                    f"{root_dir}, got: {source_path}"
                )
            report_label = _normalize_space(root_dir.name)
            round_folder_name = _normalize_space(rel.parts[0])

        if not round_folder_name:
            raise CommandError(f"Invalid empty round folder name for {source_path}")

        sp = str(source_path)
        packet_name = _normalize_space(_packet_label_from_export_obj(export_obj))
        checksum = _packet_checksum_from_export_obj(export_obj)
        round_number_guess = _parse_round_number_from_name(round_folder_name)

        rounds_for_report = report_rounds.setdefault(report_label, {})
        rounds_for_report.setdefault(
            round_folder_name,
            {
                "round_folder_name": round_folder_name,
                "round_number_guess": round_number_guess,
                "packet_name": packet_name,
                "checksum": checksum,
            },
        )

    assigned_by_report_and_round: dict[tuple[str, str], int] = {}

    if combine_reports:
        round_items: list[dict[str, Any]] = []
        for report_label, rounds in report_rounds.items():
            for round_folder_name, info in rounds.items():
                round_items.append(
                    {
                        "report_label": report_label,
                        "round_folder_name": round_folder_name,
                        "round_number_guess": info["round_number_guess"],
                    }
                )

        round_items.sort(
            key=lambda item: (
                _report_phase_rank(item["report_label"]),
                item["round_number_guess"] if item["round_number_guess"] is not None else 999999,
                item["round_folder_name"].casefold(),
                item["report_label"].casefold(),
            )
        )

        for idx, item in enumerate(round_items, start=1):
            assigned_by_report_and_round[
                (item["report_label"], item["round_folder_name"])
            ] = idx
    else:
        for report_label, rounds in report_rounds.items():
            parsed_numbers = [
                info["round_number_guess"]
                for info in rounds.values()
                if info["round_number_guess"] is not None
            ]
            use_parsed_numbers = (
                len(parsed_numbers) == len(rounds)
                and len(set(parsed_numbers)) == len(parsed_numbers)
            )

            if use_parsed_numbers:
                for round_folder_name, info in rounds.items():
                    assigned_by_report_and_round[(report_label, round_folder_name)] = int(
                        info["round_number_guess"]
                    )
                continue

            sorted_rounds = sorted(
                rounds.items(),
                key=lambda item: (
                    item[1]["round_number_guess"] if item[1]["round_number_guess"] is not None else 999999,
                    item[0].casefold(),
                ),
            )
            for idx, (round_folder_name, _info) in enumerate(sorted_rounds, start=1):
                assigned_by_report_and_round[(report_label, round_folder_name)] = idx

    for source_path, _raw, export_obj in export_inputs:
        rel = source_path.resolve().relative_to(root_dir.resolve())
        if combine_reports:
            report_label = _normalize_space(rel.parts[0])
            round_folder_name = _normalize_space(rel.parts[1])
        else:
            report_label = _normalize_space(root_dir.name)
            round_folder_name = _normalize_space(rel.parts[0])
        packet_name = _normalize_space(_packet_label_from_export_obj(export_obj)) or round_folder_name
        is_advancement = _is_advancement_report_label(report_label)
        round_assignments[str(source_path)] = {
            "round_number": assigned_by_report_and_round[(report_label, round_folder_name)],
            "name": round_folder_name,
            "packet_name": packet_name,
            "packet_checksum": _packet_checksum_from_export_obj(export_obj),
            "is_advancement": is_advancement,
        }

    mode = "structured_folder_combined" if combine_reports else "structured_folder"
    return round_assignments, mode, warnings


def _infer_round_assignments(
    export_inputs: list[tuple[Path, bytes, dict[str, Any]]],
) -> tuple[dict[str, dict[str, Any]], str, list[str]]:
    """
    Returns (round_assignments, mode, warnings).

    round_assignments is keyed by source_path string, mapping to:
      {round_number: int, name: str, packet_name: str, packet_checksum: str}
    """
    parsed_rounds: dict[str, dict[str, Any]] = {}
    packet_label_by_path: dict[str, str] = {}
    checksum_by_path: dict[str, str] = {}

    for source_path, _raw, export_obj in export_inputs:
        sp = str(source_path)
        packet_label_by_path[sp] = _packet_label_from_export_obj(export_obj)
        checksum_by_path[sp] = _packet_checksum_from_export_obj(export_obj)
        parsed = _parse_round_descriptor_from_path(source_path)
        if parsed is not None:
            parsed_rounds[sp] = parsed

    warnings: list[str] = []
    round_assignments: dict[str, dict[str, Any]] = {}

    has_any_folder_round = bool(parsed_rounds)
    if not has_any_folder_round:
        # No round folders detected: group by packet checksum.
        warnings.append(
            "No round-like folder names detected; grouping rounds by packet checksum."
        )
        groups: dict[str, list[str]] = {}
        for sp in packet_label_by_path.keys():
            checksum = checksum_by_path.get(sp) or ""
            groups.setdefault(checksum, []).append(sp)

        group_items = sorted(
            groups.items(),
            key=lambda kv: (
                (packet_label_by_path.get(kv[1][0]) or "").casefold(),
                kv[0],
            ),
        )
        for idx, (checksum, paths) in enumerate(group_items, start=1):
            for sp in paths:
                packet_name = packet_label_by_path.get(sp) or ""
                round_assignments[sp] = {
                    "round_number": idx,
                    "name": packet_name,
                    "packet_name": packet_name,
                    "packet_checksum": checksum,
                }
        return round_assignments, "packet_checksum", warnings

    # Folder-based for any exports that have a parsed numeric round; packet-checksum fallback for the rest.
    missing_paths = [sp for sp in packet_label_by_path.keys() if sp not in parsed_rounds]
    if missing_paths:
        warnings.append(
            f"{len(missing_paths)} export(s) had no round-like folder name; assigning those to additional rounds by packet checksum."
        )

    round_groups: dict[tuple[int, str, str], dict[str, Any]] = {}
    group_key_by_path: dict[str, tuple[int, str, str]] = {}
    for sp, descriptor in parsed_rounds.items():
        packet_name = _normalize_space(packet_label_by_path.get(sp) or "")
        round_folder_name = _normalize_space(descriptor.get("round_folder_name", ""))
        phase_name = _normalize_space(descriptor.get("phase_name", ""))
        checksum = checksum_by_path.get(sp) or ""
        identity_label = packet_name or round_folder_name or checksum
        group_key = (
            int(descriptor["round_number"]),
            phase_name.casefold(),
            identity_label.casefold(),
        )
        group_key_by_path[sp] = group_key
        round_groups.setdefault(
            group_key,
            {
                "round_number": int(descriptor["round_number"]),
                "phase_name": phase_name,
                "packet_name": packet_name,
                "round_folder_name": round_folder_name,
                "checksum": checksum,
            },
        )

    groups_by_local_round: dict[int, set[tuple[str, str]]] = {}
    for round_number, phase_key, identity_key in round_groups.keys():
        groups_by_local_round.setdefault(round_number, set()).add((phase_key, identity_key))

    has_round_number_collisions = any(
        len(group_keys) > 1 for group_keys in groups_by_local_round.values()
    )

    assigned_round_number_by_group: dict[tuple[int, str, str], int] = {}
    if has_round_number_collisions:
        warnings.append(
            "Detected reused folder round numbers across multiple phase/packet groups; assigning unique round numbers by phase order."
        )
        sorted_group_items = sorted(
            round_groups.items(),
            key=lambda item: (
                _round_phase_rank(
                    item[1]["phase_name"],
                    item[1]["packet_name"],
                    item[1]["round_folder_name"],
                ),
                item[1]["round_number"],
                item[1]["phase_name"].casefold(),
                item[1]["packet_name"].casefold(),
                item[1]["round_folder_name"].casefold(),
                item[1]["checksum"],
            ),
        )
        for idx, (group_key, _group_info) in enumerate(sorted_group_items, start=1):
            assigned_round_number_by_group[group_key] = idx
    else:
        for group_key, group_info in round_groups.items():
            assigned_round_number_by_group[group_key] = int(group_info["round_number"])

    max_round_number = max(assigned_round_number_by_group.values(), default=0)

    # Assign folder-based rounds first.
    for sp, descriptor in parsed_rounds.items():
        round_number = assigned_round_number_by_group[group_key_by_path[sp]]
        packet_name = _normalize_space(packet_label_by_path.get(sp) or "")
        round_folder_name = _normalize_space(descriptor.get("round_folder_name", ""))
        display_packet_name = packet_name or round_folder_name
        # Avoid redundant "Round N: Round N" when the packet name is just "Round N".
        if re.fullmatch(rf"(?i)round\s*0*{round_number}", display_packet_name):
            round_name = ""
        else:
            round_name = display_packet_name

        round_assignments[sp] = {
            "round_number": round_number,
            "name": round_name,
            "packet_name": display_packet_name,
            "packet_checksum": checksum_by_path.get(sp) or "",
        }

    # Assign missing paths to new round numbers grouped by checksum.
    groups_missing: dict[str, list[str]] = {}
    for sp in missing_paths:
        checksum = checksum_by_path.get(sp) or ""
        groups_missing.setdefault(checksum, []).append(sp)

    group_items_missing = sorted(
        groups_missing.items(),
        key=lambda kv: (
            (packet_label_by_path.get(kv[1][0]) or "").casefold(),
            kv[0],
        ),
    )
    next_round_number = max_round_number + 1
    for checksum, paths in group_items_missing:
        for sp in paths:
            packet_name = packet_label_by_path.get(sp) or ""
            round_assignments[sp] = {
                "round_number": next_round_number,
                "name": packet_name,
                "packet_name": packet_name,
                "packet_checksum": checksum,
            }
        next_round_number += 1

    return round_assignments, "folder", warnings


def _advancement_round_numbers(
    round_assignments: dict[str, dict[str, Any]],
) -> list[int]:
    return sorted(
        {
            int(info["round_number"])
            for info in round_assignments.values()
            if info.get("is_advancement") is True
            and isinstance(info.get("round_number"), int)
            and not isinstance(info.get("round_number"), bool)
        }
    )


def _fetch_team_advancement_rounds(
    *,
    db_alias: str,
    tournament_id: int,
    advancement_round_numbers: list[int],
) -> dict[int, int]:
    if not advancement_round_numbers:
        return {}

    placeholders = ", ".join(["%s"] * len(advancement_round_numbers))
    sql = f"""
        SELECT
          gt.tournament_team_id AS team_id,
          MAX(r.round_number) AS deepest_round
        FROM moss_gameteam gt
        JOIN moss_game g ON g.id = gt.game_id
        JOIN tournaments_round r ON r.id = g.round_id
        WHERE g.tournament_id = %s
          AND r.round_number IN ({placeholders})
        GROUP BY gt.tournament_team_id
    """
    params: list[Any] = [tournament_id, *advancement_round_numbers]
    with connections[db_alias].cursor() as cursor:
        cursor.execute(sql, params)
        return {
            int(team_id): int(deepest_round)
            for team_id, deepest_round in cursor.fetchall()
            if team_id is not None and deepest_round is not None
        }


def _reorder_team_standings_rows_for_advancement(
    *,
    cols: list[str],
    rows: list[tuple[Any, ...]],
    team_advancement_rounds: dict[int, int],
) -> list[tuple[Any, ...]]:
    if not rows or not team_advancement_rounds:
        return rows

    rank_idx = cols.index("rank")
    team_id_idx = cols.index("team_id")

    sortable = []
    for original_idx, row in enumerate(rows):
        team_id_raw = row[team_id_idx]
        try:
            team_id = int(team_id_raw)
        except (TypeError, ValueError):
            team_id = None
        deepest_round = team_advancement_rounds.get(team_id) if team_id is not None else None
        sortable.append(
            (
                0 if deepest_round is not None else 1,
                -(deepest_round or 0),
                original_idx,
                row,
            )
        )

    sortable.sort(key=lambda item: (item[0], item[1], item[2]))

    reordered: list[tuple[Any, ...]] = []
    for new_rank, (_missing_flag, _neg_round, _original_idx, row) in enumerate(sortable, start=1):
        row_list = list(row)
        row_list[rank_idx] = new_rank
        reordered.append(tuple(row_list))
    return reordered


class Command(BaseCommand):
    help = (
        "Generate static stats artifacts (JSON) from MoSS scoresheet export files (v1/v2/v3) "
        "using a temporary local SQLite database."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--reports-from-subdirs",
            action="store_true",
            help=(
                "Treat the single input directory as a report root whose first-level subdirectories "
                "are reports and nested subdirectories are round folders. Generates inferred reports "
                "plus a combined report."
            ),
        )
        parser.add_argument(
            "--report-key",
            type=str,
            required=False,
            default="combined",
            help=(
                "Key for the stats report being generated (default: combined). "
                "Used for organizing multi-report outputs under stats/<slug>/reports/<key>/."
            ),
        )
        parser.add_argument(
            "--report-label",
            type=str,
            required=False,
            default=None,
            help=(
                "Display label for this report (default: derived from --report-key). "
                "Used in stats/<slug>/reports.json."
            ),
        )
        parser.add_argument(
            "--output-dir",
            type=str,
            required=False,
            default=None,
            help=(
                "Directory to write generated artifacts into. "
                "Relative paths are resolved from the repo root. "
                "Defaults to <repo>/stats/<tournament-slug> for --report-key=combined, "
                "or <repo>/stats/<tournament-slug>/reports/<report-key> otherwise."
            ),
        )
        parser.add_argument(
            "--tournament-slug",
            type=str,
            required=False,
            help="Tournament slug to write into the output JSON (defaults to the output folder name).",
        )
        parser.add_argument(
            "--tournament-name",
            type=str,
            required=False,
            help="Tournament display name to write into the output JSON (defaults to the slug).",
        )
        parser.add_argument(
            "--pretty",
            action="store_true",
            help="Write pretty-printed JSON (indented).",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Do not prompt; overwrite existing artifacts if present.",
        )
        parser.add_argument(
            "--no-dedupe",
            action="store_true",
            help="Do not deduplicate identical exports by file bytes hash.",
        )
        parser.add_argument(
            "--no-sync-frontends",
            action="store_true",
            help=(
                "Do not sync repo-root stats/ into the website and MoSS frontends' public/stats/ folders. "
                "By default, this command runs the sync scripts so the updated artifacts are immediately "
                "available to the frontends."
            ),
        )
        parser.add_argument(
            "paths",
            nargs="+",
            help="One or more moss_scoresheet export JSON files, or directories containing them (searched recursively).",
        )
        parser.add_argument(
            "--structured-round-root",
            type=str,
            required=False,
            help=argparse.SUPPRESS,
        )
        parser.add_argument(
            "--structured-rounds-combined",
            action="store_true",
            help=argparse.SUPPRESS,
        )

    def _sync_frontends(self, *, repo_root: Path) -> None:
        scripts: list[tuple[str, Path]] = [
            ("website", repo_root / "apps" / "website" / "frontend" / "scripts" / "sync-stats.mjs"),
            ("moss", repo_root / "apps" / "moss" / "frontend" / "scripts" / "sync-stats.mjs"),
        ]

        missing = [name for name, p in scripts if not p.exists()]
        if missing:
            raise CommandError(
                "Stats generated, but frontend sync scripts are missing: "
                + ", ".join(missing)
                + ". Pass --no-sync-frontends to skip syncing."
            )

        for name, script_path in scripts:
            try:
                result = subprocess.run(
                    ["node", str(script_path)],
                    cwd=str(repo_root),
                    capture_output=True,
                    text=True,
                    check=False,
                )
            except FileNotFoundError as e:
                raise CommandError(
                    "Stats generated, but failed to sync frontends because 'node' was not found on PATH. "
                    "Either install Node.js, or re-run with --no-sync-frontends."
                ) from e

            if result.returncode != 0:
                raise CommandError(
                    f"Stats generated, but frontend sync failed for {name}.\n"
                    f"Command: node {script_path}\n"
                    f"Exit code: {result.returncode}\n"
                    f"Stdout:\n{result.stdout}\n"
                    f"Stderr:\n{result.stderr}\n"
                    "Re-run with --no-sync-frontends to skip syncing."
                )

            if result.stdout.strip():
                self.stdout.write(result.stdout.rstrip())
            if result.stderr.strip():
                self.stderr.write(result.stderr.rstrip())

    def handle(self, *args, **options) -> None:
        reports_from_subdirs: bool = options["reports_from_subdirs"]
        structured_round_root_raw: str | None = options.get("structured_round_root")
        structured_rounds_combined: bool = options["structured_rounds_combined"]
        report_key = _normalize_report_key(options.get("report_key"))
        report_label_raw: str | None = options.get("report_label")
        report_label = (report_label_raw or _default_report_label(report_key)).strip()
        if not report_label:
            report_label = _default_report_label(report_key)

        tournament_slug: str | None = options.get("tournament_slug")
        tournament_name: str | None = options.get("tournament_name")
        pretty: bool = options["pretty"]
        assume_yes: bool = options["yes"]
        no_dedupe: bool = options["no_dedupe"]
        no_sync_frontends: bool = options["no_sync_frontends"]
        raw_paths: list[str] = options["paths"]

        repo_root = Path(settings.BASE_DIR).parent
        if reports_from_subdirs:
            if report_key != "combined":
                raise CommandError(
                    "--reports-from-subdirs cannot be combined with --report-key."
                )
            if report_label_raw is not None:
                raise CommandError(
                    "--reports-from-subdirs cannot be combined with --report-label."
                )
            if len(raw_paths) != 1:
                raise CommandError(
                    "--reports-from-subdirs expects exactly one root directory path."
                )
            if structured_round_root_raw:
                raise CommandError(
                    "--reports-from-subdirs cannot be combined with --structured-round-root."
                )

            raw_output_dir: str | None = options.get("output_dir")
            if raw_output_dir:
                output_dir_path = Path(raw_output_dir)
                tournament_root_output_dir = (
                    output_dir_path
                    if output_dir_path.is_absolute()
                    else (repo_root / output_dir_path)
                )
            else:
                slug_for_default = (tournament_slug or "").strip()
                if not slug_for_default:
                    raise CommandError(
                        "Pass --tournament-slug (or --output-dir) to choose an output folder."
                    )
                tournament_root_output_dir = repo_root / "stats" / slug_for_default

            slug = (
                tournament_slug
                or _infer_slug_from_output_dir(
                    repo_root=repo_root, output_dir=tournament_root_output_dir
                )
            ).strip()
            if not slug:
                raise CommandError(
                    "Could not infer tournament slug; pass --tournament-slug."
                )
            name = (tournament_name or slug).strip()

            root_dir = Path(raw_paths[0]).expanduser()
            reports, _all_paths, discovery_warnings = _discover_reports_from_subdirs(root_dir)
            for w in discovery_warnings:
                self.stderr.write(self.style.WARNING(f"WARNING: {w}"))

            for report in reports:
                call_command(
                    "generate_moss_static_stats",
                    *[str(p) for p in report["paths"]],
                    report_key=report["key"],
                    report_label=report["label"],
                    output_dir=str(tournament_root_output_dir / "reports" / report["key"]),
                    tournament_slug=slug,
                    tournament_name=name,
                    pretty=pretty,
                    yes=assume_yes,
                    no_dedupe=no_dedupe,
                    no_sync_frontends=True,
                    structured_round_root=str(report["root_dir"]),
                )

            call_command(
                "generate_moss_static_stats",
                *[str(p) for report in reports for p in report["paths"]],
                report_key="combined",
                report_label="Combined",
                output_dir=str(tournament_root_output_dir),
                tournament_slug=slug,
                tournament_name=name,
                pretty=pretty,
                yes=assume_yes,
                no_dedupe=no_dedupe,
                no_sync_frontends=True,
                structured_round_root=str(root_dir),
                structured_rounds_combined=True,
            )

            if not no_sync_frontends:
                self._sync_frontends(repo_root=repo_root)
                self.stdout.write(self.style.SUCCESS("Synced stats into website and MoSS frontends."))
            return

        raw_output_dir: str | None = options.get("output_dir")
        if raw_output_dir:
            output_dir_path = Path(raw_output_dir)
            output_dir = (
                output_dir_path
                if output_dir_path.is_absolute()
                else (repo_root / output_dir_path)
            )
        else:
            slug_for_default = (tournament_slug or "").strip()
            if not slug_for_default:
                raise CommandError(
                    "Pass --tournament-slug (or --output-dir) to choose an output folder."
                )
            if report_key == "combined":
                output_dir = repo_root / "stats" / slug_for_default
            else:
                output_dir = repo_root / "stats" / slug_for_default / "reports" / report_key

        slug = (tournament_slug or _infer_slug_from_output_dir(repo_root=repo_root, output_dir=output_dir)).strip()
        if not slug:
            raise CommandError(
                "Could not infer tournament slug; pass --tournament-slug."
            )
        name = (tournament_name or slug).strip()

        existing_sources_sha256: set[str] = set()
        existing_manifest = output_dir / "manifest.json"
        if existing_manifest.exists():
            try:
                existing_obj = json.loads(existing_manifest.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                existing_obj = None
            if isinstance(existing_obj, dict):
                sources_any = existing_obj.get("sources")
                if isinstance(sources_any, list):
                    for item in sources_any:
                        if isinstance(item, dict) and isinstance(
                            item.get("sha256"), str
                        ):
                            existing_sources_sha256.add(item["sha256"])

        export_inputs: list[tuple[Path, bytes, dict[str, Any]]] = []
        sources: list[dict[str, Any]] = []
        seen: set[str] = set()
        duplicate_with_existing: list[str] = []

        paths, path_warnings = _expand_export_input_paths(raw_paths)
        for w in path_warnings:
            self.stderr.write(self.style.WARNING(f"WARNING: {w}"))

        if not paths:
            raise CommandError("No export JSON files found in the provided path arguments.")

        for path in paths:
            data = path.read_bytes()
            file_hash = _sha256_bytes(data)
            if file_hash in existing_sources_sha256:
                duplicate_with_existing.append(str(path))
            if not no_dedupe and file_hash in seen:
                self.stdout.write(f"SKIP {path.name} (duplicate sha256)")
                continue
            seen.add(file_hash)

            try:
                export_obj_any = json.loads(data)
            except json.JSONDecodeError as e:
                raise CommandError(f"Invalid JSON: {path} ({e})") from e
            export_obj = _require_dict(export_obj_any, f"{path} (top-level)")

            export_inputs.append((path, data, export_obj))
            sources.append(
                {
                    "path": str(path),
                    "sha256": file_hash,
                    "version": export_obj.get("version"),
                    "exported_at": export_obj.get("exported_at"),
                    "packet_checksum": export_obj.get("packet_checksum"),
                }
            )

        if structured_round_root_raw:
            round_assignments, round_mode, round_warnings = (
                _infer_round_assignments_from_report_structure(
                    export_inputs,
                    root_dir=Path(structured_round_root_raw).expanduser(),
                    combine_reports=structured_rounds_combined,
                )
            )
        else:
            round_assignments, round_mode, round_warnings = _infer_round_assignments(
                export_inputs
            )
        for w in round_warnings:
            self.stderr.write(self.style.WARNING(f"WARNING: {w}"))

        output_dir.mkdir(parents=True, exist_ok=True)

        existing_artifacts = any(
            (output_dir / name).exists() for name in ("standings.json", "manifest.json")
        )
        if existing_artifacts or duplicate_with_existing:
            reasons: list[str] = []
            if existing_artifacts:
                reasons.append("existing artifacts in output directory")
            if duplicate_with_existing:
                reasons.append(
                    f"{len(duplicate_with_existing)} input export(s) already listed in manifest.json"
                )

            if not assume_yes:
                self.stdout.write(
                    "This run would overwrite previously generated stats artifacts."
                )
                self.stdout.write(f"Reason(s): {', '.join(reasons)}")
                if duplicate_with_existing:
                    shown = duplicate_with_existing[:5]
                    for p in shown:
                        self.stdout.write(f"  - {p}")
                    if len(duplicate_with_existing) > 5:
                        self.stdout.write(
                            f"  ... and {len(duplicate_with_existing) - 5} more"
                        )
                if not _prompt_yes_no(
                    prompt="Regenerate and replace artifacts?", default=False
                ):
                    raise CommandError("Aborted.")

            protected_top_level_names: set[str] = set()
            tournament_root = (repo_root / "stats" / slug).resolve()
            try:
                is_tournament_root = output_dir.resolve() == tournament_root
            except Exception:
                is_tournament_root = False
            if report_key == "combined" and is_tournament_root:
                # Don't delete other reports when regenerating the combined report.
                protected_top_level_names = {"reports", "reports.json"}

            _safe_wipe_output_dir(
                output_dir, protected_top_level_names=protected_top_level_names
            )

        # Build everything using an ephemeral local SQLite DB (separate alias) so we
        # never touch any configured persistent DB, even if one exists locally.
        db_alias = f"moss_stats_{uuid4().hex[:8]}"
        original_databases = dict(settings.DATABASES)
        if db_alias in settings.DATABASES:
            raise CommandError(
                f"Unexpected DATABASES entry already present: {db_alias}"
            )

        original_default = dict(settings.DATABASES.get("default", {}))
        tmp = tempfile.TemporaryDirectory()
        try:
            sqlite_path = str(Path(tmp.name) / "moss_stats.sqlite3")
            settings.DATABASES[db_alias] = {
                # Keep this in sync with Django's defaults in
                # django.db.utils.ConnectionHandler.configure_settings().
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": sqlite_path,
                "ATOMIC_REQUESTS": False,
                "AUTOCOMMIT": True,
                "CONN_MAX_AGE": 0,
                "CONN_HEALTH_CHECKS": False,
                "OPTIONS": {},
                "TIME_ZONE": None,
                "USER": "",
                "PASSWORD": "",
                "HOST": "",
                "PORT": "",
                "TEST": {
                    "CHARSET": None,
                    "COLLATION": None,
                    "MIGRATE": True,
                    "MIRROR": None,
                    "NAME": None,
                },
            }
            connections.close_all()

            # Create schema.
            call_command("migrate", verbosity=0, interactive=False, database=db_alias)

            # Minimal tournament row required by moss FK relationships.
            tournament = Tournament.objects.using(db_alias).create(
                name=name,
                slug=slug,
                description="",
                division="HIGH_SCHOOL",
                format="ROUND_ROBIN",
                status="COMPLETED",
                tournament_date=now().date(),
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

            try:
                ingest_scoresheet_exports(
                    tournament_id=tournament.id,
                    exports=export_inputs,
                    round_assignments=round_assignments,
                    using=db_alias,
                )
            except ValueError as e:
                raise CommandError(str(e)) from e

            sql_dir = Path(settings.BASE_DIR) / "moss" / "services" / "stats_sql"
            team_sql = (sql_dir / "team_standings.sql").read_text(encoding="utf-8")
            individual_sql = (sql_dir / "individual_standings.sql").read_text(encoding="utf-8")
            team_category_sql = (sql_dir / "team_category_standings.sql").read_text(encoding="utf-8")
            individual_category_sql = (sql_dir / "individual_category_standings.sql").read_text(encoding="utf-8")
            rounds_summary: list[dict[str, Any]] = []
            advancement_round_numbers = _advancement_round_numbers(round_assignments)
            team_advancement_rounds = _fetch_team_advancement_rounds(
                db_alias=db_alias,
                tournament_id=tournament.id,
                advancement_round_numbers=advancement_round_numbers,
            )

            def write_csv(*, filename: str, sql: str, params: list[Any]) -> None:
                out_path = output_dir / filename
                with connections[db_alias].cursor() as cursor:
                    cursor.execute(sql, params)
                    cols = [d[0] for d in cursor.description or []]
                    rows = cursor.fetchall()
                if filename == "team_standings.csv":
                    rows = _reorder_team_standings_rows_for_advancement(
                        cols=cols,
                        rows=rows,
                        team_advancement_rounds=team_advancement_rounds,
                    )
                out_path.parent.mkdir(parents=True, exist_ok=True)
                with out_path.open("w", encoding="utf-8", newline="") as f:
                    writer = csv.writer(f)
                    writer.writerow(cols)
                    writer.writerows(rows)

            datasets: dict[str, str] = {}

            write_csv(
                filename="team_standings.csv",
                sql=team_sql,
                params=[tournament.id],
            )
            write_csv(
                filename="individual_standings.csv",
                sql=individual_sql,
                params=[tournament.id, tournament.id],
            )

            # Category standings
            with connections[db_alias].cursor() as cursor:
                cursor.execute(
                    """
                    SELECT DISTINCT pq.category
                    FROM moss_gameteamquestionoutcome o
                    JOIN moss_packetquestion pq ON pq.id = o.packet_question_id
                    JOIN moss_game g ON g.id = o.game_id
                    WHERE g.tournament_id = %s
                    ORDER BY pq.category ASC
                    """,
                    [tournament.id],
                )
                categories = [row[0] for row in cursor.fetchall()]

            if any((c or "").strip() == "" for c in categories):
                if not assume_yes:
                    proceed = _prompt_yes_no(
                        prompt=(
                            "Warning: Some questions are missing a category label. "
                            "Continue and treat those questions as an uncategorized category?"
                        ),
                        default=False,
                    )
                    if not proceed:
                        raise CommandError(
                            "Aborted due to uncategorized questions. "
                            "Fix the source exports (or re-run with --yes to proceed)."
                        )

            category_views: list[dict[str, str]] = []
            used_stems: dict[str, int] = {}
            for category in categories:
                category_value = "" if category is None else str(category)
                stem = _safe_category_file_stem(category_value)
                if stem in used_stems:
                    used_stems[stem] += 1
                    stem = f"{stem}_{used_stems[stem]}"
                else:
                    used_stems[stem] = 1

                team_filename = f"team_standings__{stem}.csv"
                individual_filename = f"individual_standings__{stem}.csv"

                write_csv(
                    filename=team_filename,
                    sql=team_category_sql,
                    params=[tournament.id, category_value],
                )
                write_csv(
                    filename=individual_filename,
                    sql=individual_category_sql,
                    params=[category_value, tournament.id, tournament.id],
                )
                category_views.append(
                    {
                        "category": category_value,
                        "key": stem,
                        "team_standings": team_filename,
                        "individual_standings": individual_filename,
                    }
                )

            # Round summary (for verification + future views).
            for rnd in TournamentRound.objects.using(db_alias).filter(
                tournament_id=tournament.id
            ).order_by("round_number"):
                rounds_summary.append(
                    {
                        "round_number": rnd.round_number,
                        "name": rnd.name,
                        "packet_name": rnd.packet_name,
                        "game_count": rnd.moss_games.count(),
                    }
                )

            # Base fact datasets (power all future views without generating a file per view).
            write_csv(
                filename="facts/teams.csv",
                sql="""
                SELECT
                  t.id AS team_id,
                  t.name AS team_name,
                  t.school AS school,
                  t.pool AS pool
                FROM moss_tournamentteam t
                WHERE t.tournament_id = %s
                ORDER BY t.name ASC
                """,
                params=[tournament.id],
            )
            datasets["teams"] = "facts/teams.csv"

            write_csv(
                filename="facts/players.csv",
                sql="""
                SELECT
                  p.id AS player_id,
                  p.name AS player_name,
                  p.grade_level AS grade_level,
                  t.id AS team_id,
                  t.name AS team_name
                FROM moss_tournamentplayer p
                JOIN moss_tournamentteam t ON t.id = p.tournament_team_id
                WHERE t.tournament_id = %s
                ORDER BY t.name ASC, p.name ASC
                """,
                params=[tournament.id],
            )
            datasets["players"] = "facts/players.csv"

            write_csv(
                filename="facts/rounds.csv",
                sql="""
                SELECT
                  r.round_number AS round_number,
                  r.name AS round_name,
                  r.packet_name AS packet_name
                FROM tournaments_round r
                WHERE r.tournament_id = %s
                ORDER BY r.round_number ASC
                """,
                params=[tournament.id],
            )
            datasets["rounds"] = "facts/rounds.csv"

            write_csv(
                filename="facts/games.csv",
                sql="""
                SELECT
                  g.id AS game_id,
                  r.round_number AS round_number,
                  r.name AS round_name,
                  r.packet_name AS round_packet_name,
                  g.status AS status,
                  g.completed_at AS completed_at,
                  pv.checksum_value AS packet_checksum,
                  pv.packet_name AS packet_name,
                  pv.year AS packet_year,
                  g.pairs_played AS pairs_played
                FROM moss_game g
                LEFT JOIN tournaments_round r ON r.id = g.round_id
                LEFT JOIN moss_packetversion pv ON pv.id = g.packet_version_id
                WHERE g.tournament_id = %s
                ORDER BY COALESCE(r.round_number, 999999) ASC, g.id ASC
                """,
                params=[tournament.id],
            )
            datasets["games"] = "facts/games.csv"

            write_csv(
                filename="facts/game_teams.csv",
                sql="""
                SELECT
                  gt.game_id AS game_id,
                  gt.slot AS slot,
                  t.id AS team_id,
                  t.name AS team_name,
                  gt.score_cached AS score,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'TOSSUP' THEN o.points ELSE 0 END), 0) AS tossup_points,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'BONUS' THEN o.points ELSE 0 END), 0) AS bonus_points,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'TOSSUP' AND o.tossup_result = 'CORRECT' THEN 1 ELSE 0 END), 0) AS tossups_correct,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'TOSSUP' AND o.tossup_result = 'INCORRECT' THEN 1 ELSE 0 END), 0) AS tossups_incorrect,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'TOSSUP' AND o.tossup_result = 'NO_PENALTY' THEN 1 ELSE 0 END), 0) AS tossups_no_penalty,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'BONUS' AND o.bonus_result = 'CORRECT' THEN 1 ELSE 0 END), 0) AS bonuses_correct,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'BONUS' AND o.bonus_result = 'INCORRECT' THEN 1 ELSE 0 END), 0) AS bonuses_incorrect,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'BONUS' AND o.bonus_result = 'UNHEARD' THEN 1 ELSE 0 END), 0) AS bonuses_unheard
                FROM moss_gameteam gt
                JOIN moss_game g ON g.id = gt.game_id
                JOIN moss_tournamentteam t ON t.id = gt.tournament_team_id
                LEFT JOIN moss_gameteamquestionoutcome o
                  ON o.game_id = gt.game_id AND o.tournament_team_id = gt.tournament_team_id
                LEFT JOIN moss_packetquestion pq ON pq.id = o.packet_question_id
                WHERE g.tournament_id = %s
                GROUP BY gt.game_id, gt.slot, t.id, t.name, gt.score_cached
                ORDER BY gt.game_id ASC, gt.slot ASC
                """,
                params=[tournament.id],
            )
            datasets["game_teams"] = "facts/game_teams.csv"

            write_csv(
                filename="facts/game_players.csv",
                sql="""
                WITH active AS (
                  SELECT DISTINCT
                    s.game_id AS game_id,
                    s.tournament_team_id AS team_id,
                    s.tournament_player_id AS player_id
                  FROM moss_gameplayerlineupsegment s
                  JOIN moss_game g ON g.id = s.game_id
                  WHERE g.tournament_id = %s
                ),
                pairs_heard AS (
                  SELECT
                    s.game_id AS game_id,
                    s.tournament_team_id AS team_id,
                    s.tournament_player_id AS player_id,
                    SUM(
                      CASE
                        WHEN COALESCE(s.end_pair_id, g.pairs_played) < s.start_pair_id THEN 0
                        ELSE (COALESCE(s.end_pair_id, g.pairs_played) - s.start_pair_id + 1)
                      END
                    ) AS pairs_heard
                  FROM moss_gameplayerlineupsegment s
                  JOIN moss_game g ON g.id = s.game_id
                  WHERE g.tournament_id = %s
                  GROUP BY s.game_id, s.tournament_team_id, s.tournament_player_id
                ),
                tossup_stats AS (
                  SELECT
                    o.game_id AS game_id,
                    o.tournament_team_id AS team_id,
                    o.buzzing_player_id AS player_id,
                    SUM(CASE WHEN o.tossup_result = 'CORRECT' THEN 1 ELSE 0 END) AS tossups_correct,
                    SUM(CASE WHEN o.tossup_result = 'INCORRECT' THEN 1 ELSE 0 END) AS tossups_incorrect,
                    SUM(CASE WHEN o.tossup_result = 'NO_PENALTY' THEN 1 ELSE 0 END) AS tossups_no_penalty,
                    SUM(o.points) AS tossup_points
                  FROM moss_gameteamquestionoutcome o
                  JOIN moss_packetquestion pq ON pq.id = o.packet_question_id
                  JOIN moss_game g ON g.id = o.game_id
                  WHERE g.tournament_id = %s
                    AND pq.question_type = 'TOSSUP'
                    AND o.buzzing_player_id IS NOT NULL
                  GROUP BY o.game_id, o.tournament_team_id, o.buzzing_player_id
                )
                SELECT
                  a.game_id AS game_id,
                  t.id AS team_id,
                  t.name AS team_name,
                  p.id AS player_id,
                  p.name AS player_name,
                  COALESCE(ph.pairs_heard, 0) AS pairs_heard,
                  COALESCE(ts.tossups_correct, 0) AS tossups_correct,
                  COALESCE(ts.tossups_incorrect, 0) AS tossups_incorrect,
                  COALESCE(ts.tossups_no_penalty, 0) AS tossups_no_penalty,
                  COALESCE(ts.tossup_points, 0) AS tossup_points
                FROM active a
                JOIN moss_tournamentteam t ON t.id = a.team_id
                JOIN moss_tournamentplayer p ON p.id = a.player_id
                LEFT JOIN pairs_heard ph
                  ON ph.game_id = a.game_id AND ph.team_id = a.team_id AND ph.player_id = a.player_id
                LEFT JOIN tossup_stats ts
                  ON ts.game_id = a.game_id AND ts.team_id = a.team_id AND ts.player_id = a.player_id
                ORDER BY a.game_id ASC, t.name ASC, p.name ASC
                """,
                params=[tournament.id, tournament.id, tournament.id],
            )
            datasets["game_players"] = "facts/game_players.csv"

            write_csv(
                filename="facts/game_teams_by_category.csv",
                sql="""
                SELECT
                  gt.game_id AS game_id,
                  gt.slot AS slot,
                  t.id AS team_id,
                  t.name AS team_name,
                  COALESCE(pq.category, '') AS category,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'TOSSUP' THEN o.points ELSE 0 END), 0) AS tossup_points,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'BONUS' THEN o.points ELSE 0 END), 0) AS bonus_points,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'TOSSUP' AND o.tossup_result = 'CORRECT' THEN 1 ELSE 0 END), 0) AS tossups_correct,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'TOSSUP' AND o.tossup_result = 'INCORRECT' THEN 1 ELSE 0 END), 0) AS tossups_incorrect,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'TOSSUP' AND o.tossup_result = 'NO_PENALTY' THEN 1 ELSE 0 END), 0) AS tossups_no_penalty,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'BONUS' AND o.bonus_result = 'CORRECT' THEN 1 ELSE 0 END), 0) AS bonuses_correct,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'BONUS' AND o.bonus_result = 'INCORRECT' THEN 1 ELSE 0 END), 0) AS bonuses_incorrect,
                  COALESCE(SUM(CASE WHEN pq.question_type = 'BONUS' AND o.bonus_result = 'UNHEARD' THEN 1 ELSE 0 END), 0) AS bonuses_unheard
                FROM moss_gameteam gt
                JOIN moss_game g ON g.id = gt.game_id
                JOIN moss_tournamentteam t ON t.id = gt.tournament_team_id
                JOIN moss_gameteamquestionoutcome o
                  ON o.game_id = gt.game_id AND o.tournament_team_id = gt.tournament_team_id
                JOIN moss_packetquestion pq ON pq.id = o.packet_question_id
                WHERE g.tournament_id = %s
                GROUP BY gt.game_id, gt.slot, t.id, t.name, COALESCE(pq.category, '')
                ORDER BY gt.game_id ASC, gt.slot ASC, category ASC
                """,
                params=[tournament.id],
            )
            datasets["game_teams_by_category"] = "facts/game_teams_by_category.csv"

            write_csv(
                filename="facts/game_players_by_category.csv",
                sql="""
                SELECT
                  o.game_id AS game_id,
                  t.id AS team_id,
                  t.name AS team_name,
                  p.id AS player_id,
                  p.name AS player_name,
                  COALESCE(pq.category, '') AS category,
                  COALESCE(SUM(CASE WHEN o.tossup_result = 'CORRECT' THEN 1 ELSE 0 END), 0) AS tossups_correct,
                  COALESCE(SUM(CASE WHEN o.tossup_result = 'INCORRECT' THEN 1 ELSE 0 END), 0) AS tossups_incorrect,
                  COALESCE(SUM(CASE WHEN o.tossup_result = 'NO_PENALTY' THEN 1 ELSE 0 END), 0) AS tossups_no_penalty,
                  COALESCE(SUM(o.points), 0) AS tossup_points
                FROM moss_gameteamquestionoutcome o
                JOIN moss_packetquestion pq ON pq.id = o.packet_question_id
                JOIN moss_game g ON g.id = o.game_id
                JOIN moss_tournamentteam t ON t.id = o.tournament_team_id
                JOIN moss_tournamentplayer p ON p.id = o.buzzing_player_id
                WHERE g.tournament_id = %s
                  AND pq.question_type = 'TOSSUP'
                  AND o.buzzing_player_id IS NOT NULL
                GROUP BY o.game_id, t.id, t.name, p.id, p.name, COALESCE(pq.category, '')
                ORDER BY o.game_id ASC, t.name ASC, p.name ASC, category ASC
                """,
                params=[tournament.id],
            )
            datasets["game_players_by_category"] = "facts/game_players_by_category.csv"
        finally:
            # On Windows, the SQLite file can't be deleted while any connection remains open.
            try:
                connections[db_alias].close()
            except Exception:
                pass
            connections.close_all()
            # Restore DB settings.
            settings.DATABASES.clear()
            settings.DATABASES.update(original_databases)
            if "default" not in settings.DATABASES:
                settings.DATABASES["default"] = original_default
            tmp.cleanup()

        manifest_payload: dict[str, Any] = {
            "schema_version": 1,
            "generated_at": _iso_utc_now(),
            "tournament": {"slug": slug, "name": name},
            "report": {"key": report_key, "label": report_label},
            "sources": sources,
            "rounds": {
                "mode": round_mode,
                "rounds": rounds_summary,
            },
            "datasets": datasets,
            "views": {
                "team_standings": "team_standings.csv",
                "individual_standings": "individual_standings.csv",
                "category_standings": category_views,
            },
        }

        indent = 2 if pretty else None
        (output_dir / "manifest.json").write_text(
            json.dumps(manifest_payload, indent=indent, sort_keys=True) + "\n",
            encoding="utf-8",
        )

        _update_reports_index(
            repo_root=repo_root,
            slug=slug,
            report_key=report_key,
            report_label=report_label,
            output_dir=output_dir,
            pretty=pretty,
        )

        self.stdout.write(self.style.SUCCESS(f"Wrote {output_dir / 'team_standings.csv'}"))
        self.stdout.write(self.style.SUCCESS(f"Wrote {output_dir / 'individual_standings.csv'}"))
        self.stdout.write(self.style.SUCCESS(f"Wrote {output_dir / 'manifest.json'}"))

        if not no_sync_frontends:
            self._sync_frontends(repo_root=repo_root)
            self.stdout.write(self.style.SUCCESS("Synced stats into website and MoSS frontends."))
