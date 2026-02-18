# Stats Artifacts (`/stats`)

This folder holds generated, static “stats views” that can be served directly by the website (or fetched from GitHub raw) without requiring a live database.

## Layout

- `stats/index.json`
  - Optional directory of tournaments and pointers to their manifests.
- `stats/<tournament_slug>/`
  - `manifest.json` — metadata about the generated artifacts (schema version, generation time, and source exports).
  - `standings.json` — team + individual standings used by the website Results tab.

Generated files are intended to be written by tooling (e.g. a `manage.py` command) and committed to the repo by the Tournament Director (or CI).

## Generating artifacts

From the repo root:

```bash
python backend/manage.py generate_moss_static_stats --pretty --output-dir stats/pilot-scrimmage path/to/export1.json path/to/export2.json
```

If `stats/<tournament_slug>/` already contains generated artifacts, the command will prompt before replacing them. Use `--yes` to overwrite without prompting (useful for CI).
