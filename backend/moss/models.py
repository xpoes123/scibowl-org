from django.conf import settings
from django.db import models



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

    packet = models.ForeignKey(
        "questions.Packet",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="games",
    )
    pairs_played = models.PositiveIntegerField(default=0)

    tossup_points_correct = models.IntegerField(null=True, blank=True)
    tossup_points_incorrect = models.IntegerField(null=True, blank=True)
    tossup_points_no_penalty = models.IntegerField(null=True, blank=True)
    bonus_points_correct = models.IntegerField(null=True, blank=True)
    bonus_points_incorrect = models.IntegerField(null=True, blank=True)

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
        "tournaments.Team",
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


class PacketVersion(models.Model):
    checksum_algorithm = models.CharField(max_length=50)
    checksum_canonicalization = models.CharField(max_length=100)
    checksum_value = models.CharField(max_length=128)

    year = models.PositiveIntegerField(null=True, blank=True)
    packet_name = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [
            ("checksum_algorithm", "checksum_canonicalization", "checksum_value"),
        ]

    def __str__(self) -> str:
        label = self.packet_name or "Packet"
        if self.year:
            label = f"{label} {self.year}"
        return f"{label} ({self.checksum_value[:12]}…)"


class PacketQuestion(models.Model):
    QUESTION_TYPE_CHOICES = [
        ("TOSSUP", "Tossup"),
        ("BONUS", "Bonus"),
    ]

    packet_version = models.ForeignKey(
        PacketVersion,
        on_delete=models.CASCADE,
        related_name="questions",
    )
    question_id = models.PositiveIntegerField()
    pair_id = models.PositiveIntegerField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES)
    category = models.TextField(blank=True)

    question_style = models.CharField(max_length=50, blank=True)
    source = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["packet_version_id", "pair_id", "question_id"]
        unique_together = [
            ("packet_version", "question_id"),
        ]
        indexes = [
            models.Index(fields=["packet_version", "pair_id"]),
            models.Index(fields=["packet_version", "category"]),
        ]

    def __str__(self) -> str:
        return f"{self.packet_version_id}:{self.question_type} q{self.question_id} (pair {self.pair_id})"


class GameTeamQuestionOutcome(models.Model):
    TOSSUP_RESULT_CHOICES = [
        ("CORRECT", "Correct"),
        ("INCORRECT", "Incorrect"),
        ("NO_PENALTY", "No penalty"),
    ]

    BONUS_RESULT_CHOICES = [
        ("CORRECT", "Correct"),
        ("INCORRECT", "Incorrect"),
        ("UNHEARD", "Unheard"),
    ]

    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="team_question_outcomes",
    )
    tournament_team = models.ForeignKey(
        "tournaments.Team",
        on_delete=models.CASCADE,
        related_name="question_outcomes",
    )
    packet_question = models.ForeignKey(
        PacketQuestion,
        on_delete=models.CASCADE,
        related_name="team_outcomes",
        null=True,
        blank=True,
    )
    question = models.ForeignKey(
        "questions.Question",
        on_delete=models.CASCADE,
        related_name="team_outcomes",
        null=True,
        blank=True,
    )

    heard = models.BooleanField(default=False)
    points = models.IntegerField(default=0)

    tossup_result = models.CharField(max_length=20, choices=TOSSUP_RESULT_CHOICES, blank=True)
    bonus_result = models.CharField(max_length=20, choices=BONUS_RESULT_CHOICES, blank=True)

    buzzing_player = models.ForeignKey(
        "tournaments.Player",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="buzz_outcomes",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["game_id", "tournament_team_id", "packet_question_id"]
        unique_together = [
            ("game", "tournament_team", "packet_question"),
        ]
        indexes = [
            models.Index(fields=["game", "tournament_team"]),
            models.Index(fields=["packet_question", "tournament_team"]),
        ]

    def __str__(self) -> str:
        return f"Game {self.game_id}: {self.tournament_team.name} q{self.packet_question.question_id} ({self.points})"


class GamePlayerLineupSegment(models.Model):
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="player_lineup_segments",
    )
    tournament_team = models.ForeignKey(
        "tournaments.Team",
        on_delete=models.CASCADE,
        related_name="lineup_segments",
    )
    tournament_player = models.ForeignKey(
        "tournaments.Player",
        on_delete=models.CASCADE,
        related_name="lineup_segments",
    )

    start_pair_id = models.PositiveIntegerField()
    end_pair_id = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["game_id", "tournament_team_id", "tournament_player_id", "start_pair_id"]
        indexes = [
            models.Index(fields=["game", "tournament_team"]),
            models.Index(fields=["game", "tournament_player"]),
        ]

    def __str__(self) -> str:
        end = self.end_pair_id if self.end_pair_id is not None else "end"
        return f"Game {self.game_id}: {self.tournament_player.name} ({self.start_pair_id}..{end})"
