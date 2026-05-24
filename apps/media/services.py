"""OSS 上传路径生成和 STS 临时凭证."""
import json
from uuid import uuid4

from django.conf import settings

from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_sts20150401.models import AssumeRoleRequest
from alibabacloud_tea_openapi.models import Config as TeaConfig

from apps.media.constants import MediaExtension, MediaScope
from apps.media.exceptions import InvalidExtensionException, InvalidScopeException


def generate_upload_path(scope: str, object_id: int, filename: str) -> str:
    if scope not in MediaScope.values:
        raise InvalidScopeException()

    parts = filename.rsplit(".", 1)
    if len(parts) != 2 or not parts[1]:
        raise InvalidExtensionException("文件名必须包含有效扩展名")
    ext = parts[1].lower()
    if ext not in MediaExtension.values:
        raise InvalidExtensionException(f"不支持的扩展名 '.{ext}'，允许：{MediaExtension.values}")

    uid = uuid4().hex
    if scope == MediaScope.USER:
        return f"uploads/users/{object_id}/{uid}.{ext}"
    return f"uploads/orgs/{object_id}/{uid}.{ext}"


def _generate_sts_token(*, path: str, duration_seconds: int = 900) -> dict:
    policy = {
        "Version": "1",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["oss:PutObject"],
                "Resource": [f"acs:oss:*:*:{settings.MEDIA_S3_BUCKET_NAME}/{path}"],
            }
        ],
    }
    config = TeaConfig(
        access_key_id=settings.ALIYUN_STS_ACCESS_KEY_ID,
        access_key_secret=settings.ALIYUN_STS_ACCESS_KEY_SECRET,
        endpoint="sts.aliyuncs.com",
    )
    client = StsClient(config)
    request = AssumeRoleRequest(
        role_arn=settings.ALIYUN_STS_ROLE_ARN,
        role_session_name=settings.ALIYUN_STS_ROLE_SESSION_NAME,
        policy=json.dumps(policy),
        duration_seconds=duration_seconds,
    )
    response = client.assume_role(request)
    creds = response.body.credentials
    return {
        "access_key_id": creds.access_key_id,
        "access_key_secret": creds.access_key_secret,
        "security_token": creds.security_token,
        "expires_at": creds.expiration,
    }


def get_oss_token(scope: str, object_id: int, filename: str) -> dict:
    path = generate_upload_path(scope=scope, object_id=object_id, filename=filename)
    token = _generate_sts_token(path=path)
    return {
        "access_key_id": token["access_key_id"],
        "access_key_secret": token["access_key_secret"],
        "security_token": token["security_token"],
        "endpoint": settings.MEDIA_S3_ENDPOINT_URL,
        "bucket": settings.MEDIA_S3_BUCKET_NAME,
        "path": path,
        "expires_at": token["expires_at"],
    }


from django.core.files.base import ContentFile  # noqa: E402, F401
from django.core.files.storage import default_storage  # noqa: E402

from apps.media.models import MediaFile as _MediaFile  # noqa: E402


def register_media_file(
    *,
    uploader,
    oss_path: str,
    original_filename: str,
    resource_type: str,
    file_size: int,
) -> _MediaFile:
    """将已存在于 OSS 的文件路径登记为 MediaFile 记录。"""
    mf = _MediaFile(
        uploader=uploader,
        resource_type=resource_type,
        original_filename=original_filename,
        file_size=file_size,
    )
    mf.file.name = oss_path
    mf.save()
    return mf


def upload_and_register(
    *,
    uploader,
    file,
    resource_type: str,
) -> _MediaFile:
    """将文件上传到默认存储后端（OSS），并登记 MediaFile 记录。"""
    parts = file.name.rsplit(".", 1)
    ext = parts[1].lower() if len(parts) == 2 else ""
    uid = uuid4().hex
    oss_path = f"uploads/users/{uploader.pk}/{uid}.{ext}" if ext else f"uploads/users/{uploader.pk}/{uid}"

    saved_path = default_storage.save(oss_path, file)
    return register_media_file(
        uploader=uploader,
        oss_path=saved_path,
        original_filename=file.name,
        resource_type=resource_type,
        file_size=file.size,
    )
