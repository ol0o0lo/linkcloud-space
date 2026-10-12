from django.shortcuts import get_object_or_404

from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.ai.services import AIErrorCode, AIExecutionError
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.house.ai_insights import HouseAIInsightBusyError, HouseAIInsightInsufficientDataError, generate_house_ai_insight, get_house_ai_insight
from apps.house.house_sync import apply_vacancy_sync, build_vacancy_sync_plan
from apps.house.models import Building
from apps.house.queries.ordering import HOUSE_DEFAULT_ORDERING, HOUSE_ORDERING_DESCRIPTION, HOUSE_ORDERING_PATTERN
from apps.house.queries.properties import get_building as query_get_building
from apps.house.queries.properties import get_estate as query_get_estate
from apps.house.queries.properties import get_house_in_org
from apps.house.queries.properties import list_buildings as query_list_buildings
from apps.house.queries.properties import list_estates as query_list_estates
from apps.house.queries.properties import list_houses as query_list_houses
from apps.house.schemas.common import DeleteCheckOut
from apps.house.schemas.insights import HouseAIInsightOut
from apps.house.schemas.properties import (
    BuildingIn,
    BuildingInventoryOut,
    BuildingOut,
    BuildingPatchIn,
    DefaultBuildingIn,
    DefaultBuildingOut,
    EstateDetailOut,
    EstateIn,
    EstateOut,
    EstatePatchIn,
    HouseIn,
    HouseInspectionReason,
    HouseOut,
    HousePatchIn,
    HouseScope,
    HouseStatusValue,
    TagSuggestionsOut,
)
from apps.house.schemas.vacancy_sync import VacancySyncIn, VacancySyncOut
from apps.house.services.properties import create_building as perform_create_building
from apps.house.services.properties import create_estate as perform_create_estate
from apps.house.services.properties import create_house as perform_create_house
from apps.house.services.properties import delete_building, delete_estate, get_building_delete_check, get_estate_delete_check, update_building, update_estate, update_house
from apps.house.services.settings import ensure_default_building, get_tag_suggestions, set_default_building

router = Router(tags=["房源/管理"])

AI_INSIGHT_ERROR_STATUS = {
    AIErrorCode.INVALID_REQUEST: 400,
    AIErrorCode.PERMISSION_DENIED: 403,
    AIErrorCode.CONTENT_REJECTED: 422,
    AIErrorCode.STRUCTURED_OUTPUT_INVALID: 422,
    AIErrorCode.CAPABILITY_UNAVAILABLE: 503,
    AIErrorCode.PROVIDER_AUTH_ERROR: 503,
    AIErrorCode.RATE_LIMITED: 503,
    AIErrorCode.TIMEOUT: 504,
    AIErrorCode.PROVIDER_UNAVAILABLE: 503,
    AIErrorCode.STREAM_INTERRUPTED: 502,
    AIErrorCode.INTERNAL_ERROR: 500,
}


def _house_ai_call(function, **kwargs):
    try:
        return function(**kwargs)
    except HouseAIInsightBusyError as exc:
        raise HttpError(409, str(exc)) from exc
    except HouseAIInsightInsufficientDataError as exc:
        raise HttpError(422, str(exc)) from exc
    except AIExecutionError as exc:
        raise HttpError(AI_INSIGHT_ERROR_STATUS.get(exc.code, 500), exc.safe_message) from exc


@router.get("/tag-suggestions/", response=TagSuggestionsOut, summary="获取房源与楼栋标签快捷候选")
def get_property_rental_tag_suggestions(request):
    require_org_selected(request)
    return {"tags": get_tag_suggestions()}


@router.post("/vacancy-sync/", response=VacancySyncOut, summary="预览或执行房表空置同步")
def vacancy_sync(request, payload: VacancySyncIn):
    org = require_org_selected(request)
    building_overrides = [item.model_dump() for item in payload.building_overrides]
    if payload.mode == "preview":
        return build_vacancy_sync_plan(
            org,
            raw_text=payload.raw_text,
            building_overrides=building_overrides,
            ignored_lines=payload.ignored_lines,
        )
    return apply_vacancy_sync(
        org,
        raw_text=payload.raw_text,
        building_overrides=building_overrides,
        ignored_lines=payload.ignored_lines,
        expected_plan_hash=payload.plan_hash,
    )


@router.get("/estates/", response=list[EstateDetailOut], summary="获取项目片区列表")
@paginate(LegacyPagination)
def list_estates(request, keyword: str | None = Query(None), scope: HouseScope | None = Query(None)):
    org = require_org_selected(request)
    return query_list_estates(org=org, user=request.user, keyword=keyword, scope=scope)


@router.post("/estates/", response={201: EstateOut}, summary="创建项目片区")
def create_estate(request, payload: EstateIn):
    org = require_org_selected(request)
    estate = perform_create_estate(organization=org, data=payload.model_dump())
    return Status(201, estate)


@router.get("/estates/{estate_id}/", response=EstateDetailOut, summary="获取项目片区详情")
def get_estate(request, estate_id: int):
    org = require_org_selected(request)
    return query_get_estate(org=org, estate_id=estate_id)


@router.get("/estates/{estate_id}/delete-check/", response=DeleteCheckOut, summary="检查项目片区删除关联资源")
def check_estate_delete(request, estate_id: int):
    return get_estate_delete_check(get_estate(request, estate_id))


