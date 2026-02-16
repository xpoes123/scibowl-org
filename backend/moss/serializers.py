from rest_framework import serializers

from . import event_types, validators
from .models import ScoresheetEvent


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
