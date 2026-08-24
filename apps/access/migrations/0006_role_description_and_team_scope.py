import django.db.models.deletion
from django.db import migrations, models

SYSTEM_DESCRIPTIONS = {
    "org_admin": "拥有空间内组织、成员、团队、角色及业务设置的完整管理权限。",
    "org_finance": "负责空间财务、订阅、退款和报表相关操作。",
    "team_manager": "负责当前团队的成员、设置、公告和任务管理。",
    "team_finance": "负责当前团队范围内的财务查看与退款操作。",
    "team_staff": "可查看当前团队及团队设置，适用于普通团队成员。",
    "team_viewer": "仅查看当前团队与团队设置，不参与管理操作。",
}


def migrate_team_role_ownership(apps, schema_editor):
    access_role_model = apps.get_model("access", "AccessRole")
    team_binding_model = apps.get_model("access", "TeamGroupBinding")
    group_model = apps.get_model("auth", "Group")

    for code, description in SYSTEM_DESCRIPTIONS.items():
        access_role_model.objects.filter(code=code, is_system=True).update(description=description)

    roles = access_role_model.objects.filter(scope="team", is_system=False, organization__isnull=False, team__isnull=True)
    for role in roles.select_related("group").iterator():
        team_ids = list(team_binding_model.objects.filter(group_id=role.group_id).values_list("team_id", flat=True).distinct().order_by("team_id"))
        if not team_ids:
            role.is_active = False
            role.save(update_fields=["is_active"])
            continue

        role.team_id = team_ids[0]
        role.save(update_fields=["team"])
        for team_id in team_ids[1:]:
            group_name = f"{role.group.name[:110]}:team:{team_id}:legacy:{role.pk}"
            cloned_group = group_model.objects.create(name=group_name)
            cloned_group.permissions.set(role.group.permissions.all())
            cloned_role = access_role_model.objects.create(
                group=cloned_group,
                organization_id=role.organization_id,
                team_id=team_id,
                scope=role.scope,
                code=role.code,
                name=role.name,
                description=role.description,
                is_system=False,
                is_active=role.is_active,
            )
            team_binding_model.objects.filter(group_id=role.group_id, team_id=team_id).update(group_id=cloned_role.group_id)


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0005_use_base_model_timestamps"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="accessrole",
            name="unique_org_access_role_code",
        ),
        migrations.AddField(
            model_name="accessrole",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="accessrole",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="access_roles",
                to="teams.team",
            ),
        ),
        migrations.RunPython(migrate_team_role_ownership, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="accessrole",
            constraint=models.UniqueConstraint(
                condition=models.Q(organization__isnull=False, team__isnull=True),
                fields=("organization", "scope", "code"),
                name="unique_org_access_role_code",
            ),
        ),
        migrations.AddConstraint(
            model_name="accessrole",
            constraint=models.UniqueConstraint(
                condition=models.Q(team__isnull=False),
                fields=("organization", "team", "scope", "code"),
                name="unique_team_access_role_code",
            ),
        ),
    ]
