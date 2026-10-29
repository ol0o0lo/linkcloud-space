from django.db import migrations


def restore_legacy_audit_default(apps, schema_editor):
    """0009 保留的旧审计列不再由 ORM 写入，必须允许新版插入。"""
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT column_default, data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = %s AND column_name = %s",
            ["organizations_organization", "created_by"],
        )
        column = cursor.fetchone()
    if column and column[0] is None and column[1] in {"character varying", "text"}:
        schema_editor.execute("ALTER TABLE organizations_organization ALTER COLUMN created_by SET DEFAULT ''")


class Migration(migrations.Migration):
    dependencies = [("organizations", "0015_organizationmember_employee_name_and_job_title")]
    operations = [migrations.RunPython(restore_legacy_audit_default, migrations.RunPython.noop)]
