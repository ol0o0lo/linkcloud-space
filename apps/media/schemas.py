from datetime import datetime
from typing import Literal

from ninja import Schema
from pydantic import Field

from apps.media.constants import MediaType


class OssTokenIn(Schema):
    scope: Literal["user", "org"] = Field(..., description="上传作用域，user 表示个人，org 表示当前租户。")
    filename: str = Field(..., description="原始文件名，用于生成上传路径。")
    resource_type: str | None = Field(None, description="可选资源类型，用于在签发上传凭证前校验作用域与扩展名。")


class OssTokenOut(Schema):
    access_key_id: str
    access_key_secret: str
    security_token: str
    endpoint: str
    bucket: str
    path: str
    expires_at: str


class MediaFileOut(Schema):
    id: int
    resource_type: str
    original_filename: str
    url: str
    file_size: int
    created_at: datetime

    @staticmethod
    def resolve_url(obj):
        try:
            return obj.file.url
        except Exception:
            return obj.file.name or ""


class MediaRefIn(Schema):
    media_id: int = Field(..., description="媒体文件 ID。")
    media_type: Literal[MediaType.IMAGE, MediaType.VIDEO, MediaType.FILE] = Field(MediaType.IMAGE, description="媒体类型，例如 image、video、file。")


class ResolvedMediaRefOut(Schema):
    media_id: int
    resource_type: str | None = Field(None, description="媒体资源类型，例如 avatar、real_name_id_card。")
    original_filename: str | None = Field(None, description="原始文件名。")
    url: str | None = Field(None, description="动态生成的访问 URL，私有存储通常为临时签名 URL。")
    thumbnail: str | None = Field(None, description="缩略图 URL，未生成时为 null。")
    file_size: int | None = Field(None, description="文件大小，单位字节。")
    created_at: datetime | None = Field(None, description="媒体文件创建时间。")


class MediaFileConfirmIn(Schema):
    oss_path: str = Field(..., description="对象存储中的文件路径。")
    original_filename: str = Field(..., description="用户上传时的原始文件名。")
    resource_type: str = Field(..., description="资源类型，例如 avatar、org_logo。")
    file_size: int = Field(..., description="文件大小，单位字节。")
