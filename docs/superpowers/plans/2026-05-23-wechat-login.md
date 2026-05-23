# 微信登录实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为项目添加微信小程序登录（自定义 provider）和微信网页扫码登录（内置 weixin provider），通过 unionid 打通账号关联。

**Architecture:** 自定义 `wechat_miniprogram` allauth provider 处理小程序 code → openid 流程，复用 allauth 内置 `weixin` provider 处理 PC 扫码 OAuth2，在 `AccountAdapter.pre_social_login` hook 中通过 unionid 合并两端账号。

**Tech Stack:** Django 5, django-allauth 65.x, django-ninja, pytest, model-bakery, unittest.mock

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/accounts/providers/__init__.py` | 新建 | 包标记 |
| `apps/accounts/providers/wechat_miniprogram/__init__.py` | 新建 | 包标记 |
| `apps/accounts/providers/wechat_miniprogram/provider.py` | 新建 | WechatMiniprogramProvider：uid 提取、extra_data、complete_login（调 jscode2session） |
| `apps/accounts/tests/test_wechat_miniprogram_login.py` | 新建 | 小程序登录全部测试 |
| `apps/accounts/tests/test_weixin_provider.py` | 新建 | weixin 网页扫码配置测试 |
| `apps/accounts/auth_adapter.py` | 修改 | 新增 `pre_social_login` unionid 合并逻辑 |
| `config/settings/_base.py` | 修改 | 新增 weixin + wechat_miniprogram INSTALLED_APPS 和 SOCIALACCOUNT_PROVIDERS 配置 |
| `pyproject.toml` | 修改 | 新增四个微信相关 epicenv 变量 |

---

## Task 1：搭建 wechat_miniprogram provider 骨架

**Files:**
- Create: `apps/accounts/providers/__init__.py`
- Create: `apps/accounts/providers/wechat_miniprogram/__init__.py`
- Create: `apps/accounts/providers/wechat_miniprogram/provider.py`
- Create: `apps/accounts/tests/test_wechat_miniprogram_login.py`
- Modify: `config/settings/_base.py`
- Modify: `pyproject.toml`

- [ ] **Step 1: 写失败测试——provider 出现在 flows 中**

新建 `apps/accounts/tests/test_wechat_miniprogram_login.py`：

```python
"""
微信小程序登录集成测试。

测试策略：
- provider 骨架：wechat_miniprogram 出现在未认证时的 flows 中
- 登录流程：mock jscode2session，用 provider/token 端点完成登录
- 自动注册：新 openid 自动创建 User（username=wx_xxx，email 为空）
- 已有账号：同一 openid 再次登录返回已有 User
- unionid 合并：先小程序后扫码、先扫码后小程序两种场景
- 错误处理：微信返回 errcode 时响应非 5xx

注意：allauth 65.x 中，如果 settings.SOCIALACCOUNT_PROVIDERS 包含 APP 块，
同时 DB 里也有 SocialApp 记录，会报 MultipleObjectsReturned。
因此测试中使用 settings APP 方式（不建 DB 记录）。
"""

import pytest
from unittest.mock import patch, MagicMock
from django.test import override_settings

MINIPROGRAM_TEST_SETTINGS = {
    "SOCIALACCOUNT_PROVIDERS": {
        "wechat_miniprogram": {
            "APP": {
                "client_id": "test-miniprogram-appid",
                "secret": "test-miniprogram-secret",
            },
        },
    },
    "SOCIALACCOUNT_AUTO_SIGNUP": True,
    "SOCIALACCOUNT_EMAIL_REQUIRED": False,
    "SOCIALACCOUNT_EMAIL_VERIFICATION": "none",
    "ACCOUNT_LOGIN_METHODS": {"email"},
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ALLOWED_HOSTS": ["localhost", "localhost:5173"],
}


