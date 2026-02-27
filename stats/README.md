# Stats Artifacts (`/stats`)

This folder holds generated, static "stats views" that can be served directly by the website (or fetched from GitHub raw).

These files are generated from MoSS export JSON files by building a temporary local SQLite database, loading the exports into normalized MoSS tables, and then running query-defined SQL views to produce static CSVs.

## Layout

- `stats/index.json`
  - Optional directory of tournaments and pointers to their manifests.
- `stats/<tournament_slug>/`
  - `manifest.json` - metadata about the generated artifacts (schema version, generation time, and source exports).
  - `team_standings.csv` - overall team standings used by the website Standings tab.
  - `individual_standings.csv` - overall individual standings used by the website Standings tab.
  - `team_standings__<category>.csv` - per-category team standings (wins/losses omitted).
  - `individual_standings__<category>.csv` - per-category individual standings.
  - `field.json` - human-authored field + team rosters (used by the website Field tab and MoSS roster picker).
- `stats/rosters/index.json`
  - Generated index of tournaments with a `field.json` file (used by MoSS to disable tournaments without roster files).

## Generating artifacts

From the repo root:

```bash
python backend/manage.py generate_moss_static_stats --pretty --output-dir stats/pilot-scrimmage path/to/export1.json path/to/export2.json
```

From anywhere (recommended):

```bash
python backend/manage.py generate_moss_static_stats --pretty --tournament-slug pilot-scrimmage path/to/export1.json path/to/export2.json
```

Notes:

- The command always uses a temporary local SQLite database; it does not require Postgres.
- If `stats/<tournament_slug>/` already contains generated artifacts, the command will prompt before replacing them (use `--yes` for CI).
- By default, the command also syncs repo-root `stats/` into the website and MoSS frontends' `public/stats/` folders (pass `--no-sync-frontends` to skip).

## Frontend consumption

Both frontends serve these artifacts as static files under `/stats/**` by copying repo-root `stats/` into each app's `public/stats/` during build/dev:

- Website: `apps/website/frontend/scripts/sync-stats.mjs`
- MoSS: `apps/moss/frontend/scripts/sync-stats.mjs`

Those `public/stats/` copies are build artifacts and should not be manually edited or committed.
