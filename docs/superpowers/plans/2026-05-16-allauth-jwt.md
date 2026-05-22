# 统一迁移到 allauth JWT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 JWT 认证从 simplejwt 统一迁移到 allauth 内置的 `JWTTokenStrategy`，使所有登录入口（用户名密码、GitHub OAuth 等）都颁发同格式 JWT，同时移除 simplejwt 依赖。

**Architecture:** allauth headless 65.x 内置 `JWTTokenStrategy`，登录完成后自动颁发 access_token + refresh_token（HS256 签名）。Ninja 的认证类改为调用 allauth 的 `validate_access_token` 验证 Bearer token，fallback 到 session 供 Web 端使用。simplejwt 的 token 端点和依赖全部移除，refresh 改用 allauth 自带的 `/_allauth/browser/v1/auth/tokens/refresh`。

**Tech Stack:** django-allauth（已有，升级 extra 为 `[mfa,socialaccount]`），PyJWT（allauth 依赖，已传递安装），django-ninja（已有）

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `pyproject.toml` | 修改 | allauth extra 加 socialaccount，移除 simplejwt |
| `config/settings/_base.py` | 修改 | 加 allauth JWT 配置，移除 SIMPLE_JWT，更新 REST_FRAMEWORK，更新 INSTALLED_APPS |
| `config/ninja_auth.py` | 修改 | 验证逻辑从 simplejwt 改为 allauth validate_access_token |
| `config/urls.py` | 修改 | 移除 simplejwt token 端点 |
| `apps/accounts/tests/test_jwt_auth.py` | 修改 | token 端点改为 allauth 登录接口，refresh 端点更新 |
| `apps/organizations/tests/test_jwt_org_header.py` | 修改 | 同上，token 获取方式更新 |

---

### Task 1: 更新依赖，移除 simplejwt

**Files:**
- Modify: `pyproject.toml`
- Modify: `config/settings/_base.py`

**背景：** simplejwt 相关的三项从 INSTALLED_APPS 删除，REST_FRAMEWORK 认证类改为只保留 SessionAuthentication（Bearer token 验证改在 ninja_auth.py 里做），SIMPLE_JWT 配置块整体删除，新增 allauth JWT 配置。

- [ ] **Step 1: 修改 `pyproject.toml`**

找到 dependencies 中的两行：
```toml
"djangorestframework>=3.16,<4",
"djangorestframework-simplejwt>=5.4,<6",
```
删除 `djangorestframework-simplejwt>=5.4,<6` 这一行（保留 djangorestframework，DRF 本身还有用）。

- [ ] **Step 2: 安装依赖**

```bash
cd /Users/lan/Project/django/linkcloud-space && uv sync
```

预期：无报错，`rest_framework_simplejwt` 不再出现在环境中。

- [ ] **Step 3: 更新 `config/settings/_base.py` — INSTALLED_APPS**

找到并删除以下两行（`rest_framework` 保留）：
```python
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
```

- [ ] **Step 4: 更新 `config/settings/_base.py` — REST_FRAMEWORK**

找到当前 REST_FRAMEWORK 配置：
```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "EXCEPTION_HANDLER": "config.drf_exceptions.custom_exception_handler",
}
```

替换为（移除 simplejwt，Bearer 验证由 ninja_auth 负责）：
```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "EXCEPTION_HANDLER": "config.drf_exceptions.custom_exception_handler",
}
```

- [ ] **Step 5: 更新 `config/settings/_base.py` — 删除 SIMPLE_JWT，加 allauth JWT 配置**

找到并完整删除以下配置块（约 13 行）：
```python
# ---------------------------------------------------------------------------
# SimpleJWT
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}
```

