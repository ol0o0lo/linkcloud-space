"""OSS 上传路径生成和 STS 临时凭证."""

import json
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import timedelta
from importlib import import_module
from typing import Any
from uuid import uuid4

from django.apps import apps
from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_sts20150401.models import AssumeRoleRequest
from alibabacloud_tea_openapi.models import Config as TeaConfig
from botocore.exceptions import ClientError

from apps.media.constants import CONTRACT_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, MediaExtension, MediaScope, ResourceType, ThumbnailStatus
from apps.media.exceptions import InvalidExtensionException, InvalidFileSizeException, InvalidScopeException, MediaStorageUnavailableException
from apps.media.models import MediaFile
from apps.media.thumbnails import is_image_path

DEFAULT_ORPHAN_RETENTION = timedelta(hours=24)
RESOURCE_TYPE_RULES = {
    ResourceType.AVATAR: {"scopes": {MediaScope.USER}, "extensions": IMAGE_EXTENSIONS},
    ResourceType.ORG_LOGO: {"scopes": {MediaScope.ORG}, "extensions": IMAGE_EXTENSIONS},
    ResourceType.REAL_NAME_ID_CARD: {"scopes": {MediaScope.USER}, "extensions": IMAGE_EXTENSIONS},
    ResourceType.ESTATE_IMAGE: {"scopes": {MediaScope.ORG}, "extensions": IMAGE_EXTENSIONS},
    ResourceType.HOUSE_IMAGE: {"scopes": {MediaScope.ORG}, "extensions": IMAGE_EXTENSIONS},
    ResourceType.HOUSE_VIDEO: {"scopes": {MediaScope.ORG}, "extensions": VIDEO_EXTENSIONS},
    ResourceType.LEASE_CONTRACT: {"scopes": {MediaScope.ORG}, "extensions": CONTRACT_EXTENSIONS},
}
MEDIA_DERIVED_REF_FIELDS = {
    "created_at",
    "file_size",
    "original_filename",
    "resource_type",
    "thumbnail",
    "url",
}


@dataclass(frozen=True)
class MediaRefBatch:
    refs: list[int | Mapping[str, Any]]
    ids: list[int]
    media_by_id: dict[int, MediaFile]


def generate_upload_path(scope: str, object_id: int, filename: str, resource_type: str | None = None) -> str:
    if scope not in MediaScope.values:
        raise InvalidScopeException()

    parts = filename.rsplit(".", 1)
    if len(parts) != 2 or not parts[1]:
        raise InvalidExtensionException("文件名必须包含有效扩展名")
    ext = parts[1].lower()
    if ext not in MediaExtension.values:
        raise InvalidExtensionException(f"不支持的扩展名 '.{ext}'，允许：{MediaExtension.values}")
    if resource_type:
        validate_resource_type_upload(
            resource_type=resource_type,
            scope=scope,
            object_id=object_id,
            filename=filename,
        )

    uid = uuid4().hex
    if scope == MediaScope.USER:
        return f"uploads/users/{object_id}/{uid}.{ext}"
    return f"uploads/orgs/{object_id}/{uid}.{ext}"


def _extract_extension(path: str) -> str:
    parts = path.rsplit(".", 1)
    if len(parts) != 2 or not parts[1]:
        raise InvalidExtensionException("文件名必须包含有效扩展名")
    return parts[1].lower()


def _scope_prefix(scope: str, object_id: int | None = None) -> str:
    if scope == MediaScope.USER:
        return f"uploads/users/{object_id}/" if object_id is not None else "uploads/users/"
    if scope == MediaScope.ORG:
        return f"uploads/orgs/{object_id}/" if object_id is not None else "uploads/orgs/"
    raise InvalidScopeException()


def validate_resource_type_upload(
    *,
    resource_type: str,
    scope: str,
    filename: str,
    object_id: int | None = None,
    path: str | None = None,
) -> None:
    """校验资源类型对应的上传作用域、路径前缀和文件扩展名。"""
    if scope not in MediaScope.values:
        raise InvalidScopeException()

    rule = RESOURCE_TYPE_RULES.get(resource_type)
    if rule is None:
        return

    if scope not in rule["scopes"]:
        raise InvalidScopeException()

    if path is not None and not path.startswith(_scope_prefix(scope, object_id)):
        raise InvalidScopeException()

    ext = _extract_extension(path or filename)
    if ext not in rule["extensions"]:
        allowed = sorted(rule["extensions"])
        raise InvalidExtensionException(f"资源类型 {resource_type} 不支持 '.{ext}'，允许：{allowed}")


