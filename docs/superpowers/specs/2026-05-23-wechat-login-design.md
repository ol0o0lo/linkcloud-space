# 微信登录设计文档

**日期：** 2026-05-23  
**状态：** 已确认，待实施

## 目标

为项目添加两种微信登录方式：

1. **微信小程序登录**：小程序端通过 `wx.login()` 获取 code，服务端换取 openid，静默注册/登录
2. **微信网页扫码登录**：PC 端用户通过微信 APP 扫码，走微信开放平台 OAuth2 标准流程

两者通过 `unionid` 打通账号关联，同一微信用户无论从哪个端登录，最终绑定同一个 Django User。

## 范围

- 不做手机号授权（需要付费权限，后续再议）
- 不做微信公众号登录（不在本期范围）
- 网页端 H5 微信内授权不在本期范围

## 架构概览

```
apps/accounts/
  providers/
    wechat_miniprogram/       ← 全新自定义 provider
      __init__.py
      provider.py             ← WechatMiniprogramProvider
  auth_adapter.py             ← 新增 pre_social_login unionid 合并逻辑

config/settings/_base.py      ← 新增 weixin + wechat_miniprogram 配置
pyproject.toml                ← 新增四个 epicenv 变量定义
```

内置 `allauth.socialaccount.providers.weixin` 处理网页扫码，零实现成本。

## 小程序 Provider 设计

### 认证流程

```
小程序 wx.login() → code
    ↓
POST /_allauth/browser/v1/auth/provider/token
    { "provider": "wechat_miniprogram", "token": { "id_token": "<code>" } }
    ↓
WechatMiniprogramProvider.complete_login()
    调用 https://api.weixin.qq.com/sns/jscode2session
    ?appid=&secret=&js_code=<code>&grant_type=authorization_code
    ↓
拿到 { openid, session_key, unionid? }
    ↓
SocialAccount(provider="wechat_miniprogram", uid=openid)
extra_data = { openid, unionid, session_key 不存储 }
    ↓
pre_social_login hook → unionid 合并检查
    ↓
自动注册/登录，返回 Django session cookie
```

### 关键细节

- **uid**：使用 `openid`（同小程序内唯一，跨应用不同）
- **unionid**：存入 `extra_data`，optional（仅用户关注公众号或授权过开放平台其他应用时才有）
- **session_key**：不持久化，每次登录刷新，不存数据库
- **自动注册**：`username` = `wx_` + 8位随机字符，`email` 为空，`first_name` 为空
- **接口**：复用 allauth headless `/_allauth/browser/v1/auth/provider/token`，与 GitHub app 登录对称

### Provider 实现要点

`WechatMiniprogramProvider` 继承 `SocialAccountProvider`，重写：

- `complete_login(request, app, token, **kwargs)`：用 token 中的 code 调 jscode2session，构造并返回 `SocialLogin`
- `extract_uid(data)`：返回 `data["openid"]`
- `extract_extra_data(data)`：返回 `{ "openid": ..., "unionid": ... }`（unionid 可能为 None）
- `extract_common_fields(data)`：返回空 dict（微信小程序不提供用户信息）

## 网页扫码登录（weixin provider）

直接使用 `allauth.socialaccount.providers.weixin`，无需实现。

- **uid**：`unionid`（微信开放平台 OAuth2 返回）
- **流程**：标准 allauth OAuth2 redirect 流程，与 GitHub 登录完全一致
- **PC 扫码**：`SCOPE = ["snsapi_login"]`，微信开放平台网站应用

## unionid 账号合并逻辑

在 `AccountAdapter.pre_social_login` 中实现：

