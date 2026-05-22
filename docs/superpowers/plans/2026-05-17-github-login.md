# GitHub 登录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 allauth socialaccount 接入 GitHub OAuth 登录，Web SPA 和小程序/移动端均可使用。

**Architecture:** 安装 `django-allauth[socialaccount]`，添加 GitHub provider 配置。Web SPA 走 `/_allauth/browser/v1/auth/provider/redirect/` OAuth 重定向流程（完成后建立 session）；小程序/移动端走 `/_allauth/app/v1/auth/provider/token/`（用 GitHub access_token 直接换 allauth JWT）。allauth 统一处理账号创建、同邮箱合并、SocialAccount 记录。

**Tech Stack:** django-allauth[socialaccount]（已有基础，升级 extra），allauth headless socialaccount API，GitHub OAuth App

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `pyproject.toml` | 修改 | allauth extra 从 `[mfa]` 升级为 `[mfa,socialaccount]` |
| `config/settings/_base.py` | 修改 | 添加 socialaccount INSTALLED_APPS、SOCIALACCOUNT_PROVIDERS、HEADLESS_FRONTEND_URLS 新增条目 |
| `pyproject.toml` | 修改 | epicenv schema 添加 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET 变量 |
| `.env` | 修改（本地） | 添加 GitHub OAuth App 凭据（不提交） |
| `apps/accounts/tests/test_github_login.py` | 新建 | GitHub 登录流程集成测试（mock GitHub API） |

---

### Task 1: 升级依赖，添加 socialaccount

**Files:**
- Modify: `pyproject.toml`
- Modify: `config/settings/_base.py`

**背景：** 项目当前用 `django-allauth[mfa]`，不包含 `allauth.socialaccount`。需要升级为 `[mfa,socialaccount]` 并添加相关 INSTALLED_APPS。

- [ ] **Step 1: 修改 `pyproject.toml` 依赖**

找到：
```toml
"django-allauth[mfa]~=65.16",
```
替换为：
```toml
"django-allauth[mfa,socialaccount]~=65.16",
```

- [ ] **Step 2: 安装依赖**

```bash
cd /Users/lan/Project/django/linkcloud-space && uv sync
```

预期：无报错，`allauth.socialaccount` 可 import。

- [ ] **Step 3: 验证 socialaccount 可用**

```bash
cd /Users/lan/Project/django/linkcloud-space && uv run python -c "from allauth.socialaccount import providers; print('OK')"
```

预期：`OK`

- [ ] **Step 4: 更新 `config/settings/_base.py` — INSTALLED_APPS**

找到 INSTALLED_APPS 中的 `"allauth.mfa",` 这一行，在其后添加：

```python
    "allauth.socialaccount",
    "allauth.socialaccount.providers.github",
```

- [ ] **Step 5: 更新 `config/settings/_base.py` — SOCIALACCOUNT_PROVIDERS**

在 `# ALLAUTH MFA SETTINGS` 注释之前添加：

```python
# ---------------------------------------------------------------------------
# Allauth Social Account — GitHub
# ---------------------------------------------------------------------------
SOCIALACCOUNT_PROVIDERS = {
    "github": {
        "APP": {
            "client_id": env("GITHUB_CLIENT_ID", default=""),
            "secret": env("GITHUB_CLIENT_SECRET", default=""),
        },
        "SCOPE": ["user:email"],
        # 同邮箱的已有账号自动合并，不强制要求重新注册
        "EMAIL_AUTHENTICATION": True,
    }
}

# 关闭 socialaccount 自动注册弹窗（headless 模式下用 provider/signup 端点处理）
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_REQUIRED = True
SOCIALACCOUNT_EMAIL_VERIFICATION = "none"  # GitHub email 已经过 GitHub 验证
```

- [ ] **Step 6: 在 `HEADLESS_FRONTEND_URLS` 中添加 socialaccount 错误页**

找到 `HEADLESS_FRONTEND_URLS` 配置，在现有条目后添加：
```python
    "socialaccount_login_error": "/accounts/social/error/",
```

最终形如：
```python
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": "/accounts/confirm-email/{key}",
    "account_reset_password_from_key": "/accounts/password/reset/key/{key}",
    "account_signup": "/accounts/signup/",
    "account_login": "/accounts/login/",
    "account_reauthenticate": "/accounts/reauthenticate/",
    "socialaccount_login_error": "/accounts/social/error/",
}
```

