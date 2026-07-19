from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated
from apps.favorites.schemas import FavoriteOut
from apps.favorites.services import (
    FavoriteTargetNotFound,
    FavoriteTargetTypeUnsupported,
    get_active_favorites,
    put_favorite,
    remove_favorite,
    resolve_favorites,
    serialize_favorite,
)

router = Router(tags=["用户/收藏"])


@router.get("/", response=list[FavoriteOut], summary="获取我的收藏")
@paginate(LegacyPagination)
def list_favorites(request, target_type: str | None = Query(None), target_id: str | None = Query(None)):
    require_authenticated(request)
    if target_id is not None and target_type is None:
        raise HttpError(422, "按目标筛选收藏时必须提供 target_type")
    try:
        favorites = get_active_favorites(request.user, target_type=target_type, target_id=target_id)
    except FavoriteTargetTypeUnsupported as error:
        raise HttpError(422, f"不支持的收藏目标类型：{error}") from error
    return resolve_favorites(favorites)


@router.put("/", response={200: FavoriteOut, 201: FavoriteOut}, summary="收藏目标")
def put_user_favorite(request, target_type: str = Query(...), target_id: str = Query(...)):
    require_authenticated(request)
    try:
        favorite, target, activated = put_favorite(request.user, target_type=target_type, target_id=target_id)
    except FavoriteTargetTypeUnsupported as error:
        raise HttpError(422, f"不支持的收藏目标类型：{error}") from error
    except FavoriteTargetNotFound as error:
        raise HttpError(404, "收藏目标不存在或当前不可收藏") from error
    return Status(201 if activated else 200, serialize_favorite(favorite, target))


@router.delete("/", summary="取消收藏目标")
def delete_user_favorite(request, target_type: str = Query(...), target_id: str = Query(...)):
    require_authenticated(request)
    try:
        remove_favorite(request.user, target_type=target_type, target_id=target_id)
    except FavoriteTargetTypeUnsupported as error:
        raise HttpError(422, f"不支持的收藏目标类型：{error}") from error
    return {"success": True}