```python
def pre_social_login(self, request, sociallogin):
    # 1. 提取当前登录的 unionid
    unionid = sociallogin.account.extra_data.get("unionid")
    if not unionid:
        return  # 没有 unionid，走正常流程

    # 2. 如果已经关联了 User，不需要合并
    if sociallogin.is_existing:
        return

    # 3. 查找有相同 unionid 的其他 SocialAccount
    #    weixin provider 的 uid 就是 unionid
    #    wechat_miniprogram provider 的 unionid 在 extra_data 里
    existing = (
        SocialAccount.objects.filter(provider="weixin", uid=unionid).first()
        or SocialAccount.objects.filter(
            provider="wechat_miniprogram",
            extra_data__unionid=unionid
        ).exclude(uid=sociallogin.account.uid).first()
    )

    if existing and existing.user:
        # 4. 关联到已有 User
        sociallogin.connect(request, existing.user)
```

**合并场景：**
- 先网页扫码 → 后小程序：小程序拿到 unionid，找到 weixin SocialAccount，关联同一 User
- 先小程序 → 后网页扫码：weixin uid 就是 unionid，找到小程序 extra_data 中相同 unionid，关联同一 User
- 无 unionid：两端账号暂时独立，待 unionid 可用时下次登录自动合并

## 配置

### settings/_base.py

```python
INSTALLED_APPS = [
    ...
    "allauth.socialaccount.providers.weixin",
    "apps.accounts.providers.wechat_miniprogram",
]

SOCIALACCOUNT_PROVIDERS = {
    ...
    "weixin": {
        "APP": {
            "client_id": env("WECHAT_APP_ID"),
            "secret": env("WECHAT_APP_SECRET"),
        },
        "SCOPE": ["snsapi_login"],
    },
    "wechat_miniprogram": {
        "APP": {
            "client_id": env("WECHAT_MINIPROGRAM_APP_ID"),
            "secret": env("WECHAT_MINIPROGRAM_APP_SECRET"),
        },
    },
}
```

### 新增环境变量

| 变量名 | 说明 |
|--------|------|
| `WECHAT_APP_ID` | 开放平台网站应用 AppID |
| `WECHAT_APP_SECRET` | 开放平台网站应用 AppSecret |
| `WECHAT_MINIPROGRAM_APP_ID` | 小程序 AppID |
| `WECHAT_MINIPROGRAM_APP_SECRET` | 小程序 AppSecret |

## 数据模型

无新增模型。使用 allauth 内置的 `SocialAccount` 表：

| 字段 | wechat_miniprogram | weixin |
|------|--------------------|--------|
| `provider` | `wechat_miniprogram` | `weixin` |
| `uid` | openid | unionid |
| `extra_data` | `{openid, unionid}` | allauth 默认 |

## 会话管理

- 小程序手动管理 cookie（存储 `sessionid`，每次请求带上）
- 与网页端完全一致，无需额外机制
- `SOCIALACCOUNT_AUTO_SIGNUP = True`，`SOCIALACCOUNT_EMAIL_REQUIRED = False`（微信无邮箱）

## 测试策略（TDD）

遵循项目现有模式（参考 `test_github_login.py`），先写测试再实现。

### 测试 settings 基础配置

```python
WECHAT_MINIPROGRAM_TEST_SETTINGS = {
    "SOCIALACCOUNT_PROVIDERS": {
        "wechat_miniprogram": {
            "APP": {
                "client_id": "test-miniprogram-appid",
                "secret": "test-miniprogram-secret",
            },
        },
        "weixin": {
            "APP": {
                "client_id": "test-weixin-appid",
                "secret": "test-weixin-secret",
            },
            "SCOPE": ["snsapi_login"],
        },
    },
    "SOCIALACCOUNT_AUTO_SIGNUP": True,
    "SOCIALACCOUNT_EMAIL_REQUIRED": False,  # 微信无邮箱
    "SOCIALACCOUNT_EMAIL_VERIFICATION": "none",
    "ACCOUNT_LOGIN_METHODS": {"email"},
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ALLOWED_HOSTS": ["localhost", "localhost:5173"],
}
```

### 测试文件：`apps/accounts/tests/test_wechat_miniprogram_login.py`

**写测试的顺序即实现顺序（TDD red → green）：**

#### 1. Provider 注册测试（最先写，驱动 provider 骨架）

```python
def test_wechat_miniprogram_provider_in_flows(client, db):
    """wechat_miniprogram 出现在未认证时的 provider flows 中。"""
    # 驱动：provider.py 注册、INSTALLED_APPS 配置
```

