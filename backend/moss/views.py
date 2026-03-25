from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction

from django.conf import settings

from .models import Game, GameTeam, Scoresheet, ScoresheetEvent
from tournaments.models import Team
from .serializers import (
    ScoresheetEventOutSerializer,
    ScoresheetEventPostSerializer,
)
from .services.snapshots import maybe_write_snapshot


class ScoresheetCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = getattr(settings, "MOSS_API_TOKEN", None)
        if token:
            if request.META.get("HTTP_X_MOSS_API_TOKEN", "") != token:
                return Response({"detail": "Unauthorized."}, status=status.HTTP_403_FORBIDDEN)

        tournament_slug = request.data.get("tournament_slug")
        team_a_name = (request.data.get("team_a_name") or "").strip() or "Team A"
        team_b_name = (request.data.get("team_b_name") or "").strip() or "Team B"

        if not tournament_slug:
            return Response({"detail": "tournament_slug is required."}, status=status.HTTP_400_BAD_REQUEST)

        from tournaments.models import Tournament
        try:
            tournament = Tournament.objects.get(slug=tournament_slug)
        except Tournament.DoesNotExist:
            return Response({"detail": "Tournament not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            game = Game.objects.create(tournament=tournament)
            scoresheet = Scoresheet.objects.create(game=game)
            for slot, name in enumerate([team_a_name, team_b_name], start=1):
                team, _ = Team.objects.get_or_create(tournament=tournament, name=name, defaults={"school": ""})
                GameTeam.objects.create(game=game, tournament_team=team, slot=slot)

        return Response({"scoresheet_id": scoresheet.id, "game_id": game.id}, status=status.HTTP_201_CREATED)


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

            def _enqueue_snapshot(scoresheet_pk: int, snapshot_seq: int) -> None:
                try:
                    maybe_write_snapshot(scoresheet_pk, snapshot_seq, reason="interval")
                except Exception:
                    # Snapshot failures should not block event append.
                    return

            transaction.on_commit(lambda: _enqueue_snapshot(scoresheet.id, seq))

        out = ScoresheetEventOutSerializer(event).data
        return Response({
            "scoresheet_id": scoresheet.id,
            "duplicate": False,
            "event": out,
            "next_seq": scoresheet.next_seq,
        }, status=status.HTTP_201_CREATED)
