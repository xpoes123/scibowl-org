from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tournaments", "0006_game_pool"),
    ]

    operations = [
        migrations.CreateModel(
            name="TournamentTeam",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("school", models.CharField(blank=True, max_length=255)),
                ("pool", models.CharField(blank=True, help_text="Pool/Group assignment (e.g., 'A', 'B', 'C')", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("tournament", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="moss_teams", to="tournaments.tournament")),
            ],
            options={
                "ordering": ["name"],
                "unique_together": {("tournament", "name")},
            },
        ),
        migrations.CreateModel(
            name="TournamentPlayer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("grade_level", models.CharField(blank=True, max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("tournament_team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="players", to="moss.tournamentteam")),
            ],
            options={
                "ordering": ["name"],
                "unique_together": {("tournament_team", "name")},
            },
        ),
        migrations.CreateModel(
            name="Game",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("SCHEDULED", "Scheduled"), ("IN_PROGRESS", "In Progress"), ("COMPLETED", "Completed")], default="SCHEDULED", max_length=20)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("room", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="moss_games", to="tournaments.room")),
                ("round", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="moss_games", to="tournaments.round")),
                ("tournament", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="moss_games", to="tournaments.tournament")),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
        migrations.CreateModel(
            name="Scoresheet",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("schema_version", models.PositiveIntegerField(default=1)),
                ("next_seq", models.PositiveBigIntegerField(default=1)),
                ("latest_snapshot_seq", models.PositiveBigIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("game", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="scoresheet", to="moss.game")),
            ],
        ),
        migrations.CreateModel(
            name="ScoresheetEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("seq", models.PositiveBigIntegerField()),
                ("client_event_id", models.UUIDField()),
                ("event_type", models.CharField(max_length=64)),
                ("event_version", models.PositiveIntegerField(default=1)),
                ("payload", models.JSONField()),
                ("client_ts", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor_user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="moss_scoresheet_events", to=settings.AUTH_USER_MODEL)),
                ("scoresheet", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="moss.scoresheet")),
            ],
            options={
                "ordering": ["seq"],
                "unique_together": {("scoresheet", "client_event_id"), ("scoresheet", "seq")},
            },
        ),
        migrations.CreateModel(
            name="ScoresheetSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("seq", models.PositiveBigIntegerField()),
                ("state", models.JSONField()),
                ("reason", models.CharField(blank=True, max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("scoresheet", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="snapshots", to="moss.scoresheet")),
            ],
            options={
                "ordering": ["-seq"],
                "unique_together": {("scoresheet", "seq")},
            },
        ),
        migrations.CreateModel(
            name="GameTeam",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slot", models.PositiveSmallIntegerField()),
                ("score_cached", models.IntegerField(default=0)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="game_teams", to="moss.game")),
                ("tournament_team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="game_teams", to="moss.tournamentteam")),
            ],
            options={
                "ordering": ["slot"],
                "unique_together": {("game", "slot"), ("game", "tournament_team")},
            },
        ),
    ]
