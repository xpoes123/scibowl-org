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


def _safe_wipe_output_dir(output_dir: Path) -> None:
    """
    Remove previously generated artifacts so stale files don't linger.

    Keeps common human-authored placeholder files.
    """
    keep_names = {"README.md", ".gitkeep", "field.json"}

    if not output_dir.exists():
        return

    # Delete files first.
    for path in sorted(output_dir.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if path.is_dir():
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


class Command(BaseCommand):
    help = (
        "Generate static stats artifacts (JSON) from MoSS scoresheet export files (v1/v2) "
        "using a temporary local SQLite database."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--output-dir",
            type=str,
            required=False,
            default=None,
            help=(
                "Directory to write generated artifacts into. "
                "Relative paths are resolved from the repo root. "
                "Defaults to <repo>/stats/<tournament-slug>."
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
            output_dir = repo_root / "stats" / slug_for_default

        slug = (tournament_slug or output_dir.name).strip()
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

            _safe_wipe_output_dir(output_dir)

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
                    using=db_alias,
                )
            except ValueError as e:
                raise CommandError(str(e)) from e

            sql_dir = Path(settings.BASE_DIR) / "moss" / "services" / "stats_sql"
            team_sql = (sql_dir / "team_standings.sql").read_text(encoding="utf-8")
            individual_sql = (sql_dir / "individual_standings.sql").read_text(encoding="utf-8")
            team_category_sql = (sql_dir / "team_category_standings.sql").read_text(encoding="utf-8")
            individual_category_sql = (sql_dir / "individual_category_standings.sql").read_text(encoding="utf-8")

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
            "sources": sources,
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

        self.stdout.write(self.style.SUCCESS(f"Wrote {output_dir / 'team_standings.csv'}"))
        self.stdout.write(self.style.SUCCESS(f"Wrote {output_dir / 'individual_standings.csv'}"))
        self.stdout.write(self.style.SUCCESS(f"Wrote {output_dir / 'manifest.json'}"))

        if not no_sync_frontends:
            self._sync_frontends(repo_root=repo_root)
            self.stdout.write(self.style.SUCCESS("Synced stats into website and MoSS frontends."))
