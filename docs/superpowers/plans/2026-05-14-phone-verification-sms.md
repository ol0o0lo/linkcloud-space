# 手机号注册/登录 + 短信验证码实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有邮箱登录基础上新增手机号登录，注册时手机号必填、邮箱可选，短信验证码默认走阿里云，腾讯云保留备用。

**Architecture:** 扩展现有 `apps/accounts/auth_adapter.py` 的 `AccountAdapter` 实现 allauth 手机号接口；在 User 模型新增 `phone`/`phone_verified` 字段；新建 `apps/base/sms/` 短信后端抽象层，阿里云和腾讯云各自实现。

**Tech Stack:** django-allauth 原生手机号支持，`alibabacloud-dysmsapi20170525`（阿里云），`tencentcloud-sdk-python-sms`（腾讯云备用），Django 内置 `import_string` 动态加载后端。

---

### Task 1: User 模型新增 phone 字段 + 迁移

**Files:**
- Modify: `apps/accounts/models.py`
- Create: `apps/accounts/migrations/0007_user_phone.py`（由 makemigrations 生成）

- [ ] **Step 1: 在 User 模型新增字段**

打开 `apps/accounts/models.py`，在 `avatar_crop_data` 字段后新增：

```python
phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
phone_verified = models.BooleanField(default=False)
```

完整 User 类字段部分变为：

```python
class User(AbstractUser):
    timezone = models.CharField(max_length=63, default="Asia/Shanghai")
    avatar_original = models.ImageField(upload_to=avatar_original_path, blank=True)
    avatar_thumbnail = models.ImageField(upload_to=avatar_thumbnail_path, blank=True)
    avatar_crop_data = models.JSONField(blank=True, null=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    phone_verified = models.BooleanField(default=False)
```

- [ ] **Step 2: 生成迁移**

```bash
docker compose run --rm web python manage.py makemigrations accounts --name user_phone
```

预期输出：`Migrations for 'accounts': apps/accounts/migrations/0007_user_phone.py`

- [ ] **Step 3: 执行迁移**

```bash
docker compose run --rm web python manage.py migrate
```

预期输出：`Applying accounts.0007_user_phone... OK`

- [ ] **Step 4: 验证**

```bash
docker compose run --rm web python manage.py shell -c "
from apps.accounts.models import User
print('phone' in [f.name for f in User._meta.get_fields()])
print('phone_verified' in [f.name for f in User._meta.get_fields()])
"
```

预期输出：
```
True
True
```

- [ ] **Step 5: 提交**

```bash
git add apps/accounts/models.py apps/accounts/migrations/0007_user_phone.py
git commit -m "feat: add phone and phone_verified fields to User model"
```

---

### Task 2: 新建短信后端抽象层

**Files:**
- Create: `apps/base/sms/__init__.py`
- Create: `apps/base/sms/base.py`
- Create: `apps/base/sms/aliyun.py`
- Create: `apps/base/sms/tencent.py`

- [ ] **Step 1: 创建 base.py（抽象基类）**

新建 `apps/base/sms/base.py`：

```python
from abc import ABC, abstractmethod


class SMSBackend(ABC):
    """Abstract base class for SMS backends."""

    @abstractmethod
    def send(self, phone: str, code: str) -> None:
        """Send an SMS verification code to the given phone number."""
        raise NotImplementedError
```

- [ ] **Step 2: 创建阿里云实现 aliyun.py**

新建 `apps/base/sms/aliyun.py`：

