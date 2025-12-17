from django.db import models
from django.contrib.postgres.fields import ArrayField


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
    ]

    QUESTION_TYPE_CHOICES = [
        ('SHORT_ANSWER', 'Short Answer'),
        ('MULTIPLE_CHOICE', 'Multiple Choice'),
        ('IDENTIFY_ALL', 'Identify All'),
        ('RANK', 'Rank'),
    ]

    DIFFICULTY_CHOICES = [
        ('EASY', 'Easy'),
        ('MEDIUM', 'Medium'),
        ('HARD', 'Hard'),
    ]

    # Question content
    question_text = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES, db_index=True)
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='MEDIUM', db_index=True)

    # Answer fields
    correct_answer = models.TextField(help_text="The correct answer(s)")

    # For multiple choice questions
    choice_w = models.CharField(max_length=500, blank=True, null=True)
    choice_x = models.CharField(max_length=500, blank=True, null=True)
    choice_y = models.CharField(max_length=500, blank=True, null=True)
    choice_z = models.CharField(max_length=500, blank=True, null=True)

    # Metadata
    source = models.CharField(max_length=255, blank=True, null=True, help_text="Source of question (e.g., 'NSB 2023 Regionals')")
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
            models.Index(fields=['difficulty']),
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
