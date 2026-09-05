from django.core.exceptions import PermissionDenied
from django.http import HttpResponse

from ninja import Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_org_selected
from apps.house.match_schemas import (
    HouseMatchShareCreateIn,
    HouseMatchShareCreateOut,
    HouseMatchShareExtendIn,
    HouseMatchShareOut,
    PublicHouseMatchShareOut,
)
from apps.house.match_services import (
    HouseMatchShareExpired,
    UnsupportedHouseMatchCriteria,
    build_house_match_share_url,
    create_house_match_share,
    extend_house_match_share,
    get_public_consultant,
    get_public_house_match_house,
    get_public_house_match_queryset,
    get_public_house_match_share,
    record_house_match_share_access,
    revoke_house_match_share,
)
from apps.house.models import HouseMatchShare
from apps.house.schemas import PublicHouseDetailOut, PublicHouseListOut
from apps.organizations.models import OrganizationMember

router = Router(tags=["房源/配房分享"])
public_router = Router(tags=["房源/公开配房分享"])


def _set_no_store(response: HttpResponse) -> None:
    response["Cache-Control"] = "no-store"


def _get_share_or_error(share_key: str):
    try:
        return get_public_house_match_share(share_key)
    except HouseMatchShareExpired as exc:
        raise HttpError(410, "配房链接已过期或失效。") from exc
    except UnsupportedHouseMatchCriteria as exc:
        raise HttpError(422, "配房链接版本暂不支持，请重新生成。") from exc


def _share_status(share: HouseMatchShare) -> str:
    if share.revoked_at is not None:
        return "revoked"
    if share.is_expired:
        return "expired"
    return "active"


def _serialize_share(share: HouseMatchShare) -> dict:
    return {
        "id": share.pk,
        "share_key": share.share_key,
        "share_url": build_house_match_share_url(share.share_key),
        "title": share.title,
        "mode": share.mode,
        "status": _share_status(share),
        "expires_at": share.expires_at,
        "revoked_at": share.revoked_at,
        "view_count": share.view_count,
        "last_accessed_at": share.last_accessed_at,
        "created_at": share.created_at,
    }


class HouseMatchSharePagination(LegacyPagination):
    def paginate_queryset(self, queryset, pagination, **params) -> dict:
        result = super().paginate_queryset(queryset, pagination, **params)
        result["items"] = [_serialize_share(share) for share in result["items"]]
        return result


def _get_management_context(request):
    require_authenticated(request)
    organization = require_org_selected(request)
    if not organization.is_active:
        raise PermissionDenied("当前组织已停用。")
    if not OrganizationMember.objects.filter(organization=organization, user=request.user).exists():
        raise PermissionDenied("当前用户已不属于所选组织。")
    return organization


@router.get("/", response=list[HouseMatchShareOut], summary="获取我的配房分享")
@paginate(HouseMatchSharePagination)
def list_shares(request):
    organization = _get_management_context(request)
    return HouseMatchShare.objects.filter(organization=organization, consultant=request.user).order_by("-created_at", "-pk")


@router.post("/", response={201: HouseMatchShareCreateOut}, summary="生成配房分享链接")
def create_share(request, payload: HouseMatchShareCreateIn):
    organization = _get_management_context(request)
    share = create_house_match_share(organization=organization, consultant=request.user, payload=payload)
    return Status(
        201,
        {
            "share_key": share.share_key,
            "share_url": build_house_match_share_url(share.share_key),
            "expires_at": share.expires_at,
            "created_at": share.created_at,
        },
    )


@router.post("/{share_id}/extend/", response=HouseMatchShareOut, summary="延期配房分享")
def extend_share(request, share_id: int, payload: HouseMatchShareExtendIn):
    organization = _get_management_context(request)
    share = extend_house_match_share(
        organization=organization,
        consultant=request.user,
        share_id=share_id,
        expires_at=payload.expires_at,
    )
    return _serialize_share(share)


@router.post("/{share_id}/revoke/", response=HouseMatchShareOut, summary="失效配房分享")
def revoke_share(request, share_id: int):
    organization = _get_management_context(request)
    share = revoke_house_match_share(organization=organization, consultant=request.user, share_id=share_id)
    return _serialize_share(share)


@public_router.get("/{share_key}/", response=PublicHouseMatchShareOut, auth=None, summary="获取公开配房分享")
def get_share(request, share_key: str, response: HttpResponse):
    _set_no_store(response)
    share = _get_share_or_error(share_key)
    record_house_match_share_access(share)
    return {
        "title": share.title,
        "remark": share.remark,
        "mode": share.mode,
        "created_at": share.created_at,
        "expires_at": share.expires_at,
        "consultant": get_public_consultant(share),
    }


@public_router.get("/{share_key}/houses/", response=list[PublicHouseListOut], auth=None, summary="获取公开配房房源")
@paginate(LegacyPagination)
def list_share_houses(request, share_key: str, response: HttpResponse):
    _set_no_store(response)
    share = _get_share_or_error(share_key)
    try:
        return get_public_house_match_queryset(share)
    except UnsupportedHouseMatchCriteria as exc:
        raise HttpError(422, "配房链接版本暂不支持，请重新生成。") from exc


@public_router.get("/{share_key}/houses/{house_id}/", response=PublicHouseDetailOut, auth=None, summary="获取公开配房房源详情")
def get_share_house(request, share_key: str, house_id: int, response: HttpResponse):
    _set_no_store(response)
    share = _get_share_or_error(share_key)
    try:
        return get_public_house_match_house(share, house_id)
    except UnsupportedHouseMatchCriteria as exc:
        raise HttpError(422, "配房链接版本暂不支持，请重新生成。") from exc
