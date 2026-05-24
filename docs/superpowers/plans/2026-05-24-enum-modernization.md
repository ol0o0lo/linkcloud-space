# 枚举现代化改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/base` 新增 `ChoicesMixin` 增强基类，统一 `apps/settings` 和 `apps/media` 的枚举风格，消除裸字符串常量。

**Architecture:** 新建 `apps/base/enums.py` 提供 `ChoicesMixin`（继承 `models.TextChoices`），`apps/settings/models.py` 的 `ValueType` 改用该基类，`apps/media/enums.py` 新增 `MediaScope` / `MediaExtension`，相关 service / schema / api 引用枚举成员替换裸字符串。

**Tech Stack:** Django 5, django-ninja, pytest, model_bakery

---

### Task 1: 新建 `apps/base/enums.py` 并写测试

**Files:**
- Create: `apps/base/enums.py`
- Create: `apps/base/tests/test_enums.py`

- [ ] **Step 1: 写失败测试**

新建 `apps/base/tests/test_enums.py`：

```python
import pytest
from django.utils.translation import gettext_lazy as _

from apps.base.enums import ChoicesMixin


class Color(ChoicesMixin):
    RED = "red", _("红色")
    GREEN = "green", _("绿色")


class TestChoicesMixin:
    def test_get_choices(self):
        assert Color.get_choices() == [("red", "红色"), ("green", "绿色")]

    def test_get_django_choices(self):
        assert Color.get_django_choices() == Color.get_choices()

    def test_get_values(self):
        assert Color.get_values() == ["red", "green"]

    def test_get_labels(self):
        assert Color.get_labels() == ["红色", "绿色"]

    def test_get_choice_label_found(self):
        assert Color.get_choice_label("red") == "红色"

    def test_get_choice_label_not_found(self):
        assert Color.get_choice_label("unknown") == "unknown"
```

- [ ] **Step 2: 运行确认失败**

```bash
docker compose exec web pytest apps/base/tests/test_enums.py -v
```

期望：`ModuleNotFoundError: No module named 'apps.base.enums'`

- [ ] **Step 3: 新建 `apps/base/enums.py`**

```python
from django.db import models


class ChoicesMixin(models.TextChoices):
    @classmethod
    def get_choices(cls):
        return cls.choices

    @classmethod
    def get_django_choices(cls):
        return cls.choices

    @classmethod
    def get_values(cls):
        return cls.values

    @classmethod
    def get_labels(cls):
        return cls.labels

    @classmethod
    def get_choice_label(cls, value):
        return cls(value).label if value in cls.values else value
```

- [ ] **Step 4: 运行确认通过**

```bash
docker compose exec web pytest apps/base/tests/test_enums.py -v
```

期望：6 个测试全部 PASS

- [ ] **Step 5: 提交**

```bash
git add apps/base/enums.py apps/base/tests/test_enums.py
git commit -m "feat: 新增 ChoicesMixin 枚举增强基类"
```

---

### Task 2: 改造 `apps/settings/models.py` 的 `ValueType`

**Files:**
- Modify: `apps/settings/models.py`

- [ ] **Step 1: 修改 `ValueType` 基类**

将 `apps/settings/models.py` 顶部 import 从：

```python
from django.db import models
```

改为（新增一行）：

```python
from django.db import models

from apps.base.enums import ChoicesMixin
```

将 `ValueType` 定义从：

```python
class ValueType(models.TextChoices):
    TEXT = "text", "文本"
    PASSWORD = "password", "密码"
    JSON = "json", "JSON"
    BOOLEAN = "boolean", "布尔"
    INTEGER = "integer", "整数"
```

改为：

```python
class ValueType(ChoicesMixin):
    TEXT = "text", "文本"
    PASSWORD = "password", "密码"
    JSON = "json", "JSON"
    BOOLEAN = "boolean", "布尔"
    INTEGER = "integer", "整数"
```

- [ ] **Step 2: 确认无 migration 变更**

```bash
docker compose exec web python manage.py makemigrations --check
```

期望：`No changes detected`

- [ ] **Step 3: 运行现有 settings 测试**

```bash
docker compose exec web pytest apps/settings/tests/ -v
```

期望：全部 PASS（基类变更不影响行为）

- [ ] **Step 4: 提交**

```bash
git add apps/settings/models.py
git commit -m "refactor: ValueType 改用 ChoicesMixin 基类"
```

---

