from django.contrib import admin
from .models import Question, UserQuestionHistory, Bookmark


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    """Admin interface for Question model"""

    list_display = ['id', 'category', 'question_type', 'difficulty', 'times_answered', 'accuracy_rate', 'created_at']
    list_filter = ['category', 'question_type', 'difficulty', 'created_at']
    search_fields = ['question_text', 'correct_answer', 'source']
    ordering = ['-created_at']

    fieldsets = (
        ('Question Content', {
            'fields': ('question_text', 'category', 'question_type', 'difficulty')
        }),
        ('Answers', {
            'fields': ('correct_answer', 'choice_w', 'choice_x', 'choice_y', 'choice_z', 'explanation')
        }),
        ('Metadata', {
            'fields': ('source', 'times_answered', 'times_correct')
        }),
    )


@admin.register(UserQuestionHistory)
class UserQuestionHistoryAdmin(admin.ModelAdmin):
    """Admin interface for UserQuestionHistory model"""

    list_display = ['user', 'question', 'is_correct', 'time_taken', 'answered_at']
    list_filter = ['is_correct', 'answered_at']
    search_fields = ['user__username', 'question__question_text']
    ordering = ['-answered_at']
    readonly_fields = ['answered_at']


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    """Admin interface for Bookmark model"""

    list_display = ['user', 'question', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'question__question_text', 'notes']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
