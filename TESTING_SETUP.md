# Testing and CI

Backend tests live under `backend/**/tests/`. CI is defined in `.github/workflows/backend-tests.yml`.

## Run tests

Local:

```bash
cd backend
python manage.py test --settings=backend.test_settings
```

Docker (choose one):

- From repo root (full stack compose):
  - `docker-compose exec backend python manage.py test --settings=backend.test_settings`
- From `backend/` (backend-only compose):
  - `docker-compose exec web python manage.py test --settings=backend.test_settings`

## Coverage

```bash
cd backend
pip install coverage
coverage run --source='.' manage.py test --settings=backend.test_settings
coverage report
```

More detail: `backend/TESTING.md`.

## MoSS frontend

MoSS unit tests use Vitest and live next to the code they test as `*.test.ts` (currently the scoresheet reducer and game-end helpers in `apps/moss/frontend/src/domain/`). They are not run in CI yet.

```bash
cd apps/moss/frontend
npm test
```
