from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0013_tournament_contact_link_deadline"),
        ("questions", "0012_enforce_question_packet_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="round",
            name="packet",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="rounds",
                to="questions.packet",
            ),
        ),
    ]
