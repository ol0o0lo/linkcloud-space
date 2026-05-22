# OSS STS 临时凭证接口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `GET /api/media/oss-token/` 接口，向已登录用户签发阿里云 OSS STS 临时凭证，前端凭此直传文件到 OSS，后端不做文件中转。

**Architecture:** 新建 `apps/media/` app，包含 STS 凭证生成逻辑（`sts.py`）和 ninja 路由（`api.py`）。后端根据 `scope` 参数生成隔离的上传路径，调用阿里云 STS SDK 生成限定该路径写权限的临时凭证。

**Tech Stack:** django-ninja、alibabacloud-sts20150401、阿里云 RAM STS

---

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `apps/media/__init__.py` | app 包 |
| 新建 | `apps/media/apps.py` | AppConfig |
| 新建 | `apps/media/sts.py` | STS 凭证生成逻辑 |
| 新建 | `apps/media/api.py` | ninja Router |
| 新建 | `apps/media/schemas.py` | 请求/响应 schema |
| 新建 | `apps/media/tests/__init__.py` | 测试包 |
| 新建 | `apps/media/tests/test_api.py` | API 测试 |
| 新建 | `apps/media/tests/test_sts.py` | STS 逻辑单元测试 |
| 修改 | `config/settings/_base.py` | 新增 STS 环境变量 |
| 修改 | `config/api.py` | 挂载 media router |
| 修改 | `config/settings/__init__.py` | 无需改动（自动继承） |
| 修改 | `pyproject.toml` | 新增 alibabacloud-sts20150401 依赖 |

---

### Task 1: 新增依赖和环境变量

**Files:**
- Modify: `pyproject.toml`
- Modify: `config/settings/_base.py`

- [ ] **Step 1: 在 pyproject.toml 中新增 STS SDK 依赖**

在 `dependencies` 列表中，紧跟 `alibabacloud-dysmsapi20170525` 后面添加：

```toml
"alibabacloud-sts20150401>=3.0.0",
```

- [ ] **Step 2: 在 _base.py 中新增 STS 环境变量**

在 `ALIYUN_SMS_*` 变量块之后添加：

```python
# 阿里云 STS（OSS 前端直传临时凭证）
ALIYUN_STS_ACCESS_KEY_ID = env("ALIYUN_STS_ACCESS_KEY_ID", default="")
ALIYUN_STS_ACCESS_KEY_SECRET = env("ALIYUN_STS_ACCESS_KEY_SECRET", default="")
ALIYUN_STS_ROLE_ARN = env("ALIYUN_STS_ROLE_ARN", default="")
ALIYUN_STS_ROLE_SESSION_NAME = env("ALIYUN_STS_ROLE_SESSION_NAME", default="oss-upload")
```

- [ ] **Step 3: 在 pyproject.toml [tool.epicenv.variables] 中新增变量声明**

在 `ALIYUN_SMS_TEMPLATE_CODE` 后面添加：

```toml
ALIYUN_STS_ACCESS_KEY_ID = { type = "str", default = "", help_text = "阿里云 STS RAM 用户 AccessKey ID（需要 AliyunSTSAssumeRoleAccess 权限）" }
ALIYUN_STS_ACCESS_KEY_SECRET = { type = "str", default = "", help_text = "阿里云 STS RAM 用户 AccessKey Secret" }
ALIYUN_STS_ROLE_ARN = { type = "str", default = "", help_text = "STS 角色 ARN，格式：acs:ram::{account_id}:role/{role_name}" }
ALIYUN_STS_ROLE_SESSION_NAME = { type = "str", default = "oss-upload", help_text = "STS 会话名称，用于审计日志" }
```

- [ ] **Step 4: 同步依赖**

```bash
uv sync
```

期望输出：包含 `alibabacloud-sts20150401` 安装成功。

---

### Task 2: 创建 media app 骨架

**Files:**
- Create: `apps/media/__init__.py`
- Create: `apps/media/apps.py`
- Modify: `config/settings/_base.py`

- [ ] **Step 1: 创建 `apps/media/__init__.py`**

内容为空文件：
```python
```

- [ ] **Step 2: 创建 `apps/media/apps.py`**

```python
from django.apps import AppConfig


class MediaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.media"
```

