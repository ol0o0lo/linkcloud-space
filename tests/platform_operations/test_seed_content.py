from importlib import import_module

from django.db import connection
from django.db.migrations.loader import MigrationLoader
from django.test import override_settings

import pytest

from apps.platform_operations.models import ContentEntry


@pytest.mark.django_db
@override_settings(MIGRATION_MODULES={})
def test_polished_seed_updates_only_unchanged_content():
    original = import_module("apps.platform_operations.migrations.0003_upgrade_seed_content").CONTENT_BY_SLUG
    polished = import_module("apps.platform_operations.migrations.0004_polish_seed_home_entries")
    guide = ContentEntry.objects.create(
        kind="guide",
        slug="first-rental-checklist",
        title="第一次租房必须确认的 8 件事",
        summary=original["first-rental-checklist"]["summary"],
        body_markdown=original["first-rental-checklist"]["body_markdown"].strip(),
        tone="slate",
    )
    edited = ContentEntry.objects.create(
        kind="guide",
        slug="commute-time-guide",
        title="通勤时间怎么估算？",
        summary="运营修改过的摘要",
        body_markdown=original["commute-time-guide"]["body_markdown"].strip(),
        tone="clay",
    )

    historical_apps = MigrationLoader(connection).project_state(("miniprogram_home", "0004_polish_seed_home_entries")).apps
    polished.polish_seed_content(historical_apps, None)
    guide.refresh_from_db()
    edited.refresh_from_db()

    assert guide.summary == polished.CONTENT_BY_SLUG["first-rental-checklist"]["summary"]
    assert guide.body_markdown == polished.CONTENT_BY_SLUG["first-rental-checklist"]["body_markdown"].strip()
    assert edited.summary == "运营修改过的摘要"
    assert edited.body_markdown == original["commute-time-guide"]["body_markdown"].strip()
