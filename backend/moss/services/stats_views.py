from __future__ import annotations

from django.db.models import Case, Count, F, IntegerField, Sum, When
from django.db.models.expressions import OuterRef, Subquery
from django.db.models.functions import Coalesce

from moss import models as moss_models
from tournaments.models import Tournament


def build_tournament_standings_view(*, tournament: Tournament, using: str = "default") -> dict:
    """
    Aggregate standings from MoSS fact tables for the given tournament.

    Shape matches the website's `TournamentStandingsResponse`.
    """

    team_fact_model = moss_models.GameTeamFact
    player_fact_model = moss_models.GamePlayerFact

    # Team standings.
    opp_points = Subquery(
        team_fact_model.objects.using(using).filter(game_id=OuterRef("game_id"))
        .exclude(tournament_team_id=OuterRef("tournament_team_id"))
        .values("points")[:1]
    )
    base = (
        team_fact_model.objects.using(using)
        .filter(game__tournament=tournament)
        .annotate(opp_points=opp_points)
    )

    team_rows = (
        base.values("tournament_team_id", "tournament_team__name")
        .annotate(
            games_played=Count("game_id", distinct=True),
            wins=Coalesce(
                Sum(
                    Case(
                        When(points__gt=F("opp_points"), then=1),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                0,
            ),
            losses=Coalesce(
                Sum(
                    Case(
                        When(points__lt=F("opp_points"), then=1),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                0,
            ),
            points=Coalesce(Sum("points"), 0),
            tossups_heard=Coalesce(Sum("tossups_heard"), 0),
            tossups_4=Coalesce(Sum("tossups_4"), 0),
            tossups_neg=Coalesce(Sum("tossups_neg"), 0),
            tossups_0=Coalesce(Sum("tossups_0"), 0),
            bonuses_heard=Coalesce(Sum("bonuses_heard"), 0),
            bonus_points=Coalesce(Sum("bonus_points"), 0),
        )
        .order_by("-wins", "-points", "tournament_team__name")
    )

    team_standings = []
    for idx, row in enumerate(team_rows, start=1):
        games_played = int(row["games_played"] or 0)
        points = int(row["points"] or 0)
        bonuses_heard = int(row["bonuses_heard"] or 0)
        bonus_points = int(row["bonus_points"] or 0)
        team_standings.append(
            {
                "rank": idx,
                "team_id": row["tournament_team_id"],
                "name": row["tournament_team__name"],
                "wins": int(row["wins"] or 0),
                "losses": int(row["losses"] or 0),
                "points_per_game": (points / games_played) if games_played else 0.0,
                "4s": int(row["tossups_4"] or 0),
                "-4s": int(row["tossups_neg"] or 0),
                "0s": int(row["tossups_0"] or 0),
                "tossups_heard": int(row["tossups_heard"] or 0),
                "bonuses_heard": bonuses_heard,
                "bonus_points": bonus_points,
                "points_per_bonus": (bonus_points / bonuses_heard) if bonuses_heard else 0.0,
            }
        )

    # Individual standings.
    player_rows = (
        player_fact_model.objects.using(using).filter(game__tournament=tournament)
        .values(
            "tournament_player_id",
            "tournament_player__name",
            "tournament_team__name",
        )
        .annotate(
            games_played=Count("game_id", distinct=True),
            tossups_heard=Coalesce(Sum("tossups_heard"), 0),
            tossups_4=Coalesce(Sum("tossups_4"), 0),
            tossups_neg=Coalesce(Sum("tossups_neg"), 0),
            tossups_0=Coalesce(Sum("tossups_0"), 0),
            tossup_points=Coalesce(Sum("tossup_points"), 0),
        )
        .order_by("-tossup_points", "-tossups_4", "tournament_player__name")
    )

    individual_standings = []
    for idx, row in enumerate(player_rows, start=1):
        games_played = int(row["games_played"] or 0)
        tossup_points = int(row["tossup_points"] or 0)
        individual_standings.append(
            {
                "rank": idx,
                "player_id": row["tournament_player_id"],
                "name": row["tournament_player__name"],
                "team": row["tournament_team__name"],
                "games_played": games_played,
                "4s": int(row["tossups_4"] or 0),
                "-4s": int(row["tossups_neg"] or 0),
                "0s": int(row["tossups_0"] or 0),
                "tossups_heard": int(row["tossups_heard"] or 0),
                "tossup_points": tossup_points,
                "points_per_game": (tossup_points / games_played) if games_played else 0.0,
            }
        )

    return {
        "tournament": {"id": tournament.id, "slug": tournament.slug, "name": tournament.name},
        "team_standings": team_standings,
        "individual_standings": individual_standings,
    }