- [ ] **Step 3: 在 INSTALLED_APPS 中注册**

在 `config/settings/_base.py` 的 `INSTALLED_APPS` 列表中，在 `"apps.base"` 后面添加：

```python
"apps.media",
```

---

### Task 3: 实现 STS 凭证生成逻辑

**Files:**
- Create: `apps/media/sts.py`
- Create: `apps/media/tests/__init__.py`
- Create: `apps/media/tests/test_sts.py`

- [ ] **Step 1: 先写失败的测试**

创建 `apps/media/tests/__init__.py`（空文件）。

创建 `apps/media/tests/test_sts.py`：

```python
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from apps.media.sts import ALLOWED_EXTENSIONS, generate_upload_path, generate_sts_token


class TestGenerateUploadPath:
    def test_user_scope(self):
        path = generate_upload_path(scope="user", object_id=42, filename="photo.jpg")
        assert path.startswith("uploads/users/42/")
        assert path.endswith(".jpg")
        # UUID 部分应可解析
        uuid_part = path.split("/")[-1].replace(".jpg", "")
        UUID(uuid_part)  # raises ValueError if invalid

    def test_org_scope(self):
        path = generate_upload_path(scope="org", object_id=7, filename="room.png")
        assert path.startswith("uploads/orgs/7/")
        assert path.endswith(".png")

    def test_invalid_scope(self):
        with pytest.raises(ValueError, match="scope"):
            generate_upload_path(scope="admin", object_id=1, filename="x.jpg")

    def test_invalid_extension(self):
        with pytest.raises(ValueError, match="extension"):
            generate_upload_path(scope="user", object_id=1, filename="file.exe")

    def test_no_extension(self):
        with pytest.raises(ValueError, match="extension"):
            generate_upload_path(scope="user", object_id=1, filename="noext")

    def test_extension_case_insensitive(self):
        path = generate_upload_path(scope="user", object_id=1, filename="photo.JPG")
        assert path.endswith(".jpg")


class TestGenerateStsToken:
    @patch("apps.media.sts.StsClient")
    def test_returns_credentials(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.body.credentials.access_key_id = "STS.xxx"
        mock_response.body.credentials.access_key_secret = "secret"
        mock_response.body.credentials.security_token = "token"
        mock_response.body.credentials.expiration = "2026-05-16T08:30:00Z"

        mock_client = MagicMock()
        mock_client.assume_role.return_value = mock_response
        mock_client_cls.return_value = mock_client

        result = generate_sts_token(
            path="uploads/users/1/abc.jpg",
            access_key_id="ak",
            access_key_secret="sk",
            role_arn="acs:ram::123:role/uploader",
            role_session_name="test",
        )

        assert result["access_key_id"] == "STS.xxx"
        assert result["access_key_secret"] == "secret"
        assert result["security_token"] == "token"
        assert result["expires_at"] == "2026-05-16T08:30:00Z"

    @patch("apps.media.sts.StsClient")
    def test_policy_restricts_to_path(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.assume_role.return_value = MagicMock(
            body=MagicMock(credentials=MagicMock(
                access_key_id="k", access_key_secret="s",
                security_token="t", expiration="2026-05-16T08:30:00Z"
            ))
        )
        mock_client_cls.return_value = mock_client

        generate_sts_token(
            path="uploads/users/1/abc.jpg",
            access_key_id="ak",
            access_key_secret="sk",
            role_arn="acs:ram::123:role/uploader",
            role_session_name="test",
            bucket="my-bucket",
        )

        call_args = mock_client.assume_role.call_args
        request = call_args[0][0]
        import json
        policy = json.loads(request.policy)
        resource = policy["Statement"][0]["Resource"][0]
        assert "my-bucket/uploads/users/1/abc.jpg" in resource
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pytest apps/media/tests/test_sts.py -v
```

期望：`ImportError: cannot import name 'generate_upload_path' from 'apps.media.sts'`

- [ ] **Step 3: 实现 `apps/media/sts.py`**

