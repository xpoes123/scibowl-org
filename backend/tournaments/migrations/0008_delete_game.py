from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("tournaments", "0007_tournament_slug"),
    ]

    operations = [
        migrations.DeleteModel(name="Game"),
    ]
