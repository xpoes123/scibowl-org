# Backend (Django)

Django REST API (Postgres) for the Scibowl/NSB Arena stack.

## Run with Docker

Full stack (repo root, includes both frontends):

```bash
docker-compose up
```

Backend only:

```bash
cd backend
docker-compose up
```

First run (backend-only compose):

```bash
cd backend
docker-compose exec web python manage.py migrate
```

API: `http://localhost:8000` (admin at `/admin/`).

## Local dev (no Docker)

Prereqs: Python 3.11+, Postgres 16+.

```bash
cd backend
python -m venv .venv
# activate your venv
pip install -r requirements.txt
# create .env from .env.example
python manage.py migrate
python manage.py runserver
```

## API routes

Routes are wired in `backend/backend/urls.py`:
- `/api/` (users + tournaments)
- `/api/questions/`
- `/api/moss/`

## Management commands

### `load_tournaments_json` (canonical seed)

Reads `apps/website/frontend/src/features/tournaments/data/tournaments.json` and
upserts all tournaments (plus related contacts, links, and deadlines) into the DB.

```bash
python manage.py load_tournaments_json            # upsert all entries
python manage.py load_tournaments_json --dry-run  # preview without writing
```

Safe to re-run; existing records are updated by slug, new ones are created.

### `load_sample_tournaments` — STALE, do not use

Pre-schema-alignment command that created synthetic sample data (Stanford 2026
Collegiate, Stanford 2026 High School, MIT Science Bowl Invitational 2026).
References field names that no longer exist on the Tournament model and will fail
if run. Retained for historical reference only.

## Tests

```bash
cd backend
python manage.py test --settings=backend.test_settings
```

More: `backend/TESTING.md`.

## License

See repo root `LICENSE`.