#### 2. jscode2session 调用测试（驱动 complete_login 实现）

```python
def test_miniprogram_login_calls_jscode2session(client, db):
    """provider/token 端点收到 code 后调用微信 jscode2session API。"""
    # mock requests.get，验证调用了正确的微信 API URL
    # 驱动：complete_login 中的 HTTP 调用逻辑
```

#### 3. 自动注册测试（驱动 extract_uid / extract_common_fields）

```python
def test_miniprogram_new_user_auto_registers(client, db):
    """新 openid 首次登录自动创建 User 和 SocialAccount。"""
    # mock jscode2session 返回 { openid: "test_openid", session_key: "sk" }
    # 验证：User 被创建，username 以 wx_ 开头，email 为空
    # 验证：SocialAccount(provider="wechat_miniprogram", uid="test_openid") 存在
    # 验证：响应 status=200，session cookie 已设置
```

#### 4. 已有账号登录测试

```python
def test_miniprogram_existing_user_logs_in(client, db):
    """已有 SocialAccount 的 openid 再次登录，直接返回已有 User session。"""
    # 预建 User + SocialAccount
    # mock 同一 openid，验证没有新建 User
```

#### 5. unionid 合并测试（驱动 pre_social_login adapter hook）

```python
def test_unionid_merge_miniprogram_then_weixin(client, db):
    """先小程序登录，再网页扫码登录，unionid 相同时合并为同一 User。"""
    # Step1: 小程序登录，建立 SocialAccount(wechat_miniprogram, openid, extra_data={unionid: "uid_123"})
    # Step2: 模拟 weixin provider pre_social_login，uid=unionid
    # 验证：weixin SocialAccount 关联到同一 User

def test_unionid_merge_weixin_then_miniprogram(client, db):
    """先网页扫码登录，再小程序登录，unionid 相同时合并为同一 User。"""
    # Step1: 建立 SocialAccount(weixin, uid="uid_123")
    # Step2: 小程序登录，extra_data={unionid: "uid_123"}
    # 验证：小程序 SocialAccount 关联到同一 User

def test_no_unionid_creates_independent_accounts(client, db):
    """小程序登录没有 unionid 时，不合并，独立创建账号。"""
    # mock jscode2session 返回无 unionid
    # 验证：新建独立 User，不关联任何已有账号
```

#### 6. username 随机生成测试

```python
def test_miniprogram_username_format(client, db):
    """自动注册的 username 以 wx_ 开头且不重复。"""
    # 两次新 openid 登录，验证两个不同的 wx_xxx username
```

#### 7. jscode2session 错误处理测试

```python
def test_miniprogram_invalid_code_returns_error(client, db):
    """微信返回 errcode 时，登录端点返回 4xx 而非 500。"""
    # mock 返回 { errcode: 40029, errmsg: "invalid code" }
    # 验证响应非 5xx
```

### 测试文件：`apps/accounts/tests/test_weixin_provider.py`

```python
def test_weixin_provider_in_flows(client, db):
    """weixin 出现在未认证时的 provider flows 中。"""

def test_weixin_redirect_returns_302(browser_client, db):
    """发起 weixin 登录返回重定向到微信授权页。"""
    # 验证 redirect URL 包含 open.weixin.qq.com
```

### 实现顺序（TDD 节奏）

1. 写 `test_wechat_miniprogram_provider_in_flows` → 实现 provider 骨架 → 测试通过
2. 写 `test_miniprogram_login_calls_jscode2session` → 实现 `complete_login` → 通过
3. 写 `test_miniprogram_new_user_auto_registers` → 实现 `extract_uid` / `extract_common_fields` / 自动注册 → 通过
4. 写 `test_miniprogram_existing_user_logs_in` → 验证已有账号流程 → 通过
5. 写三个 unionid 合并测试 → 实现 `pre_social_login` hook → 通过
6. 写 username 格式和错误处理测试 → 补全边界逻辑 → 通过
7. 写 weixin provider 测试 → 补配置 → 通过