@router.patch("/estates/{estate_id}/", response=EstateOut, summary="更新项目片区")
def patch_estate(request, estate_id: int, payload: EstatePatchIn):
    org = require_org_selected(request)
    return update_estate(organization=org, estate_id=estate_id, changes=payload.model_dump(exclude_unset=True))


@router.delete("/estates/{estate_id}/", response={200: dict}, summary="删除项目片区")
def delete_estate_endpoint(request, estate_id: int):
    org = require_org_selected(request)
    return {"deleted": delete_estate(org, estate_id)}


@router.get("/buildings/", response=list[BuildingInventoryOut], summary="获取楼栋列表")
@paginate(LegacyPagination)
def list_buildings(
    request,
    estate_id: int | None = Query(None),
    keyword: str | None = Query(None),
    scope: HouseScope | None = Query(None),
):
    org = require_org_selected(request)
    return query_list_buildings(org=org, user=request.user, estate_id=estate_id, keyword=keyword, scope=scope)


@router.post("/buildings/", response={201: BuildingOut}, summary="创建楼栋")
def create_building(request, payload: BuildingIn):
    org = require_org_selected(request)
    building = perform_create_building(organization=org, data=payload.model_dump())
    return Status(201, building)


@router.get("/buildings/{building_id}/", response=BuildingInventoryOut, summary="获取楼栋详情")
def get_building(request, building_id: int):
    org = require_org_selected(request)
    return query_get_building(org=org, building_id=building_id)


@router.get("/buildings/{building_id}/delete-check/", response=DeleteCheckOut, summary="检查楼栋删除关联资源")
def check_building_delete(request, building_id: int):
    return get_building_delete_check(get_building(request, building_id))


@router.patch("/buildings/{building_id}/", response=BuildingOut, summary="更新楼栋")
def patch_building(request, building_id: int, payload: BuildingPatchIn):
    org = require_org_selected(request)
    return update_building(organization=org, building_id=building_id, changes=payload.model_dump(exclude_unset=True))


@router.delete("/buildings/{building_id}/", response={200: dict}, summary="删除楼栋")
def delete_building_endpoint(request, building_id: int):
    org = require_org_selected(request)
    return {"deleted": delete_building(org, building_id)}


@router.get("/default-building/", response=DefaultBuildingOut, summary="获取默认楼栋")
def get_default_building(request):
    org = require_org_selected(request)
    building = ensure_default_building(org)
    return {
        "id": building.pk,
        "estate_id": building.estate_id,
        "estate": building.estate,
        "name": building.name,
        "floors": building.floors,
        "address": building.address,
    }


@router.put("/default-building/", response=DefaultBuildingOut, summary="设置默认楼栋")
def put_default_building(request, payload: DefaultBuildingIn):
    org = require_org_selected(request)
    get_object_or_404(Building, pk=payload.building_id, organization=org)
    building = set_default_building(org, payload.building_id)
    return {
        "id": building.pk,
        "estate_id": building.estate_id,
        "estate": building.estate,
        "name": building.name,
        "floors": building.floors,
        "address": building.address,
    }


@router.get("/houses/", response=list[HouseOut], summary="获取房源列表")
@paginate(LegacyPagination)
def list_houses(
    request,
    estate_id: int | None = Query(None),
    building_id: int | None = Query(None),
    responsible_member_id: int | None = Query(None),
    scope: HouseScope | None = Query(None),
    inspection_due: bool = Query(False),
    inspection_reason: HouseInspectionReason | None = Query(None),
    status: HouseStatusValue | None = Query(None),
    keyword: str | None = Query(None),
    ordering: str = Query(
        HOUSE_DEFAULT_ORDERING,
        description=HOUSE_ORDERING_DESCRIPTION,
        pattern=HOUSE_ORDERING_PATTERN,
        example="-asking_rent,room_number",
    ),
):
    org = require_org_selected(request)
    return query_list_houses(
        org=org,
        user=request.user,
        estate_id=estate_id,
        building_id=building_id,
        responsible_member_id=responsible_member_id,
        scope=scope,
        inspection_due=inspection_due,
        inspection_reason=inspection_reason,
        status=status,
        keyword=keyword,
        ordering=ordering,
    )


@router.post("/houses/", response={201: HouseOut}, summary="创建房源")
def create_house(request, payload: HouseIn):
    org = require_org_selected(request)
    return Status(201, perform_create_house(organization=org, data=payload.model_dump()))


@router.get("/houses/{house_id}/", response=HouseOut, summary="获取房源详情")
def get_house(request, house_id: int):
    org = require_org_selected(request)
    return get_house_in_org(house_id, org)


@router.get("/houses/{house_id}/ai-insight/", response=HouseAIInsightOut, summary="获取房源 AI 洞察")
def get_house_ai_insight_endpoint(request, house_id: int):
    org = require_org_selected(request)
    house = get_house_in_org(house_id, org)
    return _house_ai_call(get_house_ai_insight, actor=request.user, organization=org, house=house)


@router.post("/houses/{house_id}/ai-insight/generate/", response=HouseAIInsightOut, summary="生成房源 AI 洞察")
def generate_house_ai_insight_endpoint(request, house_id: int):
    org = require_org_selected(request)
    house = get_house_in_org(house_id, org)
    return _house_ai_call(generate_house_ai_insight, actor=request.user, organization=org, house=house)


@router.patch("/houses/{house_id}/", response=HouseOut, summary="更新房源")
def patch_house(request, house_id: int, payload: HousePatchIn):
    org = require_org_selected(request)
    return update_house(organization=org, house_id=house_id, changes=payload.model_dump(exclude_unset=True))
