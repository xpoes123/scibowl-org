from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        (
            "moss",
            "0005_rename_moss_gamepl_game_id_f710ce_idx_moss_gamepl_game_id_cf4b01_idx_and_more",
        ),
        ("tournaments", "0008_delete_game"),
    ]

    operations = [
        # Redirect TournamentPlayer.tournament_team → tournaments.Team
        # (related_name changed to moss_players to avoid clash with tournaments.Player.team)
        migrations.AlterField(
            model_name="tournamentplayer",
            name="tournament_team",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="moss_players",
                to="tournaments.team",
            ),
        ),
        # Redirect GameTeam.tournament_team → tournaments.Team
        migrations.AlterField(
            model_name="gameteam",
            name="tournament_team",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="game_teams",
                to="tournaments.team",
            ),
        ),
        # Redirect GameTeamQuestionOutcome.tournament_team → tournaments.Team
        migrations.AlterField(
            model_name="gameteamquestionoutcome",
            name="tournament_team",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="question_outcomes",
                to="tournaments.team",
            ),
        ),
        # Redirect GamePlayerLineupSegment.tournament_team → tournaments.Team
        migrations.AlterField(
            model_name="gameplayerlineupsegment",
            name="tournament_team",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="lineup_segments",
                to="tournaments.team",
            ),
        ),
        # Now safe to drop TournamentTeam
        migrations.DeleteModel(name="TournamentTeam"),
    ]
