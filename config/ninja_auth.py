"""
Ninja 双认证：JWT Bearer 优先，fallback 到 Django session。

Web SPA 继续用 session（X-CSRFToken），无感知。
小程序 / 移动端使用 Authorization: Bearer <access_token>。
"""

from ninja.security import HttpBearer
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class JWTOrSessionAuth(HttpBearer):
    """
    Ninja 全局认证类。

    1. 若请求头有 Authorization: Bearer <token>，走 simplejwt 验证。
    2. 否则 fallback 到 Django session（与原 django_auth 行为一致）。
    """

    openapi_scheme = "bearer"

    def authenticate(self, request, token: str):
        # --- JWT 路径 ---
        if token:
            jwt_auth = JWTAuthentication()
            try:
                validated_token = jwt_auth.get_validated_token(token.encode())
                user = jwt_auth.get_user(validated_token)
                request.user = user
                return user
            except (InvalidToken, TokenError):
                return None

        return None

    def __call__(self, request):
        # Bearer token 存在时走 JWT
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            return self.authenticate(request, token)

        # 无 Bearer header → fallback 到 session
        if request.user and request.user.is_authenticated:
            return request.user

        return None
