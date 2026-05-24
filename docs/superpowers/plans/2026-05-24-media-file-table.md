# MediaFile 统一文件表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `MediaFile` 模型统一管理媒体资产，支持前端直传后回调登记和后端多文件上传两种路径。

**Architecture:** `MediaFile` 模型用 `FileField(storage=S3MediaStorage)` 存储路径，`.url` 自动处理签名。服务层 `register_media_file()` 是唯一写入入口，被 `confirm` 和 `upload` 两个 API 端点及其他业务调用。`ResourceType` 枚举定义合法的业务来源，扩展时只改枚举。

**Tech Stack:** Django 5, django-ninja, django-storages (S3Boto3 / S3MediaStorage), pytest, factory_boy

---

## File Map

| 动作 | 文件 |
|------|------|
| 新建 | `apps/media/models.py` |
| 修改 | `apps/media/constants.py` — 新增 `ResourceType` |
| 修改 | `apps/media/services.py` — 新增 `register_media_file`, `upload_and_register` |
| 修改 | `apps/media/schemas.py` — 新增 `MediaFileConfirmIn`, `MediaFileOut` |
| 修改 | `apps/media/api.py` — 新增 `confirm` 和 `upload` 端点 |
| 新建 | `apps/media/tests/test_media_file.py` |
| 修改 | `apps/media/tests/test_api.py` — 新增两个端点的测试 |

---

## Task 1: 新增 `ResourceType` 枚举到 constants.py

**Files:**
- Modify: `apps/media/constants.py`

- [ ] **Step 1: 修改 constants.py，追加 ResourceType**

```python
# apps/media/constants.py
from django.utils.translation import gettext_lazy as _

from apps.base.enums import StrChoices


class MediaScope(StrChoices):
    USER = "user", _("用户")
    ORG = "org", _("组织")


class MediaExtension(StrChoices):
    JPG = "jpg", "JPG"
    JPEG = "jpeg", "JPEG"
    PNG = "png", "PNG"
    WEBP = "webp", "WebP"


class ResourceType(StrChoices):
    AVATAR = "avatar", _("用户头像")
    ORG_LOGO = "org_logo", _("组织 Logo")
```

- [ ] **Step 2: 确认无语法错误**

```bash
docker compose exec web python -c "from apps.media.constants import ResourceType; print(ResourceType.values)"
```

期望输出：`['avatar', 'org_logo']`

- [ ] **Step 3: commit**

```bash
git add apps/media/constants.py
git commit -m "feat(media): 新增 ResourceType 枚举"
```

---

## Task 2: 新建 MediaFile 模型

**Files:**
- Create: `apps/media/models.py`
- Modify: `apps/media/apps.py` — 确认 default_auto_field

- [ ] **Step 1: 创建 models.py**

```python
# apps/media/models.py
from django.conf import settings
from django.db import models

from apps.base.storage import S3MediaStorage
from apps.media.constants import ResourceType


def _media_upload_to(instance, filename):
    return filename  # 路径由调用方（服务层）预先生成后通过 File(name=path) 传入


class MediaFile(models.Model):
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_files",
    )
    resource_type = models.CharField(max_length=32, choices=ResourceType.choices)
    original_filename = models.CharField(max_length=255)
    file = models.FileField(storage=S3MediaStorage(), upload_to=_media_upload_to)
    file_size = models.PositiveIntegerField(help_text="bytes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.resource_type}:{self.original_filename}"
```

- [ ] **Step 2: 生成 migration**

```bash
docker compose exec web python manage.py makemigrations media
```

期望输出：`Migrations for 'media': apps/media/migrations/XXXX_add_mediafile.py`

- [ ] **Step 3: 执行 migration**

```bash
docker compose exec web python manage.py migrate media
```

- [ ] **Step 4: commit**

```bash
git add apps/media/models.py apps/media/migrations/
git commit -m "feat(media): 新增 MediaFile 模型及 migration"
```

---

## Task 3: 服务层 `register_media_file`

**Files:**
- Modify: `apps/media/services.py`
- Create: `apps/media/tests/test_media_file.py`

- [ ] **Step 1: 写失败测试**

