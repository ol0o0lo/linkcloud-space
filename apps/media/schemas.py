from ninja import Schema

from apps.media.constants import MediaScope


class OssTokenIn(Schema):
    scope: MediaScope
    filename: str


class OssTokenOut(Schema):
    access_key_id: str
    access_key_secret: str
    security_token: str
    endpoint: str
    bucket: str
    path: str
    expires_at: str
