from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("questions", "0009_question_options_jsonfield"),
    ]

    operations = [
        migrations.CreateModel(
            name="QuestionSet",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("year", models.PositiveIntegerField(blank=True, null=True)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-year", "name"]},
        ),
        migrations.CreateModel(
            name="QuestionSetVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tag", models.CharField(help_text='e.g. "v1", "v1.1", "corrected"', max_length=50)),
                ("notes", models.TextField(blank=True, help_text="What changed in this version")),
                ("is_primary", models.BooleanField(default=False, help_text="Marks the canonical/current version")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "question_set",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versions",
                        to="questions.questionset",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "unique_together": {("question_set", "tag")},
            },
        ),
        migrations.CreateModel(
            name="Packet",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("number", models.PositiveIntegerField(help_text="Packet number within the set (e.g. 1–12)")),
                ("title", models.CharField(blank=True, help_text='e.g. "Round 1"', max_length=255)),
                ("checksum", models.CharField(blank=True, help_text="SHA-256 of canonicalized packet JSON, for deduplication", max_length=128)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "question_set_version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="packets",
                        to="questions.questionsetversion",
                    ),
                ),
            ],
            options={
                "ordering": ["number"],
                "unique_together": {("question_set_version", "number")},
            },
        ),
    ]
