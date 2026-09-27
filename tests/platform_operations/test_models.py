from datetime import timedelta

from django.core.exceptions import ValidationError
from django.utils import timezone

import pytest

from apps.platform_operations.models import ContentEntry, HomeBanner
from apps.platform_operations.services import get_schedule_status


def make_entry(**overrides):
    values = {
        "kind": "topic",
        "title": "毕业好房",
        "summary": "适合毕业生的公开房源",
        "tone": "sage",
    }
    values.update(overrides)
    return ContentEntry(**values)


@pytest.mark.parametrize(
    ("enabled", "starts_delta", "ends_delta", "expected"),
    [
        (False, None, None, "disabled"),
        (True, 1, 2, "scheduled"),
        (True, -1, 1, "active"),
        (True, -2, -1, "expired"),
        (True, None, None, "active"),
    ],
)
def test_schedule_status(enabled, starts_delta, ends_delta, expected):
    now = timezone.now()
    entry = make_entry(
        is_enabled=enabled,
        starts_at=now + timedelta(days=starts_delta) if starts_delta is not None else None,
        ends_at=now + timedelta(days=ends_delta) if ends_delta is not None else None,
    )

    assert get_schedule_status(entry, now=now) == expected


@pytest.mark.django_db
def test_schedule_requires_complete_valid_range():
    now = timezone.now()

    with pytest.raises(ValidationError):
        make_entry(starts_at=now).full_clean()

    with pytest.raises(ValidationError):
        make_entry(starts_at=now, ends_at=now).full_clean()

    make_entry(starts_at=now, ends_at=now + timedelta(hours=1)).full_clean()


@pytest.mark.django_db
def test_entry_tone_must_match_kind():
    with pytest.raises(ValidationError):
        make_entry(kind="guide", tone="sage").full_clean()


@pytest.mark.django_db
def test_entry_banner_requires_entry_and_search_banner_rejects_entry():
    entry = make_entry()
    entry.full_clean()
    entry.save()

    with pytest.raises(ValidationError):
        HomeBanner(
            title="专题",
            description="进入专题",
            tone="blue",
            action_type="entry",
        ).full_clean()

    with pytest.raises(ValidationError):
        HomeBanner(
            title="找房",
            description="开始找房",
            tone="blue",
            action_type="house_list",
            entry=entry,
        ).full_clean()