@pytest.fixture
def client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_wechat_miniprogram_provider_in_flows(client, db):
    """wechat_miniprogram 出现在未认证时的 provider flows 中。"""
    resp = client.get("/_allauth/browser/v1/account/providers")
    body = resp.json()
    flows = body.get("data", {}).get("flows", [])
    provider_flow = next((f for f in flows if f.get("id") == "provider_token"), None)
    assert provider_flow is not None, f"No provider_token flow: {flows}"
    assert "wechat_miniprogram" in provider_flow.get("providers", []), \
        f"wechat_miniprogram not in providers: {provider_flow}"
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_miniprogram_login.py::test_wechat_miniprogram_provider_in_flows -v
```

预期：FAIL，报 `No module named 'apps.accounts.providers'` 或 provider 不在 flows 中。

- [ ] **Step 3: 创建 provider 包和骨架**

创建 `apps/accounts/providers/__init__.py`（空文件）。

创建 `apps/accounts/providers/wechat_miniprogram/__init__.py`（空文件）。

创建 `apps/accounts/providers/wechat_miniprogram/provider.py`：

```python
import requests

from allauth.socialaccount.providers.base import Provider, ProviderAccount
from allauth.socialaccount.models import SocialLogin


JSCODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session"


class WechatMiniprogramAccount(ProviderAccount):
    pass


class WechatMiniprogramProvider(Provider):
    id = "wechat_miniprogram"
    name = "微信小程序"
    account_class = WechatMiniprogramAccount
    uses_apps = True

    def extract_uid(self, data):
        return data["openid"]

    def extract_extra_data(self, data):
        return {
            "openid": data.get("openid"),
            "unionid": data.get("unionid"),
        }

    def extract_common_fields(self, data):
        return {}

    def complete_login(self, request, app, token, **kwargs):
        code = token.token
        params = {
            "appid": app.client_id,
            "secret": app.secret,
            "js_code": code,
            "grant_type": "authorization_code",
        }
        resp = requests.get(JSCODE2SESSION_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("errcode"):
            from allauth.socialaccount.adapter import get_adapter
            raise get_adapter().validation_error(
                "invalid_token",
                f"微信登录失败: {data.get('errmsg', data['errcode'])}",
            )

        login = self.sociallogin_from_response(request, data)
        return login


provider_classes = [WechatMiniprogramProvider]
```

- [ ] **Step 4: 注册 provider 到 INSTALLED_APPS**

修改 `config/settings/_base.py`，在 `allauth.socialaccount.providers.github` 后添加：

```python
"allauth.socialaccount.providers.weixin",
"apps.accounts.providers.wechat_miniprogram",
```

同时在 `SOCIALACCOUNT_PROVIDERS` 中添加：

```python
"weixin": {
    "APP": {
        "client_id": env("WECHAT_APP_ID", default=""),
        "secret": env("WECHAT_APP_SECRET", default=""),
    },
    "SCOPE": ["snsapi_login"],
},
"wechat_miniprogram": {
    "APP": {
        "client_id": env("WECHAT_MINIPROGRAM_APP_ID", default=""),
        "secret": env("WECHAT_MINIPROGRAM_APP_SECRET", default=""),
    },
},
```

- [ ] **Step 5: 新增 epicenv 变量到 pyproject.toml**

在 `[tool.epicenv.variables]` 的 `# GitHub OAuth` 块之后添加：

```toml
# WeChat OAuth
WECHAT_APP_ID = { type = "str", default = "", help_text = "微信开放平台网站应用 AppID（PC 扫码登录）" }
WECHAT_APP_SECRET = { type = "str", default = "", help_text = "微信开放平台网站应用 AppSecret" }
WECHAT_MINIPROGRAM_APP_ID = { type = "str", default = "", help_text = "微信小程序 AppID" }
WECHAT_MINIPROGRAM_APP_SECRET = { type = "str", default = "", help_text = "微信小程序 AppSecret" }
```

- [ ] **Step 6: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_miniprogram_login.py::test_wechat_miniprogram_provider_in_flows -v
```

预期：PASS。

- [ ] **Step 7: 提交**

```bash
git add apps/accounts/providers/ apps/accounts/tests/test_wechat_miniprogram_login.py config/settings/_base.py pyproject.toml
git commit -m "feat: 添加 wechat_miniprogram provider 骨架和配置"
```

---

## Task 2：实现 complete_login（jscode2session 调用）

**Files:**
- Modify: `apps/accounts/providers/wechat_miniprogram/provider.py`（已在 Task 1 完整实现，本 task 补充测试）
- Modify: `apps/accounts/tests/test_wechat_miniprogram_login.py`

- [ ] **Step 1: 写失败测试——调用 jscode2session**

在 `test_wechat_miniprogram_login.py` 末尾追加：

```python
@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_login_calls_jscode2session(client, db):
    """provider/token 端点收到 code 后调用微信 jscode2session API。"""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "openid": "test_openid_123",
        "session_key": "test_session_key",
    }
    mock_resp.raise_for_status = MagicMock()

    with patch("apps.accounts.providers.wechat_miniprogram.provider.requests.get",
               return_value=mock_resp) as mock_get:
        client.post(
            "/_allauth/browser/v1/auth/provider/token",
            {"provider": "wechat_miniprogram", "token": {"id_token": "test_code_abc"}},
            content_type="application/json",
        )
        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args
        assert "jscode2session" in call_kwargs[0][0]
        assert call_kwargs[1]["params"]["js_code"] == "test_code_abc"
        assert call_kwargs[1]["params"]["appid"] == "test-miniprogram-appid"
