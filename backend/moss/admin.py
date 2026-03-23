from django.contrib import admin

from . import models


@admin.register(models.Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ["id", "tournament", "status", "round", "room", "started_at", "completed_at"]
    list_filter = ["tournament", "status"]


@admin.register(models.GameTeam)
class GameTeamAdmin(admin.ModelAdmin):
    list_display = ["game", "tournament_team", "slot", "score_cached"]
    list_filter = ["game__tournament", "slot"]


@admin.register(models.Scoresheet)
class ScoresheetAdmin(admin.ModelAdmin):
    list_display = ["id", "game", "schema_version", "next_seq", "latest_snapshot_seq"]
    list_filter = ["schema_version"]


@admin.register(models.ScoresheetEvent)
class ScoresheetEventAdmin(admin.ModelAdmin):
    list_display = ["scoresheet", "seq", "event_type", "event_version", "client_event_id", "created_at"]
    list_filter = ["event_type"]
    search_fields = ["client_event_id", "event_type"]


@admin.register(models.ScoresheetSnapshot)
class ScoresheetSnapshotAdmin(admin.ModelAdmin):
    list_display = ["scoresheet", "seq", "reason", "created_at"]