### Task 3: 改造 `apps/settings/service.py` 替换字符串字面量

**Files:**
- Modify: `apps/settings/service.py`

- [ ] **Step 1: 修改 `_serialize_value`**

将 `apps/settings/service.py` 顶部 import 从：

```python
from apps.settings.models import DefaultSetting, OrganizationSetting, TeamSetting, UserSetting
```

改为：

```python
from apps.settings.models import DefaultSetting, OrganizationSetting, TeamSetting, UserSetting, ValueType
```

将 `_serialize_value` 函数从：

```python
def _serialize_value(value, value_type: str):
    """根据 value_type 处理返回值。password 脱敏，其余做类型转换。"""
    if value_type == "password":
        return "********"
    if value_type == "boolean":
        return bool(value)
    if value_type == "integer":
        return int(value)
    return value
```

改为：

```python
def _serialize_value(value, value_type: str):
    """根据 value_type 处理返回值。password 脱敏，其余做类型转换。"""
    if value_type == ValueType.PASSWORD:
        return "********"
    if value_type == ValueType.BOOLEAN:
        return bool(value)
    if value_type == ValueType.INTEGER:
        return int(value)
    return value
```

- [ ] **Step 2: 运行 settings 全量测试**

```bash
docker compose exec web pytest apps/settings/tests/ -v
```

期望：全部 PASS

- [ ] **Step 3: 提交**

```bash
git add apps/settings/service.py
git commit -m "refactor: _serialize_value 替换字符串字面量为 ValueType 枚举"
```

---

### Task 4: 新建 `apps/media/enums.py` 并写测试

**Files:**
- Create: `apps/media/enums.py`
- Create: `apps/media/tests/test_enums.py`

- [ ] **Step 1: 写失败测试**

新建 `apps/media/tests/test_enums.py`：

```python
from apps.media.enums import MediaExtension, MediaScope


class TestMediaScope:
    def test_values(self):
        assert MediaScope.get_values() == ["user", "org"]

    def test_user_member(self):
        assert MediaScope.USER == "user"

    def test_org_member(self):
        assert MediaScope.ORG == "org"


class TestMediaExtension:
    def test_values(self):
        assert MediaExtension.get_values() == ["jpg", "jpeg", "png", "webp"]

    def test_jpg_member(self):
        assert MediaExtension.JPG == "jpg"
```

- [ ] **Step 2: 运行确认失败**

```bash
docker compose exec web pytest apps/media/tests/test_enums.py -v
```

期望：`ModuleNotFoundError: No module named 'apps.media.enums'`

- [ ] **Step 3: 新建 `apps/media/enums.py`**

```python
from django.utils.translation import gettext_lazy as _

from apps.base.enums import ChoicesMixin


class MediaScope(ChoicesMixin):
    USER = "user", _("用户")
    ORG = "org", _("组织")


class MediaExtension(ChoicesMixin):
    JPG = "jpg", "JPG"
    JPEG = "jpeg", "JPEG"
    PNG = "png", "PNG"
    WEBP = "webp", "WebP"
```

- [ ] **Step 4: 运行确认通过**

```bash
docker compose exec web pytest apps/media/tests/test_enums.py -v
```

期望：5 个测试全部 PASS

- [ ] **Step 5: 提交**

```bash
git add apps/media/enums.py apps/media/tests/test_enums.py
git commit -m "feat: 新增 MediaScope 和 MediaExtension 枚举"
```

---

### Task 5: 改造 `apps/media/services.py`

**Files:**
- Modify: `apps/media/services.py`

- [ ] **Step 1: 修改 `services.py`**

将 `apps/media/services.py` 完整替换为：