```

- [ ] **Step 2: 运行测试，确认通过**

`complete_login` 已在 Task 1 实现，此测试应直接通过：

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_miniprogram_login.py::test_miniprogram_login_calls_jscode2session -v
```

预期：PASS。若失败，检查 `provider.py` 中 `token.token` 是否正确取到 `id_token` 的值（allauth provider/token 端点将 `id_token` 字段映射到 `SocialToken.token`）。

- [ ] **Step 3: 提交**

```bash
git add apps/accounts/tests/test_wechat_miniprogram_login.py
git commit -m "test: 验证 wechat_miniprogram provider 调用 jscode2session"
```

---

## Task 3：实现自动注册——新 openid 首次登录

**Files:**
- Modify: `apps/accounts/tests/test_wechat_miniprogram_login.py`

- [ ] **Step 1: 写失败测试——自动注册**

在 `test_wechat_miniprogram_login.py` 末尾追加：

```python
@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_new_user_auto_registers(client, db):
    """新 openid 首次登录自动创建 User 和 SocialAccount。"""
    from django.contrib.auth import get_user_model
    from allauth.socialaccount.models import SocialAccount

    User = get_user_model()

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"openid": "new_openid_001", "session_key": "sk"}
    mock_resp.raise_for_status = MagicMock()

    with patch("apps.accounts.providers.wechat_miniprogram.provider.requests.get",
               return_value=mock_resp):
        resp = client.post(
            "/_allauth/browser/v1/auth/provider/token",
            {"provider": "wechat_miniprogram", "token": {"id_token": "some_code"}},
            content_type="application/json",
        )

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.content[:300]}"

    # User 已创建
    assert User.objects.filter(socialaccount__uid="new_openid_001").exists()
    user = User.objects.get(socialaccount__uid="new_openid_001")
    assert user.username.startswith("wx_"), f"username 应以 wx_ 开头: {user.username}"
    assert user.email == "", f"email 应为空: {user.email}"

    # SocialAccount 已创建
    sa = SocialAccount.objects.get(provider="wechat_miniprogram", uid="new_openid_001")
    assert sa.extra_data.get("openid") == "new_openid_001"


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_username_format(client, db):
    """两次不同 openid 登录，username 各自以 wx_ 开头且互不重复。"""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    for openid in ["openid_aaa", "openid_bbb"]:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"openid": openid, "session_key": "sk"}
        mock_resp.raise_for_status = MagicMock()
        with patch("apps.accounts.providers.wechat_miniprogram.provider.requests.get",
                   return_value=mock_resp):
            client.post(
                "/_allauth/browser/v1/auth/provider/token",
                {"provider": "wechat_miniprogram", "token": {"id_token": "code"}},
                content_type="application/json",
            )

    usernames = list(User.objects.filter(username__startswith="wx_").values_list("username", flat=True))
    assert len(usernames) == 2, f"应有 2 个 wx_ 用户: {usernames}"
    assert len(set(usernames)) == 2, f"username 不应重复: {usernames}"
```