def get_oss_token(scope: str, object_id: int, filename: str, resource_type: str | None = None) -> dict:
    path = generate_upload_path(scope=scope, object_id=object_id, filename=filename, resource_type=resource_type)
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
    duration_seconds = 900
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
        "endpoint": settings.MEDIA_S3_ENDPOINT_URL,
        "bucket": settings.MEDIA_S3_BUCKET_NAME,
        "path": path,
        "expires_at": creds.expiration,
    }


def register_media_file(
    *,
    uploader,
    oss_path: str,
    original_filename: str,
    resource_type: str,
    file_size: int,
    scope: str | None = None,
    object_id: int | None = None,
    verify_storage_size: bool = False,
) -> MediaFile:
    """将已存在于 OSS 的文件路径登记为 MediaFile 记录。"""
    if scope is None:
        if oss_path.startswith("uploads/users/"):
            scope = MediaScope.USER
        elif oss_path.startswith("uploads/orgs/"):
            scope = MediaScope.ORG
        else:
            raise InvalidScopeException()
    validate_resource_type_upload(
        resource_type=resource_type,
        scope=scope,
        object_id=object_id,
        filename=original_filename,
        path=oss_path,
    )
    if file_size <= 0:
        raise InvalidFileSizeException("媒体文件不能为空")
    is_image = is_image_path(oss_path)
    if is_image:
        if verify_storage_size:
            try:
                actual_size = default_storage.size(oss_path)
            except FileNotFoundError as exc:
                raise InvalidFileSizeException("已上传的图片不存在") from exc
            except ClientError as exc:
                error_code = str(exc.response.get("Error", {}).get("Code", ""))
                if error_code in {"404", "NoSuchKey", "NotFound", "NoSuchObject"}:
                    raise InvalidFileSizeException("已上传的图片不存在") from exc
                raise MediaStorageUnavailableException() from exc
            except Exception as exc:
                raise MediaStorageUnavailableException() from exc
            if actual_size != file_size:
                raise InvalidFileSizeException("图片实际大小与上传确认信息不一致")
            file_size = actual_size
        if file_size > settings.MEDIA_IMAGE_MAX_FILE_SIZE:
            raise InvalidFileSizeException(f"图片不能超过 {settings.MEDIA_IMAGE_MAX_FILE_SIZE // (1024 * 1024)} MB")

    mf = MediaFile(
        uploader=uploader,
        resource_type=resource_type,
        original_filename=original_filename,
        file_size=file_size,
        thumbnail_status=ThumbnailStatus.PENDING if is_image else ThumbnailStatus.NOT_REQUESTED,
    )
    mf.file.name = oss_path
    mf.save()
    if mf.thumbnail_status == ThumbnailStatus.PENDING:

        def enqueue_thumbnail() -> None:
            from apps.media.tasks import enqueue_media_thumbnail

            enqueue_media_thumbnail(mf.pk)

        transaction.on_commit(enqueue_thumbnail, robust=True)
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

    validate_resource_type_upload(
        resource_type=resource_type,
        scope=scope,
        object_id=target_object_id,
        filename=file.name,
    )
    if file.size <= 0:
        raise InvalidFileSizeException("媒体文件不能为空")
    if is_image_path(file.name) and file.size > settings.MEDIA_IMAGE_MAX_FILE_SIZE:
        raise InvalidFileSizeException(f"图片不能超过 {settings.MEDIA_IMAGE_MAX_FILE_SIZE // (1024 * 1024)} MB")

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
        scope=scope,
    )


def _file_url(file_field, fallback: str | None = None) -> str:
    try:
        return file_field.url
    except Exception:
        if fallback is not None:
            return fallback
        return file_field.name or ""


def get_media_thumbnail_url(media_file: MediaFile, *, original_url: str | None = None) -> str | None:
    if not is_image_path(media_file.file.name):
        return None
    if original_url is None:
        original_url = _file_url(media_file.file)
    if media_file.thumbnail_status == ThumbnailStatus.READY and media_file.thumbnail:
        return _file_url(media_file.thumbnail, fallback=original_url)
    return original_url


