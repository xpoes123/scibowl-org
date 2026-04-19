#!/usr/bin/env python3
"""
Standalone stats generator for MoSS scoresheet export JSON files.

Reads export JSONs and produces CSV standings files without Django or any database.

Usage:
    python scripts/generate_stats.py --tournament-slug my-tournament path/to/exports/
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Add backend/ to sys.path so we can import the pure-Python export_facts module.
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "backend"))

from moss.services.export_facts import (  # noqa: E402
    ExportFacts,
    ExportQuestionOutcomes,
    PlayerFacts,
    TeamFacts,
    TeamQuestionOutcome,
    reduce_scoresheet_export_to_facts,
    reduce_scoresheet_export_to_question_outcomes,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_category_stem(category: str) -> str:
    raw = (category or "").strip()
    if not raw:
        return "UNCATEGORIZED"
    stem = re.sub(r"[^A-Za-z0-9]+", "_", raw).strip("_").lower()
    return stem[:80] if stem else "UNCATEGORIZED"


def _discover_json_files(raw_paths: list[str]) -> list[Path]:
    expanded: list[Path] = []
    for raw in raw_paths:
        p = Path(raw).expanduser()
        if not p.exists():
            print(f"ERROR: path not found: {p}", file=sys.stderr)
            sys.exit(1)
        if p.is_dir():
            expanded.extend(sorted(f for f in p.rglob("*.json") if f.is_file()))
        elif p.is_file():
            expanded.append(p)
    # Deduplicate while preserving order.
    seen: set[str] = set()
    unique: list[Path] = []
    for f in sorted(expanded, key=lambda x: str(x)):
        key = str(f)
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique


def _load_exports(
    paths: list[Path],
) -> list[tuple[Path, bytes, dict[str, Any]]]:
    """Load and deduplicate export JSON files by SHA256."""
    exports: list[tuple[Path, bytes, dict[str, Any]]] = []
    seen_hashes: set[str] = set()
    for path in paths:
        raw = path.read_bytes()
        h = _sha256(raw)
        if h in seen_hashes:
            print(f"  SKIP {path.name} (duplicate)")
            continue
        seen_hashes.add(h)
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"ERROR: invalid JSON: {path} ({e})", file=sys.stderr)
            sys.exit(1)
        if not isinstance(obj, dict):
            print(f"ERROR: expected JSON object: {path}", file=sys.stderr)
            sys.exit(1)
        # Skip non-export files (e.g. message.txt that was renamed to .json).
        if obj.get("format") != "moss_scoresheet":
            print(f"  SKIP {path.name} (not a moss_scoresheet export)")
            continue
        exports.append((path, raw, obj))
    return exports


# ---------------------------------------------------------------------------
# Aggregation data classes
# ---------------------------------------------------------------------------

@dataclass
class TeamAgg:
    name: str
    games_played: int = 0
    wins: float = 0.0
    losses: float = 0.0
    points: int = 0
    tossups_heard: int = 0
    tossups_4: int = 0
    tossups_neg: int = 0
    tossups_0: int = 0
    bonuses_heard: int = 0
    bonus_points: int = 0


@dataclass
class PlayerAgg:
    name: str
    team_name: str
    games_played: int = 0
    tossups_heard: int = 0
    tossups_4: int = 0
    tossups_neg: int = 0
    tossups_0: int = 0
    tossup_points: int = 0


@dataclass
class TeamCatAgg:
    name: str
    games_with_cat: set = field(default_factory=set)  # set of game indices
    points: int = 0
    tossups_heard: int = 0
    tossups_4: int = 0
    tossups_neg: int = 0
    tossups_0: int = 0
    bonuses_heard: int = 0
    bonus_points: int = 0


@dataclass
class PlayerCatAgg:
    name: str
    team_name: str
    games_with_cat: set = field(default_factory=set)
    tossups_heard: int = 0
    tossups_4: int = 0
    tossups_neg: int = 0
    tossups_0: int = 0
    tossup_points: int = 0


# ---------------------------------------------------------------------------
# Aggregation engine
# ---------------------------------------------------------------------------

def aggregate_all(
    exports: list[tuple[Path, bytes, dict[str, Any]]],
) -> tuple[
    dict[str, TeamAgg],
    dict[tuple[str, str], PlayerAgg],
    dict[str, dict[str, TeamCatAgg]],
    dict[str, dict[tuple[str, str], PlayerCatAgg]],
    list[str],
]:
    """
    Process all exports and return aggregated stats.

    Returns:
        teams: {team_name: TeamAgg}
        players: {(team_name, player_name): PlayerAgg}
        team_cats: {category: {team_name: TeamCatAgg}}
        player_cats: {category: {(team_name, player_name): PlayerCatAgg}}
        categories: sorted list of category names
    """
    teams: dict[str, TeamAgg] = {}
    players: dict[tuple[str, str], PlayerAgg] = {}
    team_cats: dict[str, dict[str, TeamCatAgg]] = defaultdict(dict)
    player_cats: dict[str, dict[tuple[str, str], PlayerCatAgg]] = defaultdict(dict)
    all_categories: set[str] = set()

    for game_idx, (path, raw, export_obj) in enumerate(exports):
        # --- Overall stats ---
        facts: ExportFacts = reduce_scoresheet_export_to_facts(export_obj)

        # Ensure team entries exist.
        for tf in facts.team_facts:
            if tf.team_name not in teams:
                teams[tf.team_name] = TeamAgg(name=tf.team_name)

        # Determine win/loss.
        if len(facts.team_facts) == 2:
            t1, t2 = facts.team_facts[0], facts.team_facts[1]
            a1, a2 = teams[t1.team_name], teams[t2.team_name]
            a1.games_played += 1
            a2.games_played += 1
            if t1.points > t2.points:
                a1.wins += 1
                a2.losses += 1
            elif t1.points < t2.points:
                a2.wins += 1
                a1.losses += 1
            else:
                a1.wins += 0.5
                a1.losses += 0.5
                a2.wins += 0.5
                a2.losses += 0.5

        # Accumulate team stats.
        for tf in facts.team_facts:
            a = teams[tf.team_name]
            a.points += tf.points
            a.tossups_heard += tf.tossups_heard
            a.tossups_4 += tf.tossups_4
            a.tossups_neg += tf.tossups_neg
            a.tossups_0 += tf.tossups_0
            a.bonuses_heard += tf.bonuses_heard
            a.bonus_points += tf.bonus_points

        # Accumulate player stats.
        for pf in facts.player_facts:
            key = (pf.team_name, pf.player_name)
            if key not in players:
                players[key] = PlayerAgg(name=pf.player_name, team_name=pf.team_name)
            pa = players[key]
            pa.games_played += 1
            pa.tossups_heard += pf.tossups_heard
            pa.tossups_4 += pf.tossups_4
            pa.tossups_neg += pf.tossups_neg
            pa.tossups_0 += pf.tossups_0
            pa.tossup_points += pf.tossup_points

        # --- Category stats ---
        outcomes: ExportQuestionOutcomes = reduce_scoresheet_export_to_question_outcomes(export_obj)

        # Parse lineup segments for per-player per-category tossups heard.
        game_obj = export_obj.get("game", {})
        team_objs = game_obj.get("teams", [])
        # Build: {team_name: [(player_name, start, end)]}
        lineup_map: dict[str, list[tuple[str, int, int]]] = {}
        for team_obj in team_objs:
            if not isinstance(team_obj, dict):
                continue
            tname = (team_obj.get("name") or "").strip()
            if not tname:
                continue
            # Build player_id -> name lookup
            pid_to_name: dict[str, str] = {}
            for p in (team_obj.get("players") or []):
                if isinstance(p, dict) and p.get("id") is not None and isinstance(p.get("name"), str):
                    pid_to_name[str(p["id"])] = p["name"].strip()
            segs: list[tuple[str, int, int]] = []
            for seg in (team_obj.get("lineup_segments") or []):
                if not isinstance(seg, dict):
                    continue
                start = seg.get("start_tossup")
                end = seg.get("end_tossup")
                if not isinstance(start, int) or start < 1:
                    continue
                if end is None:
                    end = facts.pairs_played
                if not isinstance(end, int) or end < start:
                    continue
                active = seg.get("active_players") or seg.get("active_player_ids") or []
                is_ids = seg.get("active_player_ids") is not None and seg.get("active_players") is None
                for pa_item in active:
                    if is_ids:
                        pname = pid_to_name.get(str(pa_item), str(pa_item))
                    elif isinstance(pa_item, str):
                        pname = pa_item.strip()
                    elif isinstance(pa_item, dict) and isinstance(pa_item.get("name"), str):
                        pname = pa_item["name"].strip()
                    else:
                        continue
                    if pname:
                        segs.append((pname, start, end))
            lineup_map[tname] = segs

        def player_heard_pair(team_name: str, player_name: str, pair_id: int) -> bool:
            for pn, s, e in lineup_map.get(team_name, []):
                if pn == player_name and s <= pair_id <= e:
                    return True
            return False

        # Group outcomes by category.
        for outcome in outcomes.outcomes:
            cat = outcome.category or ""
            all_categories.add(cat)

            # Team category aggregation.
            tc_map = team_cats[cat]
            if outcome.team_name not in tc_map:
                tc_map[outcome.team_name] = TeamCatAgg(name=outcome.team_name)
            tc = tc_map[outcome.team_name]
            tc.games_with_cat.add(game_idx)

            if outcome.question_type == "TOSSUP":
                tc.tossups_heard += 1
                tc.points += outcome.points
                if outcome.tossup_result == "CORRECT":
                    tc.tossups_4 += 1
                elif outcome.tossup_result == "INCORRECT":
                    tc.tossups_neg += 1
                else:
                    tc.tossups_0 += 1
            elif outcome.question_type == "BONUS":
                if outcome.heard:
                    tc.bonuses_heard += 1
                tc.bonus_points += outcome.points
                tc.points += outcome.points

            # Player category aggregation (tossups only, players who buzzed).
            if outcome.question_type == "TOSSUP" and outcome.buzzing_player_name:
                pc_map = player_cats[cat]
                pk = (outcome.team_name, outcome.buzzing_player_name)
                if pk not in pc_map:
                    pc_map[pk] = PlayerCatAgg(
                        name=outcome.buzzing_player_name,
                        team_name=outcome.team_name,
                    )
                pc = pc_map[pk]
                pc.games_with_cat.add(game_idx)
                pc.tossup_points += outcome.points
                if outcome.tossup_result == "CORRECT":
                    pc.tossups_4 += 1
                elif outcome.tossup_result == "INCORRECT":
                    pc.tossups_neg += 1

            # Player tossups heard per category.
            if outcome.question_type == "TOSSUP":
                # For each player on this team who was active during this pair,
                # credit them with hearing this tossup in this category.
                for pn, s, e in lineup_map.get(outcome.team_name, []):
                    if s <= outcome.pair_id <= e:
                        pc_map = player_cats[cat]
                        pk = (outcome.team_name, pn)
                        if pk not in pc_map:
                            pc_map[pk] = PlayerCatAgg(name=pn, team_name=outcome.team_name)
                        pc_map[pk].tossups_heard += 1
                        pc_map[pk].games_with_cat.add(game_idx)

    # Finalize player category tossups_0.
    for cat, pc_map in player_cats.items():
        for pk, pc in pc_map.items():
            pc.tossups_0 = max(0, pc.tossups_heard - pc.tossups_4 - pc.tossups_neg)

    return teams, players, dict(team_cats), dict(player_cats), sorted(all_categories)


# ---------------------------------------------------------------------------
# CSV writing
# ---------------------------------------------------------------------------

def _write_csv(path: Path, headers: list[str], rows: list[list[Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)


def write_team_standings(
    output_dir: Path,
    teams: dict[str, TeamAgg],
    team_ids: dict[str, int],
) -> None:
    items = list(teams.values())
    items.sort(key=lambda t: (
        -(t.wins / t.games_played if t.games_played else 0),
        -t.wins,
        -t.points,
        t.name,
    ))
    headers = [
        "rank", "team_id", "name", "wins", "losses", "points_per_game",
        "4s", "-4s", "0s", "tossups_heard", "bonuses_heard", "bonus_points", "points_per_bonus",
    ]
    rows = []
    for rank, t in enumerate(items, 1):
        ppg = t.points / t.games_played if t.games_played else 0
        ppb = t.bonus_points / t.bonuses_heard if t.bonuses_heard else 0
        wins = int(t.wins) if t.wins == int(t.wins) else t.wins
        losses = int(t.losses) if t.losses == int(t.losses) else t.losses
        rows.append([
            rank, team_ids[t.name], t.name,
            wins, losses,
            ppg, t.tossups_4, t.tossups_neg, t.tossups_0,
            t.tossups_heard, t.bonuses_heard, t.bonus_points, ppb,
        ])
    _write_csv(output_dir / "team_standings.csv", headers, rows)
    print(f"  Wrote team_standings.csv ({len(rows)} teams)")


def write_individual_standings(
    output_dir: Path,
    players: dict[tuple[str, str], PlayerAgg],
    player_ids: dict[tuple[str, str], int],
) -> None:
    items = [p for p in players.values()
             if p.tossups_heard > 0 or p.tossups_4 > 0 or p.tossups_neg > 0]
    items.sort(key=lambda p: (-p.tossup_points, -p.tossups_4, p.name))
    headers = [
        "rank", "player_id", "name", "team", "games_played",
        "4s", "-4s", "0s", "tossups_heard", "tossup_points", "points_per_game",
    ]
    rows = []
    for rank, p in enumerate(items, 1):
        ppg = p.tossup_points / p.games_played if p.games_played else 0
        rows.append([
            rank, player_ids[(p.team_name, p.name)], p.name, p.team_name,
            p.games_played, p.tossups_4, p.tossups_neg, p.tossups_0,
            p.tossups_heard, p.tossup_points, ppg,
        ])
    _write_csv(output_dir / "individual_standings.csv", headers, rows)
    print(f"  Wrote individual_standings.csv ({len(rows)} players)")


def write_team_category_standings(
    output_dir: Path,
    cat: str,
    stem: str,
    tc_map: dict[str, TeamCatAgg],
    team_ids: dict[str, int],
) -> None:
    items = list(tc_map.values())
    for tc in items:
        tc_gp = len(tc.games_with_cat)
        if tc_gp == 0:
            continue
    items = [tc for tc in items if len(tc.games_with_cat) > 0]
    items.sort(key=lambda tc: (
        -(tc.points / len(tc.games_with_cat) if tc.games_with_cat else 0),
        -tc.points,
        tc.name,
    ))
    headers = [
        "rank", "team_id", "name", "games_played", "points_per_game",
        "4s", "-4s", "0s", "tossups_heard", "bonuses_heard", "bonus_points", "points_per_bonus",
    ]
    rows = []
    for rank, tc in enumerate(items, 1):
        gp = len(tc.games_with_cat)
        ppg = tc.points / gp if gp else 0
        ppb = tc.bonus_points / tc.bonuses_heard if tc.bonuses_heard else 0
        rows.append([
            rank, team_ids.get(tc.name, 0), tc.name, gp, ppg,
            tc.tossups_4, tc.tossups_neg, tc.tossups_0,
            tc.tossups_heard, tc.bonuses_heard, tc.bonus_points, ppb,
        ])
    filename = f"team_standings__{stem}.csv"
    _write_csv(output_dir / filename, headers, rows)
    print(f"  Wrote {filename} ({len(rows)} teams)")
    return filename


def write_individual_category_standings(
    output_dir: Path,
    cat: str,
    stem: str,
    pc_map: dict[tuple[str, str], PlayerCatAgg],
    player_ids: dict[tuple[str, str], int],
) -> None:
    items = [pc for pc in pc_map.values()
             if pc.tossups_heard > 0 or pc.tossups_4 > 0 or pc.tossups_neg > 0]
    items.sort(key=lambda pc: (-pc.tossup_points, -pc.tossups_4, pc.name))
    headers = [
        "rank", "player_id", "name", "team", "games_played",
        "4s", "-4s", "0s", "tossups_heard", "tossup_points", "points_per_game",
    ]
    rows = []
    for rank, pc in enumerate(items, 1):
        gp = len(pc.games_with_cat)
        ppg = pc.tossup_points / gp if gp else 0
        rows.append([
            rank, player_ids.get((pc.team_name, pc.name), 0), pc.name, pc.team_name,
            gp, pc.tossups_4, pc.tossups_neg, pc.tossups_0,
            pc.tossups_heard, pc.tossup_points, ppg,
        ])
    filename = f"individual_standings__{stem}.csv"
    _write_csv(output_dir / filename, headers, rows)
    print(f"  Wrote {filename} ({len(rows)} players)")
    return filename


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------

def write_manifest(
    output_dir: Path,
    *,
    slug: str,
    name: str,
    sources: list[dict[str, Any]],
    category_views: list[dict[str, str]],
    pretty: bool,
) -> None:
    manifest = {
        "schema_version": 1,
        "generated_at": _iso_utc_now(),
        "tournament": {"slug": slug, "name": name},
        "sources": sources,
        "views": {
            "team_standings": "team_standings.csv",
            "individual_standings": "individual_standings.csv",
            "category_standings": category_views,
        },
    }
    indent = 2 if pretty else None
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=indent, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"  Wrote manifest.json")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate stats CSVs from MoSS scoresheet export JSON files.",
    )
    parser.add_argument("paths", nargs="+", help="Export JSON files or directories.")
    parser.add_argument("--tournament-slug", required=True, help="Tournament slug for output.")
    parser.add_argument("--tournament-name", default=None, help="Tournament display name.")
    parser.add_argument("--output-dir", default=None, help="Output directory (default: stats/<slug>).")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    parser.add_argument("--yes", action="store_true", help="Overwrite without prompting.")
    parser.add_argument("--no-sync-frontends", action="store_true", help="Skip syncing to frontends.")
    args = parser.parse_args()

    slug = args.tournament_slug
    name = args.tournament_name or slug

    if args.output_dir:
        output_dir = Path(args.output_dir)
        if not output_dir.is_absolute():
            output_dir = _REPO_ROOT / output_dir
    else:
        output_dir = _REPO_ROOT / "stats" / slug

    # Discover and load exports.
    print(f"Discovering JSON files...")
    paths = _discover_json_files(args.paths)
    if not paths:
        print("ERROR: no JSON files found.", file=sys.stderr)
        sys.exit(1)
    print(f"Found {len(paths)} JSON files.")

    print(f"Loading exports...")
    exports = _load_exports(paths)
    if not exports:
        print("ERROR: no valid export files found.", file=sys.stderr)
        sys.exit(1)
    print(f"Loaded {len(exports)} exports.")

    # Check for existing output.
    if output_dir.exists() and any(output_dir.iterdir()):
        if not args.yes:
            answer = input(f"Output directory {output_dir} already exists. Overwrite? [y/N] ").strip().lower()
            if answer not in {"y", "yes"}:
                print("Aborted.")
                sys.exit(0)

    output_dir.mkdir(parents=True, exist_ok=True)

    # Aggregate.
    print(f"Aggregating stats across {len(exports)} games...")
    teams, players, team_cats, player_cats, categories = aggregate_all(exports)

    # Assign stable IDs.
    sorted_team_names = sorted(teams.keys())
    team_ids = {name: idx for idx, name in enumerate(sorted_team_names, 1)}

    sorted_player_keys = sorted(players.keys())
    player_ids = {key: idx for idx, key in enumerate(sorted_player_keys, 1)}

    # Write outputs.
    print(f"Writing output to {output_dir}/")
    write_team_standings(output_dir, teams, team_ids)
    write_individual_standings(output_dir, players, player_ids)

    category_views: list[dict[str, str]] = []
    used_stems: dict[str, int] = {}
    for cat in categories:
        stem = _safe_category_stem(cat)
        if stem in used_stems:
            used_stems[stem] += 1
            stem = f"{stem}_{used_stems[stem]}"
        else:
            used_stems[stem] = 1

        tc_map = team_cats.get(cat, {})
        pc_map = player_cats.get(cat, {})
        team_fn = write_team_category_standings(output_dir, cat, stem, tc_map, team_ids)
        indiv_fn = write_individual_category_standings(output_dir, cat, stem, pc_map, player_ids)
        category_views.append({
            "category": cat,
            "key": stem,
            "team_standings": team_fn,
            "individual_standings": indiv_fn,
        })

    # Build sources list.
    sources = []
    for path, raw, obj in exports:
        sources.append({
            "path": str(path),
            "sha256": _sha256(raw),
            "version": obj.get("version"),
            "exported_at": obj.get("exported_at"),
        })

    write_manifest(
        output_dir,
        slug=slug,
        name=name,
        sources=sources,
        category_views=category_views,
        pretty=args.pretty,
    )

    # Sync frontends.
    if not args.no_sync_frontends:
        for label, script in [
            ("website", _REPO_ROOT / "apps" / "website" / "frontend" / "scripts" / "sync-stats.mjs"),
            ("moss", _REPO_ROOT / "apps" / "moss" / "frontend" / "scripts" / "sync-stats.mjs"),
        ]:
            if not script.exists():
                print(f"WARNING: sync script not found: {script}", file=sys.stderr)
                continue
            result = subprocess.run(
                ["node", str(script)],
                cwd=str(_REPO_ROOT),
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                print(f"WARNING: frontend sync failed for {label}: {result.stderr}", file=sys.stderr)
            else:
                print(f"  Synced stats to {label} frontend.")

    print("Done!")


if __name__ == "__main__":
    main()
