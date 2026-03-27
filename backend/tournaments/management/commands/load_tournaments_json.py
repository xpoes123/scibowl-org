"""
Management command: load_tournaments_json

Reads apps/website/frontend/src/features/tournaments/data/tournaments.json
and upserts Tournament records (plus related contacts, links, and deadlines)
into the database.

This is the authoritative seed command for the tournament listing. Run it
whenever the static JSON is updated and you want those changes reflected in
the DB.

Usage:
    python manage.py load_tournaments_json [--dry-run]
"""

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from tournaments.models import Tournament, TournamentContact, TournamentDeadline, TournamentLink

JSON_PATH = (
    Path(settings.BASE_DIR).parent
    / "apps"
    / "website"
    / "frontend"
    / "src"
    / "features"
    / "tournaments"
    / "data"
    / "tournaments.json"
)


class Command(BaseCommand):
    help = "Seed the DB from the frontend tournaments.json file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and validate the JSON without writing to the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if not JSON_PATH.exists():
            self.stderr.write(self.style.ERROR(f"JSON file not found: {JSON_PATH}"))
            return

        with JSON_PATH.open("r", encoding="utf-8") as f:
            entries = json.load(f)

        if not isinstance(entries, list):
            self.stderr.write(self.style.ERROR("Expected a JSON array at the top level."))
            return

        self.stdout.write(f"Found {len(entries)} tournament(s) in JSON.")

        created_count = 0
        updated_count = 0

        for entry in entries:
            slug = entry.get("slug")
            if not slug:
                self.stderr.write(
                    self.style.WARNING(f"Skipping entry with no slug: {entry.get('name')}")
                )
                continue

            if dry_run:
                self.stdout.write(f"  [dry-run] Would upsert: {slug}")
                continue

            defaults = _build_tournament_defaults(entry)
            tournament, created = Tournament.objects.update_or_create(
                slug=slug,
                defaults=defaults,
            )

            if created:
                created_count += 1
                label = "Created"
            else:
                updated_count += 1
                label = "Updated"

            # Replace related records (clear + recreate to stay in sync with JSON)
            tournament.contacts.all().delete()
            for contact in entry.get("contacts") or []:
                TournamentContact.objects.create(
                    tournament=tournament,
                    type=contact["type"],
                    value=contact["value"],
                    label=contact.get("label", ""),
                )

            tournament.links.all().delete()
            for link in entry.get("links") or []:
                TournamentLink.objects.create(
                    tournament=tournament,
                    type=link["type"],
                    url=link["url"],
                    label=link["label"],
                )

            tournament.deadlines.all().delete()
            registration = entry.get("registration") or {}
            for deadline in registration.get("deadlines") or []:
                TournamentDeadline.objects.create(
                    tournament=tournament,
                    label=deadline["label"],
                    date=deadline["date"],
                )

            self.stdout.write(f"  {label}: {slug}")

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nDone. Created: {created_count}, Updated: {updated_count}."
                )
            )


def _build_tournament_defaults(entry: dict) -> dict:
    dates = entry.get("dates") or {}
    start_str = dates.get("start", "")
    end_str = dates.get("end", "")

    location = entry.get("location") or {}
    notes = entry.get("notes") or {}
    fmt = entry.get("format") or {}
    registration = entry.get("registration") or {}

    # Store end_date as null when it equals start_date (single-day event),
    # consistent with the model's intent (nullable for single-day events).
    end_date = end_str if (end_str and end_str != start_str) else None

    return {
        "name": entry.get("name", ""),
        # JSON 'status' is the publication_status on the DB model.
        # Lifecycle 'status' is not in the JSON; default to UPCOMING.
        "publication_status": entry.get("status", "DRAFT"),
        "status": "UPCOMING",
        "mode": entry.get("mode", "IN_PERSON"),
        "timezone": entry.get("timezone", "America/New_York"),
        "divisions": entry.get("divisions") or [],
        "start_date": start_str,
        "end_date": end_date,
        "location_city": location.get("city", ""),
        "location_state": location.get("state", ""),
        "location_address": location.get("address", ""),
        "difficulty": entry.get("difficulty", ""),
        "notes_logistics": notes.get("logistics", ""),
        "notes_writing_team": notes.get("writing_team", ""),
        "format_summary": fmt.get("summary", ""),
        "rounds_guaranteed": fmt.get("rounds_guaranteed"),
        "registration_method": registration.get("method", ""),
        "registration_instructions": registration.get("instructions", ""),
        "registration_url": registration.get("url", ""),
        "registration_cost": registration.get("cost", ""),
    }
