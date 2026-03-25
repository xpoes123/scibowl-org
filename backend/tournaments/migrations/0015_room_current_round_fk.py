from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0014_round_packet_fk"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="room",
            name="current_round",
        ),
        migrations.AddField(
            model_name="room",
            name="current_round",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="active_rooms",
                to="tournaments.round",
            ),
        ),
    ]
