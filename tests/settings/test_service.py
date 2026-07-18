import importlib

from django.apps import apps as django_apps
from django.core.exceptions import ValidationError

import pytest
from model_bakery import baker

from apps.house.services import (
    DEFAULT_BUILDING_SETTING_KEY,
    DEFAULT_HOUSE_PUBLISH_RULES,
    DEFAULT_LOCATION_SETTING_KEY,
    PUBLISH_RULES_SETTING_KEY,
    TAG_SUGGESTIONS_SETTING_KEY,
    _default_building_setting,
    _publish_rules_setting,
    evaluate_house_publish_state,
    normalize_house_publish_rules,
)
from apps.settings.models import DefaultSetting, OrganizationSetting, TeamSetting, UserSetting
from apps.settings.service import (
    delete_org_setting,
    delete_team_setting,
    delete_user_setting,
    get_all_org_settings,
    get_all_team_settings,
    get_all_user_settings,
    get_org_setting,
    get_team_setting,
    get_user_setting,
    set_org_setting,
    set_team_setting,
    set_user_setting,
)


@pytest.fixture
def default_text(db):
    return DefaultSetting.objects.create(
        key="site_name",
        value="My SaaS",
        value_type="text",
        label="站点名称",
        widget="input",
        ui={"placeholder": "请输入站点名称"},
        category="general",
    )


@pytest.fixture
def default_password(db):
    return DefaultSetting.objects.create(key="api_secret", value="raw_secret", value_type="password")


@pytest.fixture
def default_boolean(db):
    return DefaultSetting.objects.create(key="feature_x", value=True, value_type="boolean")


@pytest.fixture
def default_integer(db):
    return DefaultSetting.objects.create(key="max_members", value=100, value_type="integer")


@pytest.fixture
def default_float(db):
    return DefaultSetting.objects.create(key="commission_rate", value="0.12", value_type="float")


@pytest.fixture
def org(db):
    return baker.make("organizations.Organization")


@pytest.fixture
def team(db, org):
    return baker.make("teams.Team", organization=org)


@pytest.fixture
def user(db):
    return baker.make("accounts.User")


@pytest.mark.django_db
class TestGetOrgSetting:
    def test_returns_default_when_no_override(self, default_text, org):
        result = get_org_setting(org, "site_name")
        assert result["value"] == "My SaaS"
        assert result["is_customized"] is False

    def test_returns_override_when_set(self, default_text, org):
        OrganizationSetting.objects.create(organization=org, setting=default_text, value="Custom SaaS")
        result = get_org_setting(org, "site_name")
        assert result["value"] == "Custom SaaS"
        assert result["is_customized"] is True

    def test_password_value_is_masked(self, default_password, org):
        result = get_org_setting(org, "api_secret")
        assert result["value"] == "********"

    def test_password_override_is_also_masked(self, default_password, org):
        OrganizationSetting.objects.create(organization=org, setting=default_password, value="my_override_secret")
        result = get_org_setting(org, "api_secret")
        assert result["value"] == "********"
        assert result["is_customized"] is True

    def test_raises_for_unknown_key(self, org, db):
        with pytest.raises(DefaultSetting.DoesNotExist):
            get_org_setting(org, "nonexistent_key")

    def test_boolean_type_returned_as_bool(self, default_boolean, org):
        result = get_org_setting(org, "feature_x")
        assert result["value"] is True

    def test_integer_type_returned_as_int(self, default_integer, org):
        result = get_org_setting(org, "max_members")
        assert result["value"] == 100
        assert isinstance(result["value"], int)

    def test_float_type_returned_as_float(self, default_float, org):
        result = get_org_setting(org, "commission_rate")
        assert result["value"] == 0.12
        assert isinstance(result["value"], float)


