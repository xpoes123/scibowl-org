from django.db import migrations, models


def migrate_options_forward(apps, schema_editor):
    Question = apps.get_model("questions", "Question")
    for q in Question.objects.all():
        opts = []
        for col in ("option_1", "option_2", "option_3", "option_4"):
            val = getattr(q, col, None)
            if val:
                opts.append(val)
        q.options = opts
        q.save(update_fields=["options"])


class Migration(migrations.Migration):
    dependencies = [
        ("questions", "0008_alter_question_category_alter_question_option_1_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="question",
            name="options",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(migrate_options_forward, migrations.RunPython.noop),
        migrations.RemoveField(model_name="question", name="option_1"),
        migrations.RemoveField(model_name="question", name="option_2"),
        migrations.RemoveField(model_name="question", name="option_3"),
        migrations.RemoveField(model_name="question", name="option_4"),
    ]
