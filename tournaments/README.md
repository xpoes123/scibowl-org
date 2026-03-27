# Tournaments

Tournament listings are now served from the **database** via the Django API.
The static `tournaments.json` file is retained as a seed reference but is no longer
imported at runtime by the frontend.

## Adding or updating a tournament

### Option 1: Django admin (recommended)

1. Open the Django admin at `/admin/` and navigate to **Tournaments**.
2. Create or edit a Tournament record. Follow `tournaments/SCHEMA.md` for field
   reference.
3. Set `publication_status = PUBLISHED` for the tournament to appear on the
   public listing.
4. Use the inline forms to add related **Contacts**, **Links**, and **Deadlines**.

### Option 2: Edit `tournaments.json` and re-seed

If you prefer editing the JSON directly (e.g. for bulk changes):

1. Edit `apps/website/frontend/src/features/tournaments/data/tournaments.json`.
   Follow `tournaments/SCHEMA.md` and start from `tournaments/example-tournament.json`.
2. Validate the JSON:
   ```bash
   node tournaments/validate.js
   ```
3. Seed the DB:
   ```bash
   cd backend
   python manage.py load_tournaments_json
   ```
   The command upserts by slug — safe to re-run. Contacts, links, and deadlines
   are cleared and recreated from the JSON on each run.

## Notes

- `status` in `tournaments.json` maps to `publication_status` on the DB model
  (`PUBLISHED` / `DRAFT` / `ARCHIVED`). Only `PUBLISHED` tournaments appear on
  the public listing.
- Use an IANA timezone string (for US: `America/Los_Angeles`, `America/Denver`,
  `America/Chicago`, `America/New_York`).
- See `tournaments/SCHEMA.md` for the full field reference and JSON format.
