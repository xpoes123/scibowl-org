from django.contrib import admin
from django import forms
from .models import Question, UserQuestionHistory, Bookmark


class QuestionAdminForm(forms.ModelForm):
    class Meta:
        model = Question
        fields = '__all__'
        help_texts = {
            'correct_answer': 'Format varies by question style',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Update help text based on question style
        if self.instance.pk:
            style = self.instance.question_style
            self.fields['correct_answer'].help_text = self._get_answer_help_text(style)

    def _get_answer_help_text(self, style):
        """Return appropriate help text based on question style"""
        help_texts = {
            'MULTIPLE_CHOICE': 'Enter the correct option letter (W, X, Y, or Z)',
            'IDENTIFY_ALL': 'Enter all correct options separated by commas (e.g., "W, X, Z")',
            'RANK': 'Enter the correct ranking order (e.g., "Y, W, Z, X" from first to last)',
            'SHORT_ANSWER': 'Enter the acceptable answer(s). Use " OR " to separate alternatives (e.g., "mitochondria OR mitochondrion")',
        }
        return help_texts.get(style, 'The correct answer(s)')

    def clean(self):
        cleaned_data = super().clean()
        question_style = cleaned_data.get('question_style')
        options = cleaned_data.get('options') or []

        if not isinstance(options, list):
            raise forms.ValidationError("Options must be a JSON list of strings.")

        num_options = len(options)

        if question_style == 'MULTIPLE_CHOICE':
            if num_options != 4:
                raise forms.ValidationError(
                    "Multiple Choice questions require exactly 4 options."
                )

        elif question_style in ['IDENTIFY_ALL', 'RANK']:
            if num_options < 2:
                raise forms.ValidationError(
                    f"{dict(Question.QUESTION_STYLE_CHOICES)[question_style]} questions require at least 2 options."
                )

        elif question_style == 'SHORT_ANSWER':
            if num_options > 0:
                raise forms.ValidationError(
                    "Short Answer questions should not have options."
                )

        return cleaned_data


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    form = QuestionAdminForm
    list_display = ['id', 'category', 'question_type', 'question_style', 'source', 'times_answered', 'accuracy_rate', 'created_at']
    list_filter = ['category', 'question_type', 'question_style', 'source', 'created_at']
    search_fields = ['question_text', 'correct_answer']
    ordering = ['-created_at']

    fieldsets = (
        ('Question Content', {
            'fields': ('question_text', 'category', 'question_type', 'question_style')
        }),
        ('Options & Answers', {
            'fields': ('options', 'correct_answer', 'explanation'),
            'description': '''
                <strong>Answer Format by Question Style:</strong><br>
                • <strong>Multiple Choice:</strong> Exactly 4 options as a JSON list, e.g. ["Option W", "Option X", "Option Y", "Option Z"]. Answer: label of correct option (W, X, Y, or Z)<br>
                • <strong>Identify All:</strong> 2+ options as a JSON list. Answer: comma-separated labels of all correct options (e.g., "W, X, Z")<br>
                • <strong>Rank:</strong> 2+ options as a JSON list. Answer: labels in correct ranking order (e.g., "Y, W, Z, X")<br>
                • <strong>Short Answer:</strong> Leave options as []. Answer: text (use " OR " for alternatives)<br>
            '''
        }),
        ('Metadata', {
            'fields': ('source', 'times_answered', 'times_correct')
        }),
    )


@admin.register(UserQuestionHistory)
class UserQuestionHistoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'question', 'is_correct', 'time_taken', 'answered_at']
    list_filter = ['is_correct', 'answered_at']
    search_fields = ['user__username', 'question__question_text']
    ordering = ['-answered_at']
    readonly_fields = ['answered_at']


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ['user', 'question', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'question__question_text', 'notes']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
