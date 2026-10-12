"""校验计划版本后应用规划好的操作，不重新计算房态和资料变更。"""

from copy import deepcopy

from django.db import IntegrityError, transaction

from apps.house.house_sync.planning import VacancySyncConflictException, VacancySyncInvalidException, build_plan
from apps.house.models import Building, House
from apps.house.services.properties import create_building


@transaction.atomic
def apply_vacancy_sync(organization, *, raw_text: str, building_overrides: list[dict] | None, ignored_lines: list[int] | None, expected_plan_hash: str | None) -> dict:
    plan = build_plan(organization, raw_text=raw_text, building_overrides=building_overrides, ignored_lines=ignored_lines, lock=True)
    if not plan.response["can_apply"]:
        raise VacancySyncInvalidException(data=plan.response)
    if not expected_plan_hash or expected_plan_hash != plan.response["plan_hash"]:
        raise VacancySyncConflictException(data={"current_plan": plan.response})

    new_house_count = sum(operation.house_id is None for operation in plan.operations)
    if new_house_count:
        from apps.subscriptions.entitlements import EntitlementService

        EntitlementService.check_can_add(organization, "house", new_house_count)

    result = deepcopy(plan.response)
    result.update(mode="apply", applied=True)
    for block in result["blocks"]:
        building_id = block["building_match"]["building_id"]
        if building_id is None:
            floors = [line["floor"] for line in block["lines"] if line["status"] == "valid" and line["floor"] is not None]
            try:
                building = create_building(
                    organization=organization,
                    data={"name": block["address"], "address": block["address"], "floors": max(floors, default=1)},
                )
            except IntegrityError as exc:
                raise VacancySyncConflictException("楼栋数据已发生变化，请重新预览。") from exc
            block["building_match"].update(
                status="created",
                building_id=building.pk,
                name=building.name,
                address=building.address,
                candidates=[{"id": building.pk, "name": building.name, "address": building.address}],
            )
        else:
            building = Building.objects.get(pk=building_id, organization=organization)

        operations = [operation for operation in plan.operations if operation.block_index == block["block_index"]]
        existing = (
            House.objects.filter(building=building)
            .select_related("building__organization", "landlord")
            .in_bulk([operation.house_id for operation in operations if operation.house_id is not None])
        )
        house_ids = {}
        for operation in operations:
            try:
                if operation.house_id is None:
                    house = House.objects.create(building=building, room_number=operation.room_number, **operation.values)
                else:
                    house = existing[operation.house_id]
                    for field, value in operation.values.items():
                        setattr(house, field, value)
                    house.save(update_fields=[*operation.values, "updated_at"])
            except IntegrityError as exc:
                raise VacancySyncConflictException("房源数据已发生变化，请重新预览。") from exc
            house_ids[operation.room_number.casefold()] = house.pk
        for change_group in block["changes"].values():
            for change in change_group:
                change["house_id"] = house_ids.get(change["room_number"].casefold(), change["house_id"])
    return result
