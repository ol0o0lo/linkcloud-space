from importlib import import_module

from django.contrib.auth import get_user_model

import pytest

from apps.miniprogram_home.models import MiniProgramHomeEntry
from tests.api_helpers import api_data

ADMIN_BASE = "/api/admin/miniprogram-home"
PUBLIC_BASE = "/api/public/miniprogram"


@pytest.mark.django_db
def test_management_endpoints_require_superuser(client):
    user = get_user_model().objects.create_user(username="home-operator", password="secret")
    client.force_login(user)

    response = client.get(f"{ADMIN_BASE}/entries/", {"page": 1, "page_size": 20})

    assert response.status_code == 403


@pytest.mark.django_db
def test_superuser_can_create_and_update_home_entry(client):
    user = get_user_model().objects.create_superuser(username="home-admin", password="secret")
    client.force_login(user)
    create_response = client.post(
        f"{ADMIN_BASE}/entries/",
        {
            "kind": "guide",
            "eyebrow": "避坑指南",
            "title": "签约前确认清单",
            "summary": "检查合同、押金和交接事项",
            "body_markdown": "# 签约前确认清单",
            "tone": "slate",
            "sort_order": 5,
            "is_enabled": True,
            "starts_at": None,
            "ends_at": None,
        },
        content_type="application/json",
    )

    assert create_response.status_code == 201
    created = api_data(create_response)
    assert created["title"] == "签约前确认清单"
    assert created["display_status"] == "active"

    update_response = client.patch(
        f"{ADMIN_BASE}/entries/{created['id']}/",
        {"is_enabled": False},
        content_type="application/json",
    )

    assert update_response.status_code == 200
    assert api_data(update_response)["display_status"] == "disabled"


@pytest.mark.django_db
def test_public_home_and_entry_detail_are_anonymous(client):
    entry = MiniProgramHomeEntry.objects.create(
        kind="guide",
        title="公开避坑指南",
        summary="无需登录即可阅读",
        body_markdown="## 正文\n\n请核对合同。",
        tone="slate",
        sort_order=0,
        is_enabled=True,
    )

    home_response = client.get(f"{PUBLIC_BASE}/home/")
    detail_response = client.get(f"{PUBLIC_BASE}/home-entries/{entry.slug}/")

    assert home_response.status_code == 200
    assert any(item["slug"] == entry.slug for item in api_data(home_response)["guides"])
    assert detail_response.status_code == 200
    assert "<h2>正文</h2>" in api_data(detail_response)["body_html"]


@pytest.mark.django_db
def test_seeded_guide_contains_publishable_content(client):
    seed_content = import_module("apps.miniprogram_home.migrations.0003_upgrade_seed_content").CONTENT_BY_SLUG["first-rental-checklist"]
    entry = MiniProgramHomeEntry.objects.create(
        kind="guide",
        slug="first-rental-checklist",
        title="第一次租房必须确认的 8 件事",
        summary=seed_content["summary"],
        body_markdown=seed_content["body_markdown"].strip(),
        tone="slate",
        is_enabled=True,
    )

    assert len(entry.body_markdown) > 500
    assert "## 1. 出租人是否有权出租" in entry.body_markdown
    assert "## 8. 入住交接是否完整" in entry.body_markdown

    response = client.get(f"{PUBLIC_BASE}/home-entries/{entry.slug}/")

    assert response.status_code == 200
    body_html = api_data(response)["body_html"]
    assert body_html.count("<h2>") == 8
    assert "遇到催促立即付款" in body_html
