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

        # Make the transition question FK non-nullable.
        migrations.AlterField(
            model_name="gameteamquestionoutcome",
            name="question",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="team_outcomes",
                to="questions.question",
            ),
        ),

        # Update unique_together and ordering BEFORE removing packet_question,
        # because Django won't drop a field that is still in unique_together.
        migrations.AlterUniqueTogether(
            name="gameteamquestionoutcome",
            unique_together={("game", "tournament_team", "question")},
        ),
        migrations.AlterModelOptions(
            name="gameteamquestionoutcome",
            options={"ordering": ["game_id", "tournament_team_id", "question_id"]},
        ),

        # Remove the old packet_question index before dropping the column.
        # Note: the index was renamed from moss_gamete_packet__10db77_idx to
        # moss_gamete_packet__c2ad7b_idx in migration 0005.
        migrations.RemoveIndex(
            model_name="gameteamquestionoutcome",
            name="moss_gamete_packet__c2ad7b_idx",
        ),

        # Now safe to drop packet_question.
        migrations.RemoveField(model_name="gameteamquestionoutcome", name="packet_question"),

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
