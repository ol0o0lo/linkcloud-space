"""OSS 上传路径生成和 STS 临时凭证."""
import json
from uuid import uuid4

from django.conf import settings

from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_sts20150401.models import AssumeRoleRequest
from alibabacloud_tea_openapi.models import Config as TeaConfig

ALLOWED_SCOPES = {"user", "org"}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}


def generate_upload_path(scope: str, object_id: int, filename: str) -> str:
    if scope not in ALLOWED_SCOPES:
        raise ValueError(f"Invalid scope '{scope}'. Allowed: {ALLOWED_SCOPES}")

    parts = filename.rsplit(".", 1)
    if len(parts) != 2 or not parts[1]:
        raise ValueError("Invalid extension: filename must have a valid extension.")
    ext = parts[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Invalid extension '.{ext}'. Allowed: {ALLOWED_EXTENSIONS}")

    uid = uuid4().hex
    if scope == "user":
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
