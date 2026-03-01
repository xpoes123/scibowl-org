# Stats (`stats/`)

Generated CSV artifacts (plus `manifest.json`) used by the website and MoSS. Inputs are MoSS scoresheet export JSON files.

## Generate

```bash
python backend/manage.py generate_moss_static_stats --pretty --tournament-slug <slug> path/to/export1.json path/to/export2.json
```

## Layout

- `stats/<slug>/manifest.json` (source of truth for what exists + filenames)
- `stats/<slug>/team_standings.csv`, `stats/<slug>/individual_standings.csv`
- Optional per-category CSVs: `team_standings__<category>.csv`, `individual_standings__<category>.csv`
- `stats/<slug>/field.json` (hand-authored roster + field metadata)
- `stats/rosters/index.json` (generated index of slugs that have a `field.json`)

## Sync to frontends

The frontends serve these as static files by syncing repo-root `stats/` into:
- `apps/website/frontend/public/stats/`
- `apps/moss/frontend/public/stats/`

Do not edit or commit the `public/stats/` copies.
