# Stats (`stats/`)

Generated CSV artifacts (plus `manifest.json`) used by the website and MoSS. Inputs are MoSS scoresheet export JSON files.

## Generate

```bash
python backend/manage.py generate_moss_static_stats --pretty --tournament-slug <slug> path/to/export1.json path/to/export2.json
```

Multiple independent reports (e.g. `prelims`, `playoffs`) can be generated per tournament by running the command multiple times with `--report-key` / `--report-label`. The default report is `combined`.

## Layout

- `stats/<slug>/reports.json` (index of available reports and their `manifest.json` paths)
- For the default `combined` report:
  - `stats/<slug>/manifest.json` (source of truth for what exists + filenames)
  - `stats/<slug>/team_standings.csv`, `stats/<slug>/individual_standings.csv`
  - Optional per-category CSVs: `team_standings__<category>.csv`, `individual_standings__<category>.csv`
  - Optional per-game “facts” CSVs (used by selector-driven views like Scoreboard / Round report / Team / Player):
    - `stats/<slug>/facts/games.csv`
    - `stats/<slug>/facts/game_teams.csv`, `stats/<slug>/facts/game_players.csv`
    - `stats/<slug>/facts/rounds.csv`
    - Optional per-category facts: `stats/<slug>/facts/game_teams_by_category.csv`, `stats/<slug>/facts/game_players_by_category.csv`
- For non-default reports:
  - `stats/<slug>/reports/<report_key>/manifest.json`
  - Same CSV layout as above, rooted at `stats/<slug>/reports/<report_key>/`
- `stats/<slug>/field.json` (hand-authored roster + field metadata)
- `stats/rosters/index.json` (generated index of slugs that have a `field.json`)

## Sync to frontends

The frontends serve these as static files by syncing repo-root `stats/` into:
- `apps/website/frontend/public/stats/`
- `apps/moss/frontend/public/stats/`

Do not edit or commit the `public/stats/` copies.
