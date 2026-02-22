from __future__ import annotations

import hashlib
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.utils.timezone import now

from moss.services.ingest_exports import ingest_scoresheet_exports
from moss.services.stats_views import build_tournament_standings_view
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
            "paths",
            nargs="+",
            help="One or more moss_scoresheet export JSON files.",
        )

    def handle(self, *args, **options) -> None:
        tournament_slug: str | None = options.get("tournament_slug")
        tournament_name: str | None = options.get("tournament_name")
        pretty: bool = options["pretty"]
        assume_yes: bool = options["yes"]
        no_dedupe: bool = options["no_dedupe"]
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
        db_alias = "moss_stats  d"
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

            standings_payload: dict[str, Any] = build_tournament_standings_view(
                tournament=tournament,
                using=db_alias,
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
            "views": {"standings": "standings.json"},
        }

        indent = 2 if pretty else None
        (output_dir / "standings.json").write_text(
            json.dumps(standings_payload, indent=indent, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        (output_dir / "manifest.json").write_text(
            json.dumps(manifest_payload, indent=indent, sort_keys=True) + "\n",
            encoding="utf-8",
        )

        self.stdout.write(self.style.SUCCESS(f"Wrote {output_dir / 'standings.json'}"))
        self.stdout.write(self.style.SUCCESS(f"Wrote {output_dir / 'manifest.json'}"))
