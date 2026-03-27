from django.db import migrations


class Migration(migrations.Migration):
    """
    Fix the `divisions` column type on tournaments_tournament.

    Migration 0012 added `divisions` as a JSONField (jsonb), but the column
    already existed in the database as `character varying[]` from an older
    version of the codebase that used ArrayField. PostgreSQL has no implicit
    cast between these types, so the column was never actually converted.

    This migration performs the conversion explicitly using `to_jsonb()`,
    which safely maps Postgres array values (e.g. {HS,MS}) to JSON arrays
    (e.g. ["HS","MS"]).
    """

    dependencies = [
        ("tournaments", "0015_room_current_round_fk"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE tournaments_tournament
                ALTER COLUMN divisions TYPE jsonb
                USING to_jsonb(divisions);
            """,
            reverse_sql="""
                ALTER TABLE tournaments_tournament
                ALTER COLUMN divisions TYPE character varying[]
                USING ARRAY(SELECT jsonb_array_elements_text(divisions));
            """,
        ),
    ]
