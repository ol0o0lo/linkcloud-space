from datetime import datetime
from typing import Literal

from ninja import Schema


class OssTokenIn(Schema):
    scope: Literal["user", "org"]
    filename: str


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
        return obj.file.url


class MediaFileConfirmIn(Schema):
    oss_path: str
    original_filename: str
    resource_type: str
    file_size: int
