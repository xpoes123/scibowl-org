from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tournaments", "0006_game_pool"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="slug",
            field=models.SlugField(
                blank=True,
                help_text="URL slug used by the website (e.g. pilot-scrimmage)",
                max_length=255,
                null=True,
                unique=True,
            ),
        ),
    ]

