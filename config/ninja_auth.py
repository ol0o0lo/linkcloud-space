"""
Ninja 双认证：allauth JWT Bearer 优先，fallback 到 Django session。

Web SPA 继续用 session（X-CSRFToken），无感知。
小程序 / 移动端使用 Authorization: Bearer <access_token>（由 allauth 颁发）。
"""

from ninja.security import HttpBearer


class JWTOrSessionAuth(HttpBearer):
    """
    Ninja 全局认证类。

    1. 若请求头有 Authorization: Bearer <token>，用 allauth validate_access_token 验证。
    2. 否则 fallback 到 Django session（与原 django_auth 行为一致）。
    """

    openapi_scheme = "bearer"

    def authenticate(self, request, token: str):
        from allauth.headless.tokens.strategies.jwt.internal import validate_access_token

        if not token:
            return None

        result = validate_access_token(token)
        if result is None:
            return None

        lazy_user, _payload = result
        # 触发 lazy user 加载并赋值给 request.user
        user = lazy_user  # SimpleLazyObject，首次访问时查询数据库
        request.user = user
        return user

    # intentionally overrides HttpBearer.__call__ to support session fallback
    def __call__(self, request):
        # Bearer token 存在时走 allauth JWT 验证
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            return self.authenticate(request, token)

        # 无 Bearer header → fallback 到 session（Web SPA）
        if request.user and request.user.is_authenticated:
            return request.user

        return None
