from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("moss", "0006_merge_tournamentteam"),
        ("tournaments", "0009_update_player"),
    ]

    operations = [
        # Redirect GameTeamQuestionOutcome.buzzing_player → tournaments.Player
        migrations.AlterField(
            model_name="gameteamquestionoutcome",
            name="buzzing_player",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="buzz_outcomes",
                to="tournaments.player",
            ),
        ),
        # Redirect GamePlayerLineupSegment.tournament_player → tournaments.Player
        migrations.AlterField(
            model_name="gameplayerlineupsegment",
            name="tournament_player",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="lineup_segments",
                to="tournaments.player",
            ),
        ),
        # Now safe to drop TournamentPlayer
        migrations.DeleteModel(name="TournamentPlayer"),
    ]