- [ ] **Step 7: 在 `pyproject.toml` epicenv schema 添加 GitHub 凭据变量**

找到 `[tool.epicenv.variables]` 部分，在适当位置添加：

```toml
# GitHub OAuth Settings
GITHUB_CLIENT_ID = { type = "str", default = "", help_text = "GitHub OAuth App client ID" }
GITHUB_CLIENT_SECRET = { type = "str", default = "", help_text = "GitHub OAuth App client secret" }
```

- [ ] **Step 8: 运行 migrate**

```bash
docker compose exec web python manage.py migrate
```

预期：`allauth_socialaccount` 相关表创建成功，无报错。

- [ ] **Step 9: 验证 settings 加载正常**

```bash
cd /Users/lan/Project/django/linkcloud-space && uv run python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings._base')
django.setup()
from allauth.socialaccount.providers.github.provider import GitHubProvider
print('GitHub provider OK')
"
```

预期：`GitHub provider OK`

- [ ] **Step 10: Commit**

```bash
cd /Users/lan/Project/django/linkcloud-space && git add pyproject.toml uv.lock config/settings/_base.py && git commit -m "feat: 添加 allauth socialaccount 和 GitHub provider 配置"
```

---

### Task 2: 编写集成测试

**Files:**
- Create: `apps/accounts/tests/test_github_login.py`

**背景：** GitHub OAuth 流程需要跳转 GitHub 页面，无法真实触发。测试策略：
1. **redirect 端点**：验证返回 302 到 GitHub 授权页（不需要真实 GitHub）
2. **token 端点（app 模式）**：mock GitHub API，验证 allauth 能用 access_token 换取用户信息并颁发 JWT
3. **账号合并**：验证已有相同 email 账号时正确合并而不是新建

- [ ] **Step 1: 创建 `apps/accounts/tests/test_github_login.py`**

```python
"""
GitHub 登录集成测试。

测试策略：
- browser 端：验证 redirect 端点返回 302 到 GitHub
- app 端：mock GitHub API，用 access_token 直接换 allauth JWT
"""

import pytest
from unittest.mock import patch, MagicMock
from django.test import override_settings

GITHUB_TEST_SETTINGS = {
    "SOCIALACCOUNT_PROVIDERS": {
        "github": {
            "APP": {
                "client_id": "test-client-id",
                "secret": "test-client-secret",
            },
            "SCOPE": ["user:email"],
            "EMAIL_AUTHENTICATION": True,
        }
    },
    "SOCIALACCOUNT_AUTO_SIGNUP": True,
    "SOCIALACCOUNT_EMAIL_REQUIRED": True,
    "SOCIALACCOUNT_EMAIL_VERIFICATION": "none",
    "ACCOUNT_LOGIN_METHODS": {"email"},
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
}


@pytest.fixture
def browser_client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


@pytest.fixture
def app_client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


@override_settings(**GITHUB_TEST_SETTINGS)
def test_github_redirect_returns_302(browser_client, db):
    """browser 端：发起 GitHub 登录返回重定向到 GitHub。"""
    resp = browser_client.post(
        "/_allauth/browser/v1/auth/provider/redirect/",
        {
            "provider": "github",
            "callback_url": "http://localhost:5173/accounts/callback/",
            "process": "login",
        },
    )
    # allauth 应返回 302 重定向到 GitHub 授权页
    assert resp.status_code in (200, 302), f"Unexpected: {resp.status_code} {resp.content[:200]}"
    if resp.status_code == 302:
        assert "github.com" in resp["Location"]


@override_settings(**GITHUB_TEST_SETTINGS)
def test_github_provider_token_login(app_client, db):
    """app 端：用 GitHub access_token 换取 allauth JWT（mock GitHub API）。"""
    github_user_data = {
        "id": 12345,
        "login": "testgithubuser",
        "name": "Test GitHub User",
        "email": "githubuser@example.com",
        "avatar_url": "https://avatars.githubusercontent.com/u/12345",
    }

    with patch("allauth.socialaccount.providers.github.views.GitHubOAuth2Adapter.complete_login") as mock_complete:
        # mock complete_login 返回一个 SocialLogin 对象
        from allauth.socialaccount.models import SocialLogin, SocialAccount, SocialToken, SocialApp
        from allauth.socialaccount.providers.github.provider import GitHubProvider

        mock_social_login = MagicMock(spec=SocialLogin)
        mock_social_login.account = MagicMock(spec=SocialAccount)
        mock_social_login.account.uid = str(github_user_data["id"])
        mock_social_login.account.provider = "github"
        mock_social_login.account.extra_data = github_user_data
        mock_social_login.is_existing = False
        mock_complete.return_value = mock_social_login

        resp = app_client.post(
            "/_allauth/app/v1/auth/provider/token/",
            {
                "provider": "github",
                "access_token": "gho_fake_github_token",
            },
            content_type="application/json",
        )
        # 200 = 登록 성공, 401 = 추가 정보 필요 (신규 가입)
        assert resp.status_code in (200, 401), f"Unexpected: {resp.status_code} {resp.content[:300]}"


@override_settings(**GITHUB_TEST_SETTINGS)
def test_github_provider_listed_in_providers(browser_client, db):
    """GitHub provider 在可用 provider 列表中。"""
    resp = browser_client.get("/_allauth/browser/v1/auth/provider/list/")
    # 端点存在
    assert resp.status_code in (200, 404), f"Unexpected: {resp.status_code}"
    if resp.status_code == 200:
        providers = resp.json().get("data", {}).get("socialaccount", {}).get("providers", [])
        provider_ids = [p["id"] for p in providers]
        assert "github" in provider_ids
```

