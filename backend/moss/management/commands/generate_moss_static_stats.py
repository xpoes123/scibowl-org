from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from moss.services.static_stats import build_standings_view_from_exports


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
    keep_names = {"README.md", ".gitkeep"}

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
    help = "Generate static stats artifacts (JSON) from MoSS scoresheet export files (v1/v2)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--output-dir",
            type=str,
            required=True,
            help="Directory to write generated artifacts into (e.g. stats/pilot-scrimmage).",
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
        output_dir = Path(options["output_dir"])
        tournament_slug: str | None = options.get("tournament_slug")
        tournament_name: str | None = options.get("tournament_name")
        pretty: bool = options["pretty"]
        assume_yes: bool = options["yes"]
        no_dedupe: bool = options["no_dedupe"]
        paths: list[str] = options["paths"]

        slug = (tournament_slug or output_dir.name).strip()
        if not slug:
            raise CommandError("Could not infer tournament slug; pass --tournament-slug.")
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
                        if isinstance(item, dict) and isinstance(item.get("sha256"), str):
                            existing_sources_sha256.add(item["sha256"])

        exports: list[dict[str, Any]] = []
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

            exports.append(export_obj)
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

        existing_artifacts = any((output_dir / name).exists() for name in ("standings.json", "manifest.json"))
        if existing_artifacts or duplicate_with_existing:
            reasons: list[str] = []
            if existing_artifacts:
                reasons.append("existing artifacts in output directory")
            if duplicate_with_existing:
                reasons.append(f"{len(duplicate_with_existing)} input export(s) already listed in manifest.json")

            if not assume_yes:
                self.stdout.write("This run would overwrite previously generated stats artifacts.")
                self.stdout.write(f"Reason(s): {', '.join(reasons)}")
                if duplicate_with_existing:
                    shown = duplicate_with_existing[:5]
                    for p in shown:
                        self.stdout.write(f"  - {p}")
                    if len(duplicate_with_existing) > 5:
                        self.stdout.write(f"  ... and {len(duplicate_with_existing) - 5} more")
                if not _prompt_yes_no(prompt="Regenerate and replace artifacts?", default=False):
                    raise CommandError("Aborted.")

            _safe_wipe_output_dir(output_dir)

        try:
            standings = build_standings_view_from_exports(exports)
        except ValueError as e:
            raise CommandError(str(e)) from e

        standings_payload: dict[str, Any] = {
            "tournament": {"id": 0, "slug": slug, "name": name},
            "team_standings": standings.team_standings,
            "individual_standings": standings.individual_standings,
        }

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
