from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("moss", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="GameTeamFact",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("points", models.IntegerField(default=0)),
                ("tossups_heard", models.PositiveIntegerField(default=0)),
                ("tossups_4", models.PositiveIntegerField(default=0)),
                ("tossups_neg", models.PositiveIntegerField(default=0)),
                ("tossups_0", models.PositiveIntegerField(default=0)),
                ("bonuses_heard", models.PositiveIntegerField(default=0)),
                ("bonus_points", models.IntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="team_facts", to="moss.game")),
                ("tournament_team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="game_facts", to="moss.tournamentteam")),
            ],
            options={
                "ordering": ["game_id", "tournament_team_id"],
                "unique_together": {("game", "tournament_team")},
            },
        ),
        migrations.CreateModel(
            name="GamePlayerFact",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tossups_heard", models.PositiveIntegerField(default=0)),
                ("tossups_4", models.PositiveIntegerField(default=0)),
                ("tossups_neg", models.PositiveIntegerField(default=0)),
                ("tossups_0", models.PositiveIntegerField(default=0)),
                ("tossup_points", models.IntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="player_facts", to="moss.game")),
                ("tournament_player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="game_facts", to="moss.tournamentplayer")),
                ("tournament_team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="player_game_facts", to="moss.tournamentteam")),
            ],
            options={
                "ordering": ["game_id", "tournament_team_id", "tournament_player_id"],
                "unique_together": {("game", "tournament_player")},
            },
        ),
    ]

