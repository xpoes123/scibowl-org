from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0011_tournament_question_set_version"),
    ]

    operations = [
        # --- Removals ---
        migrations.RemoveField(model_name="tournament", name="division"),
        migrations.RemoveField(model_name="tournament", name="location"),
        migrations.RemoveField(model_name="tournament", name="registration_deadline"),
        migrations.RemoveField(model_name="tournament", name="venue"),
        migrations.RemoveField(model_name="tournament", name="website_url"),

        # --- Rename tournament_date -> start_date ---
        migrations.RenameField(
            model_name="tournament",
            old_name="tournament_date",
            new_name="start_date",
        ),

        # --- New fields ---
        migrations.AddField(
            model_name="tournament",
            name="publication_status",
            field=models.CharField(
                choices=[("DRAFT", "Draft"), ("PUBLISHED", "Published"), ("ARCHIVED", "Archived")],
                default="DRAFT",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="mode",
            field=models.CharField(
                choices=[("IN_PERSON", "In Person"), ("ONLINE", "Online")],
                default="ONLINE",
                max_length=20,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="tournament",
            name="timezone",
            field=models.CharField(
                default="America/New_York",
                help_text="IANA timezone identifier, e.g. America/New_York",
                max_length=100,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="tournament",
            name="divisions",
            field=models.JSONField(
                default=list,
                help_text="Division(s) for this tournament, e.g. ['HS'] or ['MS', 'HS']",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="tournament",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tournament",
            name="difficulty",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="tournament",
            name="format_summary",
            field=models.TextField(
                blank=True,
                help_text="Human-readable format description, e.g. '4x8 RR + 8-team DE bracket'",
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="rounds_guaranteed",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tournament",
            name="location_city",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="tournament",
            name="location_state",
            field=models.CharField(blank=True, max_length=2),
        ),
        migrations.AddField(
            model_name="tournament",
            name="location_address",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="tournament",
            name="notes_logistics",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="tournament",
            name="notes_writing_team",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="tournament",
            name="registration_method",
            field=models.CharField(
                blank=True,
                choices=[("FORM", "Form"), ("EMAIL", "Email"), ("WEBSITE", "Website"), ("OTHER", "Other")],
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="registration_instructions",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="tournament",
            name="registration_cost",
            field=models.CharField(blank=True, max_length=100),
        ),

        # --- Alter existing fields ---
        migrations.AlterField(
            model_name="tournament",
            name="format",
            field=models.CharField(
                blank=True,
                choices=[
                    ("ROUND_ROBIN", "Round Robin"),
                    ("DOUBLE_ELIM", "Double Elimination"),
                    ("SINGLE_ELIM", "Single Elimination"),
                    ("SWISS", "Swiss"),
                    ("CUSTOM", "Custom"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="tournament",
            name="host_organization",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
