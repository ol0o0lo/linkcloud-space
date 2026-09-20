from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from ninja import Query, Router
from ninja.errors import HttpError
from ninja.pagination import paginate
from ninja.responses import Status

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_superuser
from apps.miniprogram_home.constants import HomeEntryKind
from apps.miniprogram_home.models import MiniProgramHomeBanner, MiniProgramHomeEntry, MiniProgramHomeEntryHouse
from apps.miniprogram_home.schemas import (
    MiniProgramHomeBannerAdminOut,
    MiniProgramHomeBannerCreateIn,
    MiniProgramHomeBannerPatchIn,
    MiniProgramHomeEntryAdminOut,
    MiniProgramHomeEntryCreateIn,
    MiniProgramHomeEntryDetailOut,
    MiniProgramHomeEntryHouseAdminOut,
    MiniProgramHomeEntryHousePublicOut,
    MiniProgramHomeEntryHousesPutIn,
    MiniProgramHomeEntryPatchIn,
    MiniProgramHomeEntrySummaryOut,
    MiniProgramHomeHouseAdminOut,
    MiniProgramHomeOut,
)
from apps.miniprogram_home.services import (
    get_house_candidates,
    get_public_entries,
    get_public_entry_houses,
    get_public_home,
    save_validated,
    sync_entry_houses,
)

admin_router = Router(tags=["小程序首页/管理"])
public_router = Router(tags=["小程序首页/公开"])


def _validation_message(exc: ValidationError) -> str:
    if hasattr(exc, "message_dict"):
        return next(iter(exc.message_dict.values()))[0]
    return exc.messages[0]


def _save_or_422(instance):
    try:
        return save_validated(instance)
    except ValidationError as exc:
        raise HttpError(422, _validation_message(exc)) from exc


def _apply_patch(instance, payload, *, user):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(instance, field, value)
    instance.updated_by = user
    return _save_or_422(instance)


@admin_router.get("/banners/", response=list[MiniProgramHomeBannerAdminOut], summary="获取小程序首页 Banner")
@paginate(LegacyPagination)
def list_banners(request, keyword: str | None = Query(None)):
    require_superuser(request)
    queryset = MiniProgramHomeBanner.objects.select_related("entry")
    if keyword:
        queryset = queryset.filter(Q(title__icontains=keyword) | Q(description__icontains=keyword))
    return queryset.order_by("sort_order", "id")


@admin_router.post("/banners/", response={201: MiniProgramHomeBannerAdminOut}, summary="创建小程序首页 Banner")
def create_banner(request, payload: MiniProgramHomeBannerCreateIn):
    require_superuser(request)
    banner = MiniProgramHomeBanner(**payload.model_dump(), created_by=request.user, updated_by=request.user)
    return Status(201, _save_or_422(banner))


@admin_router.get("/banners/{banner_id}/", response=MiniProgramHomeBannerAdminOut, summary="获取小程序首页 Banner 详情")
def get_banner(request, banner_id: int):
    require_superuser(request)
    return get_object_or_404(MiniProgramHomeBanner.objects.select_related("entry"), pk=banner_id)


@admin_router.patch("/banners/{banner_id}/", response=MiniProgramHomeBannerAdminOut, summary="更新小程序首页 Banner")
def patch_banner(request, banner_id: int, payload: MiniProgramHomeBannerPatchIn):
    banner = get_banner(request, banner_id)
    return _apply_patch(banner, payload, user=request.user)


@admin_router.get("/entries/", response=list[MiniProgramHomeEntryAdminOut], summary="获取小程序首页专题和指南")
@paginate(LegacyPagination)
def list_entries(request, kind: str | None = Query(None), keyword: str | None = Query(None)):
    require_superuser(request)
    queryset = MiniProgramHomeEntry.objects.annotate(house_count=Count("house_links", distinct=True))
    if kind:
        queryset = queryset.filter(kind=kind)
    if keyword:
        queryset = queryset.filter(Q(title__icontains=keyword) | Q(summary__icontains=keyword))
    return queryset.order_by("sort_order", "id")


@admin_router.post("/entries/", response={201: MiniProgramHomeEntryAdminOut}, summary="创建小程序首页专题或指南")
def create_entry(request, payload: MiniProgramHomeEntryCreateIn):
    require_superuser(request)
    entry = MiniProgramHomeEntry(**payload.model_dump(), created_by=request.user, updated_by=request.user)
    return Status(201, _save_or_422(entry))


@admin_router.get("/entries/{entry_id}/", response=MiniProgramHomeEntryAdminOut, summary="获取小程序首页专题或指南详情")
def get_entry(request, entry_id: int):
    require_superuser(request)
    return get_object_or_404(MiniProgramHomeEntry.objects.annotate(house_count=Count("house_links", distinct=True)), pk=entry_id)


@admin_router.patch("/entries/{entry_id}/", response=MiniProgramHomeEntryAdminOut, summary="更新小程序首页专题或指南")
def patch_entry(request, entry_id: int, payload: MiniProgramHomeEntryPatchIn):
    entry = get_entry(request, entry_id)
    return _apply_patch(entry, payload, user=request.user)


@admin_router.get("/house-candidates/", response=list[MiniProgramHomeHouseAdminOut], summary="获取小程序首页专题候选房源")
@paginate(LegacyPagination)
def list_house_candidates(request, keyword: str | None = Query(None)):
    require_superuser(request)
    return get_house_candidates(keyword=keyword)


@admin_router.get("/entries/{entry_id}/houses/", response=list[MiniProgramHomeEntryHouseAdminOut], summary="获取专题已选房源")
@paginate(LegacyPagination)
def list_entry_houses(request, entry_id: int):
    entry = get_entry(request, entry_id)
    if entry.kind != HomeEntryKind.TOPIC:
        raise HttpError(404, "租房指南没有关联房源。")
    return MiniProgramHomeEntryHouse.objects.filter(entry=entry).select_related("house__building__estate", "house__building__organization")


@admin_router.put("/entries/{entry_id}/houses/", response=list[MiniProgramHomeEntryHouseAdminOut], summary="保存专题房源")
def put_entry_houses(request, entry_id: int, payload: MiniProgramHomeEntryHousesPutIn):
    entry = get_entry(request, entry_id)
    try:
        return sync_entry_houses(entry, [item.model_dump() for item in payload.items])
    except ValidationError as exc:
        raise HttpError(422, _validation_message(exc)) from exc


@public_router.get("/home/", response=MiniProgramHomeOut, auth=None, summary="获取小程序首页公开内容")
def public_home(request):
    return get_public_home()


@public_router.get("/home-entries/", response=list[MiniProgramHomeEntrySummaryOut], auth=None, summary="获取小程序首页专题和指南列表")
@paginate(LegacyPagination)
def public_entries(request, kind: str = Query(...)):
    if kind not in HomeEntryKind.values:
        raise HttpError(422, "无效的内容类型。")
    return get_public_entries(kind=kind)


@public_router.get("/home-entries/{slug}/", response=MiniProgramHomeEntryDetailOut, auth=None, summary="获取小程序首页专题或指南详情")
def public_entry_detail(request, slug: str):
    return get_object_or_404(get_public_entries(), slug=slug)


@public_router.get("/home-entries/{slug}/houses/", response=list[MiniProgramHomeEntryHousePublicOut], auth=None, summary="获取小程序首页专题房源")
@paginate(LegacyPagination)
def public_entry_houses(request, slug: str):
    entry = get_object_or_404(get_public_entries(kind=HomeEntryKind.TOPIC), slug=slug)
    return get_public_entry_houses(entry)
