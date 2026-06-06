"""OSS 上传路径生成和 STS 临时凭证."""
import json
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import timedelta
from importlib import import_module
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone

from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_sts20150401.models import AssumeRoleRequest
from alibabacloud_tea_openapi.models import Config as TeaConfig

from apps.media.constants import MediaExtension, MediaScope
from apps.media.exceptions import InvalidExtensionException, InvalidScopeException
from apps.media.models import MediaFile

DEFAULT_ORPHAN_RETENTION = timedelta(hours=24)


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


def register_media_file(
    *,
    uploader,
    oss_path: str,
    original_filename: str,
    resource_type: str,
    file_size: int,
) -> MediaFile:
    """将已存在于 OSS 的文件路径登记为 MediaFile 记录。"""
    mf = MediaFile(
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
    scope: str = MediaScope.USER,
    object_id: int | None = None,
) -> MediaFile:
    """将文件上传到默认存储后端（OSS），并登记 MediaFile 记录。"""
    if scope == MediaScope.USER:
        target_object_id = uploader.pk
    else:
        target_object_id = object_id

    if target_object_id is None:
        raise ValueError("scope=org 时必须提供 object_id")

    oss_path = generate_upload_path(
        scope=scope,
        object_id=target_object_id,
        filename=file.name,
    )
    saved_path = default_storage.save(oss_path, file)
    return register_media_file(
        uploader=uploader,
        oss_path=saved_path,
        original_filename=file.name,
        resource_type=resource_type,
        file_size=file.size,
    )


def get_media_file_info(media_file: MediaFile) -> dict:
    """返回前端展示需要的媒体资源信息。缩略图尚未生成时返回 None。"""
    try:
        original_url = media_file.file.url
    except Exception:
        original_url = media_file.file.name or ""

    return {
        "id": media_file.pk,
        "resource_type": media_file.resource_type,
        "original_filename": media_file.original_filename,
        "original": {
            "url": original_url,
        },
        "thumbnail": None,
        "file_size": media_file.file_size,
        "created_at": media_file.created_at,
    }


def validate_media_ids(media_ids: Iterable[int]) -> list[int]:
    """校验业务 JSON list[int] 中的媒体 ID，保持原顺序返回。"""
    ordered_ids = list(media_ids)
    if len(ordered_ids) != len(set(ordered_ids)):
        raise ValueError("media_ids 不能包含重复 ID")
    if not ordered_ids:
        return []

    media_by_id = MediaFile.objects.in_bulk(ordered_ids)
    missing_ids = [media_id for media_id in ordered_ids if media_id not in media_by_id]
    if missing_ids:
        raise ValueError(f"媒体文件不存在: {missing_ids}")
    return ordered_ids


def get_media_list_info(media_ids: Iterable[int]) -> list[dict]:
    """按传入 ID 顺序返回媒体信息，适合业务方保存的 list[id] 回显。"""
    ordered_ids = validate_media_ids(media_ids)
    if not ordered_ids:
        return []

    media_by_id = MediaFile.objects.in_bulk(ordered_ids)
    return [get_media_file_info(media_by_id[media_id]) for media_id in ordered_ids]


def _import_from_string(path: str) -> Callable[[], Iterable[int]]:
    module_path, func_name = path.rsplit(".", 1)
    module = import_module(module_path)
    return getattr(module, func_name)


def collect_referenced_media_ids(providers: Iterable[str | Callable[[], Iterable[int]]] | None = None) -> set[int]:
    """
    收集业务侧仍在引用的 MediaFile ID。

    业务 app 可以在 settings.MEDIA_REFERENCE_PROVIDERS 注册函数路径，函数返回媒体 ID 集合。
    """
    referenced_ids: set[int] = set()
    for provider in providers or getattr(settings, "MEDIA_REFERENCE_PROVIDERS", []):
        callback = _import_from_string(provider) if isinstance(provider, str) else provider
        referenced_ids.update(int(media_id) for media_id in callback() if media_id)
    return referenced_ids


@dataclass(frozen=True)
class CleanupResult:
    deleted_count: int
    deleted_ids: list[int]


def cleanup_unreferenced_media(
    *,
    referenced_media_ids: Iterable[int] | None = None,
    older_than=DEFAULT_ORPHAN_RETENTION,
) -> CleanupResult:
    """删除超过保留窗口且没有被业务引用的媒体记录和物理文件。"""
    referenced_ids = set(referenced_media_ids) if referenced_media_ids is not None else collect_referenced_media_ids()
    cutoff = timezone.now() - older_than
    candidates = MediaFile.objects.filter(created_at__lt=cutoff).exclude(pk__in=referenced_ids).order_by("pk")

    deleted_ids = []
    for media_file in candidates:
        deleted_ids.append(media_file.pk)
        if media_file.file:
            media_file.file.delete(save=False)
        media_file.delete()
    return CleanupResult(deleted_count=len(deleted_ids), deleted_ids=deleted_ids)
