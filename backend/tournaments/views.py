from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from pathlib import Path
import json
import re
from .models import Tournament, Team, Player, Room, Round
from moss import models as moss_models
from moss.serializers import MossGameSerializer
from .serializers import (
    PublicTournamentSummarySerializer, PublicTournamentDetailSerializer,
    TeamSerializer, PlayerSerializer, RoomSerializer,
    RoundSerializer,
)


_SLUG_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")


def _load_static_standings(*, tournament_slug: str) -> dict | None:
    """
    Load generated standings from the repo-level `stats/<slug>/standings.json` folder.

    This allows the website Results tab to work without requiring a database-backed tournament.
    """
    if not tournament_slug or not _SLUG_RE.fullmatch(tournament_slug):
        return None

    # In Django settings, BASE_DIR points at `<repo>/backend`.
    stats_root = Path(settings.BASE_DIR).parent / "stats"
    standings_path = stats_root / tournament_slug / "standings.json"
    if not standings_path.exists():
        return None

    try:
        with standings_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, json.JSONDecodeError):
        # Treat malformed artifacts as missing so we can fall back to DB behavior.
        return None

    if not isinstance(payload, dict):
        return None
    return payload


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
            return PublicTournamentSummarySerializer
        return PublicTournamentDetailSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300, stale-if-error=604800'
        return response

    def get_queryset(self):
        # Only surface PUBLISHED tournaments on the public API.
        queryset = Tournament.objects.filter(publication_status='PUBLISHED')

        # Prefetch related objects for the detail view to avoid N+1 queries.
        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('contacts', 'links', 'deadlines')

        # Filter by lifecycle status (supports comma-separated values).
        status = self.request.query_params.get('status', None)
        if status:
            status_list = [s.strip() for s in status.split(',')]
            queryset = queryset.filter(status__in=status_list)

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
        games = moss_models.Game.objects.filter(tournament=tournament).prefetch_related(
            'game_teams__tournament_team', 'room'
        )
        serializer = MossGameSerializer(games, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def standings(self, request, *args, **kwargs):
        """
        Aggregate standings from moss fact tables for this tournament.

        Returns both team standings and individual standings suitable for the website Results tab.
        """
        raw_slug = self.kwargs.get(self.lookup_field) or ""
        static_payload = _load_static_standings(tournament_slug=str(raw_slug))
        if static_payload is not None:
            return Response(static_payload)

        return Response(
            {"detail": "Standings not found. Generate stats/<slug>/standings.json for this tournament."},
            status=status.HTTP_404_NOT_FOUND,
        )

    @action(detail=True, methods=['delete'])
    def clear_schedule(self, request, *args, **kwargs):
        """
        Delete all games and rounds for this tournament.
        """
        tournament = self.get_object()

        games_count = moss_models.Game.objects.filter(tournament=tournament).count()
        rounds_count = tournament.rounds.count()

        moss_models.Game.objects.filter(tournament=tournament).delete()
        tournament.rounds.all().delete()

        return Response({
            'message': f'Deleted {games_count} games and {rounds_count} rounds',
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
        existing_games_count = moss_models.Game.objects.filter(tournament=tournament).count()
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
            moss_team_by_team_id = {team.id: team for team in teams}

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

                            moss_game = moss_models.Game.objects.create(
                                tournament=tournament,
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
                                'id': moss_game.id,
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


