from django.db import models


class QuestionSet(models.Model):
    """
    An abstract, named collection of packets (e.g. "NSB 2025 Regionals").
    Versions of the same set are tracked via QuestionSetVersion.
    """
    name = models.CharField(max_length=255)
    year = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', 'name']

    def __str__(self):
        if self.year:
            return f"{self.name} ({self.year})"
        return self.name


class QuestionSetVersion(models.Model):
    """
    A specific, immutable snapshot of a QuestionSet. This is the object
    that tournaments and games reference directly.
    """
    question_set = models.ForeignKey(QuestionSet, on_delete=models.CASCADE, related_name='versions')
    tag = models.CharField(max_length=50, help_text='e.g. "v1", "v1.1", "corrected"')
    notes = models.TextField(blank=True, help_text="What changed in this version")
    is_primary = models.BooleanField(default=False, help_text="Marks the canonical/current version")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('question_set', 'tag')]

    def __str__(self):
        return f"{self.question_set.name} {self.tag}"


class Packet(models.Model):
    """
    A single packet (set of tossup/bonus pairs) within a QuestionSetVersion.
    """
    question_set_version = models.ForeignKey(
        QuestionSetVersion, on_delete=models.CASCADE, related_name='packets'
    )
    number = models.PositiveIntegerField(help_text="Packet number within the set (e.g. 1–12)")
    title = models.CharField(max_length=255, blank=True, help_text='e.g. "Round 1"')
    checksum = models.CharField(
        max_length=128, blank=True,
        help_text="SHA-256 of canonicalized packet JSON, for deduplication"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['number']
        unique_together = [('question_set_version', 'number')]

    def __str__(self):
        label = self.title or f"Packet {self.number}"
        return f"{self.question_set_version} — {label}"


class Question(models.Model):
    """
    Main Question model for Science Bowl questions
    """

    CATEGORY_CHOICES = [
        ('BIOLOGY', 'Biology'),
        ('CHEMISTRY', 'Chemistry'),
        ('PHYSICS', 'Physics'),
        ('EARTH_SPACE', 'Earth and Space'),
        ('MATH', 'Math'),
        ('ENERGY', 'Energy'),
        ('OTHER', 'Other'),
    ]

    QUESTION_STYLE_CHOICES = [
        ('SHORT_ANSWER', 'Short Answer'),
        ('MULTIPLE_CHOICE', 'Multiple Choice'),
        ('IDENTIFY_ALL', 'Identify All'),
        ('RANK', 'Rank'),
    ]

    QUESTION_TYPE_CHOICES = [
        ('TOSSUP', 'Tossup'),
        ('BONUS', 'Bonus'),
    ]

    # Packet position
    packet = models.ForeignKey(
        Packet, on_delete=models.CASCADE, related_name='questions',
        null=True, blank=True,
    )
    pair_id = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Which tossup/bonus pair within the packet (1-based)"
    )

    # Question content
    question_text = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    question_style = models.CharField(max_length=20, choices=QUESTION_STYLE_CHOICES, db_index=True, default='MULTIPLE_CHOICE')
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES, db_index=True, default='TOSSUP')

    # Options (ordered list of strings; labels W/X/Y/Z/… derived by position)
    options = models.JSONField(default=list, blank=True)

    # Correct answer — type depends on question_style:
    #   SHORT_ANSWER / MULTIPLE_CHOICE : string (e.g. "mitosis" or "W")
    #   IDENTIFY_ALL                   : list of ints (indices of correct options)
    #   RANK                           : list of ints (options in correct order)
    correct_answer = models.JSONField(null=True, blank=True)

    explanation = models.TextField(blank=True, null=True)

    # Content checksum for deduplication
    checksum = models.CharField(max_length=128, blank=True)

    # Stats
    times_answered = models.IntegerField(default=0)
    times_correct = models.IntegerField(default=0)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'questions'
        ordering = ['pair_id', 'question_type']
        unique_together = [['packet', 'pair_id', 'question_type']]
        indexes = [
            models.Index(fields=['category', 'question_type']),
        ]

    def __str__(self):
        return f"{self.category} - {self.question_type}: {self.question_text[:50]}..."

    @property
    def accuracy_rate(self):
        """Calculate accuracy rate for this question"""
        if self.times_answered == 0:
            return 0
        return (self.times_correct / self.times_answered) * 100


class UserQuestionHistory(models.Model):
    """
    Tracks individual user's performance on questions
    """
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='question_history')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='user_attempts')

    user_answer = models.TextField()
    is_correct = models.BooleanField()
    time_taken = models.IntegerField(help_text="Time taken in seconds", null=True, blank=True)

    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_question_history'
        ordering = ['-answered_at']
        indexes = [
            models.Index(fields=['user', 'answered_at']),
            models.Index(fields=['question', 'is_correct']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.question.id} - {'✓' if self.is_correct else '✗'}"


class Bookmark(models.Model):
    """
    Allows users to bookmark questions for later review
    """
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='bookmarks')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='bookmarked_by')

    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bookmarks'
        unique_together = ['user', 'question']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} bookmarked Q{self.question.id}"
