from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import transaction

from apps.house.constants import ContactRole, HouseStatus, LeaseStatus
from apps.settings.constants import ValueType

DEFAULT_BUILDING_SETTING_KEY = "property_rental.default_building_id"

if TYPE_CHECKING:
    from apps.accounts.models import User
    from apps.organizations.models import Organization


def claim_landlord_contact_for_bound_phone(user: User, organization: Organization | None, phone: str | None):
    """手机号绑定后的房东 Contact 统一认领入口。"""
    if organization is None or not phone:
        return None

    from apps.accounts.models import normalize_phone, split_phone
    from apps.house.models import Contact

    normalized_phone = normalize_phone(phone)
    _country_code, national_number = split_phone(normalized_phone)
    phone_candidates = {value for value in {phone, normalized_phone, national_number} if value}

    qs = Contact.objects.filter(
        organization=organization,
        phone__in=phone_candidates,
        roles__contains=[ContactRole.LANDLORD],
    )
    existing = qs.filter(user=user).first()
    if existing is not None:
        return existing

    contact = qs.filter(user__isnull=True).order_by("id").first()
    if contact is None:
        return None

    contact.user = user
    contact.save(update_fields=["user", "updated_at"])
    return contact


def get_landlord_houses(user: User, organization: Organization):
    from apps.house.models import House

    return (
        House.objects.select_related("building__estate", "landlord")
        .filter(
            landlord__user=user,
            building__estate__organization=organization,
        )
        .order_by("building__estate__name", "building__name", "room_number")
    )


def get_landlord_leases(user: User, organization: Organization):
    from apps.house.models import Lease

    return (
        Lease.objects.select_related("house__building__estate", "house__landlord", "tenant")
        .filter(
            organization=organization,
            house__landlord__user=user,
            house__building__estate__organization=organization,
        )
        .order_by("-start_date", "-id")
    )


def _default_building_setting():
    from apps.settings.models import DefaultSetting

    return DefaultSetting.objects.get_or_create(
        key=DEFAULT_BUILDING_SETTING_KEY,
        defaults={
            "value": 0,
            "value_type": ValueType.INTEGER,
            "description": "房源租赁默认楼栋",
            "label": "默认楼栋",
            "widget": "select",
            "ui": {"options_source": "house.buildings"},
            "category": "property_rental",
        },
    )[0]


@transaction.atomic
def ensure_default_building(organization: Organization):
    from apps.house.models import Building, Estate
    from apps.settings.models import OrganizationSetting

    setting = _default_building_setting()
    override = OrganizationSetting.objects.select_for_update().filter(organization=organization, setting=setting).first()
    if override:
        building = Building.objects.select_related("estate").filter(pk=override.value, organization=organization).first()
        if building:
            return building

    estate, _ = Estate.objects.get_or_create(
        organization=organization,
        name="默认项目",
        defaults={
            "display_name": "默认项目",
            "province": "默认",
            "city": "默认",
            "district": "默认",
            "address": "默认",
        },
    )
    building, _ = Building.objects.get_or_create(
        organization=organization,
        estate=estate,
        name="默认楼栋",
        defaults={"floors": 1, "address": ""},
    )
    OrganizationSetting.objects.update_or_create(organization=organization, setting=setting, defaults={"value": building.pk})
    return building


def set_default_building(organization: Organization, building_id: int):
    from apps.house.models import Building
    from apps.settings.models import OrganizationSetting

    setting = _default_building_setting()
    building = Building.objects.select_related("estate").get(pk=building_id, organization=organization)
    OrganizationSetting.objects.update_or_create(organization=organization, setting=setting, defaults={"value": building.pk})
    return building


@transaction.atomic
def recalculate_house_status(house_id: int):
    """统一重算房态；人工 locked/renovating 不被无 active 租约时覆盖。"""
    from apps.house.models import House, Lease

    house = House.objects.select_for_update().get(pk=house_id)
    if house.status in {HouseStatus.LOCKED, HouseStatus.RENOVATING}:
        return house

    has_active = Lease.objects.filter(house_id=house_id, status=LeaseStatus.ACTIVE).exists()
    next_status = HouseStatus.RENTED if has_active else HouseStatus.VACANT
    if house.status != next_status:
        House.objects.filter(pk=house.pk).update(status=next_status)
        house.status = next_status
    return house


def validate_org_scoped_media_refs(*, instance, refs, media_by_id, field):
    """固定媒体字段只允许引用组织目录下的媒体。"""
    org = getattr(instance, "organization", None)
    if org is None:
        return
    prefix = f"uploads/orgs/{org.pk}/"
    invalid = [media.pk for media in media_by_id.values() if not (media.file.name or "").startswith(prefix)]
    if invalid:
        raise ValueError(f"媒体文件必须属于当前组织目录: {invalid}")
