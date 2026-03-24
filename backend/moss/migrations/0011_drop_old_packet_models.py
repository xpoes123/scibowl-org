from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("moss", "0010_clear_ingest_data"),
        ("questions", "0012_enforce_question_packet_fk"),
    ]

    operations = [
        # Drop the old packet_version FK from Game.
        migrations.RemoveField(model_name="game", name="packet_version"),

        # Replace the transition nullable question FK with a required one,
        # and update unique_together/ordering/index to match the new model.
        migrations.AlterField(
            model_name="gameteamquestionoutcome",
            name="question",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="team_outcomes",
                to="questions.question",
            ),
        ),
        migrations.RemoveField(model_name="gameteamquestionoutcome", name="packet_question"),
        migrations.AlterUniqueTogether(
            name="gameteamquestionoutcome",
            unique_together={("game", "tournament_team", "question")},
        ),
        migrations.AlterModelOptions(
            name="gameteamquestionoutcome",
            options={"ordering": ["game_id", "tournament_team_id", "question_id"]},
        ),
        migrations.RemoveIndex(
            model_name="gameteamquestionoutcome",
            name="moss_gamete_packet__10db77_idx",
        ),
        migrations.AddIndex(
            model_name="gameteamquestionoutcome",
            index=models.Index(
                fields=["question", "tournament_team"],
                name="moss_gamete_questio_team_idx",
            ),
        ),

        # Drop old models (all rows were cleared in 0010).
        migrations.DeleteModel(name="PacketQuestion"),
        migrations.DeleteModel(name="PacketVersion"),
    ]