```python
import logging

from alibabacloud_dysmsapi20170525 import models as sms_models
from alibabacloud_dysmsapi20170525.client import Client
from alibabacloud_tea_openapi import models as open_api_models
from django.conf import settings

from .base import SMSBackend

logger = logging.getLogger(__name__)


class AliyunSMSBackend(SMSBackend):
    """Aliyun (Alibaba Cloud) SMS backend."""

    def _get_client(self) -> Client:
        config = open_api_models.Config(
            access_key_id=settings.ALIYUN_SMS_ACCESS_KEY_ID,
            access_key_secret=settings.ALIYUN_SMS_ACCESS_KEY_SECRET,
        )
        config.endpoint = "dysmsapi.aliyuncs.com"
        return Client(config)

    def send(self, phone: str, code: str) -> None:
        client = self._get_client()
        request = sms_models.SendSmsRequest(
            phone_numbers=phone,
            sign_name=settings.ALIYUN_SMS_SIGN_NAME,
            template_code=settings.ALIYUN_SMS_TEMPLATE_CODE,
            template_param=f'{{"code":"{code}"}}',
        )
        response = client.send_sms(request)
        if response.body.code != "OK":
            logger.error("Aliyun SMS failed: %s - %s", response.body.code, response.body.message)
            raise RuntimeError(f"Aliyun SMS error: {response.body.code} {response.body.message}")
        logger.info("Aliyun SMS sent to %s", phone)
```

- [ ] **Step 3: 创建腾讯云实现 tencent.py**

新建 `apps/base/sms/tencent.py`：

```python
import logging

from django.conf import settings
from tencentcloud.common import credential
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.sms.v20210111 import models as sms_models
from tencentcloud.sms.v20210111 import sms_client

from .base import SMSBackend

logger = logging.getLogger(__name__)


class TencentSMSBackend(SMSBackend):
    """Tencent Cloud SMS backend."""

    def send(self, phone: str, code: str) -> None:
        try:
            cred = credential.Credential(
                settings.TENCENT_SMS_SECRET_ID,
                settings.TENCENT_SMS_SECRET_KEY,
            )
            client = sms_client.SmsClient(cred, "ap-guangzhou")
            req = sms_models.SendSmsRequest()
            req.SmsSdkAppId = settings.TENCENT_SMS_APP_ID
            req.SignName = settings.TENCENT_SMS_SIGN_NAME
            req.TemplateId = settings.TENCENT_SMS_TEMPLATE_ID
            req.TemplateParamSet = [code]
            req.PhoneNumberSet = [phone if phone.startswith("+") else f"+86{phone}"]
            resp = client.SendSms(req)
            status = resp.SendStatusSet[0]
            if status.Code != "Ok":
                logger.error("Tencent SMS failed: %s - %s", status.Code, status.Message)
                raise RuntimeError(f"Tencent SMS error: {status.Code} {status.Message}")
            logger.info("Tencent SMS sent to %s", phone)
        except TencentCloudSDKException as e:
            logger.error("Tencent SMS SDK exception: %s", str(e))
            raise RuntimeError(f"Tencent SMS SDK error: {e}") from e
```

- [ ] **Step 4: 创建 __init__.py（便捷函数）**

新建 `apps/base/sms/__init__.py`：

```python
from django.conf import settings
from django.utils.module_loading import import_string


def send_sms(phone: str, code: str) -> None:
    """Send an SMS using the configured SMS_BACKEND."""
    backend_class = import_string(settings.SMS_BACKEND)
    backend = backend_class()
    backend.send(phone, code)
```

- [ ] **Step 5: 提交**

```bash
git add apps/base/sms/
git commit -m "feat: add SMS backend abstraction with aliyun and tencent implementations"
```

---

### Task 3: 安装短信 SDK 依赖

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: 在 pyproject.toml 新增两个依赖**

在 `[project] dependencies` 列表中新增：

```toml
    "alibabacloud-dysmsapi20170525>=2.0.0",
    "tencentcloud-sdk-python-sms>=3.0.0",
```

- [ ] **Step 2: 同步依赖**

```bash
uv sync
```

预期：正常解析，无报错

- [ ] **Step 3: 验证两个包可以导入**

