from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Tournament(models.Model):
    """
    Core tournament model representing a quiz bowl tournament.
    """
    FORMAT_CHOICES = [
        ('ROUND_ROBIN', 'Round Robin'),
        ('DOUBLE_ELIM', 'Double Elimination'),
        ('SINGLE_ELIM', 'Single Elimination'),
        ('SWISS', 'Swiss'),
        ('CUSTOM', 'Custom'),
    ]

    DIVISION_CHOICES = [
        ('HS', 'High School'),
        ('MS', 'Middle School'),
        ('UG', 'Undergraduate'),
        ('OPEN', 'Open'),
    ]

    STATUS_CHOICES = [
        ('UPCOMING', 'Upcoming'),
        ('REGISTRATION', 'Registration Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    PUBLICATION_STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PUBLISHED', 'Published'),
        ('ARCHIVED', 'Archived'),
    ]

    MODE_CHOICES = [
        ('IN_PERSON', 'In Person'),
        ('ONLINE', 'Online'),
    ]

    REGISTRATION_METHOD_CHOICES = [
        ('FORM', 'Form'),
        ('EMAIL', 'Email'),
        ('WEBSITE', 'Website'),
        ('OTHER', 'Other'),
    ]

    name = models.CharField(max_length=255)
    slug = models.SlugField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text="URL slug used by the website (e.g. pilot-scrimmage)",
    )
    description = models.TextField(blank=True)
    publication_status = models.CharField(max_length=20, choices=PUBLICATION_STATUS_CHOICES, default='DRAFT')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UPCOMING')
    mode = models.CharField(max_length=20, choices=MODE_CHOICES)
    timezone = models.CharField(max_length=100, help_text="IANA timezone identifier, e.g. America/New_York")
    divisions = ArrayField(
        models.CharField(max_length=10, choices=DIVISION_CHOICES),
        help_text="Division(s) for this tournament, e.g. ['HS'] or ['MS', 'HS']",
    )
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES, blank=True)
    difficulty = models.CharField(max_length=255, blank=True)
    format_summary = models.TextField(blank=True, help_text="Human-readable format description, e.g. '4x8 RR + 8-team DE bracket'")
    rounds_guaranteed = models.IntegerField(null=True, blank=True)

    # Dates
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Location (blank for ONLINE tournaments)
    location_city = models.CharField(max_length=255, blank=True)
    location_state = models.CharField(max_length=2, blank=True)
    location_address = models.CharField(max_length=255, blank=True)

    # Notes
    notes_logistics = models.TextField(blank=True)
    notes_writing_team = models.CharField(max_length=255, blank=True)

    # Organizer info
    host_organization = models.CharField(max_length=255, blank=True)
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

    # Question set used for this tournament
    question_set_version = models.ForeignKey(
        "questions.QuestionSetVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tournaments",
    )

    # Registration
    registration_url = models.URLField(max_length=500, blank=True, help_text="External registration link")
    registration_method = models.CharField(max_length=20, choices=REGISTRATION_METHOD_CHOICES, blank=True)
    registration_instructions = models.TextField(blank=True)
    registration_cost = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['start_date', 'name']

    def __str__(self):
        return f"{self.name} ({', '.join(self.divisions)})"

    @property
    def is_registration_open(self):
        return self.status == 'REGISTRATION'

    @property
    def is_upcoming(self):
        return self.status in ['UPCOMING', 'REGISTRATION']


class Team(models.Model):
    """
    Represents a team participating in a tournament.
    """
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='teams')
    name = models.CharField(max_length=255)
    school = models.CharField(max_length=255)
    pool = models.CharField(max_length=10, blank=True, help_text="Pool/Group assignment (e.g., 'A', 'B', 'C', 'D')")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        unique_together = [['team', 'name']]

    def __str__(self):
        return f"{self.name} ({self.team.name})"


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


class TournamentContact(models.Model):
    CONTACT_TYPE_CHOICES = [
        ('EMAIL', 'Email'),
        ('DISCORD', 'Discord'),
        ('PHONE', 'Phone'),
        ('OTHER', 'Other'),
    ]

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='contacts')
    type = models.CharField(max_length=20, choices=CONTACT_TYPE_CHOICES)
    value = models.CharField(max_length=500)
    label = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['type', 'label']

    def __str__(self):
        return f"{self.tournament.name} - {self.type}: {self.label or self.value}"


class TournamentLink(models.Model):
    LINK_TYPE_CHOICES = [
        ('WEBSITE', 'Website'),
        ('RESULTS', 'Results'),
        ('PACKETS', 'Packets'),
        ('STATS', 'Stats'),
        ('OTHER', 'Other'),
    ]

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='links')
    type = models.CharField(max_length=20, choices=LINK_TYPE_CHOICES)
    url = models.URLField(max_length=500)
    label = models.CharField(max_length=255)

    class Meta:
        ordering = ['type', 'label']

    def __str__(self):
        return f"{self.tournament.name} - {self.label}"


class TournamentDeadline(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='deadlines')
    label = models.CharField(max_length=255)
    date = models.CharField(max_length=100, help_text="Date in YYYY-MM-DD format or descriptive text")

    class Meta:
        ordering = ['date', 'label']

    def __str__(self):
        return f"{self.tournament.name} - {self.label}: {self.date}"


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


