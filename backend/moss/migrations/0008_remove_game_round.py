from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("moss", "0007_merge_tournamentplayer"),
    ]

    operations = [
        migrations.RemoveField(model_name="game", name="round"),
    ]
