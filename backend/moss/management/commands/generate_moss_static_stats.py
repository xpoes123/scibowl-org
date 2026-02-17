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
        no_dedupe: bool = options["no_dedupe"]
        paths: list[str] = options["paths"]

        output_dir.mkdir(parents=True, exist_ok=True)

        slug = (tournament_slug or output_dir.name).strip()
        if not slug:
            raise CommandError("Could not infer tournament slug; pass --tournament-slug.")
        name = (tournament_name or slug).strip()

        exports: list[dict[str, Any]] = []
        sources: list[dict[str, Any]] = []
        seen: set[str] = set()

        for raw_path in paths:
            path = Path(raw_path)
            if not path.exists():
                raise CommandError(f"File not found: {path}")
            data = path.read_bytes()
            file_hash = _sha256_bytes(data)
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
