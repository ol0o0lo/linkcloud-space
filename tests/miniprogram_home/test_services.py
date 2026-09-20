from django.core.exceptions import ValidationError

import pytest

from apps.house.constants import EstatePropertyType, HouseStatus
from apps.house.models import Building, Estate, House
from apps.miniprogram_home.models import MiniProgramHomeBanner, MiniProgramHomeEntry, MiniProgramHomeEntryHouse
from apps.miniprogram_home.services import get_public_entry_houses, get_public_home, render_home_markdown, sync_entry_houses
from apps.organizations.models import Organization


def create_house(*, slug: str, status: str = HouseStatus.LISTED) -> House:
    organization = Organization.objects.create(name=slug, slug=slug, is_active=True)
    estate = Estate.objects.create(
        organization=organization,
        name=f"{slug}-estate",
        display_name=f"{slug}小区",
        property_type=EstatePropertyType.RESIDENTIAL,
        province="广东",
        city="深圳",
        district="南山",
    )
    building = Building.objects.create(organization=organization, estate=estate, name="1栋", floors=20, address="科技园路")
    return House.objects.create(building=building, room_number="101", status=status, bedrooms=1, living_rooms=0)


def create_topic(**overrides) -> MiniProgramHomeEntry:
    values = {
        "kind": "topic",
        "title": "毕业好房",
        "summary": "适合毕业生的公开房源",
        "tone": "sage",
        "is_enabled": True,
        "sort_order": 1,
    }
    values.update(overrides)
    return MiniProgramHomeEntry.objects.create(**values)


def test_render_home_markdown_keeps_basic_formatting_and_removes_unsafe_content():
    html = render_home_markdown("# 标题\n\n[危险链接](javascript:alert(1))\n\n<script>alert(2)</script>\n\n**正文**")

    assert "<h1>标题</h1>" in html
    assert "<strong>正文</strong>" in html
    assert "javascript:" not in html
    assert "<script" not in html


@pytest.mark.django_db
def test_public_home_only_returns_enabled_items_and_enforces_home_limits():
    MiniProgramHomeBanner.objects.all().update(is_enabled=False)
    MiniProgramHomeEntry.objects.all().update(is_enabled=False)
    for index in range(7):
        MiniProgramHomeBanner.objects.create(
            title=f"Banner {index}",
            description="说明",
            tone="blue",
            action_type="house_list",
            is_enabled=index < 6,
            sort_order=index,
        )
    for index in range(4):
        create_topic(title=f"专题 {index}", sort_order=index)

    result = get_public_home()

    assert [item.title for item in result["banners"]] == [f"Banner {index}" for index in range(5)]
    assert [item.title for item in result["topics"]] == ["专题 0", "专题 1"]


@pytest.mark.django_db
def test_topic_house_sync_only_accepts_public_new_houses_and_hides_later_unlisted_houses():
    topic = create_topic()
    public_house = create_house(slug="public-house")
    hidden_house = create_house(slug="hidden-house", status=HouseStatus.VACANT)

    links = sync_entry_houses(topic, [{"house_id": public_house.pk, "recommendation_reason": "通勤方便"}])
    assert [(link.house_id, link.recommendation_reason) for link in links] == [(public_house.pk, "通勤方便")]

    with pytest.raises(ValidationError):
        sync_entry_houses(topic, [{"house_id": hidden_house.pk, "recommendation_reason": ""}])

    public_house.status = HouseStatus.VACANT
    public_house.save(update_fields=["status", "updated_at"])

    assert MiniProgramHomeEntryHouse.objects.filter(entry=topic, house=public_house).exists()
    assert list(get_public_entry_houses(topic)) == []
    retained = sync_entry_houses(topic, [{"house_id": public_house.pk, "recommendation_reason": "仍保留运营备注"}])
    assert retained[0].recommendation_reason == "仍保留运营备注"


@pytest.mark.django_db
def test_guide_cannot_sync_houses():
    guide = MiniProgramHomeEntry.objects.create(kind="guide", title="避坑指南", summary="签约注意事项", tone="slate")
    house = create_house(slug="guide-house")

    with pytest.raises(ValidationError):
        sync_entry_houses(guide, [{"house_id": house.pk}])