@pytest.mark.django_db
class TestGetAllOrgSettings:
    def test_returns_all_default_keys(self, default_text, default_boolean, org):
        results = get_all_org_settings(org)
        keys = [r["key"] for r in results]
        assert "site_name" in keys
        assert "feature_x" in keys

    def test_marks_customized_correctly(self, default_text, org):
        OrganizationSetting.objects.create(organization=org, setting=default_text, value="Custom")
        results = get_all_org_settings(org)
        result = next(r for r in results if r["key"] == "site_name")
        assert result["is_customized"] is True

    def test_includes_label_widget_ui_and_category_metadata(self, db, org):
        DefaultSetting.objects.create(
            key="smtp_host",
            value="localhost",
            value_type="text",
            description="SMTP 服务器地址",
            label="SMTP 地址",
            widget="input",
            ui={"placeholder": "smtp.example.com"},
            category="general",
        )
        results = get_all_org_settings(org)
        result = next(r for r in results if r["key"] == "smtp_host")
        assert result["label"] == "SMTP 地址"
        assert result["description"] == "SMTP 服务器地址"
        assert result["value_type"] == "text"
        assert result["widget"] == "input"
        assert result["ui"] == {"placeholder": "smtp.example.com"}
        assert result["category"] == "general"

    def test_system_only_setting_is_hidden_from_org_and_team_scopes(self, org, team):
        setting = DefaultSetting.objects.create(
            key=TAG_SUGGESTIONS_SETTING_KEY,
            value=["近地铁"],
            value_type="json",
            widget="tags",
            ui={"scopes": ["system"]},
        )
        OrganizationSetting.objects.create(organization=org, setting=setting, value=["组织覆盖标签"])
        TeamSetting.objects.create(team=team, setting=setting, value=["团队覆盖标签"])

        assert TAG_SUGGESTIONS_SETTING_KEY not in {item["key"] for item in get_all_org_settings(org)}
        assert TAG_SUGGESTIONS_SETTING_KEY not in {item["key"] for item in get_all_team_settings(team)}
        with pytest.raises(DefaultSetting.DoesNotExist):
            get_org_setting(org, TAG_SUGGESTIONS_SETTING_KEY)
        with pytest.raises(DefaultSetting.DoesNotExist):
            set_org_setting(org, TAG_SUGGESTIONS_SETTING_KEY, ["采光好"])
        with pytest.raises(DefaultSetting.DoesNotExist):
            get_team_setting(team, TAG_SUGGESTIONS_SETTING_KEY)
        with pytest.raises(DefaultSetting.DoesNotExist):
            set_team_setting(team, TAG_SUGGESTIONS_SETTING_KEY, ["采光好"])
        with pytest.raises(DefaultSetting.DoesNotExist):
            delete_org_setting(org, TAG_SUGGESTIONS_SETTING_KEY)
        with pytest.raises(DefaultSetting.DoesNotExist):
            delete_team_setting(team, TAG_SUGGESTIONS_SETTING_KEY)

        assert OrganizationSetting.objects.filter(organization=org, setting=setting, value=["组织覆盖标签"]).exists()
        assert TeamSetting.objects.filter(team=team, setting=setting, value=["团队覆盖标签"]).exists()


@pytest.mark.django_db
class TestSetOrgSetting:
    def test_creates_override(self, default_text, org):
        set_org_setting(org, "site_name", "New Name")
        assert OrganizationSetting.objects.filter(organization=org, setting=default_text).exists()

    def test_upserts_existing_override(self, default_text, org):
        set_org_setting(org, "site_name", "First")
        set_org_setting(org, "site_name", "Second")
        assert OrganizationSetting.objects.filter(organization=org, setting=default_text).count() == 1
        assert OrganizationSetting.objects.get(organization=org, setting=default_text).value == "Second"

    def test_raises_for_unknown_key(self, org, db):
        with pytest.raises(DefaultSetting.DoesNotExist):
            set_org_setting(org, "nonexistent_key", "value")

    def test_default_location_accepts_only_complete_location_value(self, org, db):
        DefaultSetting.objects.create(
            key=DEFAULT_LOCATION_SETTING_KEY,
            value={},
            value_type="json",
        )

        set_org_setting(
            org,
            DEFAULT_LOCATION_SETTING_KEY,
            {"address": "科技园路 1 号", "lat": 22.540123, "lng": 113.934567},
        )
        assert get_org_setting(org, DEFAULT_LOCATION_SETTING_KEY)["value"]["lat"] == 22.540123

        with pytest.raises(ValidationError):
            set_org_setting(
                org,
                DEFAULT_LOCATION_SETTING_KEY,
                {"address": "科技园路 1 号", "lat": 22.540123},
            )


