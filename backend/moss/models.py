from django.conf import settings
from django.db import models


class TournamentTeam(models.Model):
    tournament = models.ForeignKey(
        "tournaments.Tournament",
        on_delete=models.CASCADE,
        related_name="moss_teams",
    )
    name = models.CharField(max_length=255)
    school = models.CharField(max_length=255, blank=True)
    pool = models.CharField(
        max_length=10,
        blank=True,
        help_text="Pool/Group assignment (e.g., 'A', 'B', 'C')",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ["tournament", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.tournament.name})"


class TournamentPlayer(models.Model):
    tournament_team = models.ForeignKey(
        TournamentTeam,
        on_delete=models.CASCADE,
        related_name="players",
    )
    name = models.CharField(max_length=255)
    grade_level = models.CharField(max_length=50, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ["tournament_team", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.tournament_team.name})"


class Game(models.Model):
    STATUS_CHOICES = [
        ("SCHEDULED", "Scheduled"),
        ("IN_PROGRESS", "In Progress"),
        ("COMPLETED", "Completed"),
    ]

    tournament = models.ForeignKey(
        "tournaments.Tournament",
        on_delete=models.CASCADE,
        related_name="moss_games",
    )
    round = models.ForeignKey(
        "tournaments.Round",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moss_games",
    )
    room = models.ForeignKey(
        "tournaments.Room",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moss_games",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="SCHEDULED")

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"Game {self.id} ({self.tournament.name})"


class GameTeam(models.Model):
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="game_teams",
    )
    tournament_team = models.ForeignKey(
        TournamentTeam,
        on_delete=models.CASCADE,
        related_name="game_teams",
    )
    slot = models.PositiveSmallIntegerField()
    score_cached = models.IntegerField(default=0)

    class Meta:
        ordering = ["slot"]
        unique_together = [
            ("game", "slot"),
            ("game", "tournament_team"),
        ]

    def __str__(self) -> str:
        return f"{self.game_id}: {self.tournament_team.name} (slot {self.slot})"


class Scoresheet(models.Model):
    game = models.OneToOneField(
        Game,
        on_delete=models.CASCADE,
        related_name="scoresheet",
    )
    schema_version = models.PositiveIntegerField(default=1)
    next_seq = models.PositiveBigIntegerField(default=1)
    latest_snapshot_seq = models.PositiveBigIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Scoresheet {self.id} (game {self.game_id})"


class ScoresheetEvent(models.Model):
    scoresheet = models.ForeignKey(
        Scoresheet,
        on_delete=models.CASCADE,
        related_name="events",
    )
    seq = models.PositiveBigIntegerField()
    client_event_id = models.UUIDField()
    event_type = models.CharField(max_length=64)
    event_version = models.PositiveIntegerField(default=1)
    payload = models.JSONField()
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moss_scoresheet_events",
    )
    client_ts = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["seq"]
        unique_together = [
            ("scoresheet", "seq"),
            ("scoresheet", "client_event_id"),
        ]

    def __str__(self) -> str:
        return f"{self.scoresheet_id}#{self.seq} {self.event_type}"


class ScoresheetSnapshot(models.Model):
    scoresheet = models.ForeignKey(
        Scoresheet,
        on_delete=models.CASCADE,
        related_name="snapshots",
    )
    seq = models.PositiveBigIntegerField()
    state = models.JSONField()
    reason = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-seq"]
        unique_together = [("scoresheet", "seq")]

    def __str__(self) -> str:
        return f"{self.scoresheet_id}@{self.seq}"


class GameTeamFact(models.Model):
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="team_facts",
    )
    tournament_team = models.ForeignKey(
        TournamentTeam,
        on_delete=models.CASCADE,
        related_name="game_facts",
    )

    points = models.IntegerField(default=0)
    tossups_heard = models.PositiveIntegerField(default=0)
    tossups_4 = models.PositiveIntegerField(default=0)
    tossups_neg = models.PositiveIntegerField(default=0)
    tossups_0 = models.PositiveIntegerField(default=0)

    bonuses_heard = models.PositiveIntegerField(default=0)
    bonus_points = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("game", "tournament_team")]
        ordering = ["game_id", "tournament_team_id"]

    def __str__(self) -> str:
        return f"Game {self.game_id}: {self.tournament_team.name}"


class GamePlayerFact(models.Model):
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="player_facts",
    )
    tournament_player = models.ForeignKey(
        TournamentPlayer,
        on_delete=models.CASCADE,
        related_name="game_facts",
    )
    tournament_team = models.ForeignKey(
        TournamentTeam,
        on_delete=models.CASCADE,
        related_name="player_game_facts",
    )

    tossups_heard = models.PositiveIntegerField(default=0)
    tossups_4 = models.PositiveIntegerField(default=0)
    tossups_neg = models.PositiveIntegerField(default=0)
    tossups_0 = models.PositiveIntegerField(default=0)
    tossup_points = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("game", "tournament_player")]
        ordering = ["game_id", "tournament_team_id", "tournament_player_id"]

    def __str__(self) -> str:
        return f"Game {self.game_id}: {self.tournament_player.name} ({self.tournament_team.name})"