```python
# apps/media/tests/test_media_file.py
import pytest
from django.core.files.base import ContentFile

from apps.accounts.models import User
from apps.media.constants import ResourceType
from apps.media.models import MediaFile
from apps.media.services import register_media_file


@pytest.mark.django_db
class TestRegisterMediaFile:
    def test_creates_record(self):
        user = User.objects.create_user(username="tester", password="secret")  # noqa: S106
        mf = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/abc.png",
            original_filename="photo.png",
            resource_type=ResourceType.AVATAR,
            file_size=1024,
        )
        assert mf.pk is not None
        assert mf.original_filename == "photo.png"
        assert mf.resource_type == ResourceType.AVATAR
        assert mf.file_size == 1024
        assert mf.uploader == user

    def test_file_name_is_oss_path(self):
        user = User.objects.create_user(username="tester2", password="secret")  # noqa: S106
        mf = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/abc.png",
            original_filename="photo.png",
            resource_type=ResourceType.AVATAR,
            file_size=1024,
        )
        assert mf.file.name == "uploads/users/1/abc.png"
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
docker compose exec web pytest apps/media/tests/test_media_file.py -v
```

期望：`FAILED` — `ImportError: cannot import name 'register_media_file'`

- [ ] **Step 3: 在 services.py 追加实现**

在文件末尾追加：

```python
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

from apps.media.models import MediaFile

User = get_user_model()


def register_media_file(
    *,
    uploader: User,
    oss_path: str,
    original_filename: str,
    resource_type: str,
    file_size: int,
) -> MediaFile:
    """将已存在于 OSS 的文件路径登记为 MediaFile 记录。"""
    mf = MediaFile(
        uploader=uploader,
        resource_type=resource_type,
        original_filename=original_filename,
        file_size=file_size,
    )
    # 用空内容占位，name 指向已存在的 OSS 路径，不触发实际上传
    mf.file.save(oss_path, ContentFile(b""), save=False)
    mf.save()
    return mf
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/media/tests/test_media_file.py -v
```

期望：`PASSED`

- [ ] **Step 5: commit**

```bash
git add apps/media/services.py apps/media/tests/test_media_file.py
git commit -m "feat(media): 新增 register_media_file 服务层"
```

---

## Task 4: 服务层 `upload_and_register`（后端上传）

**Files:**
- Modify: `apps/media/services.py`
- Modify: `apps/media/tests/test_media_file.py`

- [ ] **Step 1: 写失败测试**

在 `test_media_file.py` 末尾追加：

```python
from unittest.mock import MagicMock, patch

from apps.media.services import upload_and_register


@pytest.mark.django_db
class TestUploadAndRegister:
    @patch("apps.media.services.default_storage")
    def test_uploads_and_creates_record(self, mock_storage):
        mock_storage.save.return_value = "uploads/users/1/abc.png"
        user = User.objects.create_user(username="uploader", password="secret")  # noqa: S106

        fake_file = MagicMock()
        fake_file.name = "photo.png"
        fake_file.size = 2048

        mf = upload_and_register(
            uploader=user,
            file=fake_file,
            resource_type=ResourceType.AVATAR,
        )
        assert mf.pk is not None
        assert mf.original_filename == "photo.png"
        assert mf.file_size == 2048
        mock_storage.save.assert_called_once()
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
docker compose exec web pytest apps/media/tests/test_media_file.py::TestUploadAndRegister -v
```

期望：`FAILED` — `ImportError`

- [ ] **Step 3: 在 services.py 追加实现**

```python
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import UploadedFile


def upload_and_register(
    *,
    uploader,
    file: UploadedFile,
    resource_type: str,
) -> MediaFile:
    """将文件上传到 OSS（使用默认存储后端），并登记 MediaFile 记录。"""
    parts = file.name.rsplit(".", 1)
    ext = parts[1].lower() if len(parts) == 2 else ""
    uid = uuid4().hex
    oss_path = f"uploads/users/{uploader.pk}/{uid}.{ext}" if ext else f"uploads/users/{uploader.pk}/{uid}"

    saved_path = default_storage.save(oss_path, file)
    return register_media_file(
        uploader=uploader,
        oss_path=saved_path,
        original_filename=file.name,
        resource_type=resource_type,
        file_size=file.size,
    )
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/media/tests/test_media_file.py -v
```

