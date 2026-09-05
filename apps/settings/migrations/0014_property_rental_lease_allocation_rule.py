from django.db import migrations

LEASE_ALLOCATION_RULE_SETTING = {
    "key": "property_rental.lease_allocation_rule",
    "value": {
        "method": "percentage",
        "rate_bp": 9000,
        "fixed_amount": None,
    },
    "value_type": "json",
    "widget": "json_editor",
    "label": "签约员工收益规则",
    "description": "登记签约时使用的员工收益规则。团队未覆盖时继承租户规则；默认按成交房源月租的 90% 计算。",
    "category": "property_rental",
    "ui": {
        "scopes": ["organization", "team"],
        "inherit_org": True,
        "control": "lease_allocation_rule",
    },
}


def ensure_lease_allocation_rule_setting(apps, schema_editor):
    default_setting = apps.get_model("app_settings", "DefaultSetting")
    setting, _ = default_setting.objects.get_or_create(
        key=LEASE_ALLOCATION_RULE_SETTING["key"],
        defaults=LEASE_ALLOCATION_RULE_SETTING,
    )
    default_setting.objects.filter(pk=setting.pk).update(
        value=LEASE_ALLOCATION_RULE_SETTING["value"],
        value_type=LEASE_ALLOCATION_RULE_SETTING["value_type"],
        widget=LEASE_ALLOCATION_RULE_SETTING["widget"],
        label=LEASE_ALLOCATION_RULE_SETTING["label"],
        description=LEASE_ALLOCATION_RULE_SETTING["description"],
        category=LEASE_ALLOCATION_RULE_SETTING["category"],
        ui=LEASE_ALLOCATION_RULE_SETTING["ui"],
    )


class Migration(migrations.Migration):
    dependencies = [("app_settings", "0013_property_rental_inspection_max_age_days")]

    operations = [migrations.RunPython(ensure_lease_allocation_rule_setting, migrations.RunPython.noop)]
