"""阿里云 OSS STS 临时凭证生成逻辑."""
import json
from uuid import uuid4

from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_sts20150401.models import AssumeRoleRequest
from alibabacloud_tea_openapi.models import Config as TeaConfig

ALLOWED_SCOPES = {"user", "org"}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}


def generate_upload_path(scope: str, object_id: int, filename: str) -> str:
    """根据 scope 和 object_id 生成隔离的 OSS 上传路径."""
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


def generate_sts_token(
    *,
    path: str,
    access_key_id: str,
    access_key_secret: str,
    role_arn: str,
    role_session_name: str,
    bucket: str = "",
    duration_seconds: int = 900,
) -> dict:
    """调用阿里云 STS 签发临时凭证，权限仅限写入指定 path."""
    policy = {
        "Version": "1",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["oss:PutObject"],
                "Resource": [f"acs:oss:*:*:{bucket}/{path}"],
            }
        ],
    }

    config = TeaConfig(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
        endpoint="sts.aliyuncs.com",
    )
    client = StsClient(config)

    request = AssumeRoleRequest(
        role_arn=role_arn,
        role_session_name=role_session_name,
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
