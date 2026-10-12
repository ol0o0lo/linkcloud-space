from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.http import Http404
from django.shortcuts import get_object_or_404

from apps.geography.coordinates import make_wgs84_point
from apps.house.constants import ContactRole, HouseStatus
from apps.house.exceptions import HouseInvalidException, ResourceInUseException
from apps.house.models import Building, Estate, House
from apps.house.services.contacts import get_contact_for_new_business
from apps.house.services.settings import (
    HOUSE_PUBLISH_ISSUE_LABELS,
    PUBLISH_RULE_MODE_OFF,
    PUBLISH_RULE_MODE_REQUIRED,
    get_org_house_publish_rules,
    normalize_house_publish_rules,
)
from apps.organizations.models import Organization

RESOURCE_PREVIEW_LIMIT = 5


def _property_data(data: dict) -> dict:
    data = dict(data)
    if isinstance(data.get("location"), dict):
        location = data["location"]
        data["location"] = make_wgs84_point(location["longitude"], location["latitude"], location["coordinate_system"])
    return data


@transaction.atomic
def create_estate(*, organization, data: dict):
    return Estate.objects.create(organization=organization, **_property_data(data))


@transaction.atomic
def update_estate(*, organization, estate_id: int, changes: dict):
    estate = get_object_or_404(Estate.objects.select_for_update(), pk=estate_id, organization=organization)
    for field, value in _property_data(changes).items():
        setattr(estate, field, value)
    estate.save()
    return estate


@transaction.atomic
def create_building(*, organization, data: dict):
    data = _property_data(data)
    estate_id = data.pop("estate_id", None)
    estate = get_object_or_404(Estate, pk=estate_id, organization=organization) if estate_id is not None else None
    return Building.objects.create(organization=organization, estate=estate, **data)


@transaction.atomic
def update_building(*, organization, building_id: int, changes: dict):
    building = get_object_or_404(Building.objects.select_for_update(), pk=building_id, organization=organization)
    data = _property_data(changes)
    if "estate_id" in data:
        estate_id = data.pop("estate_id")
        building.estate = get_object_or_404(Estate, pk=estate_id, organization=organization) if estate_id is not None else None
    for field, value in data.items():
        setattr(building, field, value)
    building.save()
    return building


def get_estate_delete_check(estate):
    buildings = estate.buildings.order_by("name", "id")
    count = buildings.count()
    if not count:
        return {"can_delete": True, "resources": []}

    preview = buildings.only("id", "name", "address")[:RESOURCE_PREVIEW_LIMIT]
    return {
        "can_delete": False,
        "resources": [
            {
                "type": "building",
                "label": "关联楼栋",
                "count": count,
                "items": [{"id": building.pk, "label": f"{building.name} · {building.address}" if building.address else building.name} for building in preview],
                "truncated": count > RESOURCE_PREVIEW_LIMIT,
                "target": {"path": "/rental/properties/list", "query": {"estate_id": estate.pk, "asset_tab": "structure"}},
            }
        ],
    }


def get_building_delete_check(building):
    houses = building.houses.order_by("room_number", "id")
    count = houses.count()
    if not count:
        return {"can_delete": True, "resources": []}

    preview = houses.only("id", "room_number")[:RESOURCE_PREVIEW_LIMIT]
    return {
        "can_delete": False,
        "resources": [
            {
                "type": "house",
                "label": "关联房源",
                "count": count,
                "items": [{"id": house.pk, "label": f"{building.name} / {house.room_number}"} for house in preview],
                "truncated": count > RESOURCE_PREVIEW_LIMIT,
                "target": {"path": "/rental/properties/list", "query": {"building_id": building.pk}},
            }
        ],
    }


def _delete_checked_resource(resource, get_delete_check, message: str) -> int:
    check = get_delete_check(resource)
    if not check["can_delete"]:
        raise ResourceInUseException(message, check)

    resource_id = resource.pk

    try:
        # Keep the outer row lock while a savepoint shields the follow-up
        # delete check from a database-level PROTECT fallback.
        with transaction.atomic():
            deleted_count, _deleted_details = resource.delete()
    except (IntegrityError, ProtectedError):
        # Do not catch OperationalError (for example, SQLite's "database is locked"):
        # without a reliable fresh read, it cannot be reported as RESOURCE_IN_USE.
        check = get_delete_check(resource)
        raise ResourceInUseException(message, check) from None

    if not deleted_count:
        raise Http404

    return resource_id


