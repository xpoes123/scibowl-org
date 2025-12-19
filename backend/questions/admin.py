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
        correct_answer = cleaned_data.get('correct_answer')
        option_1 = cleaned_data.get('option_1')
        option_2 = cleaned_data.get('option_2')
        option_3 = cleaned_data.get('option_3')
        option_4 = cleaned_data.get('option_4')

        filled_options = sum([
            bool(option_1),
            bool(option_2),
            bool(option_3),
            bool(option_4)
        ])

        if question_style == 'MULTIPLE_CHOICE':
            if filled_options != 4:
                raise forms.ValidationError(
                    "Multiple Choice questions require all 4 options to be filled."
                )
            if correct_answer and correct_answer.upper() not in ['W', 'X', 'Y', 'Z']:
                raise forms.ValidationError(
                    "For Multiple Choice, correct_answer must be W, X, Y, or Z"
                )

        elif question_style in ['IDENTIFY_ALL', 'RANK']:
            if filled_options < 3:
                raise forms.ValidationError(
                    f"{dict(Question.QUESTION_STYLE_CHOICES)[question_style]} questions require at least 3 options."
                )
            if correct_answer and question_style == 'IDENTIFY_ALL':
                valid_letters = set(['W', 'X', 'Y', 'Z'])
                answer_letters = [a.strip().upper() for a in correct_answer.split(',')]
                if not all(letter in valid_letters for letter in answer_letters):
                    raise forms.ValidationError(
                        "For Identify All, correct_answer must be comma-separated letters (W, X, Y, Z)"
                    )

        elif question_style == 'SHORT_ANSWER':
            if filled_options > 0:
                raise forms.ValidationError(
                    "Short Answer questions should not have options filled."
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
            'fields': ('option_1', 'option_2', 'option_3', 'option_4', 'correct_answer', 'explanation'),
            'description': '''
                <strong>Answer Format by Question Style:</strong><br>
                • <strong>Multiple Choice:</strong> Options W/X/Y/Z (all 4 required). Answer: single letter (W, X, Y, or Z)<br>
                • <strong>Identify All:</strong> Options W/X/Y/Z (3-4 required). Answer: comma-separated letters (e.g., "W, X, Z")<br>
                • <strong>Rank:</strong> Options W/X/Y/Z (3-4 required). Answer: ranking order (e.g., "Y, W, Z, X")<br>
                • <strong>Short Answer:</strong> No options. Answer: text (use " OR " for alternatives)<br>
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
