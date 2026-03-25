from django.contrib import admin
from .models import Tournament, Team, Player, Room, Round


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ['name', 'division', 'status', 'tournament_date', 'location', 'question_set_version', 'current_teams', 'max_teams']
    list_filter = ['status', 'division', 'format', 'tournament_date']
    search_fields = ['name', 'location', 'host_organization']
    date_hierarchy = 'tournament_date'
    raw_id_fields = ['question_set_version']


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'school', 'tournament', 'pool']
    list_filter = ['tournament']
    search_fields = ['name', 'school']



@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['name', 'team', 'grade_level']
    list_filter = ['team__tournament', 'grade_level']
    search_fields = ['name', 'team__name']


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'tournament', 'status', 'current_round']
    list_filter = ['tournament', 'status']
    search_fields = ['name']


@admin.register(Round)
class RoundAdmin(admin.ModelAdmin):
    list_display = ['tournament', 'round_number', 'name', 'packet_name']
    list_filter = ['tournament']
    search_fields = ['name', 'packet_name']


