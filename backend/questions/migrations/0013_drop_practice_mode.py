from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("questions", "0012_enforce_question_packet_fk"),
    ]

    operations = [
        migrations.DeleteModel(name="UserQuestionHistory"),
        migrations.DeleteModel(name="Bookmark"),
        migrations.RemoveField(model_name="question", name="times_answered"),
        migrations.RemoveField(model_name="question", name="times_correct"),
    ]
