from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Tournament, Team, Player, Room, Round, Game
from .serializers import (
    TournamentListSerializer, TournamentDetailSerializer,
    TeamSerializer, PlayerSerializer, RoomSerializer,
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


class TeamViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing teams."""
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
