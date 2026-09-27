from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from ninja import Query, Router
from ninja.errors import HttpError
from ninja.pagination import paginate
from ninja.responses import Status

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_superuser
from apps.platform_operations.constants import ContentEntryKind
from apps.platform_operations.models import ContentEntry, ContentEntryHouse, HomeBanner
from apps.platform_operations.schemas import (
    ContentEntryAdminOut,
    ContentEntryCreateIn,
    ContentEntryDetailOut,
    ContentEntryHouseAdminOut,
    ContentEntryHousePublicOut,
    ContentEntryHousesPutIn,
    ContentEntryPatchIn,
    ContentEntrySummaryOut,
    ContentHouseAdminOut,
    HomeBannerAdminOut,
    HomeBannerCreateIn,
    HomeBannerPatchIn,
    HomeContentOut,
)
from apps.platform_operations.services import (
    get_house_candidates,
    get_public_entries,
    get_public_entry_houses,
    get_public_home,
    save_validated,
    sync_entry_houses,
)

admin_router = Router(tags=["平台运营/内容管理"])
public_router = Router(tags=["平台运营/公开内容"])


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


@admin_router.get("/banners/", response=list[HomeBannerAdminOut], summary="获取首页 Banner")
@paginate(LegacyPagination)
def list_banners(request, keyword: str | None = Query(None)):
    require_superuser(request)
    queryset = HomeBanner.objects.select_related("entry")
    if keyword:
        queryset = queryset.filter(Q(title__icontains=keyword) | Q(description__icontains=keyword))
    return queryset.order_by("sort_order", "id")


@admin_router.post("/banners/", response={201: HomeBannerAdminOut}, summary="创建首页 Banner")
def create_banner(request, payload: HomeBannerCreateIn):
    require_superuser(request)
    banner = HomeBanner(**payload.model_dump(), created_by=request.user, updated_by=request.user)
    return Status(201, _save_or_422(banner))


@admin_router.get("/banners/{banner_id}/", response=HomeBannerAdminOut, summary="获取首页 Banner 详情")
def get_banner(request, banner_id: int):
    require_superuser(request)
    return get_object_or_404(HomeBanner.objects.select_related("entry"), pk=banner_id)


@admin_router.patch("/banners/{banner_id}/", response=HomeBannerAdminOut, summary="更新首页 Banner")
def patch_banner(request, banner_id: int, payload: HomeBannerPatchIn):
    banner = get_banner(request, banner_id)
    return _apply_patch(banner, payload, user=request.user)


@admin_router.get("/entries/", response=list[ContentEntryAdminOut], summary="获取运营专题和指南")
@paginate(LegacyPagination)
def list_entries(request, kind: str | None = Query(None), keyword: str | None = Query(None)):
    require_superuser(request)
    queryset = ContentEntry.objects.annotate(house_count=Count("house_links", distinct=True))
    if kind:
        queryset = queryset.filter(kind=kind)
    if keyword:
        queryset = queryset.filter(Q(title__icontains=keyword) | Q(summary__icontains=keyword))
    return queryset.order_by("sort_order", "id")


@admin_router.post("/entries/", response={201: ContentEntryAdminOut}, summary="创建运营专题或指南")
def create_entry(request, payload: ContentEntryCreateIn):
    require_superuser(request)
    entry = ContentEntry(**payload.model_dump(), created_by=request.user, updated_by=request.user)
    return Status(201, _save_or_422(entry))


@admin_router.get("/entries/{entry_id}/", response=ContentEntryAdminOut, summary="获取运营专题或指南详情")
def get_entry(request, entry_id: int):
    require_superuser(request)
    return get_object_or_404(ContentEntry.objects.annotate(house_count=Count("house_links", distinct=True)), pk=entry_id)


@admin_router.patch("/entries/{entry_id}/", response=ContentEntryAdminOut, summary="更新运营专题或指南")
def patch_entry(request, entry_id: int, payload: ContentEntryPatchIn):
    entry = get_entry(request, entry_id)
    return _apply_patch(entry, payload, user=request.user)


@admin_router.get("/house-candidates/", response=list[ContentHouseAdminOut], summary="获取运营专题候选房源")
@paginate(LegacyPagination)
def list_house_candidates(request, keyword: str | None = Query(None)):
    require_superuser(request)
    return get_house_candidates(keyword=keyword)


@admin_router.get("/entries/{entry_id}/houses/", response=list[ContentEntryHouseAdminOut], summary="获取专题已选房源")
@paginate(LegacyPagination)
def list_entry_houses(request, entry_id: int):
    entry = get_entry(request, entry_id)
    if entry.kind != ContentEntryKind.TOPIC:
        raise HttpError(404, "租房指南没有关联房源。")
    return ContentEntryHouse.objects.filter(entry=entry).select_related("house__building__estate", "house__building__organization")


@admin_router.put("/entries/{entry_id}/houses/", response=list[ContentEntryHouseAdminOut], summary="保存专题房源")
def put_entry_houses(request, entry_id: int, payload: ContentEntryHousesPutIn):
    entry = get_entry(request, entry_id)
    try:
        return sync_entry_houses(entry, [item.model_dump() for item in payload.items])
    except ValidationError as exc:
        raise HttpError(422, _validation_message(exc)) from exc


@public_router.get("/home/", response=HomeContentOut, auth=None, summary="获取首页公开内容")
def public_home(request):
    return get_public_home()


@public_router.get("/entries/", response=list[ContentEntrySummaryOut], auth=None, summary="获取运营专题和指南列表")
@paginate(LegacyPagination)
def public_entries(request, kind: str = Query(...)):
    if kind not in ContentEntryKind.values:
        raise HttpError(422, "无效的内容类型。")
    return get_public_entries(kind=kind)


@public_router.get("/entries/{slug}/", response=ContentEntryDetailOut, auth=None, summary="获取运营专题或指南详情")
def public_entry_detail(request, slug: str):
    return get_object_or_404(get_public_entries(), slug=slug)


@public_router.get("/entries/{slug}/houses/", response=list[ContentEntryHousePublicOut], auth=None, summary="获取运营专题房源")
@paginate(LegacyPagination)
def public_entry_houses(request, slug: str):
    entry = get_object_or_404(get_public_entries(kind=ContentEntryKind.TOPIC), slug=slug)
    return get_public_entry_houses(entry)
