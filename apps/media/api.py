"""OSS 临时凭证接口."""

from ninja import File, Form, Query, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.responses import Status

from apps.base.permissions import require_org_selected
from apps.media.constants import MediaScope, ResourceType
from apps.media.schemas import MediaFileConfirmIn, MediaFileOut, OssTokenIn, OssTokenOut
from apps.media.services import get_oss_token, register_media_file, upload_and_register

router = Router(tags=["media"])


@router.get("/oss-token/", response=OssTokenOut)
def oss_token(request, params: OssTokenIn = Query(...)):
    if params.scope == MediaScope.USER:
        object_id = request.user.pk
    else:
        org = require_org_selected(request)
        object_id = org.pk

    result = get_oss_token(scope=params.scope, object_id=object_id, filename=params.filename)
    return OssTokenOut(**result)


@router.post("/confirm/", response={201: MediaFileOut})
def confirm_upload(request, payload: MediaFileConfirmIn):
    if payload.resource_type not in ResourceType.values:
        raise HttpError(422, f"无效的 resource_type: {payload.resource_type}")
    mf = register_media_file(
        uploader=request.user,
        oss_path=payload.oss_path,
        original_filename=payload.original_filename,
        resource_type=payload.resource_type,
        file_size=payload.file_size,
    )
    return Status(201, mf)


@router.post("/upload/", response={201: list[MediaFileOut]})
def upload_files(request, files: list[UploadedFile] = File(...), resource_type: str = Form(...)):
    if resource_type not in ResourceType.values:
        raise HttpError(422, f"无效的 resource_type: {resource_type}")
    results = []
    for f in files:
        mf = upload_and_register(
            uploader=request.user,
            file=f,
            resource_type=resource_type,
        )
        results.append(mf)
    return Status(201, results)
