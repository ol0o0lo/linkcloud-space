# 设计文档：手机号注册/登录 + 短信验证码

**日期**：2026-05-14  
**状态**：已批准

---

## 背景

项目目前只支持邮箱注册登录。需要新增手机号支持：
- 手机号为主要登录方式，注册时必填
- 邮箱为辅助登录方式，注册时可选
- 两种方式并存，互不影响
- 利用 django-allauth 原生手机号支持，短信发送默认走腾讯云，保留阿里云备用

---

## 变更范围

### 1. User 模型（`apps/accounts/models.py`）

新增两个字段：

```python
phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
phone_verified = models.BooleanField(default=False)
```

- `null=True`：兼容已有用户（无手机号）
- `unique=True`：一个手机号只能绑定一个账号

### 2. Adapter（`apps/accounts/adapter.py`，新建）

继承 `DefaultAccountAdapter`，实现 6 个方法：

| 方法 | 作用 |
|------|------|
| `get_phone(user)` | 返回 `(phone, verified)` 元组，无手机号返回 `None` |
| `set_phone(user, phone, verified)` | 写入手机号和验证状态 |
| `set_phone_verified(user, phone)` | 标记手机号已验证 |
| `get_user_by_phone(phone)` | 按手机号查 User，不存在返回 `None` |
| `send_verification_code_sms(user, phone, code, **kwargs)` | 调短信后端发验证码 |
| `send_unknown_account_sms(phone, **kwargs)` | 防枚举：未注册号码发提示短信 |

### 3. 短信后端（`apps/base/sms/`，新建）

```
apps/base/sms/
├── __init__.py        # 导出 send_sms() 便捷函数
├── base.py            # 抽象基类 SMSBackend，定义 send(phone, code) 接口
├── tencent.py         # 腾讯云 SMS 实现（默认）
└── aliyun.py          # 阿里云 SMS 实现（备用）
```

通过 `settings.SMS_BACKEND` 切换：
```python
SMS_BACKEND = "apps.base.sms.tencent.TencentSMSBackend"
```

### 4. Settings（`config/settings/_base.py`）

```python
# allauth 手机号配置
ACCOUNT_LOGIN_METHODS = {"phone", "email"}
ACCOUNT_SIGNUP_FIELDS = ["phone*", "email"]
ACCOUNT_ADAPTER = "apps.accounts.adapter.AccountAdapter"
ACCOUNT_PHONE_VERIFICATION_ENABLED = True
ACCOUNT_PHONE_VERIFICATION_SUPPORTS_RESEND = True

# 短信后端
SMS_BACKEND = env("SMS_BACKEND", default="apps.base.sms.tencent.TencentSMSBackend")

# 腾讯云 SMS
TENCENT_SMS_SECRET_ID = env("TENCENT_SMS_SECRET_ID", default="")
TENCENT_SMS_SECRET_KEY = env("TENCENT_SMS_SECRET_KEY", default="")
TENCENT_SMS_APP_ID = env("TENCENT_SMS_APP_ID", default="")
TENCENT_SMS_SIGN_NAME = env("TENCENT_SMS_SIGN_NAME", default="")
TENCENT_SMS_TEMPLATE_ID = env("TENCENT_SMS_TEMPLATE_ID", default="")

# 阿里云 SMS（备用）
ALIYUN_SMS_ACCESS_KEY_ID = env("ALIYUN_SMS_ACCESS_KEY_ID", default="")
ALIYUN_SMS_ACCESS_KEY_SECRET = env("ALIYUN_SMS_ACCESS_KEY_SECRET", default="")
ALIYUN_SMS_SIGN_NAME = env("ALIYUN_SMS_SIGN_NAME", default="")
ALIYUN_SMS_TEMPLATE_CODE = env("ALIYUN_SMS_TEMPLATE_CODE", default="")
```

### 5. pyproject.toml 环境变量说明

新增以上所有 SMS 相关变量的 epicenv schema 定义。

### 6. 数据库迁移

新增 migration，为 User 模型添加 `phone` 和 `phone_verified` 字段，不破坏现有数据。

---

## 短信后端接口设计

```python
# base.py
class SMSBackend:
    def send(self, phone: str, code: str) -> None:
        raise NotImplementedError

# __init__.py
def send_sms(phone: str, code: str) -> None:
    """根据 settings.SMS_BACKEND 动态加载后端并发送"""
```

---

## 依赖

- 腾讯云：`tencentcloud-sdk-python-sms`
- 阿里云：`alibabacloud-dysmsapi20170525`

---

## 不在此次变更范围内

- 前端 Vue SPA 手机号输入 UI（allauth headless API 已提供接口，前端后续适配）
- 手机号格式校验（使用 allauth 默认 E.164 格式校验）
- 换绑手机号流程
