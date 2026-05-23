"""OSS 临时凭证接口."""
from ninja import Query, Router

from apps.base.permissions import require_authenticated, require_org_selected
from apps.media.schemas import OssTokenIn, OssTokenOut
from apps.media.services import get_oss_token

router = Router(tags=["media"])


@router.get("/oss-token/", response=OssTokenOut, auth=None)
def oss_token(request, params: OssTokenIn = Query(...)):
    require_authenticated(request)

    if params.scope == "user":
        object_id = request.user.pk
    else:
        org = require_org_selected(request)
        object_id = org.pk

    result = get_oss_token(scope=params.scope, object_id=object_id, filename=params.filename)
    return OssTokenOut(**result)