@pytest.mark.django_db
class TestDeleteOrgSetting:
    def test_deletes_override(self, default_text, org):
        OrganizationSetting.objects.create(organization=org, setting=default_text, value="Custom")
        delete_org_setting(org, "site_name")
        assert not OrganizationSetting.objects.filter(organization=org, setting=default_text).exists()

    def test_raises_when_no_override(self, default_text, org):
        with pytest.raises(OrganizationSetting.DoesNotExist):
            delete_org_setting(org, "site_name")


@pytest.mark.django_db
class TestTeamSettings:
    def test_fallback_to_default_not_org(self, default_text, org, team):
        """Team fallback 直接到 default，不经过 Org。"""
        OrganizationSetting.objects.create(organization=org, setting=default_text, value="Org Override")
        result = get_team_setting(team, "site_name")
        assert result["value"] == "My SaaS"  # 取 default，不取 org 的
        assert result["is_customized"] is False

    def test_team_override_wins(self, default_text, org, team):
        TeamSetting.objects.create(team=team, setting=default_text, value="Team Override")
        result = get_team_setting(team, "site_name")
        assert result["value"] == "Team Override"
        assert result["is_customized"] is True


@pytest.mark.django_db
class TestUserSettings:
    def test_returns_none_for_missing_key(self, user):
        result = get_user_setting(user, "onboarding_done")
        assert result is None

    def test_returns_default_for_missing_key(self, user):
        result = get_user_setting(user, "onboarding_done", default=False)
        assert result is False

    def test_set_and_get(self, user):
        set_user_setting(user, "onboarding_done", True)
        result = get_user_setting(user, "onboarding_done")
        assert result is True

    def test_upsert(self, user):
        set_user_setting(user, "theme", "light")
        set_user_setting(user, "theme", "dark")
        assert UserSetting.objects.filter(user=user, key="theme").count() == 1
        assert get_user_setting(user, "theme") == "dark"

    def test_delete(self, user):
        set_user_setting(user, "theme", "light")
        delete_user_setting(user, "theme")
        assert get_user_setting(user, "theme") is None

    def test_get_all(self, user):
        set_user_setting(user, "theme", "dark")
        set_user_setting(user, "onboarding_done", True)
        results = get_all_user_settings(user)
        assert len(results) == 2
        keys = [r["key"] for r in results]
        assert "theme" in keys


@pytest.mark.django_db
class TestDefaultBuildingSetting:
    def test_existing_setting_metadata_is_filled_without_overwriting_value(self):
        DefaultSetting.objects.create(
            key=DEFAULT_BUILDING_SETTING_KEY,
            value=123,
            value_type="integer",
        )

        setting = _default_building_setting()

        assert setting.value == 123
        assert setting.description == "房源租赁默认楼栋"
        assert setting.label == "默认楼栋"
        assert setting.widget == "select"
        assert setting.ui == {"options_source": "house.buildings"}
        assert setting.category == "property_rental"

    def test_default_building_metadata_migration_backfill_keeps_value(self):
        setting = DefaultSetting.objects.create(
            key=DEFAULT_BUILDING_SETTING_KEY,
            value=456,
            value_type="integer",
        )
        migration = importlib.import_module("apps.settings.migrations.0004_defaultsetting_category")

        migration.backfill_default_building_metadata(django_apps, None)

        setting.refresh_from_db()
        assert setting.value == 456
        assert setting.description == "房源租赁默认楼栋"
        assert setting.label == "默认楼栋"
        assert setting.widget == "select"
        assert setting.ui == {"options_source": "house.buildings"}
        assert setting.category == "property_rental"