```python
"""阿里云 OSS STS 临时凭证生成逻辑."""
import json
from uuid import uuid4

from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_sts20150401.models import AssumeRoleRequest
from alibabacloud_tea_openapi.models import Config

ALLOWED_SCOPES = {"user", "org"}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}


def generate_upload_path(scope: str, object_id: int, filename: str) -> str:
    """根据 scope 和 object_id 生成隔离的 OSS 上传路径."""
    if scope not in ALLOWED_SCOPES:
        raise ValueError(f"Invalid scope '{scope}'. Allowed: {ALLOWED_SCOPES}")

    parts = filename.rsplit(".", 1)
    if len(parts) != 2 or not parts[1]:
        raise ValueError("Invalid extension: filename must have a valid extension.")
    ext = parts[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Invalid extension '.{ext}'. Allowed: {ALLOWED_EXTENSIONS}")

    uid = uuid4().hex
    if scope == "user":
        return f"uploads/users/{object_id}/{uid}.{ext}"
    return f"uploads/orgs/{object_id}/{uid}.{ext}"


def generate_sts_token(
    *,
    path: str,
    access_key_id: str,
    access_key_secret: str,
    role_arn: str,
    role_session_name: str,
    bucket: str = "",
    duration_seconds: int = 900,
) -> dict:
    """调用阿里云 STS 签发临时凭证，权限仅限写入指定 path."""
    policy = {
        "Version": "1",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["oss:PutObject"],
                "Resource": [f"acs:oss:*:*:{bucket}/{path}"],
            }
        ],
    }

    config = Config(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
        endpoint="sts.aliyuncs.com",
    )
    client = StsClient(config)

    request = AssumeRoleRequest(
        role_arn=role_arn,
        role_session_name=role_session_name,
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
pytest apps/media/tests/test_sts.py -v
```

期望：全部 PASS。

---

### Task 4: 实现 API 接口

**Files:**
- Create: `apps/media/schemas.py`
- Create: `apps/media/api.py`
- Create: `apps/media/tests/test_api.py`
- Modify: `config/api.py`

- [ ] **Step 1: 先写失败的 API 测试**

创建 `apps/media/tests/test_api.py`：

```python
import json
from unittest.mock import patch

import pytest

from apps.accounts.models import User

OSS_TOKEN_URL = "/api/media/oss-token/"


def _make_sts_response():
    return {
        "access_key_id": "STS.test",
        "access_key_secret": "secret",
        "security_token": "token",
        "expires_at": "2026-05-16T08:30:00Z",
    }


@pytest.mark.django_db
class TestOssTokenAPI:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client
        self.user = User.objects.create_user(username="alice", password="secret")  # noqa: S106

    def _login(self):
        self.client.force_login(self.user)

    def _get(self, params):
        return self.client.get(OSS_TOKEN_URL, params)

    def test_requires_login(self):
        resp = self._get({"scope": "user", "filename": "photo.jpg"})
        assert resp.status_code == 403

    @patch("apps.media.api.generate_sts_token", return_value=_make_sts_response())
    @patch("apps.media.api.generate_upload_path", return_value="uploads/users/1/abc.jpg")
    def test_user_scope_returns_token(self, mock_path, mock_sts):
        self._login()
        resp = self._get({"scope": "user", "filename": "photo.jpg"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_key_id"] == "STS.test"
        assert data["path"] == "uploads/users/1/abc.jpg"
        assert "bucket" in data
        assert "endpoint" in data

    @patch("apps.media.api.generate_sts_token", return_value=_make_sts_response())
    @patch("apps.media.api.generate_upload_path", return_value="uploads/users/1/abc.jpg")
    def test_invalid_scope_returns_400(self, mock_path, mock_sts):
        self._login()
        resp = self._get({"scope": "admin", "filename": "photo.jpg"})
        assert resp.status_code == 400

    @patch("apps.media.api.generate_sts_token", return_value=_make_sts_response())
    @patch("apps.media.api.generate_upload_path", return_value="uploads/users/1/abc.jpg")
    def test_invalid_extension_returns_400(self, mock_path, mock_sts):
        self._login()
        # generate_upload_path 抛 ValueError，API 应转为 400
        mock_path.side_effect = ValueError("Invalid extension")
        resp = self._get({"scope": "user", "filename": "file.exe"})
        assert resp.status_code == 400

    @patch("apps.media.api.generate_sts_token", return_value=_make_sts_response())
    @patch("apps.media.api.generate_upload_path", return_value="uploads/orgs/5/abc.jpg")
    def test_org_scope_requires_active_org(self, mock_path, mock_sts):
        self._login()
        # 未设置 org session，应返回 403
        resp = self._get({"scope": "org", "filename": "room.jpg"})
        assert resp.status_code == 403
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pytest apps/media/tests/test_api.py -v
```