- [ ] **Step 2: 运行测试，确认失败或通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_miniprogram_login.py::test_miniprogram_new_user_auto_registers apps/accounts/tests/test_wechat_miniprogram_login.py::test_miniprogram_username_format -v
```

若 `SOCIALACCOUNT_AUTO_SIGNUP=True` 下 allauth 默认 username 生成不符合 `wx_` 前缀，需在 `provider.py` 中重写 `generate_unique_username`。

- [ ] **Step 3: 如需自定义 username 生成，修改 provider.py**

在 `WechatMiniprogramProvider` 中添加：

```python
def extract_common_fields(self, data):
    return {"username": self._generate_wx_username()}

def _generate_wx_username(self):
    import random
    import string
    from django.contrib.auth import get_user_model
    User = get_user_model()
    for _ in range(10):
        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
        username = f"wx_{suffix}"
        if not User.objects.filter(username=username).exists():
            return username
    # 极端情况兜底
    import uuid
    return f"wx_{uuid.uuid4().hex[:12]}"
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_miniprogram_login.py::test_miniprogram_new_user_auto_registers apps/accounts/tests/test_wechat_miniprogram_login.py::test_miniprogram_username_format -v
```

预期：PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/accounts/providers/wechat_miniprogram/provider.py apps/accounts/tests/test_wechat_miniprogram_login.py
git commit -m "feat: wechat_miniprogram 自动注册，username 以 wx_ 开头随机生成"
```

---

## Task 4：已有账号登录 + 错误处理

**Files:**
- Modify: `apps/accounts/tests/test_wechat_miniprogram_login.py`

- [ ] **Step 1: 写测试——已有账号**

在 `test_wechat_miniprogram_login.py` 末尾追加：

```python
@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_existing_user_logs_in(client, db):
    """已有 SocialAccount 的 openid 再次登录，直接返回已有 User，不重复创建。"""
    from django.contrib.auth import get_user_model
    from allauth.socialaccount.models import SocialAccount
    from model_bakery import baker

    User = get_user_model()
    existing_user = baker.make(User, username="wx_existing", email="")
    baker.make(
        SocialAccount,
        user=existing_user,
        provider="wechat_miniprogram",
        uid="existing_openid_999",
        extra_data={"openid": "existing_openid_999"},
    )

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"openid": "existing_openid_999", "session_key": "sk2"}
    mock_resp.raise_for_status = MagicMock()

    with patch("apps.accounts.providers.wechat_miniprogram.provider.requests.get",
               return_value=mock_resp):
        resp = client.post(
            "/_allauth/browser/v1/auth/provider/token",
            {"provider": "wechat_miniprogram", "token": {"id_token": "code2"}},
            content_type="application/json",
        )

    assert resp.status_code == 200
    assert User.objects.filter(username="wx_existing").count() == 1, "不应重复创建 User"


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_invalid_code_returns_error(client, db):
    """微信返回 errcode 时，响应为 4xx 而非 500。"""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"errcode": 40029, "errmsg": "invalid code"}
    mock_resp.raise_for_status = MagicMock()

    with patch("apps.accounts.providers.wechat_miniprogram.provider.requests.get",
               return_value=mock_resp):
        resp = client.post(
            "/_allauth/browser/v1/auth/provider/token",
            {"provider": "wechat_miniprogram", "token": {"id_token": "bad_code"}},
            content_type="application/json",
        )

    assert resp.status_code < 500, f"不应返回 5xx: {resp.status_code} {resp.content[:200]}"
```

