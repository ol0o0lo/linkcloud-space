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

## 测试策略

- 小程序 provider：mock `jscode2session` API，测试 code → openid 流程、自动注册、已有账号登录
- unionid 合并：测试先小程序后扫码、先扫码后小程序两个场景
- weixin provider：配置验证，无需完整 OAuth2 测试（allauth 内置已有覆盖）
- `SOCIALACCOUNT_EMAIL_REQUIRED = False` 需在测试 settings 中覆盖