期望：`ImportError` 或 404（路由未注册）。

- [ ] **Step 3: 创建 `apps/media/schemas.py`**

```python
"""Media app 的请求/响应 schema."""
from ninja import Schema


class OssTokenIn(Schema):
    scope: str
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

- [ ] **Step 4: 创建 `apps/media/api.py`**

```python
"""OSS 临时凭证接口."""
from django.conf import settings
from ninja import Query, Router
from ninja.errors import HttpError

from apps.base.permissions import require_authenticated, require_org_selected
from apps.media.schemas import OssTokenIn, OssTokenOut
from apps.media.sts import generate_upload_path, generate_sts_token

router = Router(tags=["media"])


@router.get("/oss-token/", response=OssTokenOut, auth=None)
def get_oss_token(request, params: OssTokenIn = Query(...)):
    require_authenticated(request)

    object_id: int
    if params.scope == "user":
        object_id = request.user.pk
    elif params.scope == "org":
        org = require_org_selected(request)
        object_id = org.pk
    else:
        raise HttpError(400, f"Invalid scope '{params.scope}'. Allowed: user, org")

    try:
        path = generate_upload_path(
            scope=params.scope,
            object_id=object_id,
            filename=params.filename,
        )
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc

    token = generate_sts_token(
        path=path,
        access_key_id=settings.ALIYUN_STS_ACCESS_KEY_ID,
        access_key_secret=settings.ALIYUN_STS_ACCESS_KEY_SECRET,
        role_arn=settings.ALIYUN_STS_ROLE_ARN,
        role_session_name=settings.ALIYUN_STS_ROLE_SESSION_NAME,
        bucket=settings.MEDIA_S3_BUCKET_NAME,
    )

    return OssTokenOut(
        access_key_id=token["access_key_id"],
        access_key_secret=token["access_key_secret"],
        security_token=token["security_token"],
        endpoint=settings.MEDIA_S3_ENDPOINT_URL,
        bucket=settings.MEDIA_S3_BUCKET_NAME,
        path=path,
        expires_at=token["expires_at"],
    )
```

- [ ] **Step 5: 在 `config/api.py` 中挂载路由**

在文件顶部 import 块中添加：

```python
from apps.media.api import router as media_router
```

在 `api.add_router("/users/", users_router)` 之后添加：

```python
api.add_router("/media/", media_router)
```

- [ ] **Step 6: 运行测试，确认通过**

```bash
pytest apps/media/tests/test_api.py -v
```

期望：全部 PASS。

---

### Task 5: 运行完整测试套件并提交

- [ ] **Step 1: 运行完整测试**

```bash
pytest apps/media/ -v
```

期望：全部 PASS，无 warning 被提升为 error。

- [ ] **Step 2: 检查 lint**

```bash
ruff check apps/media/ config/api.py config/settings/_base.py
```

期望：无报错。

- [ ] **Step 3: 提交**

```bash
git add apps/media/ config/api.py config/settings/_base.py pyproject.toml
git commit -m "feat: 新增 OSS STS 临时凭证接口，支持前端直传文件到 OSS"
```

---

## 阿里云控制台配置（手动步骤）

实现完成后，还需要在阿里云控制台做以下配置才能真正生效：

1. **创建 RAM 角色** `oss-uploader`，信任实体选「阿里云账号」
2. **给角色附加权限**：自定义 Policy，允许 `oss:PutObject` 到 `linkcloud-space/*`
3. **创建 RAM 用户**，授予 `AliyunSTSAssumeRoleAccess` 权限
4. **生成 AccessKey**，填入 `.env` 的 `ALIYUN_STS_ACCESS_KEY_ID` / `ALIYUN_STS_ACCESS_KEY_SECRET`
5. **获取角色 ARN**（RAM 控制台 → 角色 → 点击角色名 → ARN），填入 `ALIYUN_STS_ROLE_ARN`
