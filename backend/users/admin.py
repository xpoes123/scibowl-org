from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for User model"""

    list_display = ['username', 'email', 'school', 'grade_level', 'total_questions_answered', 'accuracy', 'is_staff']
    list_filter = ['is_staff', 'is_superuser', 'is_active', 'grade_level']
    search_fields = ['username', 'email', 'school']

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Science Bowl Info', {
            'fields': ('school', 'grade_level', 'bio')
        }),
        ('Statistics', {
            'fields': ('total_questions_answered', 'correct_answers')
        }),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {
            'fields': ('email', 'school', 'grade_level')
        }),
    )
