from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Tournament(models.Model):
    """
    Core tournament model representing a quiz bowl tournament.
    Based on TOURNAMENT.md requirements for MVP.
    """
    FORMAT_CHOICES = [
        ('ROUND_ROBIN', 'Round Robin'),
        ('DOUBLE_ELIM', 'Double Elimination'),
        ('SINGLE_ELIM', 'Single Elimination'),
        ('SWISS', 'Swiss'),
        ('CUSTOM', 'Custom'),
    ]

    DIVISION_CHOICES = [
        ('HIGH_SCHOOL', 'High School'),
        ('MIDDLE_SCHOOL', 'Middle School'),
        ('COLLEGIATE', 'Collegiate'),
        ('OPEN', 'Open'),
    ]

    STATUS_CHOICES = [
        ('UPCOMING', 'Upcoming'),
        ('REGISTRATION', 'Registration Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    division = models.CharField(max_length=20, choices=DIVISION_CHOICES)
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UPCOMING')

    # Dates
    tournament_date = models.DateField()
    registration_deadline = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Location
    location = models.CharField(max_length=255)
    venue = models.CharField(max_length=255, blank=True)

    # Organizer info
    host_organization = models.CharField(max_length=255)
    tournament_director = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='directed_tournaments'
    )

    # Settings
    max_teams = models.IntegerField(null=True, blank=True)
    current_teams = models.IntegerField(default=0)

    # External links
    website_url = models.URLField(max_length=500, blank=True, help_text="Tournament website or information page")
    registration_url = models.URLField(max_length=500, blank=True, help_text="External registration link (if not using built-in registration)")

    class Meta:
        ordering = ['tournament_date', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_division_display()})"

    @property
    def is_registration_open(self):
        """Check if registration is currently open."""
        return self.status == 'REGISTRATION'

    @property
    def is_upcoming(self):
        """Check if tournament hasn't started yet."""
        return self.status in ['UPCOMING', 'REGISTRATION']


class Team(models.Model):
    """
    Represents a team participating in a tournament.
    """
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='teams')
    name = models.CharField(max_length=255)
    school = models.CharField(max_length=255)
    seed = models.IntegerField(null=True, blank=True)
    pool = models.CharField(max_length=10, blank=True, help_text="Pool/Group assignment (e.g., 'A', 'B', 'C', 'D')")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['seed', 'name']
        unique_together = ['tournament', 'name']

    def __str__(self):
        return f"{self.name} ({self.school})"


class Player(models.Model):
    """
    Represents an individual player on a team.
    """
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='players')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tournament_participations')

    name = models.CharField(max_length=255)
    grade_level = models.CharField(max_length=50, blank=True)

    # Stats (populated by MODAQ)
    total_points = models.IntegerField(default=0)
    tossups_heard = models.IntegerField(default=0)
    correct_buzzes = models.IntegerField(default=0)
    incorrect_buzzes = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.team.name})"

    @property
    def accuracy(self):
        """Calculate buzz accuracy."""
        total_buzzes = self.correct_buzzes + self.incorrect_buzzes
        if total_buzzes == 0:
            return 0
        return (self.correct_buzzes / total_buzzes) * 100


class Room(models.Model):
    """
    Represents a physical or virtual room where games are played.
    """
    STATUS_CHOICES = [
        ('NOT_STARTED', 'Not Started'),
        ('IN_PROGRESS', 'In Progress'),
        ('FINISHED', 'Finished'),
    ]

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NOT_STARTED')
    current_round = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        unique_together = ['tournament', 'name']

    def __str__(self):
        return f"{self.tournament.name} - {self.name}"


class Round(models.Model):
    """
    Represents a round of play in a tournament.
    """
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='rounds')
    round_number = models.IntegerField()
    name = models.CharField(max_length=100, blank=True)

    # Packet assignment
    packet_name = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['round_number']
        unique_together = ['tournament', 'round_number']

    def __str__(self):
        if self.name:
            return f"{self.tournament.name} - Round {self.round_number}: {self.name}"
        return f"{self.tournament.name} - Round {self.round_number}"


class Game(models.Model):
    """
    Represents a single game between teams.
    Data primarily written by MODAQ.
    """
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='games')
    round = models.ForeignKey(Round, on_delete=models.CASCADE, related_name='games')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='games')

    team1 = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='games_as_team1')
    team2 = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='games_as_team2')

    # Scores (set by MODAQ)
    team1_score = models.IntegerField(default=0)
    team2_score = models.IntegerField(default=0)

    # Game state
    current_tossup = models.IntegerField(default=0)
    is_complete = models.BooleanField(default=False)

    # Timestamps
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['round__round_number', 'room__name']

    def __str__(self):
        return f"{self.team1.name} vs {self.team2.name} (Round {self.round.round_number})"

    @property
    def winner(self):
        """Return the winning team if game is complete."""
        if not self.is_complete:
            return None
        if self.team1_score > self.team2_score:
            return self.team1
        elif self.team2_score > self.team1_score:
            return self.team2
        return None  # Tie
