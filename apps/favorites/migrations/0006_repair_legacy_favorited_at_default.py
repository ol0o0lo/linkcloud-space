from django.db import migrations

REPAIR_LEGACY_FAVORITED_AT_SQL = """
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'favorites_favorite'
          AND column_name = 'favorited_at'
    ) THEN
        ALTER TABLE "favorites_favorite"
        ALTER COLUMN favorited_at SET DEFAULT CURRENT_TIMESTAMP;
    END IF;
END
$$;
"""


class Migration(migrations.Migration):
    dependencies = [("favorites", "0005_alter_favorite_options")]

    operations = [
        migrations.RunSQL(
            sql=REPAIR_LEGACY_FAVORITED_AT_SQL,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
