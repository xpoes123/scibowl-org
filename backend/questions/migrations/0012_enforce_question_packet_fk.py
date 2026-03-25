from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("questions", "0011_update_question_fields"),
        ("moss", "0010_clear_ingest_data"),
    ]

    operations = [
        migrations.AlterField(
            model_name="question",
            name="packet",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="questions",
                to="questions.packet",
            ),
        ),
        migrations.AlterField(
            model_name="question",
            name="pair_id",
            field=models.PositiveIntegerField(
                help_text="Which tossup/bonus pair within the packet (1-based)"
            ),
        ),
        migrations.AlterField(
            model_name="question",
            name="correct_answer",
            field=models.JSONField(),
        ),
    ]
