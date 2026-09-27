from collections.abc import Iterable

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

import markdown
import nh3

from apps.house.services import apply_public_house_filters, get_public_houses_queryset
from apps.platform_operations.constants import ContentDisplayStatus, ContentEntryKind
from apps.platform_operations.models import ContentEntry, ContentEntryHouse, HomeBanner

ALLOWED_MARKDOWN_TAGS = {
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "strong",
    "em",
    "code",
    "pre",
    "a",
    "hr",
}


def active_at(queryset, *, now=None):
    now = now or timezone.now()
    return queryset.filter(is_enabled=True).filter(Q(starts_at__isnull=True, ends_at__isnull=True) | Q(starts_at__lte=now, ends_at__gt=now))


def get_schedule_status(item, *, now=None) -> str:
    now = now or timezone.now()
    if not item.is_enabled:
        return ContentDisplayStatus.DISABLED
    if item.starts_at is None and item.ends_at is None:
        return ContentDisplayStatus.ACTIVE
    if now < item.starts_at:
        return ContentDisplayStatus.SCHEDULED
    if now >= item.ends_at:
        return ContentDisplayStatus.EXPIRED
    return ContentDisplayStatus.ACTIVE


def render_home_markdown(source: str) -> str:
    rendered = markdown.markdown(source or "", extensions=["sane_lists"])
    return nh3.clean(
        rendered,
        tags=ALLOWED_MARKDOWN_TAGS,
        attributes={"a": {"href", "title"}},
        url_schemes={"http", "https"},
        link_rel="noopener noreferrer",
    )


def save_validated(instance, *, update_fields=None):
    instance.full_clean()
    instance.save(update_fields=update_fields)
    return instance


def get_public_entries(*, kind: str | None = None, now=None):
    queryset = active_at(ContentEntry.objects.all(), now=now)
    if kind:
        queryset = queryset.filter(kind=kind)
    return queryset.order_by("sort_order", "id")


def get_public_banners(*, now=None):
    active_entry_ids = get_public_entries(now=now).values("id")
    return active_at(HomeBanner.objects.select_related("entry"), now=now).filter(Q(entry__isnull=True) | Q(entry_id__in=active_entry_ids)).order_by("sort_order", "id")


def get_public_home(*, now=None) -> dict:
    return {
        "banners": list(get_public_banners(now=now)[:5]),
        "topics": list(get_public_entries(kind=ContentEntryKind.TOPIC, now=now)[:2]),
        "guides": list(get_public_entries(kind=ContentEntryKind.GUIDE, now=now)[:2]),
    }


def get_public_entry_houses(entry: ContentEntry):
    public_house_ids = get_public_houses_queryset().values("id")
    return (
        ContentEntryHouse.objects.filter(entry=entry, house_id__in=public_house_ids)
        .select_related("house__building__estate", "house__building__organization")
        .order_by("sort_order", "id")
    )


def get_house_candidates(*, keyword: str | None = None):
    queryset = get_public_houses_queryset()
    if keyword:
        queryset = apply_public_house_filters(queryset, keyword=keyword)
    return queryset.order_by("-updated_at", "-id")


@transaction.atomic
def sync_entry_houses(entry: ContentEntry, items: Iterable[dict]) -> list[ContentEntryHouse]:
    if entry.kind != ContentEntryKind.TOPIC:
        raise ValidationError({"entry": ["只有专题活动可以关联房源。"]})

    normalized_items = list(items)
    house_ids = [int(item["house_id"]) for item in normalized_items]
    if len(house_ids) != len(set(house_ids)):
        raise ValidationError({"items": ["同一专题不能重复选择同一套房源。"]})

    existing_links = {link.house_id: link for link in ContentEntryHouse.objects.select_for_update().filter(entry=entry)}
    new_house_ids = set(house_ids) - set(existing_links)
    valid_new_ids = set(get_public_houses_queryset().filter(id__in=new_house_ids).values_list("id", flat=True))
    invalid_new_ids = sorted(new_house_ids - valid_new_ids)
    if invalid_new_ids:
        raise ValidationError({"items": [f"只能新增当前公开招租房源：{invalid_new_ids}"]})

    keep_ids = set(house_ids)
    ContentEntryHouse.objects.filter(entry=entry).exclude(house_id__in=keep_ids).delete()

    for index, item in enumerate(normalized_items, start=1):
        house_id = int(item["house_id"])
        reason = str(item.get("recommendation_reason") or "").strip()
        link = existing_links.get(house_id)
        if link is None:
            link = ContentEntryHouse(entry=entry, house_id=house_id)
        link.sort_order = index * 10
        link.recommendation_reason = reason
        link.full_clean()
        link.save()

    return list(ContentEntryHouse.objects.filter(entry=entry).select_related("house__building__estate", "house__building__organization"))