- [ ] **Step 2: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_miniprogram_login.py::test_miniprogram_existing_user_logs_in apps/accounts/tests/test_wechat_miniprogram_login.py::test_miniprogram_invalid_code_returns_error -v
```

预期：PASS。若错误处理测试返回 500，检查 `provider.py` 中 `raise get_adapter().validation_error(...)` 的调用方式是否与 allauth 65.x 兼容（参考 GitHub provider 的错误处理）。

- [ ] **Step 3: 提交**

```bash
git add apps/accounts/tests/test_wechat_miniprogram_login.py
git commit -m "test: 补充已有账号登录和错误处理测试"
```

---

## Task 5：unionid 账号合并（pre_social_login hook）

**Files:**
- Modify: `apps/accounts/auth_adapter.py`
- Modify: `apps/accounts/tests/test_wechat_miniprogram_login.py`

- [ ] **Step 1: 写失败测试——三个合并场景**

在 `test_wechat_miniprogram_login.py` 末尾追加：

```python
MINIPROGRAM_AND_WEIXIN_SETTINGS = {
    **MINIPROGRAM_TEST_SETTINGS,
    "SOCIALACCOUNT_PROVIDERS": {
        **MINIPROGRAM_TEST_SETTINGS["SOCIALACCOUNT_PROVIDERS"],
        "weixin": {
            "APP": {
                "client_id": "test-weixin-appid",
                "secret": "test-weixin-secret",
            },
            "SCOPE": ["snsapi_login"],
        },
    },
}


@override_settings(**MINIPROGRAM_AND_WEIXIN_SETTINGS)
def test_unionid_merge_miniprogram_then_weixin(db):
    """先小程序登录建立账号，再用相同 unionid 的 weixin provider 登录，应合并为同一 User。"""
    from django.contrib.auth import get_user_model
    from allauth.socialaccount.models import SocialAccount
    from model_bakery import baker
    from django.test import RequestFactory

    User = get_user_model()

    # 先建小程序账号（有 unionid）
    mp_user = baker.make(User, username="wx_mp_user", email="")
    baker.make(
        SocialAccount,
        user=mp_user,
        provider="wechat_miniprogram",
        uid="mp_openid_001",
        extra_data={"openid": "mp_openid_001", "unionid": "shared_unionid_xyz"},
    )

    # 模拟 weixin provider pre_social_login
    from allauth.socialaccount.models import SocialLogin, SocialToken, SocialApp
    from apps.accounts.auth_adapter import AccountAdapter

    weixin_account = SocialAccount(
        provider="weixin",
        uid="shared_unionid_xyz",
        extra_data={"unionid": "shared_unionid_xyz"},
    )
    weixin_login = SocialLogin(account=weixin_account)
    weixin_login.token = SocialToken(token="fake_access_token")

    request = RequestFactory().get("/")
    request.session = {}

    adapter = AccountAdapter()
    adapter.pre_social_login(request, weixin_login)

    # 合并后 weixin_login 应关联到 mp_user
    assert weixin_login.user == mp_user, \
        f"应合并到 mp_user，实际: {weixin_login.user}"


