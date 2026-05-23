# 小程序手机号授权绑定实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `POST /api/auth/wechat-phone/` 端点，允许已登录的小程序用户通过 `wx.getPhoneNumber()` 授权手机号，自动合并或绑定账号。

**Architecture:** 独立的 `apps/accounts/wechat_phone.py` 模块处理 access_token 缓存和微信 API 调用，ninja 端点在 `apps/accounts/api.py` 中新增，账号合并逻辑（迁移 SocialAccount、软删除空白账号、重新登录）内聚在同一模块中。

**Tech Stack:** Django 5, django-ninja, django-allauth, Django cache (Redis), requests, pytest, unittest.mock

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/accounts/wechat_phone.py` | 新建 | access_token 缓存、手机号换取、合并逻辑 |
| `apps/accounts/schemas.py` | 修改 | 新增 `WechatPhoneIn`、`WechatPhoneOut` |
| `apps/accounts/api.py` | 修改 | 新增 `auth_router`，注册 `POST /wechat-phone/` |
| `config/api.py` | 修改 | 挂载 `auth_router` 到 `/auth/` |
| `apps/accounts/tests/test_wechat_phone.py` | 新建 | 全部测试 |

---

## Task 1：access_token 获取与缓存

**Files:**
- Create: `apps/accounts/wechat_phone.py`
- Create: `apps/accounts/tests/test_wechat_phone.py`

- [ ] **Step 1: 写失败测试**

新建 `apps/accounts/tests/test_wechat_phone.py`：

```python
"""
小程序手机号授权绑定测试。

测试策略：
- access_token 首次获取后缓存，第二次不重复请求微信 API
- 换取手机号：mock 微信 API，验证标准化格式 +86XXXXXXXXXX
- 未登录拒绝：401
- 绑定新手机号：无已有账号，写入当前 User
- 幂等：重复绑定同一手机号 → 200
- 账号合并：已有 User B 有此手机号，迁移 SocialAccount，软删除当前 User，session 切换
- 微信 API errcode → 400
"""

import pytest
from unittest.mock import patch, MagicMock
from django.test import override_settings

WECHAT_PHONE_SETTINGS = {
    "SOCIALACCOUNT_PROVIDERS": {
        "wechat_miniprogram": {
            "APP": {
                "client_id": "test-miniprogram-appid",
                "secret": "test-miniprogram-secret",
            },
        },
    },
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ALLOWED_HOSTS": ["localhost"],
}


def _make_access_token_mock(token="fake_access_token"):
    mock = MagicMock()
    mock.json.return_value = {"access_token": token, "expires_in": 7200}
    mock.raise_for_status = MagicMock()
    return mock


def _make_phone_mock(phone_number="13800138000", country_code="86"):
    mock = MagicMock()
    mock.json.return_value = {
        "errcode": 0,
        "phone_info": {
            "phoneNumber": phone_number,
            "purePhoneNumber": phone_number,
            "countryCode": country_code,
        },
    }
    mock.raise_for_status = MagicMock()
    return mock


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_access_token_cached_on_second_call(db):
    """access_token 首次调用请求微信 API，第二次从 cache 读取。"""
    from django.core.cache import cache
    from apps.accounts.wechat_phone import get_miniprogram_access_token
    from allauth.socialaccount.models import SocialApp

    cache.clear()
    app = SocialApp(provider="wechat_miniprogram", client_id="test-miniprogram-appid", secret="test-miniprogram-secret")

    with patch("apps.accounts.wechat_phone.requests.post", return_value=_make_access_token_mock()) as mock_post:
        token1 = get_miniprogram_access_token(app)
        token2 = get_miniprogram_access_token(app)

    assert token1 == "fake_access_token"
    assert token2 == "fake_access_token"
    mock_post.assert_called_once()  # 只调用了一次微信 API
    cache.clear()
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_phone.py::test_access_token_cached_on_second_call -v
```

预期：FAIL，`No module named 'apps.accounts.wechat_phone'`

- [ ] **Step 3: 实现 `get_miniprogram_access_token`**

新建 `apps/accounts/wechat_phone.py`：

```python
import requests
from django.core.cache import cache

ACCESS_TOKEN_CACHE_KEY = "wechat_miniprogram_access_token"
ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token"
GET_PHONE_URL = "https://api.weixin.qq.com/wxa/business/getuserphonenumber"


