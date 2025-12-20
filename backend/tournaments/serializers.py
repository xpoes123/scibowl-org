from rest_framework import serializers
from .models import Tournament, Team, Player, Room, Round, Game


class TournamentDirectorSerializer(serializers.Serializer):
    """Serializer for tournament director info."""
    id = serializers.IntegerField()
    username = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    bio = serializers.CharField()
    school = serializers.CharField()


class TournamentListSerializer(serializers.ModelSerializer):
    """Serializer for tournament list view."""
    class Meta:
        model = Tournament
        fields = [
            'id', 'name', 'description', 'division', 'format', 'status',
            'tournament_date', 'registration_deadline', 'location', 'venue',
            'host_organization', 'max_teams', 'current_teams',
            'website_url', 'registration_url'
        ]


class TournamentDetailSerializer(serializers.ModelSerializer):
    """Serializer for tournament detail view with related data."""
    teams_count = serializers.SerializerMethodField()
    rooms_count = serializers.SerializerMethodField()
    director = serializers.SerializerMethodField()

    class Meta:
        model = Tournament
        fields = [
            'id', 'name', 'description', 'division', 'format', 'status',
            'tournament_date', 'registration_deadline', 'location', 'venue',
            'host_organization', 'max_teams', 'current_teams',
            'website_url', 'registration_url',
            'teams_count', 'rooms_count', 'director', 'created_at', 'updated_at'
        ]

    def get_teams_count(self, obj):
        return obj.teams.count()

    def get_rooms_count(self, obj):
        return obj.rooms.count()

    def get_director(self, obj):
        if obj.tournament_director:
            return TournamentDirectorSerializer(obj.tournament_director).data
        return None


class TeamSerializer(serializers.ModelSerializer):
    """Serializer for teams."""
    players_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Team
        fields = ['id', 'name', 'school', 'seed', 'players_count']
    
    def get_players_count(self, obj):
        return obj.players.count()


class PlayerSerializer(serializers.ModelSerializer):
    """Serializer for players."""
    team_name = serializers.CharField(source='team.name', read_only=True)
    accuracy = serializers.ReadOnlyField()
    
    class Meta:
        model = Player
        fields = [
            'id', 'name', 'grade_level', 'team_name',
            'total_points', 'tossups_heard', 'correct_buzzes', 'incorrect_buzzes',
            'accuracy'
        ]


class RoomSerializer(serializers.ModelSerializer):
    """Serializer for rooms."""
    class Meta:
        model = Room
        fields = ['id', 'name', 'status', 'current_round']


class RoundSerializer(serializers.ModelSerializer):
    """Serializer for rounds."""
    class Meta:
        model = Round
        fields = ['id', 'round_number', 'name', 'packet_name']


class GameSerializer(serializers.ModelSerializer):
    """Serializer for games."""
    team1_name = serializers.CharField(source='team1.name', read_only=True)
    team2_name = serializers.CharField(source='team2.name', read_only=True)
    round_number = serializers.IntegerField(source='round.round_number', read_only=True)
    room_name = serializers.CharField(source='room.name', read_only=True)
    winner_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Game
        fields = [
            'id', 'round_number', 'room_name',
            'team1_name', 'team2_name', 'team1_score', 'team2_score',
            'current_tossup', 'is_complete', 'winner_name',
            'started_at', 'completed_at'
        ]
    
    def get_winner_name(self, obj):
        winner = obj.winner
        return winner.name if winner else None
