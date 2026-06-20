"""OSS 上传路径生成和 STS 临时凭证."""
import json
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import timedelta
from importlib import import_module
from typing import Any
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
MEDIA_DERIVED_REF_FIELDS = {
    "created_at",
    "file_size",
    "original_filename",
    "resource_type",
    "thumbnail",
    "url",
}


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
    target_object_id = uploader.pk if scope == MediaScope.USER else object_id

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


def _extract_media_id(media_ref: int | Mapping[str, Any]) -> int:
    if isinstance(media_ref, Mapping):
        if "media_id" not in media_ref:
            raise ValueError("媒体引用对象必须包含 media_id")
        return int(media_ref["media_id"])
    return int(media_ref)


def extract_media_ids(media_refs: Iterable[int | Mapping[str, Any]]) -> list[int]:
    """从 list[int] 或 list[dict] 中提取媒体 ID，保持原顺序返回。"""
    return [_extract_media_id(media_ref) for media_ref in media_refs]


def validate_media_ids(media_ids: Iterable[int | Mapping[str, Any]]) -> list[int]:
    """校验媒体 ID 或媒体引用对象列表，保持原顺序返回媒体 ID。"""
    ordered_ids = extract_media_ids(media_ids)
    if len(ordered_ids) != len(set(ordered_ids)):
        raise ValueError("media_ids 不能包含重复 ID")
    if not ordered_ids:
        return []

    media_by_id = MediaFile.objects.in_bulk(ordered_ids)
    missing_ids = [media_id for media_id in ordered_ids if media_id not in media_by_id]
    if missing_ids:
        raise ValueError(f"媒体文件不存在: {missing_ids}")
    return ordered_ids


def validate_media_refs(media_refs: Iterable[int | Mapping[str, Any]]) -> list[int | Mapping[str, Any]]:
    """校验业务媒体引用列表，返回可安全入库的稳定引用。"""
    ordered_refs = list(media_refs)
    validate_media_ids(ordered_refs)

    normalized_refs: list[int | Mapping[str, Any]] = []
    for media_ref in ordered_refs:
        if not isinstance(media_ref, Mapping):
            normalized_refs.append(_extract_media_id(media_ref))
            continue

        item = {key: value for key, value in media_ref.items() if key not in MEDIA_DERIVED_REF_FIELDS}
        item["media_id"] = _extract_media_id(media_ref)
        normalized_refs.append(item)
    return normalized_refs


def get_media_list_info(media_ids: Iterable[int | Mapping[str, Any]]) -> list[dict]:
    """按传入引用顺序返回媒体信息，兼容 list[int] 和 list[dict]。"""
    ordered_ids = validate_media_ids(media_ids)
    if not ordered_ids:
        return []

    media_by_id = MediaFile.objects.in_bulk(ordered_ids)
    return [get_media_file_info(media_by_id[media_id]) for media_id in ordered_ids]


def _flatten_media_info(media_info: dict) -> dict:
    return {
        "media_id": media_info["id"],
        "resource_type": media_info["resource_type"],
        "original_filename": media_info["original_filename"],
        "url": media_info["original"]["url"],
        "thumbnail": media_info["thumbnail"],
        "file_size": media_info["file_size"],
        "created_at": media_info["created_at"],
    }


def get_media_refs_info(media_refs: Iterable[int | Mapping[str, Any]]) -> list[dict]:
    """返回平铺增强后的媒体引用列表；平台派生字段始终动态刷新。"""
    ordered_refs = list(media_refs)
    media_infos = get_media_list_info(ordered_refs)

    result = []
    for media_ref, media_info in zip(ordered_refs, media_infos, strict=True):
        media_id = _extract_media_id(media_ref)
        item = dict(media_ref) if isinstance(media_ref, Mapping) else {"media_id": media_id}
        item["media_id"] = media_id
        item.update(_flatten_media_info(media_info))
        result.append(item)
    return result


def resolve_media_refs(media_refs: Iterable[int | Mapping[str, Any]]) -> list[dict]:
    """解析媒体引用为前端展示结构，兼容 list[int] 和 list[dict]。"""
    return get_media_refs_info(media_refs)


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
    if referenced_media_ids is not None:
        referenced_ids = set(referenced_media_ids)
    else:
        providers = list(getattr(settings, "MEDIA_REFERENCE_PROVIDERS", []))
        if not providers:
            return CleanupResult(deleted_count=0, deleted_ids=[])
        referenced_ids = collect_referenced_media_ids(providers)

    cutoff = timezone.now() - older_than
    candidates = MediaFile.objects.filter(created_at__lt=cutoff).exclude(pk__in=referenced_ids).order_by("pk")

    deleted_ids = []
    for media_file in candidates:
        deleted_ids.append(media_file.pk)
        if media_file.file:
            media_file.file.delete(save=False)
        media_file.delete()
    return CleanupResult(deleted_count=len(deleted_ids), deleted_ids=deleted_ids)
