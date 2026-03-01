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

## Tests

```bash
cd backend
python manage.py test --settings=backend.test_settings
```

More: `backend/TESTING.md`.

## License

See repo root `LICENSE`.
