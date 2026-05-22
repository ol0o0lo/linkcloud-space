"""OSS 临时凭证接口."""
from django.conf import settings

from ninja import Query, Router
from ninja.errors import HttpError

from apps.base.permissions import require_authenticated, require_org_selected
from apps.media.schemas import OssTokenIn, OssTokenOut
from apps.media.sts import generate_sts_token, generate_upload_path

router = Router(tags=["media"])


@router.get("/oss-token/", response=OssTokenOut, auth=None)
def get_oss_token(request, params: OssTokenIn = Query(...)):
    require_authenticated(request)

    if params.scope == "user":
        object_id = request.user.pk
    elif params.scope == "org":
        org = require_org_selected(request)
        object_id = org.pk
    else:
        raise HttpError(400, f"Invalid scope '{params.scope}'. Allowed: user, org")

    try:
        path = generate_upload_path(
            scope=params.scope,
            object_id=object_id,
            filename=params.filename,
        )
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc

    token = generate_sts_token(
        path=path,
        access_key_id=settings.ALIYUN_STS_ACCESS_KEY_ID,
        access_key_secret=settings.ALIYUN_STS_ACCESS_KEY_SECRET,
        role_arn=settings.ALIYUN_STS_ROLE_ARN,
        role_session_name=settings.ALIYUN_STS_ROLE_SESSION_NAME,
        bucket=settings.MEDIA_S3_BUCKET_NAME,
    )

    return OssTokenOut(
        access_key_id=token["access_key_id"],
        access_key_secret=token["access_key_secret"],
        security_token=token["security_token"],
        endpoint=settings.MEDIA_S3_ENDPOINT_URL,
        bucket=settings.MEDIA_S3_BUCKET_NAME,
        path=path,
        expires_at=token["expires_at"],
    )
