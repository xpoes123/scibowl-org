from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    bio = models.TextField(blank=True, null=True)
    school = models.CharField(max_length=255, blank=True, null=True)
    grade_level = models.IntegerField(blank=True, null=True)

    total_questions_answered = models.IntegerField(default=0)
    correct_answers = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return self.username

    @property
    def accuracy(self):
        if self.total_questions_answered == 0:
            return 0
        return (self.correct_answers / self.total_questions_answered) * 100