期望：全部 `PASSED`

- [ ] **Step 5: commit**

```bash
git add apps/media/services.py apps/media/tests/test_media_file.py
git commit -m "feat(media): 新增 upload_and_register 服务层"
```

---

## Task 5: Schema 新增 MediaFileOut 和 MediaFileConfirmIn

**Files:**
- Modify: `apps/media/schemas.py`

- [ ] **Step 1: 修改 schemas.py**

```python
# apps/media/schemas.py
from datetime import datetime
from typing import Literal

from ninja import Schema


class OssTokenIn(Schema):
    scope: Literal["user", "org"]
    filename: str


class OssTokenOut(Schema):
    access_key_id: str
    access_key_secret: str
    security_token: str
    endpoint: str
    bucket: str
    path: str
    expires_at: str


class MediaFileOut(Schema):
    id: int
    resource_type: str
    original_filename: str
    url: str
    file_size: int
    created_at: datetime

    @staticmethod
    def resolve_url(obj):
        return obj.file.url


class MediaFileConfirmIn(Schema):
    oss_path: str
    original_filename: str
    resource_type: str
    file_size: int
```

- [ ] **Step 2: 确认无语法错误**

```bash
docker compose exec web python -c "from apps.media.schemas import MediaFileOut, MediaFileConfirmIn; print('OK')"
```

期望：`OK`

- [ ] **Step 3: commit**

```bash
git add apps/media/schemas.py
git commit -m "feat(media): 新增 MediaFileOut 和 MediaFileConfirmIn schema"
```

---

## Task 6: API — confirm 端点

**Files:**
- Modify: `apps/media/api.py`
- Modify: `apps/media/tests/test_api.py`

- [ ] **Step 1: 写失败测试**

在 `test_api.py` 末尾追加：

```python
from apps.media.constants import ResourceType
from apps.media.models import MediaFile

CONFIRM_URL = "/api/media/confirm/"


@pytest.mark.django_db
class TestConfirmAPI:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client
        self.user = User.objects.create_user(username="confirmer", password="secret")  # noqa: S106
        self.client.force_login(self.user)

    def test_requires_login(self, client):
        resp = client.post(CONFIRM_URL, {"oss_path": "x", "original_filename": "x.png", "resource_type": "avatar", "file_size": 100}, content_type="application/json")
        assert resp.status_code == 401

    def test_creates_media_file(self):
        payload = {
            "oss_path": "uploads/users/1/abc.png",
            "original_filename": "photo.png",
            "resource_type": "avatar",
            "file_size": 1024,
        }
        resp = self.client.post(CONFIRM_URL, payload, content_type="application/json")
        assert resp.status_code == 201
        data = resp.json()
        assert data["original_filename"] == "photo.png"
        assert data["resource_type"] == "avatar"
        assert "url" in data
        assert MediaFile.objects.filter(pk=data["id"]).exists()

    def test_invalid_resource_type_returns_422(self):
        payload = {
            "oss_path": "uploads/users/1/abc.png",
            "original_filename": "photo.png",
            "resource_type": "nonexistent",
            "file_size": 1024,
        }
        resp = self.client.post(CONFIRM_URL, payload, content_type="application/json")
        assert resp.status_code == 422
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
docker compose exec web pytest apps/media/tests/test_api.py::TestConfirmAPI -v
```

期望：`FAILED` — 404

- [ ] **Step 3: 在 api.py 追加 confirm 端点**

```python
# apps/media/api.py 末尾追加
from apps.media.constants import ResourceType
from apps.media.models import MediaFile
from apps.media.schemas import MediaFileConfirmIn, MediaFileOut
from apps.media.services import register_media_file


@router.post("/confirm/", response={201: MediaFileOut})
def confirm_upload(request, payload: MediaFileConfirmIn):
    if payload.resource_type not in ResourceType.values:
        from ninja.errors import HttpError
        raise HttpError(422, f"无效的 resource_type: {payload.resource_type}")
    mf = register_media_file(
        uploader=request.user,
        oss_path=payload.oss_path,
        original_filename=payload.original_filename,
        resource_type=payload.resource_type,
        file_size=payload.file_size,
    )
    return 201, mf
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/media/tests/test_api.py::TestConfirmAPI -v
```

