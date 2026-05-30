"""OSS 临时凭证接口."""

from ninja import File, Form, Query, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.responses import Status

from apps.base.permissions import require_org_selected
from apps.media.constants import MediaScope, ResourceType
from apps.media.schemas import MediaFileConfirmIn, MediaFileOut, OssTokenIn, OssTokenOut
from apps.media.services import get_oss_token, register_media_file, upload_and_register

router = Router(tags=["媒体/文件"])


@router.get("/oss-token/", response=OssTokenOut, summary="获取上传凭证")
def oss_token(request, params: OssTokenIn = Query(..., description="上传凭证请求参数。")):
    """为当前用户或当前租户生成直传 OSS 所需的临时上传凭证。"""
    if params.scope == MediaScope.USER:
        object_id = request.user.pk
    else:
        org = require_org_selected(request)
        object_id = org.pk

    result = get_oss_token(scope=params.scope, object_id=object_id, filename=params.filename)
    return OssTokenOut(**result)


@router.post("/confirm/", response={201: MediaFileOut}, summary="确认直传文件")
def confirm_upload(request, payload: MediaFileConfirmIn = ...):
    """在前端完成直传后登记媒体文件元数据，生成系统内媒体记录。"""
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


@router.post("/upload/", response={201: list[MediaFileOut]}, summary="服务端上传文件")
def upload_files(
    request,
    files: list[UploadedFile] = File(..., description="要上传的文件列表。"),
    resource_type: str = Form(..., description="资源类型，例如 avatar、org_logo。"),
):
    """通过服务端接收文件并上传存储，同时登记媒体文件记录。"""
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
