# `pilot-scrimmage`

This directory holds:

- Generated stats artifacts (`manifest.json`, `team_standings.csv`, `individual_standings.csv`, and optional per-category CSVs) produced by `generate_moss_static_stats`.
- Optional per-game “facts” CSVs (under `facts/`) used by selector-driven views (Scoreboard / Round report / Team / Player).
- A human-authored roster artifact (`field.json`) used by the website Field tab and MoSS roster picker.

Run the static stats generator (see the backend `manage.py` command) with `--output-dir stats/pilot-scrimmage` to populate this folder.

Notes:

- Per-category files use the naming convention `team_standings__<category_key>.csv` / `individual_standings__<category_key>.csv`.
- `manifest.json` is the source of truth for which standings views exist and which filenames the website should load.