```bash
docker compose run --rm web python -c "
from alibabacloud_dysmsapi20170525.client import Client
from tencentcloud.sms.v20210111 import sms_client
print('OK')
" 2>&1 | tail -2
```

预期输出：`OK`

- [ ] **Step 4: 提交**

```bash
git add pyproject.toml uv.lock
git commit -m "chore: add aliyun and tencent SMS SDK dependencies"
```

---

### Task 4: 扩展 AccountAdapter，实现手机号接口

**Files:**
- Modify: `apps/accounts/auth_adapter.py`

- [ ] **Step 1: 扩展 AccountAdapter，新增 6 个手机号方法**

打开 `apps/accounts/auth_adapter.py`，在文件末尾的 `AccountAdapter` 类内追加：

```python
    # --- Phone number support (django-allauth) ---

    def get_phone(self, user):
        """Return (phone, verified) tuple or None if no phone set."""
        if not user.phone:
            return None
        return (user.phone, user.phone_verified)

    def set_phone(self, user, phone, verified):
        """Store phone number and verification status on the user."""
        user.phone = phone
        user.phone_verified = verified
        user.save(update_fields=["phone", "phone_verified"])

    def set_phone_verified(self, user, phone):
        """Mark the phone number as verified."""
        user.phone_verified = True
        user.save(update_fields=["phone_verified"])

    def get_user_by_phone(self, phone):
        """Look up a user by phone number. Returns None if not found."""
        from apps.accounts.models import User

        try:
            return User.objects.get(phone=phone)
        except User.DoesNotExist:
            return None

    def send_verification_code_sms(self, user, phone, code, **kwargs):
        """Send SMS verification code via configured SMS backend."""
        from apps.base.sms import send_sms

        send_sms(phone, code)

    def send_unknown_account_sms(self, phone, **kwargs):
        """Send an SMS to an unregistered number (enumeration prevention)."""
        from apps.base.sms import send_sms

        send_sms(phone, "该手机号未注册，请检查后重试")
```

- [ ] **Step 2: 验证 Django check 通过**

```bash
docker compose run --rm web python manage.py check 2>&1 | tail -3
```

预期：`System check identified no issues (0 silenced).`

- [ ] **Step 3: 提交**

```bash
git add apps/accounts/auth_adapter.py
git commit -m "feat: extend AccountAdapter with phone number methods for allauth"
```

---

### Task 5: 更新 settings 和 pyproject.toml 环境变量

**Files:**
- Modify: `config/settings/_base.py`
- Modify: `pyproject.toml`

- [ ] **Step 1: 更新 allauth 配置**

在 `config/settings/_base.py` 中找到：

```python
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_CONFIRM_EMAIL_ON_GET = True
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
```

替换为：

```python
ACCOUNT_LOGIN_METHODS = {"phone", "email"}
ACCOUNT_CONFIRM_EMAIL_ON_GET = True
ACCOUNT_SIGNUP_FIELDS = ["phone*", "email", "password1*"]
ACCOUNT_PHONE_VERIFICATION_ENABLED = True
ACCOUNT_PHONE_VERIFICATION_SUPPORTS_RESEND = True
```

- [ ] **Step 2: 新增 SMS 配置**

在 `config/settings/_base.py` 的邮件配置块之后新增：

```python
# SMS Backend
SMS_BACKEND = env("SMS_BACKEND", default="apps.base.sms.aliyun.AliyunSMSBackend")

# 阿里云 SMS（默认）
ALIYUN_SMS_ACCESS_KEY_ID = env("ALIYUN_SMS_ACCESS_KEY_ID", default="")
ALIYUN_SMS_ACCESS_KEY_SECRET = env("ALIYUN_SMS_ACCESS_KEY_SECRET", default="")
ALIYUN_SMS_SIGN_NAME = env("ALIYUN_SMS_SIGN_NAME", default="")
ALIYUN_SMS_TEMPLATE_CODE = env("ALIYUN_SMS_TEMPLATE_CODE", default="")

# 腾讯云 SMS（备用，切换方式：SMS_BACKEND=apps.base.sms.tencent.TencentSMSBackend）
TENCENT_SMS_SECRET_ID = env("TENCENT_SMS_SECRET_ID", default="")
TENCENT_SMS_SECRET_KEY = env("TENCENT_SMS_SECRET_KEY", default="")
TENCENT_SMS_APP_ID = env("TENCENT_SMS_APP_ID", default="")
TENCENT_SMS_SIGN_NAME = env("TENCENT_SMS_SIGN_NAME", default="")
TENCENT_SMS_TEMPLATE_ID = env("TENCENT_SMS_TEMPLATE_ID", default="")
```

