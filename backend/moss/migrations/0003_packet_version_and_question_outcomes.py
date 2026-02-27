from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("moss", "0002_fact_tables"),
    ]

    operations = [
        migrations.CreateModel(
            name="PacketVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("checksum_algorithm", models.CharField(max_length=50)),
                ("checksum_canonicalization", models.CharField(max_length=100)),
                ("checksum_value", models.CharField(max_length=128)),
                ("year", models.PositiveIntegerField(blank=True, null=True)),
                ("packet_name", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-created_at"],
                "unique_together": {("checksum_algorithm", "checksum_canonicalization", "checksum_value")},
            },
        ),
        migrations.CreateModel(
            name="PacketQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question_id", models.PositiveIntegerField()),
                ("pair_id", models.PositiveIntegerField()),
                ("question_type", models.CharField(choices=[("TOSSUP", "Tossup"), ("BONUS", "Bonus")], max_length=20)),
                ("category", models.TextField(blank=True)),
                ("question_style", models.CharField(blank=True, max_length=50)),
                ("source", models.CharField(blank=True, max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "packet_version",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="moss.packetversion"),
                ),
            ],
            options={
                "ordering": ["packet_version_id", "pair_id", "question_id"],
                "unique_together": {("packet_version", "question_id")},
            },
        ),
        migrations.AddIndex(
            model_name="packetquestion",
            index=models.Index(fields=["packet_version", "pair_id"], name="moss_packetq_packet__0aa0ee_idx"),
        ),
        migrations.AddIndex(
            model_name="packetquestion",
            index=models.Index(fields=["packet_version", "category"], name="moss_packetq_packet__5be45c_idx"),
        ),
        migrations.AddField(
            model_name="game",
            name="bonus_points_correct",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="game",
            name="bonus_points_incorrect",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="game",
            name="pairs_played",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="game",
            name="packet_version",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="games", to="moss.packetversion"),
        ),
        migrations.AddField(
            model_name="game",
            name="tossup_points_correct",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="game",
            name="tossup_points_incorrect",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="game",
            name="tossup_points_no_penalty",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="GameTeamQuestionOutcome",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("heard", models.BooleanField(default=False)),
                ("points", models.IntegerField(default=0)),
                ("tossup_result", models.CharField(blank=True, choices=[("CORRECT", "Correct"), ("INCORRECT", "Incorrect"), ("NO_PENALTY", "No penalty")], max_length=20)),
                ("bonus_result", models.CharField(blank=True, choices=[("CORRECT", "Correct"), ("INCORRECT", "Incorrect"), ("UNHEARD", "Unheard")], max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("buzzing_player", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="buzz_outcomes", to="moss.tournamentplayer")),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="team_question_outcomes", to="moss.game")),
                ("packet_question", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="team_outcomes", to="moss.packetquestion")),
                ("tournament_team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="question_outcomes", to="moss.tournamentteam")),
            ],
            options={
                "ordering": ["game_id", "tournament_team_id", "packet_question_id"],
                "unique_together": {("game", "tournament_team", "packet_question")},
            },
        ),
        migrations.AddIndex(
            model_name="gameteamquestionoutcome",
            index=models.Index(fields=["game", "tournament_team"], name="moss_gamete_game_id_d1134f_idx"),
        ),
        migrations.AddIndex(
            model_name="gameteamquestionoutcome",
            index=models.Index(fields=["packet_question", "tournament_team"], name="moss_gamete_packet__10db77_idx"),
        ),
        migrations.CreateModel(
            name="GamePlayerLineupSegment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_pair_id", models.PositiveIntegerField()),
                ("end_pair_id", models.PositiveIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="player_lineup_segments", to="moss.game")),
                ("tournament_player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lineup_segments", to="moss.tournamentplayer")),
                ("tournament_team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lineup_segments", to="moss.tournamentteam")),
            ],
            options={
                "ordering": ["game_id", "tournament_team_id", "tournament_player_id", "start_pair_id"],
            },
        ),
        migrations.AddIndex(
            model_name="gameplayerlineupsegment",
            index=models.Index(fields=["game", "tournament_team"], name="moss_gamepl_game_id_f710ce_idx"),
        ),
        migrations.AddIndex(
            model_name="gameplayerlineupsegment",
            index=models.Index(fields=["game", "tournament_player"], name="moss_gamepl_game_id_e648e6_idx"),
        ),
    ]