def get_media_file_info(media_file: MediaFile) -> dict:
    """返回前端展示需要的媒体资源信息；图片缩略图不可用时回退原图。"""
    original_url = _file_url(media_file.file)

    return {
        "id": media_file.pk,
        "resource_type": media_file.resource_type,
        "original_filename": media_file.original_filename,
        "original": {
            "url": original_url,
        },
        "thumbnail": get_media_thumbnail_url(media_file, original_url=original_url),
        "file_size": media_file.file_size,
        "created_at": media_file.created_at,
    }


def extract_media_id(media_ref: int | Mapping[str, Any]) -> int:
    if isinstance(media_ref, Mapping):
        if "media_id" not in media_ref:
            raise ValueError("媒体引用对象必须包含 media_id")
        return int(media_ref["media_id"])
    return int(media_ref)


def to_plain_media_ref(media_ref):
    if hasattr(media_ref, "model_dump"):
        return media_ref.model_dump(exclude_none=True)
    return media_ref


def extract_media_ids(media_refs: Iterable[int | Mapping[str, Any]]) -> list[int]:
    """从 list[int] 或 list[dict] 中提取媒体 ID，保持原顺序返回。"""
    return [extract_media_id(media_ref) for media_ref in media_refs]


def load_media_refs(media_refs: Iterable[int | Mapping[str, Any]]) -> MediaRefBatch:
    """校验媒体引用是否存在且不重复，并返回按原顺序的 ID 与媒体映射。"""
    refs = [to_plain_media_ref(media_ref) for media_ref in media_refs]
    ordered_ids = extract_media_ids(refs)
    if len(ordered_ids) != len(set(ordered_ids)):
        raise ValueError("media_ids 不能包含重复 ID")
    if not ordered_ids:
        return MediaRefBatch(refs=refs, ids=[], media_by_id={})

    media_by_id = MediaFile.objects.in_bulk(ordered_ids)
    missing_ids = [media_id for media_id in ordered_ids if media_id not in media_by_id]
    if missing_ids:
        raise ValueError(f"媒体文件不存在: {missing_ids}")
    return MediaRefBatch(refs=refs, ids=ordered_ids, media_by_id=media_by_id)


def validate_media_refs(
    media_refs: Iterable[int | Mapping[str, Any]],
    *,
    allowed_media_types: Iterable[str] | None = None,
    allowed_resource_types: Iterable[str] | None = None,
    business_validators: Iterable[str | Callable] | None = None,
    instance=None,
    field=None,
    media_type_error_message: str = "媒体类型不正确。",
    resource_type_error_message: str = "媒体资源类型不正确。",
) -> list[int | Mapping[str, Any]]:
    """校验业务媒体引用列表，返回可安全入库的稳定引用。"""
    batch = load_media_refs(media_refs)
    media_type_set = set(allowed_media_types or [])
    resource_type_set = set(allowed_resource_types or [])
    normalized_refs: list[int | Mapping[str, Any]] = []

    for media_ref in batch.refs:
        media_id = extract_media_id(media_ref)
        if resource_type_set and batch.media_by_id[media_id].resource_type not in resource_type_set:
            raise ValueError(resource_type_error_message)
        if not isinstance(media_ref, Mapping):
            normalized_refs.append(media_id)
            continue
        if media_type_set and media_ref.get("media_type") not in media_type_set:
            raise ValueError(media_type_error_message)

        item = {key: value for key, value in media_ref.items() if key not in MEDIA_DERIVED_REF_FIELDS}
        item["media_id"] = media_id
        normalized_refs.append(item)

    for validator in business_validators or []:
        if isinstance(validator, str):
            module_path, func_name = validator.rsplit(".", 1)
            callback = getattr(import_module(module_path), func_name)
        else:
            callback = validator
        callback(instance=instance, refs=normalized_refs, media_by_id=batch.media_by_id, field=field)
    return normalized_refs