- [ ] **Step 3: 更新 pyproject.toml epicenv schema**

在 `[tool.epicenv.variables]` 的 Email Settings 区块之后新增：

```toml
# SMS Settings
SMS_BACKEND = { type = "str", default = "apps.base.sms.aliyun.AliyunSMSBackend", help_text = "短信后端，切换腾讯云：apps.base.sms.tencent.TencentSMSBackend" }
ALIYUN_SMS_ACCESS_KEY_ID = { type = "str", default = "", help_text = "阿里云 AccessKey ID" }
ALIYUN_SMS_ACCESS_KEY_SECRET = { type = "str", default = "", help_text = "阿里云 AccessKey Secret" }
ALIYUN_SMS_SIGN_NAME = { type = "str", default = "", help_text = "阿里云短信签名" }
ALIYUN_SMS_TEMPLATE_CODE = { type = "str", default = "", help_text = "阿里云短信模板 CODE，模板变量为 ${code}" }
TENCENT_SMS_SECRET_ID = { type = "str", default = "", help_text = "腾讯云 SecretId（备用）" }
TENCENT_SMS_SECRET_KEY = { type = "str", default = "", help_text = "腾讯云 SecretKey（备用）" }
TENCENT_SMS_APP_ID = { type = "str", default = "", help_text = "腾讯云 SMS SdkAppId（备用）" }
TENCENT_SMS_SIGN_NAME = { type = "str", default = "", help_text = "腾讯云短信签名（备用）" }
TENCENT_SMS_TEMPLATE_ID = { type = "str", default = "", help_text = "腾讯云短信模板 ID（备用）" }
```

- [ ] **Step 4: 验证配置加载**

```bash
docker compose run --rm web python manage.py check 2>&1 | tail -3
```

预期：`System check identified no issues (0 silenced).`

- [ ] **Step 5: 提交**

```bash
git add config/settings/_base.py pyproject.toml
git commit -m "feat: add phone login settings and SMS backend configuration"
```

---

### Task 6: 更新 Admin，显示手机号字段

**Files:**
- Modify: `apps/accounts/admin.py`

- [ ] **Step 1: 在 UserAdmin 中新增 phone 字段**

打开 `apps/accounts/admin.py`，替换为：

```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("手机号", {"fields": ("phone", "phone_verified")}),
    )
    list_display = ("username", "email", "phone", "phone_verified", "is_staff")
    search_fields = ("username", "email", "phone")
```

- [ ] **Step 2: 验证**

```bash
docker compose run --rm web python manage.py check 2>&1 | tail -3
```

预期：`System check identified no issues (0 silenced).`

- [ ] **Step 3: 提交**

```bash
git add apps/accounts/admin.py
git commit -m "feat: add phone fields to UserAdmin"
```

---

## 完成标志

- `python manage.py check` 无 issues
- User 模型有 `phone` 和 `phone_verified` 字段
- `apps/base/sms/` 目录存在，三个文件齐全
- allauth 设置中 `ACCOUNT_LOGIN_METHODS` 包含 `phone`
- Admin 后台 User 详情页显示手机号字段
- `.env` 中预留了阿里云 SMS 环境变量（填入真实值后可测试发送）