```python
"""OSS 上传路径生成和 STS 临时凭证."""
import json
from uuid import uuid4

from django.conf import settings

from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_sts20150401.models import AssumeRoleRequest
from alibabacloud_tea_openapi.models import Config as TeaConfig

from apps.media.enums import MediaExtension, MediaScope
from apps.media.exceptions import InvalidExtensionException, InvalidScopeException


def generate_upload_path(scope: str, object_id: int, filename: str) -> str:
    if scope not in MediaScope.get_values():
        raise InvalidScopeException()

    parts = filename.rsplit(".", 1)
    if len(parts) != 2 or not parts[1]:
        raise InvalidExtensionException("文件名必须包含有效扩展名")
    ext = parts[1].lower()
    if ext not in MediaExtension.get_values():
        raise InvalidExtensionException(f"不支持的扩展名 '.{ext}'，允许：{MediaExtension.get_values()}")

    uid = uuid4().hex
    if scope == MediaScope.USER:
        return f"uploads/users/{object_id}/{uid}.{ext}"
    return f"uploads/orgs/{object_id}/{uid}.{ext}"


def _generate_sts_token(*, path: str, duration_seconds: int = 900) -> dict:
    policy = {
        "Version": "1",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["oss:PutObject"],
                "Resource": [f"acs:oss:*:*:{settings.MEDIA_S3_BUCKET_NAME}/{path}"],
            }
        ],
    }
    config = TeaConfig(
        access_key_id=settings.ALIYUN_STS_ACCESS_KEY_ID,
        access_key_secret=settings.ALIYUN_STS_ACCESS_KEY_SECRET,
        endpoint="sts.aliyuncs.com",
    )
    client = StsClient(config)
    request = AssumeRoleRequest(
        role_arn=settings.ALIYUN_STS_ROLE_ARN,
        role_session_name=settings.ALIYUN_STS_ROLE_SESSION_NAME,
        policy=json.dumps(policy),
        duration_seconds=duration_seconds,
    )
    response = client.assume_role(request)
    creds = response.body.credentials
    return {
        "access_key_id": creds.access_key_id,
        "access_key_secret": creds.access_key_secret,
        "security_token": creds.security_token,
        "expires_at": creds.expiration,
    }


def get_oss_token(scope: str, object_id: int, filename: str) -> dict:
    path = generate_upload_path(scope=scope, object_id=object_id, filename=filename)
    token = _generate_sts_token(path=path)
    return {
        "access_key_id": token["access_key_id"],
        "access_key_secret": token["access_key_secret"],
        "security_token": token["security_token"],
        "endpoint": settings.MEDIA_S3_ENDPOINT_URL,
        "bucket": settings.MEDIA_S3_BUCKET_NAME,
        "path": path,
        "expires_at": token["expires_at"],
    }
```

- [ ] **Step 2: 运行 media 测试**

```bash
docker compose exec web pytest apps/media/tests/ -v
```

期望：全部 PASS

- [ ] **Step 3: 提交**

```bash
git add apps/media/services.py
git commit -m "refactor: media services 替换裸字符串常量为枚举"
```

---

### Task 6: 改造 `apps/media/schemas.py` 和 `api.py`

**Files:**
- Modify: `apps/media/schemas.py`
- Modify: `apps/media/api.py`

- [ ] **Step 1: 修改 `schemas.py`**

将 `apps/media/schemas.py` 替换为：

```python
from ninja import Schema

from apps.media.enums import MediaScope


class OssTokenIn(Schema):
    scope: MediaScope
    filename: str


class OssTokenOut(Schema):
    access_key_id: str
    access_key_secret: str
    security_token: str
    endpoint: str
    bucket: str
    path: str
    expires_at: str
```

- [ ] **Step 2: 修改 `api.py`**

将 `apps/media/api.py` 替换为：

```python
"""OSS 临时凭证接口."""
from ninja import Query, Router

from apps.base.permissions import require_authenticated, require_org_selected
from apps.media.enums import MediaScope
from apps.media.schemas import OssTokenIn, OssTokenOut
from apps.media.services import get_oss_token

router = Router(tags=["media"])


@router.get("/oss-token/", response=OssTokenOut)
def oss_token(request, params: OssTokenIn = Query(...)):
    require_authenticated(request)

    if params.scope == MediaScope.USER:
        object_id = request.user.pk
    else:
        org = require_org_selected(request)
        object_id = org.pk

    result = get_oss_token(scope=params.scope, object_id=object_id, filename=params.filename)
    return OssTokenOut(**result)
```

- [ ] **Step 3: 运行 media 全量测试**

```bash
docker compose exec web pytest apps/media/tests/ -v
```

期望：全部 PASS（包括 `test_invalid_scope_returns_400`，Ninja 现在会在路由层拦截非法 scope）

- [ ] **Step 4: 运行全量测试确认无回归**

```bash
docker compose exec web pytest --ignore=e2e -v
```

期望：全部 PASS

- [ ] **Step 5: 提交**

```bash
git add apps/media/schemas.py apps/media/api.py
git commit -m "refactor: media schemas/api 使用 MediaScope 枚举替换 Literal"
```
