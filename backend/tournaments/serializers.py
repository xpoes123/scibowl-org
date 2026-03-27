from rest_framework import serializers
from .models import Tournament, Team, Player, Room, Round, TournamentContact, TournamentLink, TournamentDeadline


# ---------------------------------------------------------------------------
# Public tournament serializers
# These match the Tournament / TournamentSummary TypeScript interfaces in
# apps/website/frontend/src/features/tournaments/types.ts.
# ---------------------------------------------------------------------------

class TournamentContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = TournamentContact
        fields = ['type', 'value', 'label']


class TournamentLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = TournamentLink
        fields = ['type', 'url', 'label']


class TournamentDeadlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = TournamentDeadline
        fields = ['label', 'date']


class PublicTournamentSummarySerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for the tournament listing.
    Matches the TournamentSummary TypeScript interface.
    """
    # Map publication_status → status to match the frontend shape.
    status = serializers.CharField(source='publication_status')
    dates = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()

    class Meta:
        model = Tournament
        fields = [
            'slug', 'name', 'status', 'mode', 'timezone',
            'dates', 'divisions', 'location', 'updated_at',
        ]

    def get_dates(self, obj):
        return {
            'start': obj.start_date.isoformat(),
            # end_date is null for single-day events; fall back to start_date.
            'end': (obj.end_date or obj.start_date).isoformat(),
        }

    def get_location(self, obj):
        if obj.mode == 'ONLINE':
            return None
        if not obj.location_city and not obj.location_state:
            return None
        loc = {'city': obj.location_city, 'state': obj.location_state}
        if obj.location_address:
            loc['address'] = obj.location_address
        return loc


class PublicTournamentDetailSerializer(PublicTournamentSummarySerializer):
    """
    Full serializer for the tournament detail page.
    Matches the Tournament TypeScript interface.
    """
    notes = serializers.SerializerMethodField()
    # 'format' here is the display summary, not the bracket-type model field.
    format = serializers.SerializerMethodField()
    contacts = TournamentContactSerializer(many=True)
    registration = serializers.SerializerMethodField()
    links = TournamentLinkSerializer(many=True)

    class Meta(PublicTournamentSummarySerializer.Meta):
        fields = PublicTournamentSummarySerializer.Meta.fields + [
            'difficulty', 'notes', 'format', 'contacts', 'registration', 'links',
        ]

    def get_notes(self, obj):
        if not obj.notes_logistics and not obj.notes_writing_team:
            return None
        notes = {}
        if obj.notes_logistics:
            notes['logistics'] = obj.notes_logistics
        if obj.notes_writing_team:
            notes['writing_team'] = obj.notes_writing_team
        return notes

    def get_format(self, obj):
        fmt = {'summary': obj.format_summary}
        if obj.rounds_guaranteed is not None:
            fmt['rounds_guaranteed'] = obj.rounds_guaranteed
        return fmt

    def get_registration(self, obj):
        if not obj.registration_method:
            return None
        deadlines = TournamentDeadlineSerializer(obj.deadlines.all(), many=True).data
        reg = {
            'method': obj.registration_method,
            'instructions': obj.registration_instructions,
            'deadlines': list(deadlines),
        }
        if obj.registration_url:
            reg['url'] = obj.registration_url
        if obj.registration_cost:
            reg['cost'] = obj.registration_cost
        return reg


# ---------------------------------------------------------------------------
# Internal / admin serializers (used by team management, room, schedule endpoints)
# ---------------------------------------------------------------------------

class TeamSerializer(serializers.ModelSerializer):
    """Serializer for teams."""
    players_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'school', 'pool', 'players_count']

    def get_players_count(self, obj):
        return obj.players.count()


class PlayerSerializer(serializers.ModelSerializer):
    """Serializer for players."""
    team_name = serializers.CharField(source='team.name', read_only=True)

    class Meta:
        model = Player
        fields = ['id', 'name', 'grade_level', 'team_name']


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
