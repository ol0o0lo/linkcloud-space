import importlib

from django.apps import apps as django_apps

import pytest

from apps.house.vacancy_sync import VACANCY_SYNC_SETTING_KEY
from apps.settings.models import DefaultSetting


@pytest.mark.django_db
def test_vacancy_sync_setting_migration_registers_org_boolean_without_overwriting_value():
    migration = importlib.import_module("apps.settings.migrations.0009_property_rental_vacancy_sync")

    migration.ensure_property_rental_vacancy_sync_setting(django_apps, None)

    setting = DefaultSetting.objects.get(key=VACANCY_SYNC_SETTING_KEY)
    assert setting.value is False
    assert setting.value_type == "boolean"
    assert setting.widget == "switch"
    assert setting.ui == {"scopes": ["organization"]}

    setting.value = True
    setting.save(update_fields=["value"])
    migration.ensure_property_rental_vacancy_sync_setting(django_apps, None)
    setting.refresh_from_db()

    assert setting.value is True
    assert setting.label == "房表同步强制改已租"