在原位置（`# ---------------------------------------------------------------------------` 注释前后）添加 allauth JWT 配置：
```python
# ---------------------------------------------------------------------------
# Allauth Headless JWT
# ---------------------------------------------------------------------------
HEADLESS_TOKEN_STRATEGY = "allauth.headless.tokens.strategies.jwt.strategy.JWTTokenStrategy"
HEADLESS_JWT_ALGORITHM = "HS256"
# HS256 自动使用 Django SECRET_KEY，无需额外配置 HEADLESS_JWT_PRIVATE_KEY
HEADLESS_JWT_ACCESS_TOKEN_EXPIRES_IN = 1800    # 30 分钟
HEADLESS_JWT_REFRESH_TOKEN_EXPIRES_IN = 604800  # 7 天
HEADLESS_JWT_ROTATE_REFRESH_TOKEN = True
HEADLESS_JWT_STATEFUL_VALIDATION_ENABLED = False  # 无状态验证，小程序端不依赖 session
```

- [ ] **Step 6: 同时检查文件顶部 `from datetime import timedelta` 是否还有其他用途**

```bash
grep -n "timedelta" /Users/lan/Project/django/linkcloud-space/config/settings/_base.py
```

若只有 SIMPLE_JWT 用到（已删除），删除这行 import。若其他地方还用则保留。

- [ ] **Step 7: 验证 settings 可正常加载**

```bash
cd /Users/lan/Project/django/linkcloud-space && uv run python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings._base')
django.setup()
from allauth.headless import app_settings
print('TOKEN_STRATEGY:', app_settings.TOKEN_STRATEGY.__class__.__name__)
print('JWT_ALGORITHM:', app_settings.JWT_ALGORITHM)
"
```

预期输出：
```
TOKEN_STRATEGY: JWTTokenStrategy
JWT_ALGORITHM: HS256
```

- [ ] **Step 8: Commit**

```bash
cd /Users/lan/Project/django/linkcloud-space && git add pyproject.toml uv.lock config/settings/_base.py && git commit -m "feat: 迁移 JWT 认证到 allauth JWTTokenStrategy，移除 simplejwt"
```

---

### Task 2: 更新 Ninja 认证类

**Files:**
- Modify: `config/ninja_auth.py`

**背景：** 当前 `JWTOrSessionAuth.__call__` 用 simplejwt 的 `JWTAuthentication` 验证 Bearer token。改为调用 allauth 的 `validate_access_token`，它返回 `(lazy_user, payload)` tuple 或 `None`。

- [ ] **Step 1: 将 `config/ninja_auth.py` 完整替换为**

```python
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
```

- [ ] **Step 2: 验证语法**

```bash
cd /Users/lan/Project/django/linkcloud-space && uv run python -c "from config.ninja_auth import JWTOrSessionAuth; print('OK')"
```

预期：`OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/lan/Project/django/linkcloud-space && git add config/ninja_auth.py && git commit -m "feat: Ninja JWT 验证改用 allauth validate_access_token"
```

---

### Task 3: 更新 URL 配置

**Files:**
- Modify: `config/urls.py`

**背景：** 移除 simplejwt 的两个端点。allauth 自带 refresh 端点 `/_allauth/browser/v1/auth/tokens/refresh`（已通过 `path("_allauth/", include("allauth.headless.urls"))` 注册），无需额外配置。登录端点用 `POST /_allauth/browser/v1/auth/login`。

- [ ] **Step 1: 修改 `config/urls.py`**

删除顶部 import：
```python
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
```

删除 urlpatterns 中的两行：
```python
    path("api/v1/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
```

- [ ] **Step 2: 验证 urls 可正常加载**

```bash
cd /Users/lan/Project/django/linkcloud-space && uv run python -c "from config.urls import urlpatterns; print('OK, routes:', len(urlpatterns))"
```

预期：`OK, routes: <数字>`，无报错。

- [ ] **Step 3: Commit**

```bash
cd /Users/lan/Project/django/linkcloud-space && git add config/urls.py && git commit -m "feat: 移除 simplejwt token 端点，改用 allauth 登录和 refresh 端点"
```

---

### Task 4: 更新测试

**Files:**
- Modify: `apps/accounts/tests/test_jwt_auth.py`
- Modify: `apps/organizations/tests/test_jwt_org_header.py`

