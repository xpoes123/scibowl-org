from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("tournaments", "0010_delete_coach"),
        ("questions", "0010_add_question_set_hierarchy"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="question_set_version",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tournaments",
                to="questions.questionsetversion",
            ),
        ),
    ]
