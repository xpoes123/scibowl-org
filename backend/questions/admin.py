from django.contrib import admin
from django import forms
from .models import Bookmark, Packet, Question, QuestionSet, QuestionSetVersion, UserQuestionHistory


class QuestionAdminForm(forms.ModelForm):
    class Meta:
        model = Question
        fields = '__all__'
        help_texts = {
            'correct_answer': 'Format varies by question style',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            style = self.instance.question_style
            self.fields['correct_answer'].help_text = self._get_answer_help_text(style)

    def _get_answer_help_text(self, style):
        help_texts = {
            'MULTIPLE_CHOICE': 'String: correct option label, e.g. "W"',
            'IDENTIFY_ALL': 'JSON array of 0-based indices of all correct options, e.g. [0, 2]',
            'RANK': 'JSON array of 0-based option indices in correct order, e.g. [1, 0, 3, 2]',
            'SHORT_ANSWER': 'String: acceptable answer(s). Use " OR " for alternatives.',
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


@admin.register(QuestionSet)
class QuestionSetAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'year', 'created_at']
    list_filter = ['year']
    search_fields = ['name']
    ordering = ['-year', 'name']


@admin.register(QuestionSetVersion)
class QuestionSetVersionAdmin(admin.ModelAdmin):
    list_display = ['id', 'question_set', 'tag', 'is_primary', 'created_at']
    list_filter = ['is_primary']
    search_fields = ['question_set__name', 'tag']
    ordering = ['-created_at']


@admin.register(Packet)
class PacketAdmin(admin.ModelAdmin):
    list_display = ['id', 'question_set_version', 'number', 'title', 'created_at']
    list_filter = ['question_set_version__question_set']
    search_fields = ['title', 'question_set_version__question_set__name']
    ordering = ['question_set_version', 'number']


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    form = QuestionAdminForm
    list_display = ['id', 'packet', 'pair_id', 'category', 'question_type', 'question_style', 'times_answered', 'accuracy_rate', 'created_at']
    list_filter = ['category', 'question_type', 'question_style', 'created_at']
    search_fields = ['question_text']
    ordering = ['-created_at']

    fieldsets = (
        ('Packet', {
            'fields': ('packet', 'pair_id'),
        }),
        ('Question Content', {
            'fields': ('question_text', 'category', 'question_type', 'question_style'),
        }),
        ('Options & Answers', {
            'fields': ('options', 'correct_answer', 'explanation'),
            'description': '''
                <strong>Answer format by question style:</strong><br>
                • <strong>Multiple Choice:</strong> 4 options. Answer: label string e.g. "W"<br>
                • <strong>Identify All:</strong> 2+ options. Answer: JSON array of 0-based indices of correct options, e.g. [0, 2]<br>
                • <strong>Rank:</strong> 2+ options. Answer: JSON array of 0-based indices in correct order, e.g. [1, 0, 3, 2]<br>
                • <strong>Short Answer:</strong> No options. Answer: string (use " OR " for alternatives)<br>
            ''',
        }),
        ('Statistics', {
            'fields': ('times_answered', 'times_correct'),
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
