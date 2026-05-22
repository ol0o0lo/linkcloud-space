from django.conf import settings

from apps.media.sts import generate_sts_token, generate_upload_path


def get_oss_token(scope: str, object_id, filename: str) -> dict:
    path = generate_upload_path(scope=scope, object_id=object_id, filename=filename)
    token = generate_sts_token(
        path=path,
        access_key_id=settings.ALIYUN_STS_ACCESS_KEY_ID,
        access_key_secret=settings.ALIYUN_STS_ACCESS_KEY_SECRET,
        role_arn=settings.ALIYUN_STS_ROLE_ARN,
        role_session_name=settings.ALIYUN_STS_ROLE_SESSION_NAME,
        bucket=settings.MEDIA_S3_BUCKET_NAME,
    )
    return {
        "access_key_id": token["access_key_id"],
        "access_key_secret": token["access_key_secret"],
        "security_token": token["security_token"],
        "endpoint": settings.MEDIA_S3_ENDPOINT_URL,
        "bucket": settings.MEDIA_S3_BUCKET_NAME,
        "path": path,
        "expires_at": token["expires_at"],
    }
