from rest_framework import serializers

from . import event_types, validators
from .models import Game, GameTeam, ScoresheetEvent


class ScoresheetEventInSerializer(serializers.Serializer):
    client_event_id = serializers.UUIDField()
    type = serializers.CharField()
    version = serializers.IntegerField(min_value=1, default=1, required=False)
    client_ts = serializers.DateTimeField(required=False, allow_null=True)
    payload = serializers.JSONField()

    def validate_type(self, value: str) -> str:
        if value not in event_types.EVENT_TYPES:
            raise serializers.ValidationError("unsupported event type")
        return value

    def validate(self, attrs: dict) -> dict:
        validators.validate_event_payload(attrs["type"], attrs.get("payload"))
        return attrs


class ScoresheetEventPostSerializer(serializers.Serializer):
    expected_next_seq = serializers.IntegerField(min_value=1, required=False)
    event = ScoresheetEventInSerializer()


class MossGameTeamSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="tournament_team.name")
    score = serializers.IntegerField(source="score_cached")

    class Meta:
        model = GameTeam
        fields = ["slot", "team_name", "score"]


class MossGameSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True, allow_null=True)
    teams = MossGameTeamSerializer(source="game_teams", many=True, read_only=True)

    class Meta:
        model = Game
        fields = [
            "id", "status", "room", "room_name", "teams",
            "pairs_played", "started_at", "completed_at", "created_at",
        ]


class ScoresheetEventOutSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="event_type")
    version = serializers.IntegerField(source="event_version")

    class Meta:
        model = ScoresheetEvent
        fields = [
            "seq",
            "client_event_id",
            "type",
            "version",
            "payload",
            "client_ts",
            "created_at",
        ]
