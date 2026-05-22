"""OSS 临时凭证接口."""
from django.conf import settings
from django.core.exceptions import PermissionDenied

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.media.sts import generate_sts_token, generate_upload_path

ALLOWED_SCOPES = {"user", "org"}


class OssTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        scope = request.query_params.get("scope", "")
        filename = request.query_params.get("filename", "")

        if scope == "user":
            object_id = request.user.pk
        elif scope == "org":
            org = getattr(request, "org", None)
            instance = org.instance if org is not None else None
            if instance is None:
                raise PermissionDenied("No active organization.")
            object_id = instance.pk
        else:
            return Response(
                {"detail": f"Invalid scope '{scope}'. Allowed: user, org"},
                status=400,
            )

        try:
            path = generate_upload_path(scope=scope, object_id=object_id, filename=filename)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        token = generate_sts_token(
            path=path,
            access_key_id=settings.ALIYUN_STS_ACCESS_KEY_ID,
            access_key_secret=settings.ALIYUN_STS_ACCESS_KEY_SECRET,
            role_arn=settings.ALIYUN_STS_ROLE_ARN,
            role_session_name=settings.ALIYUN_STS_ROLE_SESSION_NAME,
            bucket=settings.MEDIA_S3_BUCKET_NAME,
        )

        return Response({
            "access_key_id": token["access_key_id"],
            "access_key_secret": token["access_key_secret"],
            "security_token": token["security_token"],
            "endpoint": settings.MEDIA_S3_ENDPOINT_URL,
            "bucket": settings.MEDIA_S3_BUCKET_NAME,
            "path": path,
            "expires_at": token["expires_at"],
        })
