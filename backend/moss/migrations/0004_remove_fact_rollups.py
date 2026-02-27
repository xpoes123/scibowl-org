from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("moss", "0003_packet_version_and_question_outcomes"),
    ]

    operations = [
        migrations.DeleteModel(name="GamePlayerFact"),
        migrations.DeleteModel(name="GameTeamFact"),
    ]

