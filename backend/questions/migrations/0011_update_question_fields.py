from django.db import migrations, models
import django.db.models.deletion


def clear_all_questions(apps, schema_editor):
    """Option B: delete all existing Question rows before changing the schema."""
    Question = apps.get_model("questions", "Question")
    Question.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("questions", "0010_add_question_set_hierarchy"),
    ]

    operations = [
        # Clear all rows first so the CharField→JSONField conversion is safe.
        migrations.RunPython(clear_all_questions, migrations.RunPython.noop),

        # Drop source field.
        migrations.RemoveField(model_name="question", name="source"),

        # Drop old correct_answer CharField and replace with JSONField.
        migrations.RemoveField(model_name="question", name="correct_answer"),
        migrations.AddField(
            model_name="question",
            name="correct_answer",
            field=models.JSONField(blank=True, null=True),
        ),

        # Add new fields.
        migrations.AddField(
            model_name="question",
            name="packet",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="questions",
                to="questions.packet",
            ),
        ),
        migrations.AddField(
            model_name="question",
            name="pair_id",
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                help_text="Which tossup/bonus pair within the packet (1-based)",
            ),
        ),
        migrations.AddField(
            model_name="question",
            name="checksum",
            field=models.CharField(blank=True, max_length=128),
        ),

        # Update ordering and unique_together.
        migrations.AlterModelOptions(
            name="question",
            options={
                "ordering": ["pair_id", "question_type"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="question",
            unique_together={("packet", "pair_id", "question_type")},
        ),
    ]
