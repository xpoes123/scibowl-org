from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("moss", "0008_remove_game_round"),
        ("questions", "0011_update_question_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="game",
            name="packet",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="games",
                to="questions.packet",
            ),
        ),
        migrations.AlterField(
            model_name="gameteamquestionoutcome",
            name="packet_question",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="team_outcomes",
                to="moss.packetquestion",
            ),
        ),
        migrations.AddField(
            model_name="gameteamquestionoutcome",
            name="question",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="team_outcomes",
                to="questions.question",
            ),
        ),
    ]