def resolve_media_refs(media_refs: Iterable[int | Mapping[str, Any]]) -> list[dict]:
    """解析媒体引用为前端展示结构，平台派生字段始终动态刷新。"""
    batch = load_media_refs(media_refs)
    media_infos = [get_media_file_info(batch.media_by_id[media_id]) for media_id in batch.ids]

    result = []
    for media_ref, media_info in zip(batch.refs, media_infos, strict=True):
        media_id = extract_media_id(media_ref)
        item = dict(media_ref) if isinstance(media_ref, Mapping) else {"media_id": media_id}
        item["media_id"] = media_id
        item.update(
            {
                "media_id": media_info["id"],
                "resource_type": media_info["resource_type"],
                "original_filename": media_info["original_filename"],
                "url": media_info["original"]["url"],
                "thumbnail": media_info["thumbnail"],
                "file_size": media_info["file_size"],
                "created_at": media_info["created_at"],
            }
        )
        result.append(item)
    return result


def collect_media_ref_field_ids() -> tuple[set[int], bool]:
    """收集所有 MediaRefsField 中仍被引用的媒体 ID。"""
    from apps.media.fields import MediaRefsField

    referenced_ids: set[int] = set()
    has_media_ref_fields = False
    for model in apps.get_models():
        for field in model._meta.get_fields():
            if not isinstance(field, MediaRefsField):
                continue
            has_media_ref_fields = True
            for row in model.objects.values_list(field.attname, flat=True).iterator():
                if row:
                    referenced_ids.update(extract_media_ids(row))
    return referenced_ids, has_media_ref_fields


def collect_referenced_media_ids(providers: Iterable[str | Callable[[], Iterable[int]]] | None = None) -> set[int]:
    """
    收集当前仍被业务引用的 MediaFile ID。

    来源分两部分：
    1. 所有 MediaRefsField 字段里的自动扫描结果
    2. settings.MEDIA_REFERENCE_PROVIDERS 里注册的 provider 返回结果

    provider 是媒体平台和业务模块之间的边界协议，适用于业务把 media_id
    存在普通 JSONField、extra JSON 或其他非 MediaRefsField 结构里的场景。
    provider 只负责上报“哪些 MediaFile 仍被业务引用”，不负责删除媒体。
    """
    referenced_ids, _ = collect_media_ref_field_ids()
    for provider in providers or getattr(settings, "MEDIA_REFERENCE_PROVIDERS", []):
        if isinstance(provider, str):
            module_path, func_name = provider.rsplit(".", 1)
            callback = getattr(import_module(module_path), func_name)
        else:
            callback = provider
        referenced_ids.update(int(media_id) for media_id in callback() if media_id)
    return referenced_ids


@dataclass(frozen=True)
class CleanupResult:
    deleted_count: int
    deleted_ids: list[int]


def delete_media_file(media_file_id: int, *, skip_processing: bool = False) -> bool:
    """统一删除媒体原文件、缩略图和数据库记录。"""
    with transaction.atomic():
        queryset = MediaFile.objects.select_for_update().filter(pk=media_file_id)
        if skip_processing:
            queryset = queryset.exclude(thumbnail_status=ThumbnailStatus.PROCESSING)
        media_file = queryset.first()
        if media_file is None:
            return False
        if media_file.thumbnail:
            media_file.thumbnail.delete(save=False)
        if media_file.file:
            media_file.file.delete(save=False)
        media_file.delete()
    return True


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
        field_referenced_ids, has_media_ref_fields = collect_media_ref_field_ids()
        if not providers and not has_media_ref_fields:
            return CleanupResult(deleted_count=0, deleted_ids=[])
        referenced_ids = set(field_referenced_ids)
        for provider in providers:
            if isinstance(provider, str):
                module_path, func_name = provider.rsplit(".", 1)
                callback = getattr(import_module(module_path), func_name)
            else:
                callback = provider
            referenced_ids.update(int(media_id) for media_id in callback() if media_id)

    cutoff = timezone.now() - older_than
    candidate_ids = list(MediaFile.objects.filter(created_at__lt=cutoff).exclude(pk__in=referenced_ids).order_by("pk").values_list("pk", flat=True))

    deleted_ids = []
    for media_file_id in candidate_ids:
        if delete_media_file(media_file_id, skip_processing=True):
            deleted_ids.append(media_file_id)
    return CleanupResult(deleted_count=len(deleted_ids), deleted_ids=deleted_ids)
