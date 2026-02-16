from __future__ import annotations

from typing import Any

from django.db import transaction

from ..models import Scoresheet, ScoresheetSnapshot
from ..reducer import initial_state, reduce_events

SNAPSHOT_INTERVAL = 50


def build_state(scoresheet: Scoresheet, upto_seq: int | None = None) -> dict[str, Any]:
    latest_snapshot = scoresheet.snapshots.order_by("-seq").first()
    base_state = initial_state()
    last_seq = 0

    if latest_snapshot and (upto_seq is None or latest_snapshot.seq <= upto_seq):
        base_state = latest_snapshot.state
        last_seq = latest_snapshot.seq

    events = scoresheet.events.filter(seq__gt=last_seq).order_by("seq")
    if upto_seq is not None:
        events = events.filter(seq__lte=upto_seq)

    return reduce_events(events, base_state)


def maybe_write_snapshot(scoresheet_id: int, upto_seq: int, reason: str = "interval") -> ScoresheetSnapshot | None:
    with transaction.atomic():
        scoresheet = Scoresheet.objects.select_for_update().get(pk=scoresheet_id)

        latest_seq = scoresheet.latest_snapshot_seq or 0
        if reason == "interval" and upto_seq - latest_seq < SNAPSHOT_INTERVAL:
            return None

        existing = ScoresheetSnapshot.objects.filter(scoresheet=scoresheet, seq=upto_seq).first()
        if existing:
            return existing

        state = build_state(scoresheet, upto_seq=upto_seq)
        snapshot = ScoresheetSnapshot.objects.create(
            scoresheet=scoresheet,
            seq=upto_seq,
            state=state,
            reason=reason,
        )

        scoresheet.latest_snapshot_seq = upto_seq
        scoresheet.save(update_fields=["latest_snapshot_seq", "updated_at"])
        return snapshot
