from django.core.exceptions import PermissionDenied

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.media.serializers import OssTokenRequestSerializer, OssTokenResponseSerializer
from apps.media.services import get_oss_token


class OssTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = OssTokenRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        scope = serializer.validated_data["scope"]
        filename = serializer.validated_data["filename"]

        if scope == "user":
            object_id = request.user.pk
        else:
            org = getattr(request, "org", None)
            instance = org.instance if org is not None else None
            if instance is None:
                raise PermissionDenied("No active organization.")
            object_id = instance.pk

        try:
            result = get_oss_token(scope=scope, object_id=object_id, filename=filename)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        return Response(OssTokenResponseSerializer(result).data)
