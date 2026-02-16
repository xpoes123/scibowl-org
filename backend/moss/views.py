from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction

from .models import Scoresheet, ScoresheetEvent
from .serializers import (
    ScoresheetEventOutSerializer,
    ScoresheetEventPostSerializer,
)


class ScoresheetEventsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, scoresheet_id: int):
        try:
            scoresheet = Scoresheet.objects.get(pk=scoresheet_id)
        except Scoresheet.DoesNotExist:
            return Response({"detail": "Scoresheet not found."}, status=status.HTTP_404_NOT_FOUND)

        after_seq_raw = request.query_params.get("after_seq", "0")
        limit_raw = request.query_params.get("limit", "500")
        try:
            after_seq = int(after_seq_raw)
        except (TypeError, ValueError):
            return Response({"detail": "after_seq must be an integer."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            limit = int(limit_raw)
        except (TypeError, ValueError):
            return Response({"detail": "limit must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        if after_seq < 0:
            return Response({"detail": "after_seq must be >= 0."}, status=status.HTTP_400_BAD_REQUEST)
        if limit < 1:
            return Response({"detail": "limit must be >= 1."}, status=status.HTTP_400_BAD_REQUEST)

        limit = min(limit, 500)

        events = (
            scoresheet.events.filter(seq__gt=after_seq)
            .order_by("seq")[:limit]
        )
        serializer = ScoresheetEventOutSerializer(events, many=True)
        return Response({
            "scoresheet_id": scoresheet.id,
            "after_seq": after_seq,
            "next_seq": scoresheet.next_seq,
            "events": serializer.data,
        })

    def post(self, request, scoresheet_id: int):
        serializer = ScoresheetEventPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        expected_next_seq = serializer.validated_data.get("expected_next_seq")
        event_data = serializer.validated_data["event"]

        client_event_id = event_data["client_event_id"]
        event_type = event_data["type"]
        event_version = event_data["version"]
        payload = event_data["payload"]
        client_ts = event_data.get("client_ts")

        with transaction.atomic():
            try:
                scoresheet = Scoresheet.objects.select_for_update().get(pk=scoresheet_id)
            except Scoresheet.DoesNotExist:
                return Response({"detail": "Scoresheet not found."}, status=status.HTTP_404_NOT_FOUND)

            existing = ScoresheetEvent.objects.filter(
                scoresheet=scoresheet,
                client_event_id=client_event_id,
            ).first()

            if existing:
                if (
                    existing.event_type != event_type
                    or existing.event_version != event_version
                    or existing.payload != payload
                ):
                    return Response(
                        {"detail": "client_event_id already exists with different payload."},
                        status=status.HTTP_409_CONFLICT,
                    )
                out = ScoresheetEventOutSerializer(existing).data
                return Response({
                    "scoresheet_id": scoresheet.id,
                    "duplicate": True,
                    "event": out,
                    "next_seq": scoresheet.next_seq,
                }, status=status.HTTP_200_OK)

            if expected_next_seq is not None and expected_next_seq != scoresheet.next_seq:
                return Response(
                    {"detail": "expected_next_seq does not match."},
                    status=status.HTTP_409_CONFLICT,
                )

            seq = scoresheet.next_seq
            actor_user = request.user if request.user.is_authenticated else None
            event = ScoresheetEvent.objects.create(
                scoresheet=scoresheet,
                seq=seq,
                client_event_id=client_event_id,
                event_type=event_type,
                event_version=event_version,
                payload=payload,
                actor_user=actor_user,
                client_ts=client_ts,
            )
            scoresheet.next_seq = seq + 1
            scoresheet.save(update_fields=["next_seq", "updated_at"])

        out = ScoresheetEventOutSerializer(event).data
        return Response({
            "scoresheet_id": scoresheet.id,
            "duplicate": False,
            "event": out,
            "next_seq": scoresheet.next_seq,
        }, status=status.HTTP_201_CREATED)
