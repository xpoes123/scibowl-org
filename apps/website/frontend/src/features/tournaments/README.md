# Tournament Feature

## Technology stack

- Backend: Django 5.1.4 + Django REST Framework
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS
- Database: PostgreSQL 16

## Database models (`backend/tournaments/models.py`)

- `Tournament` — core tournament record
  - Lifecycle status: `UPCOMING`, `REGISTRATION`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
  - Publication status: `DRAFT`, `PUBLISHED`, `ARCHIVED` (controls public visibility)
  - Divisions: `HS`, `MS`, `UG`, `OPEN` — stored as a JSONField array (supports multi-division)
  - Mode: `IN_PERSON`, `ONLINE`
  - Format: `ROUND_ROBIN`, `DOUBLE_ELIM`, `SINGLE_ELIM`, `SWISS`, `CUSTOM`
  - Related tables: `TournamentContact`, `TournamentLink`, `TournamentDeadline`
- `Team` — team participating in a tournament, with pool assignment
- `Player` — individual player on a team roster
- `Room` — physical or virtual room; status: `NOT_STARTED`, `IN_PROGRESS`, `FINISHED`
- `Round` — tournament round with optional packet assignment

Game data lives in the `moss` app (`moss.Game`), written by MoSS.

See the root `SCHEMA.md` for full field-level documentation.

## API endpoints (`backend/tournaments/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tournaments/` | Public listing — PUBLISHED only; filterable by lifecycle `?status=` |
| GET | `/api/tournaments/:slug/` | Full tournament detail (contacts, links, deadlines) |
| GET | `/api/tournaments/:slug/teams/` | Teams for a tournament |
| GET | `/api/tournaments/:slug/rooms/` | Rooms for a tournament |
| GET | `/api/tournaments/:slug/rounds/` | Rounds for a tournament |
| GET | `/api/tournaments/:slug/games/` | Games for a tournament |
| POST | `/api/tournaments/:slug/generate_schedule/` | Generate round-robin schedule |
| PATCH | `/api/teams/:id/` | Update team pool assignment |
| GET | `/api/teams/:id/players/` | Players for a team |
| POST | `/api/players/` | Add player to a team |
| DELETE | `/api/players/:id/` | Remove a player |

Tournament endpoints are read-only except for pool configuration and roster management.

## Tournament listing data flow

The public listing is served from the database via the API — it is no longer sourced
from the static `tournaments.json` file at runtime.

```
tournaments.json  →  load_tournaments_json  →  DB  →  GET /api/tournaments/  →  useTournaments hook
```

- Frontend list: `useTournaments` hook calls `GET /api/tournaments/`
- Frontend detail: `getTournamentById(slug)` calls `GET /api/tournaments/:slug/`
- Seed command: `python manage.py load_tournaments_json` (upserts by slug, safe to re-run)
- `load_sample_tournaments` is stale — references old schema fields, will fail if run

To add or update a tournament, see `tournaments/README.md` at the repo root.

## TypeScript types

Defined in `types.ts`:

- `Tournament` / `TournamentDetail` — full tournament shape (detail page)
- `TournamentSummary` — lighter subset (listing)
- `PublicationStatus` — `"DRAFT" | "PUBLISHED" | "ARCHIVED"`
- `TournamentStatus` — derived display state `"LIVE" | "UPCOMING" | "FINISHED"` (computed from dates, not stored)
- `TournamentDivision` — `"HS" | "MS" | "UG" | "OPEN"`
- `TournamentMode` — `"IN_PERSON" | "ONLINE"`
