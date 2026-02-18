# Stats Artifacts (`/stats`)

This folder holds generated, static "stats views" that can be served directly by the website (or fetched from GitHub raw).

These files are generated from MoSS export JSON files by building an ephemeral local SQLite database, loading the exports into MoSS fact tables, and then running query-defined views against those fact tables.

## Layout

- `stats/index.json`
  - Optional directory of tournaments and pointers to their manifests.
- `stats/<tournament_slug>/`
  - `manifest.json` - metadata about the generated artifacts (schema version, generation time, and source exports).
  - `standings.json` - team + individual standings used by the website Results tab.

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
