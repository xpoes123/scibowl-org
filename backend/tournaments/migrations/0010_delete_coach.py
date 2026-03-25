from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("tournaments", "0009_update_player"),
    ]

    operations = [
        migrations.DeleteModel(name="Coach"),
    ]
