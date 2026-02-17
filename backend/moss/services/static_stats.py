from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from moss.services.export_facts import ExportFacts, reduce_scoresheet_export_to_facts


@dataclass(frozen=True)
class StandingsView:
    team_standings: list[dict[str, Any]]
    individual_standings: list[dict[str, Any]]


def _require_dict(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{path} must be an object")
    return value


def reduce_exports_to_facts(exports: list[dict[str, Any]]) -> list[ExportFacts]:
    facts: list[ExportFacts] = []
    for idx, export_obj in enumerate(exports):
        export_obj = _require_dict(export_obj, f"exports[{idx}]")
        facts.append(reduce_scoresheet_export_to_facts(export_obj))
    return facts


def build_standings_view_from_exports(exports: list[dict[str, Any]]) -> StandingsView:
    """
    Build the standings view used by the website Results tab from a list of MoSS
    scoresheet exports (v1/v2).

    This intentionally mirrors the backend API aggregation semantics:
    - wins/losses are computed by comparing each team's points to the opponent
    - ties count as neither a win nor a loss
    - individual "games_played" counts only games where the player has a fact row
    """

    export_facts = reduce_exports_to_facts(exports)

    team_agg: dict[str, dict[str, int]] = {}
    team_games: dict[str, int] = {}

    player_agg: dict[tuple[str, str], dict[str, int]] = {}
    player_games: dict[tuple[str, str], int] = {}

    for facts in export_facts:
        if len(facts.team_facts) != 2:
            raise ValueError("Each export must contain exactly 2 teams")

        team1, team2 = facts.team_facts
        points = {team1.team_name: team1.points, team2.team_name: team2.points}

        def ensure_team(name: str) -> dict[str, int]:
            if name not in team_agg:
                team_agg[name] = {
                    "wins": 0,
                    "losses": 0,
                    "points": 0,
                    "tossups_heard": 0,
                    "tossups_4": 0,
                    "tossups_neg": 0,
                    "tossups_0": 0,
                    "bonuses_heard": 0,
                    "bonus_points": 0,
                }
                team_games[name] = 0
            return team_agg[name]

        for tf in facts.team_facts:
            opp_name = team2.team_name if tf.team_name == team1.team_name else team1.team_name
            row = ensure_team(tf.team_name)
            team_games[tf.team_name] += 1

            if points[tf.team_name] > points[opp_name]:
                row["wins"] += 1
            elif points[tf.team_name] < points[opp_name]:
                row["losses"] += 1

            row["points"] += int(tf.points)
            row["tossups_heard"] += int(tf.tossups_heard)
            row["tossups_4"] += int(tf.tossups_4)
            row["tossups_neg"] += int(tf.tossups_neg)
            row["tossups_0"] += int(tf.tossups_0)
            row["bonuses_heard"] += int(tf.bonuses_heard)
            row["bonus_points"] += int(tf.bonus_points)

        for pf in facts.player_facts:
            key = (pf.team_name, pf.player_name)
            if key not in player_agg:
                player_agg[key] = {
                    "tossups_heard": 0,
                    "tossups_4": 0,
                    "tossups_neg": 0,
                    "tossups_0": 0,
                    "tossup_points": 0,
                }
                player_games[key] = 0
            prow = player_agg[key]
            player_games[key] += 1
            prow["tossups_heard"] += int(pf.tossups_heard)
            prow["tossups_4"] += int(pf.tossups_4)
            prow["tossups_neg"] += int(pf.tossups_neg)
            prow["tossups_0"] += int(pf.tossups_0)
            prow["tossup_points"] += int(pf.tossup_points)

    team_ids = {name: idx for idx, name in enumerate(sorted(team_agg.keys()), start=1)}
    player_ids = {key: idx for idx, key in enumerate(sorted(player_agg.keys()), start=1)}

    sorted_teams = sorted(
        team_agg.items(),
        key=lambda kv: (-kv[1]["wins"], -kv[1]["points"], kv[0]),
    )
    team_standings: list[dict[str, Any]] = []
    for rank, (name, row) in enumerate(sorted_teams, start=1):
        games_played = team_games.get(name, 0)
        points_total = row["points"]
        bonuses_heard = row["bonuses_heard"]
        bonus_points = row["bonus_points"]
        team_standings.append(
            {
                "rank": rank,
                "team_id": team_ids[name],
                "name": name,
                "wins": row["wins"],
                "losses": row["losses"],
                "points_per_game": (points_total / games_played) if games_played else 0.0,
                "4s": row["tossups_4"],
                "-4s": row["tossups_neg"],
                "0s": row["tossups_0"],
                "tossups_heard": row["tossups_heard"],
                "bonuses_heard": bonuses_heard,
                "bonus_points": bonus_points,
                "points_per_bonus": (bonus_points / bonuses_heard) if bonuses_heard else 0.0,
            }
        )

    sorted_players = sorted(
        player_agg.items(),
        key=lambda kv: (-kv[1]["tossup_points"], -kv[1]["tossups_4"], kv[0][1], kv[0][0]),
    )
    individual_standings: list[dict[str, Any]] = []
    for rank, ((team, name), row) in enumerate(sorted_players, start=1):
        games_played = player_games.get((team, name), 0)
        points = row["tossup_points"]
        individual_standings.append(
            {
                "rank": rank,
                "player_id": player_ids[(team, name)],
                "name": name,
                "team": team,
                "games_played": games_played,
                "4s": row["tossups_4"],
                "-4s": row["tossups_neg"],
                "0s": row["tossups_0"],
                "tossups_heard": row["tossups_heard"],
                "tossup_points": points,
                "points_per_game": (points / games_played) if games_played else 0.0,
            }
        )

    return StandingsView(team_standings=team_standings, individual_standings=individual_standings)

