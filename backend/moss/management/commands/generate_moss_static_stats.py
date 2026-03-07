from __future__ import annotations

import hashlib
import json
import tempfile
import csv
import subprocess
import re
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


def _parse_round_number_from_path(source_path: Path) -> int | None:
    """
    Best-effort folder-based round inference.

    Scans upwards from the file's parent dir, returning the first round-like numeric token
    it finds (e.g., "Round 3", "R3", "3").
    """
    max_search_levels = 8
    for depth, parent in enumerate(source_path.parents):
        if depth == 0:
            # parents[0] is the file's parent dir.
            pass
        if depth >= max_search_levels:
            break

        name = parent.name or ""
        if not name.strip():
            continue

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


def _infer_round_assignments(
    export_inputs: list[tuple[Path, bytes, dict[str, Any]]],
) -> tuple[dict[str, dict[str, Any]], str, list[str]]:
    """
    Returns (round_assignments, mode, warnings).

    round_assignments is keyed by source_path string, mapping to:
      {round_number: int, name: str, packet_name: str, packet_checksum: str}
    """
    parsed_numbers: dict[str, int] = {}
    packet_label_by_path: dict[str, str] = {}
    checksum_by_path: dict[str, str] = {}

    for source_path, _raw, export_obj in export_inputs:
        sp = str(source_path)
        packet_label_by_path[sp] = _packet_label_from_export_obj(export_obj)
        checksum_by_path[sp] = _packet_checksum_from_export_obj(export_obj)
        parsed = _parse_round_number_from_path(source_path)
        if parsed is not None:
            parsed_numbers[sp] = parsed

    warnings: list[str] = []
    round_assignments: dict[str, dict[str, Any]] = {}

    has_any_folder_round = bool(parsed_numbers)
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
    max_round_number = max(parsed_numbers.values()) if parsed_numbers else 0
    missing_paths = [sp for sp in packet_label_by_path.keys() if sp not in parsed_numbers]
    if missing_paths:
        warnings.append(
            f"{len(missing_paths)} export(s) had no round-like folder name; assigning those to additional rounds by packet checksum."
        )

    # Assign folder-based rounds first.
    for sp, round_number in parsed_numbers.items():
        packet_name = packet_label_by_path.get(sp) or ""
        # Avoid redundant "Round N: Round N" when the packet name is just "Round N".
        normalized_packet = re.sub(r"\\s+", " ", packet_name).strip()
        if re.fullmatch(rf"(?i)round\\s*0*{round_number}", normalized_packet):
            round_name = ""
        else:
            round_name = packet_name

        round_assignments[sp] = {
            "round_number": round_number,
            "name": round_name,
            "packet_name": packet_name,
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


class Command(BaseCommand):
    help = (
        "Generate static stats artifacts (JSON) from MoSS scoresheet export files (v1/v2/v3) "
        "using a temporary local SQLite database."
    )

    def add_arguments(self, parser) -> None:
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
            help="One or more moss_scoresheet export JSON files.",
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
        paths: list[str] = options["paths"]

        repo_root = Path(settings.BASE_DIR).parent
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

        for raw_path in paths:
            path = Path(raw_path)
            if not path.exists():
                raise CommandError(f"File not found: {path}")
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
        db_alias = "moss_stats"
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

            def write_csv(*, filename: str, sql: str, params: list[Any]) -> None:
                out_path = output_dir / filename
                with connections[db_alias].cursor() as cursor:
                    cursor.execute(sql, params)
                    cols = [d[0] for d in cursor.description or []]
                    rows = cursor.fetchall()
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