**背景：** 旧测试通过 simplejwt 的 `/api/v1/auth/token/` 获取 token。改为通过 allauth headless 登录接口获取：
- 登录：`POST /_allauth/browser/v1/auth/login`，body `{"email": "...", "password": "..."}`
- 响应中 `data.access_token` 是 access token，`data.refresh_token` 是 refresh token
- Refresh：`POST /_allauth/browser/v1/auth/tokens/refresh`，body `{"refresh_token": "..."}`

- [ ] **Step 1: 完整替换 `apps/accounts/tests/test_jwt_auth.py`**

```python
"""
JWT 认证集成测试（使用 allauth headless JWT）。

验证：
- allauth 登录接口颁发 access_token + refresh_token
- access_token 可访问受保护的 Ninja 接口
- 无效 token 返回 401
- refresh_token 可换取新 access_token
- session 认证仍然有效（Web 端回归）
"""

import pytest


@pytest.fixture
def user_with_password(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(
        username="jwtuser",
        email="jwtuser@example.com",
        password="testpass123",
    )


@pytest.fixture
def jwt_client():
    """使用 localhost SERVER_NAME 的测试客户端。"""
    from django.test import Client
    return Client(SERVER_NAME="localhost")


def _allauth_login(client, email, password):
    """通过 allauth headless 登录，返回 (access_token, refresh_token)。"""
    resp = client.post(
        "/_allauth/browser/v1/auth/login",
        {"email": email, "password": password},
        content_type="application/json",
    )
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    data = resp.json()["data"]
    return data["access_token"], data["refresh_token"]


def test_login_returns_jwt(jwt_client, user_with_password):
    """allauth 登录接口颁发 access_token 和 refresh_token。"""
    access, refresh = _allauth_login(jwt_client, "jwtuser@example.com", "testpass123")
    assert access
    assert refresh


def test_login_wrong_password(jwt_client, user_with_password):
    """错误密码返回 401。"""
    resp = jwt_client.post(
        "/_allauth/browser/v1/auth/login",
        {"email": "jwtuser@example.com", "password": "wrong"},
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_access_ninja_endpoint_with_jwt(jwt_client, user_with_password):
    """用 access_token 可访问 Ninja 保护接口（认证通过即可，权限不足是 403 不是 401）。"""
    access, _ = _allauth_login(jwt_client, "jwtuser@example.com", "testpass123")

    resp = jwt_client.get(
        "/api/users/",
        HTTP_AUTHORIZATION=f"Bearer {access}",
    )
    # 认证通过：200 或 403（权限不足），不能是 401
    assert resp.status_code in (200, 403)


def test_invalid_jwt_returns_401(jwt_client, db):
    """无效 JWT 返回 401。"""
    resp = jwt_client.get(
        "/api/users/",
        HTTP_AUTHORIZATION="Bearer invalidtoken",
    )
    assert resp.status_code == 401


def test_no_auth_returns_401(jwt_client, db):
    """无认证信息返回 401。"""
    resp = jwt_client.get("/api/users/")
    assert resp.status_code == 401


def test_refresh_token(jwt_client, user_with_password):
    """refresh_token 可换取新 access_token。"""
    _, refresh = _allauth_login(jwt_client, "jwtuser@example.com", "testpass123")

    resp = jwt_client.post(
        "/_allauth/browser/v1/auth/tokens/refresh",
        {"refresh_token": refresh},
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "access_token" in data


def test_session_auth_still_works(client, user_with_password):
    """Web 端 session 认证不受影响（回归测试）。"""
    client.force_login(user_with_password)
    resp = client.get("/api/version/")
    assert resp.status_code == 200
```

- [ ] **Step 2: 完整替换 `apps/organizations/tests/test_jwt_org_header.py`**