@override_settings(**MINIPROGRAM_AND_WEIXIN_SETTINGS)
def test_unionid_merge_weixin_then_miniprogram(db):
    """先网页扫码登录建立账号，再用相同 unionid 的小程序登录，应合并为同一 User。"""
    from django.contrib.auth import get_user_model
    from allauth.socialaccount.models import SocialAccount, SocialLogin, SocialToken
    from model_bakery import baker
    from django.test import RequestFactory

    User = get_user_model()

    # 先建 weixin 账号（uid 就是 unionid）
    wx_user = baker.make(User, username="weixin_user", email="")
    baker.make(
        SocialAccount,
        user=wx_user,
        provider="weixin",
        uid="shared_unionid_abc",
        extra_data={},
    )

    # 模拟小程序 pre_social_login（extra_data 有 unionid）
    from apps.accounts.auth_adapter import AccountAdapter

    mp_account = SocialAccount(
        provider="wechat_miniprogram",
        uid="mp_openid_002",
        extra_data={"openid": "mp_openid_002", "unionid": "shared_unionid_abc"},
    )
    mp_login = SocialLogin(account=mp_account)
    mp_login.token = SocialToken(token="fake_code")

    request = RequestFactory().get("/")
    request.session = {}

    adapter = AccountAdapter()
    adapter.pre_social_login(request, mp_login)

    assert mp_login.user == wx_user, \
        f"应合并到 wx_user，实际: {mp_login.user}"


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_no_unionid_creates_independent_accounts(client, db):
    """小程序登录没有 unionid 时，不合并，独立创建账号。"""
    from django.contrib.auth import get_user_model
    from allauth.socialaccount.models import SocialAccount
    from model_bakery import baker

    User = get_user_model()

    # 先建一个无关账号
    existing = baker.make(User, username="wx_other", email="")
    baker.make(
        SocialAccount,
        user=existing,
        provider="wechat_miniprogram",
        uid="other_openid",
        extra_data={"openid": "other_openid", "unionid": "some_unionid"},
    )

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"openid": "no_unionid_openid", "session_key": "sk"}  # 无 unionid
    mock_resp.raise_for_status = MagicMock()

    with patch("apps.accounts.providers.wechat_miniprogram.provider.requests.get",
               return_value=mock_resp):
        resp = client.post(
            "/_allauth/browser/v1/auth/provider/token",
            {"provider": "wechat_miniprogram", "token": {"id_token": "code_no_uid"}},
            content_type="application/json",
        )

    assert resp.status_code == 200
    # 应新建独立 User，不关联已有账号
    assert User.objects.count() == 2, f"应有 2 个 User，实际: {User.objects.count()}"
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_miniprogram_login.py::test_unionid_merge_miniprogram_then_weixin apps/accounts/tests/test_wechat_miniprogram_login.py::test_unionid_merge_weixin_then_miniprogram -v
```

预期：FAIL，`pre_social_login` 尚未实现合并逻辑。

- [ ] **Step 3: 实现 pre_social_login**

修改 `apps/accounts/auth_adapter.py`，在 `AccountAdapter` 类末尾添加：

```python
def pre_social_login(self, request, sociallogin):
    from allauth.socialaccount.models import SocialAccount

    # 已关联 User 的登录无需合并
    if sociallogin.is_existing:
        return

    # 提取 unionid
    unionid = sociallogin.account.extra_data.get("unionid")
    if not unionid:
        return

    # 查找有相同 unionid 的已有 SocialAccount
    # weixin provider 的 uid 就是 unionid
    existing = SocialAccount.objects.filter(
        provider="weixin", uid=unionid
    ).first()

    if not existing:
        # wechat_miniprogram 的 unionid 存在 extra_data 里
        existing = SocialAccount.objects.filter(
            provider="wechat_miniprogram",
            extra_data__unionid=unionid,
        ).exclude(uid=sociallogin.account.uid).first()

    if existing and existing.user_id:
        sociallogin.connect(request, existing.user)
```

- [ ] **Step 4: 运行全部 unionid 测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_miniprogram_login.py::test_unionid_merge_miniprogram_then_weixin apps/accounts/tests/test_wechat_miniprogram_login.py::test_unionid_merge_weixin_then_miniprogram apps/accounts/tests/test_wechat_miniprogram_login.py::test_no_unionid_creates_independent_accounts -v
```