期望：全部 `PASSED`

- [ ] **Step 5: commit**

```bash
git add apps/media/api.py apps/media/tests/test_api.py
git commit -m "feat(media): 新增 confirm 端点"
```

---

## Task 7: API — upload 端点（多文件）

**Files:**
- Modify: `apps/media/api.py`
- Modify: `apps/media/tests/test_api.py`

- [ ] **Step 1: 写失败测试**

在 `test_api.py` 末尾追加：

```python
from io import BytesIO
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch

UPLOAD_URL = "/api/media/upload/"


@pytest.mark.django_db
class TestUploadAPI:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client
        self.user = User.objects.create_user(username="uploader_api", password="secret")  # noqa: S106
        self.client.force_login(self.user)

    def test_requires_login(self, client):
        resp = client.post(UPLOAD_URL, {})
        assert resp.status_code == 401

    @patch("apps.media.services.default_storage")
    def test_single_file_upload(self, mock_storage):
        mock_storage.save.return_value = "uploads/users/1/abc.png"
        file = SimpleUploadedFile("photo.png", b"fakecontent", content_type="image/png")
        resp = self.client.post(UPLOAD_URL, {"files": [file], "resource_type": "avatar"}, format="multipart")
        assert resp.status_code == 201
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["original_filename"] == "photo.png"

    @patch("apps.media.services.default_storage")
    def test_multiple_files_upload(self, mock_storage):
        mock_storage.save.side_effect = ["uploads/users/1/a.png", "uploads/users/1/b.png"]
        f1 = SimpleUploadedFile("a.png", b"content1", content_type="image/png")
        f2 = SimpleUploadedFile("b.png", b"content2", content_type="image/png")
        resp = self.client.post(UPLOAD_URL, {"files": [f1, f2], "resource_type": "avatar"}, format="multipart")
        assert resp.status_code == 201
        assert len(resp.json()) == 2

    def test_invalid_resource_type_returns_422(self):
        file = SimpleUploadedFile("photo.png", b"fakecontent", content_type="image/png")
        resp = self.client.post(UPLOAD_URL, {"files": [file], "resource_type": "bad_type"}, format="multipart")
        assert resp.status_code == 422
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
docker compose exec web pytest apps/media/tests/test_api.py::TestUploadAPI -v
```

期望：`FAILED` — 404

- [ ] **Step 3: 在 api.py 追加 upload 端点**

```python
# apps/media/api.py 末尾追加
from typing import List
from ninja import File
from ninja.files import UploadedFile
from apps.media.services import upload_and_register


@router.post("/upload/", response={201: List[MediaFileOut]})
def upload_files(request, files: List[UploadedFile] = File(...), resource_type: str = Form(...)):
    from ninja.errors import HttpError
    if resource_type not in ResourceType.values:
        raise HttpError(422, f"无效的 resource_type: {resource_type}")
    results = []
    for f in files:
        mf = upload_and_register(
            uploader=request.user,
            file=f,
            resource_type=resource_type,
        )
        results.append(mf)
    return 201, results
```

同时在文件顶部 import 中补充 `Form`：

```python
from ninja import File, Form, Query, Router
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
docker compose exec web pytest apps/media/tests/test_api.py::TestUploadAPI -v
```

期望：全部 `PASSED`

- [ ] **Step 5: 全量测试**

```bash
docker compose exec web pytest apps/media/ -v
```

期望：全部 `PASSED`

- [ ] **Step 6: commit**

```bash
git add apps/media/api.py apps/media/tests/test_api.py
git commit -m "feat(media): 新增多文件 upload 端点"
```

---

## Task 8: 收尾验证

- [ ] **Step 1: 运行全量测试**

```bash
docker compose exec web pytest --tb=short
```

期望：全部 `PASSED`，无新增失败

- [ ] **Step 2: lint 检查**

```bash
docker compose exec web ruff check apps/media/
```

期望：无错误

- [ ] **Step 3: 最终 commit（如有遗漏文件）**

```bash
git status
# 确认无未提交文件
```