```python
"""
X-Org-Slug header 测试（使用 allauth headless JWT）。

验证小程序通过 JWT + X-Org-Slug header 可正确解析 request.org。
"""

import pytest


@pytest.fixture
def user_with_password(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(
        username="orgtest",
        email="orgtest@example.com",
        password="testpass123",
    )


@pytest.fixture
def org_with_member(db, user_with_password):
    from model_bakery import baker
    from apps.organizations.models import OrganizationMember
    org = baker.make("organizations.Organization", name="Test Org", slug="test-org")
    OrganizationMember.objects.create(organization=org, user=user_with_password, is_owner=True)
    return org


@pytest.fixture
def jwt_client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


def _get_access_token(client, email="orgtest@example.com", password="testpass123"):
    resp = client.post(
        "/_allauth/browser/v1/auth/login",
        {"email": email, "password": password},
        content_type="application/json",
    )
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    return resp.json()["data"]["access_token"]


def test_org_resolved_from_header(jwt_client, org_with_member, user_with_password):
    """JWT + X-Org-Slug header 可正确访问需要 org 的接口。"""
    token = _get_access_token(jwt_client)
    resp = jwt_client.get(
        "/api/teams/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_ORG_SLUG="test-org",
    )
    assert resp.status_code == 200


def test_wrong_org_slug_returns_403(jwt_client, org_with_member, user_with_password):
    """不存在的 org slug 应返回 403。"""
    token = _get_access_token(jwt_client)
    resp = jwt_client.get(
        "/api/teams/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_ORG_SLUG="nonexistent-org",
    )
    assert resp.status_code == 403


def test_not_member_org_returns_403(jwt_client, db, user_with_password):
    """不是成员的 org 应返回 403。"""
    from model_bakery import baker
    baker.make("organizations.Organization", slug="other-org")
    token = _get_access_token(jwt_client)
    resp = jwt_client.get(
        "/api/teams/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_ORG_SLUG="other-org",
    )
    assert resp.status_code == 403


def test_no_org_header_returns_403(jwt_client, org_with_member, user_with_password):
    """JWT 认证通过但无 X-Org-Slug header，需要 org 的接口返回 403。"""
    token = _get_access_token(jwt_client)
    resp = jwt_client.get(
        "/api/teams/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert resp.status_code == 403
```

- [ ] **Step 3: 运行新测试**

```bash
docker compose exec web pytest apps/accounts/tests/test_jwt_auth.py apps/organizations/tests/test_jwt_org_header.py -v 2>&1 | tail -40
```

若有失败，常见原因：
- allauth headless 登录响应结构不同 → 打印 `resp.json()` 调试
- `HEADLESS_JWT_STATEFUL_VALIDATION_ENABLED = False` 时 session 里无 sid → 检查 allauth 版本行为

- [ ] **Step 4: 运行全量测试，确认无新增失败**

```bash
docker compose exec web pytest --ignore=e2e -x -q 2>&1 | tail -20
```

预期：原有 8 个已知失败不变，无新增失败。

- [ ] **Step 5: Commit**

```bash
cd /Users/lan/Project/django/linkcloud-space && git add apps/accounts/tests/test_jwt_auth.py apps/organizations/tests/test_jwt_org_header.py && git commit -m "test: 更新 JWT 测试，改用 allauth headless 登录接口"
```

---

## 自检

**Spec coverage：**
- ✅ simplejwt 移除 → Task 1
- ✅ allauth JWTTokenStrategy 配置（HS256）→ Task 1
- ✅ Ninja 认证改用 allauth validate_access_token → Task 2
- ✅ Web 端 session fallback 保留 → Task 2
- ✅ 移除 simplejwt URL 端点 → Task 3
- ✅ allauth refresh 端点自动可用 → Task 3（说明）
- ✅ 测试更新 → Task 4

**Placeholder scan：** 无 TBD/TODO。

**Type consistency：** `validate_access_token` 返回 `(lazy_user, payload) | None`，Task 2 和 Task 4 的用法一致。

**注意事项：**
- allauth `HEADLESS_JWT_STATEFUL_VALIDATION_ENABLED = False` 表示 access token 验证不查 session，但 refresh token 仍然是有状态的（jti 存在 session 里）。这对小程序场景是合理的——access token 无状态可随时用，refresh token 保有撤销能力。
- token_blacklist 表随 simplejwt 一起移除，需要 migrate 清理（Task 1 的 uv sync 后 manage.py migrate 会处理）。但如果 token_blacklist 表已有数据，需要先手动确认是否可以丢弃。
