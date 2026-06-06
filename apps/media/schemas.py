from datetime import datetime
from typing import Literal

from ninja import Schema
from pydantic import Field


class OssTokenIn(Schema):
    scope: Literal["user", "org"] = Field(..., description="上传作用域，user 表示个人，org 表示当前租户。")
    filename: str = Field(..., description="原始文件名，用于生成上传路径。")


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


class MediaFileConfirmIn(Schema):
    oss_path: str = Field(..., description="对象存储中的文件路径。")
    original_filename: str = Field(..., description="用户上传时的原始文件名。")
    resource_type: str = Field(..., description="资源类型，例如 avatar、org_logo。")
    file_size: int = Field(..., description="文件大小，单位字节。")