def delete_estate(organization: Organization, estate_id: int) -> int:

    with transaction.atomic():
        try:
            estate = Estate.objects.select_for_update().get(pk=estate_id, organization=organization)
        except Estate.DoesNotExist:
            raise Http404 from None
        return _delete_checked_resource(estate, get_estate_delete_check, "小区已关联楼栋，不能删除。")


def delete_building(organization: Organization, building_id: int) -> int:
    from apps.house.models import Building

    with transaction.atomic():
        try:
            building = Building.objects.select_for_update().get(pk=building_id, organization=organization)
        except Building.DoesNotExist:
            raise Http404 from None
        return _delete_checked_resource(building, get_building_delete_check, "楼栋已关联房源，不能删除。")


def evaluate_house_publish_state(house, rules=None):
    publish_rules = normalize_house_publish_rules(rules)
    images = house.images or []
    image_roles = {item.get("image_role") for item in images if isinstance(item, dict)}
    image_count = len(images)
    video_count = len(house.videos or [])
    issue_flags = {
        "landlord": not bool(house.landlord_id),
        "rent": not bool(house.asking_rent),
        "cover": "cover" not in image_roles,
        "images": image_count < publish_rules["images"]["min_count"],
        "floor_plan": "floor_plan" not in image_roles,
        "video": video_count < publish_rules["video"]["min_count"],
    }

    blocking_issues: list[str] = []
    warning_issues: list[str] = []
    for key, is_missing in issue_flags.items():
        if not is_missing:
            continue
        rule = publish_rules[key]
        if rule["mode"] == PUBLISH_RULE_MODE_OFF:
            continue
        target = blocking_issues if rule["mode"] == PUBLISH_RULE_MODE_REQUIRED else warning_issues
        target.append(HOUSE_PUBLISH_ISSUE_LABELS[key])

    return {
        "can_publish": not blocking_issues,
        "blocking_issues": blocking_issues,
        "warning_issues": warning_issues,
        "rule_snapshot": publish_rules,
    }


def validate_house_publication(house, *, previous_status: str | None, organization):
    if house.status != HouseStatus.LISTED or previous_status == HouseStatus.LISTED:
        return
    publish_state = evaluate_house_publish_state(house, get_org_house_publish_rules(organization))
    if publish_state["blocking_issues"]:
        raise HouseInvalidException(f"房源暂不能发布：{'、'.join(publish_state['blocking_issues'])}")


@transaction.atomic
def create_house(*, organization, data: dict):
    org = organization
    from apps.subscriptions.entitlements import EntitlementService

    EntitlementService.check_can_add(org, "house")
    building = get_object_or_404(Building, pk=data["building_id"], organization=org)
    data = dict(data)
    data.pop("building_id")
    landlord_id = data.pop("landlord_id", None)
    landlord = get_contact_for_new_business(landlord_id, org, ContactRole.LANDLORD) if landlord_id is not None else None
    if landlord is not None:
        data["landlord"] = landlord
    house = House.objects.create(building=building, **data)
    return house


def _apply_house_changes(house, organization, changes):
    data = dict(changes)
    data.pop("confirm_current", None)
    building_id = data.pop("building_id", None)
    if building_id is not None:
        house.building = get_object_or_404(Building, pk=building_id, organization=organization)
    if "landlord_id" in data:
        landlord_id = data.pop("landlord_id")
        if landlord_id is None:
            house.landlord = None
        elif landlord_id != house.landlord_id:
            house.landlord = get_contact_for_new_business(landlord_id, organization, ContactRole.LANDLORD)
    for field, value in data.items():
        setattr(house, field, value)


@transaction.atomic
def publish_house(*, organization, house_id: int, changes: dict | None = None):
    """在同一事务中更新发布资料、校验发布规则并招租。"""
    house = get_object_or_404(House.objects.select_for_update(of=("self",)).select_related("building__estate", "landlord"), pk=house_id, building__organization=organization)
    previous_status = house.status
    _apply_house_changes(house, organization, changes or {})
    house.status = HouseStatus.LISTED
    validate_house_publication(house, previous_status=previous_status, organization=organization)
    house.save()
    return house


@transaction.atomic
def update_house(*, organization, house_id: int, changes: dict):
    if changes.get("status") == HouseStatus.LISTED:
        return publish_house(organization=organization, house_id=house_id, changes=changes)
    house = get_object_or_404(House.objects.select_for_update(of=("self",)).select_related("building__estate", "landlord"), pk=house_id, building__organization=organization)
    _apply_house_changes(house, organization, changes)
    house.save()
    return house