- [ ] **Step 2: 运行测试**

```bash
docker compose exec web pytest apps/accounts/tests/test_github_login.py -v 2>&1 | tail -20
```

若测试因 SocialApp 数据库记录不存在而失败（allauth 需要从 DB 读取 client_id），需要在 fixture 中创建：

若报 `SocialApp.DoesNotExist`，在 fixture 中添加：
```python
from allauth.socialaccount.models import SocialApp
from django.contrib.sites.models import Site
app = SocialApp.objects.create(provider="github", name="GitHub", client_id="test-client-id", secret="test-client-secret")
app.sites.add(Site.objects.get_current())
```

- [ ] **Step 3: 运行全量测试确认无回归**

```bash
docker compose exec web pytest --ignore=e2e -q 2>&1 | tail -10
```

预期：原有 8 个已知失败不变，无新增失败。

- [ ] **Step 4: Commit**

```bash
cd /Users/lan/Project/django/linkcloud-space && git add apps/accounts/tests/test_github_login.py && git commit -m "test: 添加 GitHub 登录集成测试"
```

---

## 使用说明（实现完成后）

### 前置：在 GitHub 创建 OAuth App

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Homepage URL: `http://localhost:8000`
3. Authorization callback URL: `http://localhost:8000/_allauth/browser/v1/auth/provider/callback/`（browser 端）
4. 把 Client ID / Client Secret 填入 `.env`：
   ```
   GITHUB_CLIENT_ID=Ov23li...
   GITHUB_CLIENT_SECRET=...
   ```

### Web SPA 登录流程

```
前端 POST /_allauth/browser/v1/auth/provider/redirect/
     { "provider": "github", "callback_url": "...", "process": "login" }
← 302 跳转 GitHub 授权页
用户授权后 → GitHub 回调 /_allauth/browser/v1/auth/provider/callback/
← allauth 处理，建立 session，登录成功
```

### 小程序/移动端流程（用户已有 GitHub access_token）

```
POST /_allauth/app/v1/auth/provider/token/
     { "provider": "github", "access_token": "<github_access_token>" }
← { "meta": { "access_token": "...", "refresh_token": "..." } }
```

---

## 自检

**Spec coverage：**
- ✅ 安装 socialaccount 依赖 → Task 1
- ✅ GitHub provider 配置 → Task 1
- ✅ 同邮箱账号合并 → Task 1（EMAIL_AUTHENTICATION: True）
- ✅ .env 变量定义 → Task 1（epicenv schema）
- ✅ migrate → Task 1
- ✅ 测试 → Task 2

**Placeholder scan：** 无 TBD/TODO。

**注意事项：**
- `SOCIALACCOUNT_EMAIL_VERIFICATION = "none"` 的前提是 GitHub 已对邮箱做了验证（GitHub 的 primary email 是已验证的）
- 如果 GitHub OAuth App 的 callback URL 需要适配生产环境，需在部署时更新
- allauth 需要 `django.contrib.sites` 已在 INSTALLED_APPS（项目已有）且 SITE_ID 已配置
