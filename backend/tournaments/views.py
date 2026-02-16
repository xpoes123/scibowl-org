from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Case, Count, F, IntegerField, Sum, When
from django.db.models.functions import Coalesce
from django.db.models.expressions import OuterRef, Subquery
from .models import Tournament, Team, Coach, Player, Room, Round, Game
from moss import models as moss_models
from .serializers import (
    TournamentListSerializer, TournamentDetailSerializer,
    TeamSerializer, CoachSerializer, PlayerSerializer, RoomSerializer,
    RoundSerializer, GameSerializer
)


class TournamentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing tournaments.
    List and retrieve operations only (read-only for MVP).
    """
    queryset = Tournament.objects.all()
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_object(self):
        """
        Lookup tournaments by slug, with a backward-compatible fallback to numeric id.
        """
        queryset = self.filter_queryset(self.get_queryset())
        raw = self.kwargs.get(self.lookup_field)
        if raw is None:
            return super().get_object()

        if isinstance(raw, str) and raw.isdigit():
            obj = queryset.filter(slug=raw).first()
            if obj is not None:
                return obj
            return get_object_or_404(queryset, pk=int(raw))

        return get_object_or_404(queryset, slug=raw)
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TournamentListSerializer
        return TournamentDetailSerializer
    
    def get_queryset(self):
        queryset = Tournament.objects.all()

        # Filter by status (supports comma-separated values)
        status = self.request.query_params.get('status', None)
        if status:
            status_list = [s.strip() for s in status.split(',')]
            queryset = queryset.filter(status__in=status_list)

        # Filter by division
        division = self.request.query_params.get('division', None)
        if division:
            queryset = queryset.filter(division=division)

        return queryset
    
    @action(detail=True, methods=['get'])
    def teams(self, request, *args, **kwargs):
        """Get all teams for a tournament."""
        tournament = self.get_object()
        teams = tournament.teams.all()
        serializer = TeamSerializer(teams, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def rooms(self, request, *args, **kwargs):
        """Get all rooms for a tournament."""
        tournament = self.get_object()
        rooms = tournament.rooms.all()
        serializer = RoomSerializer(rooms, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def rounds(self, request, *args, **kwargs):
        """Get all rounds for a tournament."""
        tournament = self.get_object()
        rounds = tournament.rounds.all()
        serializer = RoundSerializer(rounds, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def games(self, request, *args, **kwargs):
        """Get all games for a tournament."""
        tournament = self.get_object()
        games = tournament.games.all()
        serializer = GameSerializer(games, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def standings(self, request, *args, **kwargs):
        """
        Aggregate standings from moss fact tables for this tournament.

        Returns both team standings and individual standings suitable for the website Results tab.
        """
        tournament = self.get_object()

        team_fact_model = moss_models.GameTeamFact
        player_fact_model = moss_models.GamePlayerFact

        # Team standings.
        opp_points = Subquery(
            team_fact_model.objects.filter(game_id=OuterRef("game_id"))
            .exclude(tournament_team_id=OuterRef("tournament_team_id"))
            .values("points")[:1]
        )
        base = team_fact_model.objects.filter(game__tournament=tournament).annotate(opp_points=opp_points)

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
            player_fact_model.objects.filter(game__tournament=tournament)
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

        return Response(
            {
                "tournament": {"id": tournament.id, "slug": tournament.slug, "name": tournament.name},
                "team_standings": team_standings,
                "individual_standings": individual_standings,
            }
        )

    @action(detail=True, methods=['delete'])
    def clear_schedule(self, request, *args, **kwargs):
        """
        Delete all games and rounds for this tournament.
        """
        tournament = self.get_object()

        games_count = tournament.games.count()
        rounds_count = tournament.rounds.count()
        moss_games_count = moss_models.Game.objects.filter(tournament=tournament).count()

        tournament.games.all().delete()
        tournament.rounds.all().delete()
        moss_models.Game.objects.filter(tournament=tournament).delete()

        return Response({
            'message': f'Deleted {games_count} games and {rounds_count} rounds',
            'moss_games_deleted': moss_games_count,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def generate_schedule(self, request, *args, **kwargs):
        """
        Generate round-robin matches for all pools in the tournament.
        Creates Game objects for all teams in each pool to play each other once.
        """
        tournament = self.get_object()

        # Get all teams grouped by pool
        teams = tournament.teams.all()
        pools = {}
        for team in teams:
            pool_name = team.pool or 'Unassigned'
            if pool_name not in pools:
                pools[pool_name] = []
            pools[pool_name].append(team)

        # Check if any games already exist
        existing_games_count = tournament.games.count()
        if existing_games_count > 0:
            return Response(
                {'error': f'Tournament already has {existing_games_count} games. Delete existing games first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if rooms exist
        rooms = list(tournament.rooms.all())
        if not rooms:
            return Response(
                {'error': 'No rooms configured. Please add rooms before generating schedule.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        generated_games = []

        with transaction.atomic():
            moss_team_by_team_id = {}
            for team in teams:
                defaults = {
                    "school": team.school or "",
                    "pool": team.pool or "",
                }
                moss_team, _ = moss_models.TournamentTeam.objects.get_or_create(
                    tournament=tournament,
                    name=team.name,
                    defaults=defaults,
                )
                update_fields = []
                if moss_team.school != defaults["school"]:
                    moss_team.school = defaults["school"]
                    update_fields.append("school")
                if moss_team.pool != defaults["pool"]:
                    moss_team.pool = defaults["pool"]
                    update_fields.append("pool")
                if update_fields:
                    moss_team.save(update_fields=update_fields)
                moss_team_by_team_id[team.id] = moss_team

            # Generate round-robin schedules for each pool using round-robin algorithm
            from collections import deque

            pool_round_schedules = {}
            for pool_name, pool_teams in pools.items():
                if pool_name == 'Unassigned' or len(pool_teams) < 2:
                    continue

                # Round-robin scheduling algorithm
                # For even number of teams, use standard round-robin
                # For odd number, add a "bye" team
                teams_list = list(pool_teams)
                if len(teams_list) % 2 == 1:
                    teams_list.append(None)  # Add bye

                num_teams = len(teams_list)
                num_rounds = num_teams - 1
                games_per_round = num_teams // 2

                pool_round_schedules[pool_name] = []

                # Use circle method for round-robin scheduling
                # Fix first team, rotate others
                for round_num in range(num_rounds):
                    round_games = []
                    for game_num in range(games_per_round):
                        if game_num == 0:
                            # First game: fixed team vs team at end of rotation
                            team1 = teams_list[0]
                            team2 = teams_list[num_teams - 1]
                        else:
                            # Other games: pairs from the rotating part
                            team1 = teams_list[game_num]
                            team2 = teams_list[num_teams - 1 - game_num]

                        # Skip games with bye
                        if team1 is not None and team2 is not None:
                            round_games.append((team1, team2))

                    pool_round_schedules[pool_name].append(round_games)

                    # Rotate all teams except the first one
                    teams_list = [teams_list[0]] + [teams_list[-1]] + teams_list[1:-1]

            # Find maximum number of rounds needed (same for all pools in round-robin)
            max_rounds = max(len(rounds) for rounds in pool_round_schedules.values()) if pool_round_schedules else 0

            # Create games round by round
            # Each tournament round contains one round of games from EACH pool
            room_idx = 0
            for round_num in range(max_rounds):
                round_number = round_num + 1

                # Get or create the round
                round_obj, _ = Round.objects.get_or_create(
                    tournament=tournament,
                    round_number=round_number,
                    defaults={'name': f'Round {round_number}'}
                )

                # Create all games for this round across all pools
                # Each pool contributes its round_num-th set of games to this tournament round
                for pool_name in sorted(pool_round_schedules.keys()):
                    if round_num < len(pool_round_schedules[pool_name]):
                        round_games = pool_round_schedules[pool_name][round_num]

                        for team1, team2 in round_games:
                            # Assign to room (rotate through available rooms)
                            room = rooms[room_idx % len(rooms)]
                            room_idx += 1

                            # Create game
                            game = Game.objects.create(
                                tournament=tournament,
                                round=round_obj,
                                room=room,
                                team1=team1,
                                team2=team2,
                                pool=pool_name  # Store the pool assignment at game creation
                            )

                            moss_game = moss_models.Game.objects.create(
                                tournament=tournament,
                                round=round_obj,
                                room=room,
                                status="SCHEDULED",
                            )
                            moss_models.GameTeam.objects.create(
                                game=moss_game,
                                tournament_team=moss_team_by_team_id[team1.id],
                                slot=1,
                            )
                            moss_models.GameTeam.objects.create(
                                game=moss_game,
                                tournament_team=moss_team_by_team_id[team2.id],
                                slot=2,
                            )
                            moss_models.Scoresheet.objects.create(game=moss_game)

                            generated_games.append({
                                'id': game.id,
                                'pool': pool_name,
                                'round_number': round_number,
                                'room_name': room.name,
                                'team1_name': team1.name,
                                'team2_name': team2.name,
                            })

        # Build pool info for response
        pool_info = {}
        for pool_name, pool_teams in pools.items():
            if pool_name != 'Unassigned':
                pool_info[pool_name] = {
                    'team_count': len(pool_teams),
                    'teams': [t.name for t in pool_teams]
                }

        return Response({
            'message': f'Successfully generated {len(generated_games)} games across {len(pools) - (1 if "Unassigned" in pools else 0)} pools',
            'games': generated_games,
            'pool_info': pool_info,
        }, status=status.HTTP_201_CREATED)


class TeamViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing teams.
    Supports full CRUD operations.
    """
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['get'])
    def players(self, request, pk=None):
        """Get all players for a team."""
        team = self.get_object()
        players = team.players.all()
        serializer = PlayerSerializer(players, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def coaches(self, request, pk=None):
        """Get all coaches for a team."""
        team = self.get_object()
        coaches = team.coaches.all()
        serializer = CoachSerializer(coaches, many=True)
        return Response(serializer.data)


class CoachViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing coaches.
    Supports full CRUD operations.
    """
    queryset = Coach.objects.all()
    serializer_class = CoachSerializer
    permission_classes = [permissions.AllowAny]


class PlayerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing players.
    Supports full CRUD operations.
    """
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [permissions.AllowAny]


class RoomViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing rooms.
    Supports full CRUD operations.
    """
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [permissions.AllowAny]


class GameViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing games.
    Allows updating room assignments.
    """
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [permissions.AllowAny]
    http_method_names = ['get', 'patch', 'head', 'options']  # Only allow GET and PATCH