@pytest.mark.django_db
class TestPublishRulesSetting:
    def test_existing_setting_metadata_is_filled_without_overwriting_value(self):
        DefaultSetting.objects.create(
            key=PUBLISH_RULES_SETTING_KEY,
            value={"rent": {"mode": "warn"}},
            value_type="json",
        )

        setting = _publish_rules_setting()

        assert setting.value == {"rent": {"mode": "warn"}}
        assert setting.description == "控制房源发布时哪些资料缺失会阻断发布，哪些仅做提醒。"
        assert setting.label == "房源发布规则"
        assert setting.widget == "json_editor"
        assert setting.ui == {"options_source": "house.publish_rules"}
        assert setting.category == "property_rental"

    def test_normalize_publish_rules_merges_defaults(self):
        rules = normalize_house_publish_rules({"rent": {"mode": "warn"}, "images": {"mode": "required", "min_count": "5"}})

        assert rules["rent"]["mode"] == "warn"
        assert rules["images"]["mode"] == "required"
        assert rules["images"]["min_count"] == 5
        assert rules["video"] == DEFAULT_HOUSE_PUBLISH_RULES["video"]

    def test_evaluate_publish_state_splits_blocking_and_warning_issues(self, org):
        estate = baker.make("house.Estate", organization=org)
        building = baker.make("house.Building", organization=org, estate=estate, address="测试楼栋地址")
        house = baker.make(
            "house.House",
            building=building,
            landlord=None,
            asking_rent=None,
            images=[],
            videos=[],
        )

        result = evaluate_house_publish_state(
            house,
            rules={
                "landlord": {"mode": "required"},
                "rent": {"mode": "required"},
                "cover": {"mode": "warn"},
                "images": {"mode": "warn", "min_count": 3},
                "floor_plan": {"mode": "off"},
                "video": {"mode": "off", "min_count": 1},
            },
        )

        assert result["can_publish"] is False
        assert result["blocking_issues"] == ["缺房东", "缺租金"]
        assert result["warning_issues"] == ["缺封面", "图片不足"]

    def test_publish_rules_migration_backfill(self):
        migration = importlib.import_module("apps.settings.migrations.0005_property_rental_publish_rules")

        migration.ensure_property_rental_publish_rules(django_apps, None)

        setting = DefaultSetting.objects.get(key=PUBLISH_RULES_SETTING_KEY)
        assert setting.value == DEFAULT_HOUSE_PUBLISH_RULES
        assert setting.value_type == "json"
        assert setting.category == "property_rental"


@pytest.mark.django_db
class TestTagSuggestionsSetting:
    def test_tags_widget_normalizes_whitespace_empty_values_and_duplicates(self):
        setting = DefaultSetting(
            key=TAG_SUGGESTIONS_SETTING_KEY,
            value=[" 近地铁 ", "近地铁", "南北   通透", ""],
            value_type="json",
            widget="tags",
        )

        setting.full_clean()

        assert setting.value == ["近地铁", "南北 通透"]

    def test_tags_widget_rejects_non_string_items(self):
        setting = DefaultSetting(
            key=TAG_SUGGESTIONS_SETTING_KEY,
            value=["近地铁", 1],
            value_type="json",
            widget="tags",
        )

        with pytest.raises(ValidationError):
            setting.full_clean()

    def test_migration_creates_global_setting_without_overwriting_existing_value(self):
        migration = importlib.import_module("apps.settings.migrations.0008_property_rental_tag_suggestions")
        migration.ensure_property_rental_tag_suggestions(django_apps, None)

        setting = DefaultSetting.objects.get(key=TAG_SUGGESTIONS_SETTING_KEY)
        assert setting.value == migration.DEFAULT_TAG_SUGGESTIONS
        assert setting.widget == "tags"
        assert setting.ui["scopes"] == ["system"]

        setting.value = ["自定义全局标签"]
        setting.save(update_fields=["value"])
        migration.ensure_property_rental_tag_suggestions(django_apps, None)
        setting.refresh_from_db()

        assert setting.value == ["自定义全局标签"]
        assert setting.description == "仅作为楼栋和房源标签录入时的快捷候选，不会自动添加，也不限制手动输入。"
