from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(model_name="user", name="bio"),
        migrations.RemoveField(model_name="user", name="school"),
        migrations.RemoveField(model_name="user", name="grade_level"),
        migrations.RemoveField(model_name="user", name="total_questions_answered"),
        migrations.RemoveField(model_name="user", name="correct_answers"),
    ]
