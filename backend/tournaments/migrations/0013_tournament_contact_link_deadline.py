from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0012_tournament_schema_alignment"),
    ]

    operations = [
        migrations.CreateModel(
            name="TournamentContact",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tournament", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="contacts", to="tournaments.tournament")),
                ("type", models.CharField(choices=[("EMAIL", "Email"), ("DISCORD", "Discord"), ("PHONE", "Phone"), ("OTHER", "Other")], max_length=20)),
                ("value", models.CharField(max_length=500)),
                ("label", models.CharField(blank=True, max_length=255)),
            ],
            options={"ordering": ["type", "label"]},
        ),
        migrations.CreateModel(
            name="TournamentLink",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tournament", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="links", to="tournaments.tournament")),
                ("type", models.CharField(choices=[("WEBSITE", "Website"), ("RESULTS", "Results"), ("PACKETS", "Packets"), ("STATS", "Stats"), ("OTHER", "Other")], max_length=20)),
                ("url", models.URLField(max_length=500)),
                ("label", models.CharField(max_length=255)),
            ],
            options={"ordering": ["type", "label"]},
        ),
        migrations.CreateModel(
            name="TournamentDeadline",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tournament", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="deadlines", to="tournaments.tournament")),
                ("label", models.CharField(max_length=255)),
                ("date", models.CharField(help_text="Date in YYYY-MM-DD format or descriptive text", max_length=100)),
            ],
            options={"ordering": ["date", "label"]},
        ),
    ]
