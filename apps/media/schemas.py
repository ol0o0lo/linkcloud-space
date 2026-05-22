"""Media app 的请求/响应 schema."""
from ninja import Schema


class OssTokenIn(Schema):
    scope: str
    filename: str


class OssTokenOut(Schema):
    access_key_id: str
    access_key_secret: str
    security_token: str
    endpoint: str
    bucket: str
    path: str
    expires_at: str
