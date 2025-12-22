from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from itertools import combinations
from .models import Tournament, Team, Coach, Player, Room, Round, Game
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
    def teams(self, request, pk=None):
        """Get all teams for a tournament."""
        tournament = self.get_object()
        teams = tournament.teams.all()
        serializer = TeamSerializer(teams, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def rooms(self, request, pk=None):
        """Get all rooms for a tournament."""
        tournament = self.get_object()
        rooms = tournament.rooms.all()
        serializer = RoomSerializer(rooms, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def rounds(self, request, pk=None):
        """Get all rounds for a tournament."""
        tournament = self.get_object()
        rounds = tournament.rounds.all()
        serializer = RoundSerializer(rounds, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def games(self, request, pk=None):
        """Get all games for a tournament."""
        tournament = self.get_object()
        games = tournament.games.all()
        serializer = GameSerializer(games, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def generate_schedule(self, request, pk=None):
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
            round_number = 1

            # For each pool, generate round-robin matchups
            for pool_name, pool_teams in pools.items():
                if pool_name == 'Unassigned' or len(pool_teams) < 2:
                    continue

                # Generate all possible matchups (combinations of 2)
                matchups = list(combinations(pool_teams, 2))

                # Create games for each matchup
                for idx, (team1, team2) in enumerate(matchups):
                    # Get or create round
                    round_obj, _ = Round.objects.get_or_create(
                        tournament=tournament,
                        round_number=round_number,
                        defaults={'name': f'Pool {pool_name} - Round {round_number}'}
                    )

                    # Assign to room (rotate through available rooms)
                    room = rooms[idx % len(rooms)]

                    # Create game
                    game = Game.objects.create(
                        tournament=tournament,
                        round=round_obj,
                        room=room,
                        team1=team1,
                        team2=team2
                    )

                    generated_games.append({
                        'id': game.id,
                        'pool': pool_name,
                        'round_number': round_number,
                        'room_name': room.name,
                        'team1_name': team1.name,
                        'team2_name': team2.name,
                    })

                    # Move to next round after filling all rooms
                    if (idx + 1) % len(rooms) == 0:
                        round_number += 1

                # Ensure next pool starts on a new round
                round_number += 1

        return Response({
            'message': f'Successfully generated {len(generated_games)} games across {len(pools) - (1 if "Unassigned" in pools else 0)} pools',
            'games': generated_games,
            'pools': {pool: len(teams) for pool, teams in pools.items() if pool != 'Unassigned'},
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


class RoomViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing rooms."""
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [permissions.AllowAny]


class GameViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing games."""
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [permissions.AllowAny]
