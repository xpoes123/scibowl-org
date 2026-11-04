# Stats (`stats/`)

Generated CSV artifacts (plus `manifest.json`) used by the website and MoSS. Inputs are MoSS scoresheet export JSON files.

## Generate

```bash
python scripts/generate_stats.py --tournament-slug <slug> [--tournament-name "<name>"] [--tuh-scale 20] path/to/exports/
```

`scripts/generate_stats.py` is the supported generator. It needs no Django or database, writes to `stats/<slug>/` (override with `--output-dir`), and syncs to the frontends unless `--no-sync-frontends` is passed. See [`scripts/README.md`](../scripts/README.md) for all options.

- `--tuh-scale N` (default 20) sets the N in "points per N tossups heard" (see [Points per N tossups heard](#points-per-n-tossups-heard)). It is written to `manifest.json` and only affects display; no CSV value depends on it.
- Run `scripts/build_buzzpoints.py` **after** `generate_stats.py`. `generate_stats.py` rewrites `manifest.json`, and `build_buzzpoints.py` adds its entries to the existing one.

### Django command (not maintained)

`python backend/manage.py generate_moss_static_stats` produced the same layout from the database and supports multiple reports per tournament (`--report-key` / `--report-label`, `--reports-from-subdirs`). It is no longer maintained, only writes schema version 1, and may not run against the current database schema. `generate_stats.py` does not support multiple reports yet; it always writes the default `combined` report.

## Layout

- `stats/<slug>/reports.json` (index of available reports and their `manifest.json` paths; only written by the Django command)
- For the default `combined` report:
  - `stats/<slug>/manifest.json` (source of truth for what exists + filenames)
  - `stats/<slug>/team_standings.csv`, `stats/<slug>/individual_standings.csv`
  - Optional per-category CSVs: `team_standings__<category>.csv`, `individual_standings__<category>.csv`
  - Optional per-game “facts” CSVs (used by selector-driven views like Scoreboard / Round report / Team / Player):
    - `stats/<slug>/facts/games.csv`
    - `stats/<slug>/facts/game_teams.csv`, `stats/<slug>/facts/game_players.csv`
    - `stats/<slug>/facts/teams.csv`, `stats/<slug>/facts/players.csv`, `stats/<slug>/facts/rounds.csv`
    - Optional per-category facts: `stats/<slug>/facts/game_teams_by_category.csv`, `stats/<slug>/facts/game_players_by_category.csv`
- For non-default reports:
  - `stats/<slug>/reports/<report_key>/manifest.json`
  - Same CSV layout as above, rooted at `stats/<slug>/reports/<report_key>/`
- `stats/<slug>/field.json` (hand-authored roster + field metadata)
- `stats/rosters/index.json` (generated index of slugs that have a `field.json`)

## Schema version 2

`manifest.json` → `schema_version` says which version a tournament's files follow. Version 2 is written by `generate_stats.py`; files from before it are version 1. All version 2 changes are additions or ranking changes: every version 1 column is still present with the same meaning, so a version 1 reader keeps working.

### Tossups heard

Games can end early (the moderator marks the end in MoSS; see the "Game end" section of [`scoresheet_export_json_spec.md`](../apps/moss/frontend/src/assets/scoresheet_export_json_spec.md)). Only pairs before the end were heard. In version 1 every game was assumed to run to the last pair with a buzz, so per-game averages were unfair to teams in shortened games.

- **Pairs played** in a game: the pairs before the game end, or, if the game was not ended early, up to the last pair with a buzz (or the moderator's last position).
- **Team tossups heard (TUH)**: one per pair played, per game. Per category, one per pair played whose tossup is in that category.
- **Player TUH**: one per pair played during which the player was in the team's lineup (from `lineup_segments`). Per category, counted the same way, restricted to tossups in that category. MoSS always records a starting lineup, so every export has segments. If an export has none, its players get 0 TUH and no P/NTUH (below).

Attempts and bonuses on pairs after the end are ignored everywhere.

### Points per N tossups heard

The website shows **points per N tossups heard (P/NTUH)** instead of points per game:

```
P/NTUH = points × N / TUH
```

N is `manifest.json` → `stats_options.tuh_scale` (default 20). P/NTUH is computed by the reader from the `points`/`tossup_points` and `tossups_heard` columns, so changing N needs no regeneration. With 0 TUH there is no P/NTUH; show it as blank and sort it last.

Which points: teams use total points (tossups + bonuses). Per category, a team's points are its tossup points on that category's tossups plus its bonus points on that category's bonuses. Players use tossup points.

### `manifest.json` changes

| Field | Change |
|---|---|
| `schema_version` | `2` |
| `stats_options` | New object: `{ "tuh_scale": 20 }` |
| `sources[].path` | File name only (e.g. `round1_teamA__teamB.json`) instead of the full local path, which leaked folder names from the generating machine. |

### CSV changes

| File | Change in version 2 |
|---|---|
| `team_standings.csv` | New `games_played` and `points` (total points). Ranking unchanged: win percentage, then wins, then points. |
| `individual_standings.csv` | No new columns (`tossup_points` and `tossups_heard` already exist). `rank` now orders by `tossup_points / tossups_heard` (highest first; 0 TUH last), then `tossup_points`, then name. No minimum TUH. |
| `team_standings__<category>.csv` | New `points` (category points as defined above). `rank` now orders by `points / tossups_heard`, then `points`, then name. |
| `individual_standings__<category>.csv` | No new columns. `rank` orders like `individual_standings.csv`. Includes players who heard tossups in the category without buzzing (version 1 already did). |
| `facts/games.csv` | New `pairs_total` (pairs in the packet) and `ended_early` (`1` if the moderator ended the game before the last pair, else `0`). `pairs_played` now respects the game end. |
| `facts/game_teams.csv` | New `tossups_heard` (equals the game's `pairs_played`). |
| `facts/game_players.csv` | No change. `pairs_heard` is the player's TUH in that game. |
| `facts/game_teams_by_category.csv` | New `tossups_heard`. |
| `facts/game_players_by_category.csv` | New `tossups_heard`. Adds rows for players who heard tossups in a category without buzzing (all their counts are 0), so per-category P/NTUH can be computed from facts. |

The website shows team standings in file order with the `rank` column as written, so they can be reordered by hand (e.g. for a tiebreak); regenerating overwrites such edits. Individual standings are re-sorted by the website, so their `rank` and order are informational only.

## Sync to frontends

The frontends serve these as static files by syncing repo-root `stats/` into:
- `apps/website/frontend/public/stats/`
- `apps/moss/frontend/public/stats/`

Do not edit or commit the `public/stats/` copies.
