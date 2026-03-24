from django.db import migrations


def clear_all_ingest_data(apps, schema_editor):
    """
    Option B: delete all existing scoring data so the new questions.Packet /
    questions.Question hierarchy can be populated from scratch via re-ingest.
    Deletion order respects FK dependencies.
    """
    ScoresheetEvent = apps.get_model("moss", "ScoresheetEvent")
    ScoresheetSnapshot = apps.get_model("moss", "ScoresheetSnapshot")
    Scoresheet = apps.get_model("moss", "Scoresheet")
    GameTeamQuestionOutcome = apps.get_model("moss", "GameTeamQuestionOutcome")
    GamePlayerLineupSegment = apps.get_model("moss", "GamePlayerLineupSegment")
    GameTeam = apps.get_model("moss", "GameTeam")
    Game = apps.get_model("moss", "Game")
    PacketQuestion = apps.get_model("moss", "PacketQuestion")
    PacketVersion = apps.get_model("moss", "PacketVersion")

    ScoresheetEvent.objects.all().delete()
    ScoresheetSnapshot.objects.all().delete()
    Scoresheet.objects.all().delete()
    GameTeamQuestionOutcome.objects.all().delete()
    GamePlayerLineupSegment.objects.all().delete()
    GameTeam.objects.all().delete()
    Game.objects.all().delete()
    PacketQuestion.objects.all().delete()
    PacketVersion.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("moss", "0009_add_transition_fks"),
    ]

    operations = [
        migrations.RunPython(clear_all_ingest_data, migrations.RunPython.noop),
    ]
