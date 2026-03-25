from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("moss", "0011_drop_old_packet_models"),
        ("tournaments", "0013_tournament_contact_link_deadline"),
    ]

    operations = [
        migrations.AddField(
            model_name="game",
            name="round",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="games",
                to="tournaments.round",
            ),
        ),
    ]
