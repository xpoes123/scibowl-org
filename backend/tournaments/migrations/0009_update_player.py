from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("tournaments", "0008_delete_game"),
    ]

    operations = [
        migrations.RemoveField(model_name="player", name="total_points"),
        migrations.RemoveField(model_name="player", name="tossups_heard"),
        migrations.RemoveField(model_name="player", name="correct_buzzes"),
        migrations.RemoveField(model_name="player", name="incorrect_buzzes"),
        migrations.AlterUniqueTogether(
            name="player",
            unique_together={("team", "name")},
        ),
    ]