预期：PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/accounts/auth_adapter.py apps/accounts/tests/test_wechat_miniprogram_login.py
git commit -m "feat: AccountAdapter.pre_social_login 通过 unionid 合并微信账号"
```

---

## Task 6：weixin 网页扫码 provider 配置测试

**Files:**
- Create: `apps/accounts/tests/test_weixin_provider.py`

- [ ] **Step 1: 写测试**

新建 `apps/accounts/tests/test_weixin_provider.py`：

```python
"""
微信网页扫码登录配置测试。

weixin provider 是 allauth 内置实现，此处只验证配置正确、
provider 可用、redirect 返回到微信授权页。
"""

import pytest
from django.test import override_settings

WEIXIN_TEST_SETTINGS = {
    "SOCIALACCOUNT_PROVIDERS": {
        "weixin": {
            "APP": {
                "client_id": "test-weixin-appid",
                "secret": "test-weixin-secret",
            },
            "SCOPE": ["snsapi_login"],
        },
    },
    "SOCIALACCOUNT_AUTO_SIGNUP": True,
    "SOCIALACCOUNT_EMAIL_REQUIRED": False,
    "SOCIALACCOUNT_EMAIL_VERIFICATION": "none",
    "ACCOUNT_LOGIN_METHODS": {"email"},
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ALLOWED_HOSTS": ["localhost", "localhost:5173"],
}


@pytest.fixture
def browser_client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


@override_settings(**WEIXIN_TEST_SETTINGS)
def test_weixin_provider_in_flows(browser_client, db):
    """weixin 出现在未认证时的 provider flows 中。"""
    resp = browser_client.get("/_allauth/browser/v1/account/providers")
    body = resp.json()
    flows = body.get("data", {}).get("flows", [])
    provider_flow = next((f for f in flows if f.get("id") == "provider_redirect"), None)
    assert provider_flow is not None, f"No provider_redirect flow: {flows}"
    assert "weixin" in provider_flow.get("providers", []), \
        f"weixin not in providers: {provider_flow}"


@override_settings(**WEIXIN_TEST_SETTINGS)
def test_weixin_redirect_returns_302(browser_client, db):
    """发起 weixin 登录返回重定向到微信开放平台授权页。"""
    resp = browser_client.post(
        "/_allauth/browser/v1/auth/provider/redirect",
        {
            "provider": "weixin",
            "callback_url": "http://localhost:5173/accounts/callback/",
            "process": "login",
        },
    )
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}: {resp.content[:200]}"
    location = resp["Location"]
    assert "weixin.qq.com" in location or "open.weixin.qq.com" in location, \
        f"Redirect 应指向微信域名: {location}"
```

- [ ] **Step 2: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_weixin_provider.py -v
```

预期：PASS（allauth 内置 weixin provider，配置正确即可）。

- [ ] **Step 3: 提交**

```bash
git add apps/accounts/tests/test_weixin_provider.py
git commit -m "test: 添加 weixin 网页扫码 provider 配置验证测试"
```

---

## Task 7：全量测试 + 收尾

**Files:**
- 无新增文件

- [ ] **Step 1: 运行全部新增测试**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_miniprogram_login.py apps/accounts/tests/test_weixin_provider.py -v
```

预期：全部 PASS。

- [ ] **Step 2: 运行完整测试套件，确认无回归**

```bash
docker compose exec web pytest --ignore=e2e -x -q
```

预期：全部通过，无新增失败。

- [ ] **Step 3: 运行 lint**

```bash
docker compose exec web ruff check apps/accounts/providers/ apps/accounts/auth_adapter.py
docker compose exec web ruff format --check apps/accounts/providers/ apps/accounts/auth_adapter.py
```

修复所有 lint 问题后提交。

- [ ] **Step 4: 最终提交**

```bash
git add -u
git commit -m "chore: 微信登录功能完成，lint 修复"
```
