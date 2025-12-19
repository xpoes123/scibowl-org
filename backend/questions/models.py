from django.db import models


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

    SOURCE_CHOICES = [
        ('MIT_2025', 'MIT 2025'),
        ('USER_SUBMITTED', 'User Submitted'),
    ]
    
    QUESTION_TYPE_CHOICES = [
        ('TOSSUP', 'Tossup'),
        ('BONUS', 'Bonus'),
    ]

    # Question content
    question_text = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    question_style = models.CharField(max_length=20, choices=QUESTION_STYLE_CHOICES, db_index=True, default='MULTIPLE_CHOICE')
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES, db_index=True, default='TOSSUP')

    # Answer fields
    correct_answer = models.CharField(max_length=1000, help_text="The correct answer(s)")

    # Options for multiple choice, ranking, and identify all questions
    option_1 = models.CharField(max_length=500, blank=True, null=True, help_text="Option W")
    option_2 = models.CharField(max_length=500, blank=True, null=True, help_text="Option X")
    option_3 = models.CharField(max_length=500, blank=True, null=True, help_text="Option Y")
    option_4 = models.CharField(max_length=500, blank=True, null=True, help_text="Option Z")

    # Metadata
    source = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        blank=True,
        null=True,
        help_text="Source of question"
    )
    explanation = models.TextField(blank=True, null=True, help_text="Explanation of the answer")

    # Stats
    times_answered = models.IntegerField(default=0)
    times_correct = models.IntegerField(default=0)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'questions'
        ordering = ['-created_at']
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