def get_miniprogram_access_token(app) -> str:
    token = cache.get(ACCESS_TOKEN_CACHE_KEY)
    if token:
        return token
    resp = requests.post(
        ACCESS_TOKEN_URL,
        params={
            "grant_type": "client_credential",
            "appid": app.client_id,
            "secret": app.secret,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    token = data["access_token"]
    cache.set(ACCESS_TOKEN_CACHE_KEY, token, timeout=7000)
    return token


def get_phone_number(app, phone_code: str) -> str:
    """返回标准化手机号 +86XXXXXXXXXX，失败抛 ValueError。"""
    access_token = get_miniprogram_access_token(app)
    resp = requests.post(
        GET_PHONE_URL,
        params={"access_token": access_token},
        json={"code": phone_code},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("errcode") and data["errcode"] != 0:
        raise ValueError(f"微信手机号换取失败: {data.get('errmsg', data['errcode'])}")
    phone_info = data["phone_info"]
    country_code = phone_info.get("countryCode", "86")
    number = phone_info["purePhoneNumber"]
    return f"+{country_code}{number}"


def bind_phone_to_user(request, user, phone: str):
    """绑定手机号到 user。若已有其他账号使用此手机号，执行合并。"""
    from django.contrib.auth import get_user_model
    from allauth.socialaccount.models import SocialAccount
    from allauth.account.internal.flows.login import login as allauth_login

    User = get_user_model()

    # 幂等：当前 user 已经是这个手机号
    if user.phone == phone:
        return user, False

    existing = User.objects.filter(phone=phone).exclude(pk=user.pk).first()
    if existing:
        # 迁移当前 user 的所有 SocialAccount 到 existing
        SocialAccount.objects.filter(user=user).update(user=existing)
        # 软删除当前空白账号
        user.is_active = False
        user.save(update_fields=["is_active"])
        # 重新登录 existing
        allauth_login(request, existing)
        return existing, True
    else:
        user.phone = phone
        user.phone_verified = True
        user.save(update_fields=["phone", "phone_verified"])
        return user, False
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_phone.py::test_access_token_cached_on_second_call -v
```

预期：PASS

- [ ] **Step 5: 提交**

```bash
git add apps/accounts/wechat_phone.py apps/accounts/tests/test_wechat_phone.py
git commit -m "feat: 添加 wechat_phone 模块，access_token 缓存"
```

---

## Task 2：手机号换取测试

**Files:**
- Modify: `apps/accounts/tests/test_wechat_phone.py`

- [ ] **Step 1: 追加测试**

在 `test_wechat_phone.py` 末尾追加：

```python
@override_settings(**WECHAT_PHONE_SETTINGS)
def test_get_phone_number_returns_normalized(db):
    """换取手机号返回 +86XXXXXXXXXX 格式。"""
    from django.core.cache import cache
    from apps.accounts.wechat_phone import get_phone_number
    from allauth.socialaccount.models import SocialApp

    cache.delete("wechat_miniprogram_access_token")
    app = SocialApp(provider="wechat_miniprogram", client_id="test-miniprogram-appid", secret="test-miniprogram-secret")

    with patch("apps.accounts.wechat_phone.requests.post") as mock_post:
        mock_post.side_effect = [_make_access_token_mock(), _make_phone_mock("13912345678", "86")]
        phone = get_phone_number(app, "test_phone_code")

    assert phone == "+8613912345678"
    cache.clear()


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_get_phone_number_raises_on_errcode(db):
    """微信返回 errcode 时抛出 ValueError。"""
    from django.core.cache import cache
    from apps.accounts.wechat_phone import get_phone_number
    from allauth.socialaccount.models import SocialApp

    cache.delete("wechat_miniprogram_access_token")
    app = SocialApp(provider="wechat_miniprogram", client_id="test-miniprogram-appid", secret="test-miniprogram-secret")

    error_mock = MagicMock()
    error_mock.json.return_value = {"errcode": 40029, "errmsg": "invalid code"}
    error_mock.raise_for_status = MagicMock()

    with patch("apps.accounts.wechat_phone.requests.post") as mock_post:
        mock_post.side_effect = [_make_access_token_mock(), error_mock]
        with pytest.raises(ValueError, match="微信手机号换取失败"):
            get_phone_number(app, "bad_code")
    cache.clear()
```

- [ ] **Step 2: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_phone.py::test_get_phone_number_returns_normalized apps/accounts/tests/test_wechat_phone.py::test_get_phone_number_raises_on_errcode -v
```

预期：PASS

- [ ] **Step 3: 提交**

```bash
git add apps/accounts/tests/test_wechat_phone.py
git commit -m "test: 手机号换取和错误处理测试"
```

---

## Task 3：Schema + 端点骨架

**Files:**
- Modify: `apps/accounts/schemas.py`
- Modify: `apps/accounts/api.py`
- Modify: `config/api.py`

- [ ] **Step 1: 追加测试——未登录拒绝**

在 `test_wechat_phone.py` 末尾追加：

```python
@pytest.fixture
def client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


def test_wechat_phone_requires_auth(client, db):
    """未登录请求 /api/auth/wechat-phone/ 返回 401。"""
    resp = client.post(
        "/api/auth/wechat-phone/",
        {"phone_code": "some_code"},
        content_type="application/json",
    )
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.content[:200]}"
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_phone.py::test_wechat_phone_requires_auth -v
```

预期：FAIL，`404`（端点不存在）

- [ ] **Step 3: 新增 Schema**

在 `apps/accounts/schemas.py` 末尾追加：

```python
class WechatPhoneIn(Schema):
    phone_code: str


class WechatPhoneOut(Schema):
    phone: str
    merged: bool
```

- [ ] **Step 4: 新增 auth_router 和端点**

在 `apps/accounts/api.py` 顶部 import 中追加：

```python
from apps.accounts.schemas import AvatarOut, ImpersonateUserOut, UserOut, UserPatchIn, WechatPhoneIn, WechatPhoneOut
```

在文件末尾追加：

```python
auth_router = Router(tags=["auth"])


@auth_router.post("/wechat-phone/", response=WechatPhoneOut)
def bind_wechat_phone(request, payload: WechatPhoneIn):
    require_authenticated(request)
    from allauth.socialaccount.models import SocialApp
    from apps.accounts.wechat_phone import bind_phone_to_user, get_phone_number

    try:
        app = SocialApp.objects.get(provider="wechat_miniprogram")
    except SocialApp.DoesNotExist:
        from allauth.socialaccount.adapter import get_adapter as get_social_adapter
        provider = get_social_adapter().get_provider(request, "wechat_miniprogram")
        app = provider.app

    try:
        phone = get_phone_number(app, payload.phone_code)
    except ValueError as e:
        raise HttpError(400, str(e))

    user, merged = bind_phone_to_user(request, request.user, phone)
    return {"phone": phone, "merged": merged}
```

- [ ] **Step 5: 挂载 auth_router 到 config/api.py**

在 `config/api.py` 中追加 import：

```python
from apps.accounts.api import auth_router, avatar_router, users_router
```

在 `api.add_router("/users/", users_router)` 后追加：

```python
api.add_router("/auth/", auth_router)
```

- [ ] **Step 6: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_phone.py::test_wechat_phone_requires_auth -v
```

预期：PASS（401）

- [ ] **Step 7: 提交**

```bash
git add apps/accounts/schemas.py apps/accounts/api.py config/api.py apps/accounts/tests/test_wechat_phone.py
git commit -m "feat: 新增 /api/auth/wechat-phone/ 端点骨架"
```

---

## Task 4：绑定新手机号 + 幂等测试

**Files:**
- Modify: `apps/accounts/tests/test_wechat_phone.py`

- [ ] **Step 1: 追加测试**

在 `test_wechat_phone.py` 末尾追加：

```python
def _login_user(client, user):
    """辅助：强制登录指定 user。"""
    from django.test import RequestFactory
    client.force_login(user)


def _post_wechat_phone(client, phone_number="13800138000"):
    """辅助：mock 微信 API，POST /api/auth/wechat-phone/。"""
    from django.core.cache import cache
    cache.set("wechat_miniprogram_access_token", "cached_token", timeout=7000)

    phone_mock = _make_phone_mock(phone_number)
    with patch("apps.accounts.wechat_phone.requests.post", return_value=phone_mock):
        return client.post(
            "/api/auth/wechat-phone/",
            {"phone_code": "test_phone_code"},
            content_type="application/json",
        )


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_bind_new_phone_to_user(client, db):
    """已登录用户，无已有账号使用此手机号，直接写入手机号。"""
    from django.contrib.auth import get_user_model
    from model_bakery import baker

    User = get_user_model()
    user = baker.make(User, username="wx_testuser", email="", phone=None)
    _login_user(client, user)

    resp = _post_wechat_phone(client, "13800138000")

    assert resp.status_code == 200, f"{resp.status_code}: {resp.content[:200]}"
    body = resp.json()
    assert body["phone"] == "+8613800138000"
    assert body["merged"] is False

    user.refresh_from_db()
    assert user.phone == "+8613800138000"
    assert user.phone_verified is True


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_bind_same_phone_is_idempotent(client, db):
    """重复绑定同一手机号，返回 200 不报错。"""
    from django.contrib.auth import get_user_model
    from model_bakery import baker

    User = get_user_model()
    user = baker.make(User, username="wx_testuser2", email="", phone="+8613800138000", phone_verified=True)
    _login_user(client, user)

    resp = _post_wechat_phone(client, "13800138000")

    assert resp.status_code == 200
    assert resp.json()["merged"] is False
```

- [ ] **Step 2: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_phone.py::test_bind_new_phone_to_user apps/accounts/tests/test_wechat_phone.py::test_bind_same_phone_is_idempotent -v
```

预期：PASS

- [ ] **Step 3: 提交**

```bash
git add apps/accounts/tests/test_wechat_phone.py
git commit -m "test: 绑定新手机号和幂等测试"
```

---

## Task 5：账号合并测试

**Files:**
- Modify: `apps/accounts/tests/test_wechat_phone.py`

- [ ] **Step 1: 追加测试**

在 `test_wechat_phone.py` 末尾追加：

```python
@override_settings(**WECHAT_PHONE_SETTINGS)
def test_bind_phone_merges_existing_account(client, db):
    """手机号已属于 User B，迁移 SocialAccount，软删除当前 User，session 切换到 User B。"""
    from django.contrib.auth import get_user_model
    from allauth.socialaccount.models import SocialAccount
    from model_bakery import baker

    User = get_user_model()

    # User A：微信 openid 登录创建的空白账号（当前登录用户）
    user_a = baker.make(User, username="wx_blank", email="", phone=None)
    baker.make(
        SocialAccount,
        user=user_a,
        provider="wechat_miniprogram",
        uid="openid_abc",
        extra_data={"openid": "openid_abc"},
    )

    # User B：已有手机号账号
    user_b = baker.make(User, username="real_user", email="user@example.com", phone="+8613800138000", phone_verified=True)

    _login_user(client, user_a)
    resp = _post_wechat_phone(client, "13800138000")

    assert resp.status_code == 200
    body = resp.json()
    assert body["merged"] is True
    assert body["phone"] == "+8613800138000"

    # SocialAccount 已迁移到 user_b
    assert SocialAccount.objects.filter(uid="openid_abc", user=user_b).exists()

    # user_a 已软删除
    user_a.refresh_from_db()
    assert user_a.is_active is False

    # session 已切换到 user_b（当前登录用户是 user_b）
    from django.contrib.auth import get_user as get_session_user
    session_user = get_session_user(client)
    assert session_user == user_b


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_wechat_phone_api_error_returns_400(client, db):
    """微信 API 返回 errcode 时，端点返回 400。"""
    from django.contrib.auth import get_user_model
    from model_bakery import baker

    User = get_user_model()
    user = baker.make(User, username="wx_err", email="", phone=None)
    _login_user(client, user)

    from django.core.cache import cache
    cache.set("wechat_miniprogram_access_token", "cached_token", timeout=7000)

    error_mock = MagicMock()
    error_mock.json.return_value = {"errcode": 40029, "errmsg": "invalid code"}
    error_mock.raise_for_status = MagicMock()

    with patch("apps.accounts.wechat_phone.requests.post", return_value=error_mock):
        resp = client.post(
            "/api/auth/wechat-phone/",
            {"phone_code": "bad_code"},
            content_type="application/json",
        )

    assert resp.status_code == 400
```

- [ ] **Step 2: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_phone.py::test_bind_phone_merges_existing_account apps/accounts/tests/test_wechat_phone.py::test_wechat_phone_api_error_returns_400 -v
```

若 `test_bind_phone_merges_existing_account` 失败，检查 `bind_phone_to_user` 中 `allauth_login` 的调用签名——allauth 65.x 的 `login()` 需要 `signup=False` 参数：

```python
allauth_login(request, existing, signup=False)
```

预期：PASS

- [ ] **Step 3: 提交**

```bash
git add apps/accounts/tests/test_wechat_phone.py
git commit -m "test: 账号合并和 API 错误测试"
```

---

## Task 6：全量测试 + lint

**Files:**
- 无新增文件

- [ ] **Step 1: 运行全部新增测试**

```bash
docker compose exec web pytest apps/accounts/tests/test_wechat_phone.py -v
```

预期：全部 PASS

- [ ] **Step 2: 运行完整套件**

```bash
docker compose exec web pytest --ignore=e2e --ignore=apps/media -q
```

预期：全部通过，无新增失败

- [ ] **Step 3: lint**

```bash
docker compose exec web ruff check apps/accounts/wechat_phone.py apps/accounts/api.py apps/accounts/schemas.py apps/accounts/tests/test_wechat_phone.py
docker compose exec web ruff format --check apps/accounts/wechat_phone.py apps/accounts/api.py apps/accounts/schemas.py
```

修复后提交：

```bash
git add -u
git commit -m "chore: 小程序手机号绑定功能完成，lint 修复"
```
