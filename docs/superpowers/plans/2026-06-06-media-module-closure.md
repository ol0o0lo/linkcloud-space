# Media 模块闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `apps/media` 成为可供其他业务模块复用的媒体存储平台：业务统一保存 `JSON list[int]` 的 `media_id` 引用，平台负责上传登记、按列表顺序回显、延迟清理和接入协议。

**Architecture:** 保留现有 `MediaFile + services + ninja API` 骨架，移除与“多业务复用”冲突的全局 `order` 语义，把顺序完全交给业务侧 `media_ids` 列表。当前仓库还没有真实使用 `media_ids` 的业务模型，因此本轮计划先补平台侧闭环和清理保护，避免 `MEDIA_REFERENCE_PROVIDERS` 为空时误删媒体；首个业务接入时再按同一协议注册 provider。

**Tech Stack:** Django 5, django-ninja, pytest, model-bakery, Celery, S3/MinIO storage

---

## File Map

| 动作 | 文件 | 责任 |
|------|------|------|
| 修改 | `apps/media/models.py` | 移除 `MediaFile.order`，保留媒体本体字段 |
| 新建 | `apps/media/migrations/0004_remove_mediafile_order.py` | 删除数据库中的 `order` 字段 |
| 修改 | `apps/media/schemas.py` | 移除 API 输出中的 `order` 字段 |
| 修改 | `apps/media/services.py` | 删除 `set_media_order()`；新增 `validate_media_ids()`；让 `upload_and_register()` 支持 `user/org` 两种作用域；为 cleanup 增加 provider 保护 |
| 修改 | `apps/media/api.py` | 给 `/api/media/upload/` 增加 `scope` 入参并转发到服务层 |
| 修改 | `config/settings/_base.py` | 补充 `MEDIA_REFERENCE_PROVIDERS` 注释，明确 provider 协议 |
| 新建 | `docs/media-platform.md` | 沉淀业务接入协议和 provider 示例 |
| 修改 | `tests/media/test_media_file.py` | 覆盖顺序回显、`validate_media_ids()`、org scope 上传、cleanup 保护 |
| 修改 | `tests/media/test_api.py` | 覆盖 API 不再返回 `order`，以及 `/api/media/upload/` 的 org scope |
| 修改 | `tests/media/test_tasks.py` | 校验定时任务在无 provider 配置时安全返回 |

---

## Task 1: 移除 `MediaFile.order` 全局排序语义

**Files:**
- Modify: `apps/media/models.py`
- Create: `apps/media/migrations/0004_remove_mediafile_order.py`
- Modify: `apps/media/schemas.py`
- Modify: `apps/media/services.py`
- Modify: `tests/media/test_media_file.py`
- Modify: `tests/media/test_api.py`

- [ ] **Step 1: 先写失败测试，锁定“顺序只来自业务 list 顺序，不来自全局 order 字段”**

把 `tests/media/test_media_file.py` 中的 `TestMediaOrdering` 调整为以下内容，删除 `test_set_media_order_updates_order_by_input_position()`，保留并加强回显测试：

```python
# tests/media/test_media_file.py
@pytest.mark.django_db
class TestMediaListInfo:
    def test_get_media_list_info_preserves_requested_id_order(self):
        user = User.objects.create_user(username="viewer", password="secret")  # noqa: S106
        first = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/first.png",
            original_filename="first.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        second = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/second.png",
            original_filename="second.png",
            resource_type=ResourceType.AVATAR,
            file_size=200,
        )

        result = get_media_list_info([second.pk, first.pk])

        assert [item["id"] for item in result] == [second.pk, first.pk]
        assert result[0]["original"]["url"]
        assert result[0]["thumbnail"] is None
        assert result[0]["file_size"] == 200
        assert "order" not in result[0]
```

同时在 `tests/media/test_api.py` 的两个成功用例里补两条断言：

```python
# tests/media/test_api.py
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
    assert "order" not in data
    assert MediaFile.objects.filter(pk=data["id"]).exists()


def test_single_file_upload(self, mock_storage):
    mock_storage.save.return_value = "uploads/users/1/abc.png"
    file = SimpleUploadedFile("photo.png", b"fakecontent", content_type="image/png")
    resp = self.client.post(UPLOAD_URL, {"files": [file], "resource_type": "avatar"}, format="multipart")
    assert resp.status_code == 201
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["original_filename"] == "photo.png"
    assert "order" not in data[0]
```

- [ ] **Step 2: 跑测试，确认当前实现确实失败**

Run:

```bash
docker compose exec web pytest tests/media/test_media_file.py tests/media/test_api.py -v
```

Expected:

- `FAILED tests/media/test_media_file.py::TestMediaListInfo::test_get_media_list_info_preserves_requested_id_order`
- 失败信息包含 `assert 'order' not in result[0]`
- `FAILED tests/media/test_api.py::TestConfirmAPI::test_creates_media_file`
- 失败信息包含 `assert 'order' not in data`

- [ ] **Step 3: 写最小实现，彻底移除全局 order 语义**

更新模型、迁移、schema 和服务层：

```python
# apps/media/models.py
from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.media.constants import ResourceType


def _media_upload_to(instance, filename):
    return filename


class MediaFile(CreateUpdateTimeModelMixin):
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_files",
    )
    resource_type = models.CharField(max_length=32, choices=ResourceType.choices)
    original_filename = models.CharField(max_length=255)
    file = models.FileField(upload_to=_media_upload_to)
    file_size = models.PositiveIntegerField(help_text="bytes")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):  # noqa: D105
        return f"{self.resource_type}:{self.original_filename}"
```

```python
# apps/media/migrations/0004_remove_mediafile_order.py
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0003_add_updated_at"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="mediafile",
            name="order",
        ),
    ]
```

```python
# apps/media/schemas.py
class MediaFileOut(Schema):
    id: int
    resource_type: str
    original_filename: str
    url: str
    file_size: int
    created_at: datetime

    @staticmethod
    def resolve_url(obj):
        try:
            return obj.file.url
        except Exception:
            return obj.file.name or ""
```

```python
# apps/media/services.py
def get_media_file_info(media_file: MediaFile) -> dict:
    try:
        original_url = media_file.file.url
    except Exception:
        original_url = media_file.file.name or ""

    return {
        "id": media_file.pk,
        "resource_type": media_file.resource_type,
        "original_filename": media_file.original_filename,
        "original": {
            "url": original_url,
        },
        "thumbnail": None,
        "file_size": media_file.file_size,
        "created_at": media_file.created_at,
    }
```

并删除 `apps/media/services.py` 中整个 `set_media_order()` 函数。

- [ ] **Step 4: 重新运行测试，确认行为稳定**

Run:

```bash
docker compose exec web pytest tests/media/test_media_file.py tests/media/test_api.py -v
```

Expected:

- `PASSED tests/media/test_media_file.py::TestMediaListInfo::test_get_media_list_info_preserves_requested_id_order`
- `PASSED tests/media/test_api.py::TestConfirmAPI::test_creates_media_file`
- `PASSED tests/media/test_api.py::TestUploadAPI::test_single_file_upload`

- [ ] **Step 5: 提交这个可独立工作的改动**

```bash
git add apps/media/models.py apps/media/migrations/0004_remove_mediafile_order.py apps/media/schemas.py apps/media/services.py tests/media/test_media_file.py tests/media/test_api.py
git commit -m "refactor: 移除 media 全局排序字段"
```

---

## Task 2: 提供统一的 `media_ids` 校验入口给业务复用

**Files:**
- Modify: `apps/media/services.py`
- Modify: `tests/media/test_media_file.py`

- [ ] **Step 1: 先写失败测试，定义业务保存 `JSON list[int]` 时的统一校验契约**

在 `tests/media/test_media_file.py` 追加：

```python
# tests/media/test_media_file.py
from apps.media.services import validate_media_ids


@pytest.mark.django_db
class TestValidateMediaIds:
    def test_returns_ids_in_original_order(self):
        user = User.objects.create_user(username="validator", password="secret")  # noqa: S106
        first = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/first.png",
            original_filename="first.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        second = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/second.png",
            original_filename="second.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )

        assert validate_media_ids([second.pk, first.pk]) == [second.pk, first.pk]

    def test_returns_empty_list_for_empty_input(self):
        assert validate_media_ids([]) == []

    def test_raises_for_duplicate_ids(self):
        user = User.objects.create_user(username="validator_dup", password="secret")  # noqa: S106
        media = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/dup.png",
            original_filename="dup.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )

        with pytest.raises(ValueError, match="media_ids 不能包含重复 ID"):
            validate_media_ids([media.pk, media.pk])

    def test_raises_for_missing_ids(self):
        with pytest.raises(ValueError, match=r"媒体文件不存在: \[999999\]"):
            validate_media_ids([999999])
```

- [ ] **Step 2: 运行测试，确认接口尚不存在**

Run:

```bash
docker compose exec web pytest tests/media/test_media_file.py::TestValidateMediaIds -v
```

Expected:

- `FAILED`，报错包含 `cannot import name 'validate_media_ids'`

- [ ] **Step 3: 在服务层实现统一校验函数，并让 `get_media_list_info()` 复用它**

在 `apps/media/services.py` 增加以下实现：

```python
# apps/media/services.py
def validate_media_ids(media_ids: Iterable[int]) -> list[int]:
    """校验业务 JSON list[int] 中的媒体 ID，保持原顺序返回。"""
    ordered_ids = list(media_ids)
    if len(ordered_ids) != len(set(ordered_ids)):
        raise ValueError("media_ids 不能包含重复 ID")
    if not ordered_ids:
        return []

    media_by_id = MediaFile.objects.in_bulk(ordered_ids)
    missing_ids = [media_id for media_id in ordered_ids if media_id not in media_by_id]
    if missing_ids:
        raise ValueError(f"媒体文件不存在: {missing_ids}")
    return ordered_ids


def get_media_list_info(media_ids: Iterable[int]) -> list[dict]:
    """按传入 ID 顺序返回媒体信息，适合业务方保存的 list[id] 回显。"""
    ordered_ids = validate_media_ids(media_ids)
    if not ordered_ids:
        return []

    media_by_id = MediaFile.objects.in_bulk(ordered_ids)
    return [get_media_file_info(media_by_id[media_id]) for media_id in ordered_ids]
```

- [ ] **Step 4: 重新运行测试，确认业务可直接复用该入口**

Run:

```bash
docker compose exec web pytest tests/media/test_media_file.py::TestValidateMediaIds tests/media/test_media_file.py::TestMediaListInfo -v
```

Expected:

- `PASSED tests/media/test_media_file.py::TestValidateMediaIds::test_returns_ids_in_original_order`
- `PASSED tests/media/test_media_file.py::TestValidateMediaIds::test_returns_empty_list_for_empty_input`
- `PASSED tests/media/test_media_file.py::TestValidateMediaIds::test_raises_for_duplicate_ids`
- `PASSED tests/media/test_media_file.py::TestValidateMediaIds::test_raises_for_missing_ids`

- [ ] **Step 5: 提交统一校验能力**

```bash
git add apps/media/services.py tests/media/test_media_file.py
git commit -m "feat: 新增 media_ids 校验服务"
```

---

## Task 3: 让服务端上传支持 `user/org` 两种作用域

**Files:**
- Modify: `apps/media/services.py`
- Modify: `apps/media/api.py`
- Modify: `tests/media/test_media_file.py`
- Modify: `tests/media/test_api.py`

- [ ] **Step 1: 先写失败测试，锁定 org scope 的服务层和 API 行为**

在 `tests/media/test_media_file.py` 的 `TestUploadAndRegister` 里追加一个服务层测试：

```python
# tests/media/test_media_file.py
from apps.media.constants import MediaScope
from apps.organizations.models import Organization


@patch("apps.media.services.default_storage")
def test_uploads_to_org_scope(self, mock_storage):
    mock_storage.save.return_value = "uploads/orgs/9/abc.png"
    user = User.objects.create_user(username="org_uploader", password="secret")  # noqa: S106
    org = Organization.objects.create(name="Example Org", slug="example-org")

    fake_file = MagicMock()
    fake_file.name = "logo.png"
    fake_file.size = 2048

    mf = upload_and_register(
        uploader=user,
        file=fake_file,
        resource_type=ResourceType.ORG_LOGO,
        scope=MediaScope.ORG,
        object_id=org.pk,
    )

    assert mf.pk is not None
    assert mf.resource_type == ResourceType.ORG_LOGO
    saved_path = mock_storage.save.call_args[0][0]
    assert saved_path.startswith(f"uploads/orgs/{org.pk}/")
```

在 `tests/media/test_api.py` 追加一个帮助函数和两个 API 测试：

```python
# tests/media/test_api.py
import json

from apps.organizations.models import Organization, OrganizationMember


def set_session_org(client, org, is_owner=False):
    session = client.session
    session["organization_data"] = json.dumps(
        {"pk": org.pk, "id": org.pk, "name": org.name, "slug": org.slug, "is_owner": is_owner}
    )
    session.save()


def test_org_scope_requires_active_org(self):
    file = SimpleUploadedFile("logo.png", b"fakecontent", content_type="image/png")
    resp = self.client.post(UPLOAD_URL, {"files": [file], "resource_type": "org_logo", "scope": "org"}, format="multipart")
    assert resp.status_code == 403


@patch("apps.media.services.default_storage")
def test_org_scope_uploads_into_org_prefix(self, mock_storage):
    mock_storage.save.return_value = "uploads/orgs/5/logo.png"
    org = Organization.objects.create(name="Org A", slug="org-a")
    OrganizationMember.objects.create(organization=org, user=self.user, is_owner=True)
    set_session_org(self.client, org, is_owner=True)

    file = SimpleUploadedFile("logo.png", b"fakecontent", content_type="image/png")
    resp = self.client.post(
        UPLOAD_URL,
        {"files": [file], "resource_type": "org_logo", "scope": "org"},
        format="multipart",
    )

    assert resp.status_code == 201
    saved_path = mock_storage.save.call_args[0][0]
    assert saved_path.startswith(f"uploads/orgs/{org.pk}/")
```

- [ ] **Step 2: 运行测试，确认当前上传逻辑还不支持 org scope**

Run:

```bash
docker compose exec web pytest tests/media/test_media_file.py::TestUploadAndRegister tests/media/test_api.py::TestUploadAPI -v
```

Expected:

- `FAILED tests/media/test_media_file.py::TestUploadAndRegister::test_uploads_to_org_scope`
- 报错包含 `upload_and_register() got an unexpected keyword argument 'scope'`
- `FAILED tests/media/test_api.py::TestUploadAPI::test_org_scope_uploads_into_org_prefix`

- [ ] **Step 3: 最小实现 org scope 支持，并把 API 参数传到服务层**

更新服务层和 API：

```python
# apps/media/services.py
def upload_and_register(
    *,
    uploader,
    file,
    resource_type: str,
    scope: str = MediaScope.USER,
    object_id: int | None = None,
) -> MediaFile:
    """将文件上传到默认存储后端（OSS），并登记 MediaFile 记录。"""
    if scope == MediaScope.USER:
        target_object_id = uploader.pk
    else:
        target_object_id = object_id

    if target_object_id is None:
        raise ValueError("scope=org 时必须提供 object_id")

    oss_path = generate_upload_path(
        scope=scope,
        object_id=target_object_id,
        filename=file.name,
    )
    saved_path = default_storage.save(oss_path, file)
    return register_media_file(
        uploader=uploader,
        oss_path=saved_path,
        original_filename=file.name,
        resource_type=resource_type,
        file_size=file.size,
    )
```

```python
# apps/media/api.py
@router.post("/upload/", response={201: list[MediaFileOut]}, summary="服务端上传文件")
def upload_files(
    request,
    files: list[UploadedFile] = File(..., description="要上传的文件列表。"),
    resource_type: str = Form(..., description="资源类型，例如 avatar、org_logo。"),
    scope: str = Form(MediaScope.USER, description="上传作用域，user 或 org。"),
):
    """通过服务端接收文件并上传存储，同时登记媒体文件记录。"""
    if resource_type not in ResourceType.values:
        raise HttpError(422, f"无效的 resource_type: {resource_type}")
    if scope not in MediaScope.values:
        raise HttpError(422, f"无效的 scope: {scope}")

    object_id = request.user.pk
    if scope == MediaScope.ORG:
        org = require_org_selected(request)
        object_id = org.pk

    results = []
    for f in files:
        mf = upload_and_register(
            uploader=request.user,
            file=f,
            resource_type=resource_type,
            scope=scope,
            object_id=object_id,
        )
        results.append(mf)
    return Status(201, results)
```

- [ ] **Step 4: 重新运行测试，确认 user/org 双作用域都可用**

Run:

```bash
docker compose exec web pytest tests/media/test_media_file.py::TestUploadAndRegister tests/media/test_api.py::TestUploadAPI -v
```

Expected:

- `PASSED tests/media/test_media_file.py::TestUploadAndRegister::test_uploads_and_creates_record`
- `PASSED tests/media/test_media_file.py::TestUploadAndRegister::test_uploads_to_org_scope`
- `PASSED tests/media/test_api.py::TestUploadAPI::test_single_file_upload`
- `PASSED tests/media/test_api.py::TestUploadAPI::test_org_scope_uploads_into_org_prefix`

- [ ] **Step 5: 提交作用域扩展**

```bash
git add apps/media/services.py apps/media/api.py tests/media/test_media_file.py tests/media/test_api.py
git commit -m "feat: 扩展 media 上传作用域"
```

---

## Task 4: 为 cleanup 增加 provider 安全保护，并沉淀业务接入协议

**Files:**
- Modify: `apps/media/services.py`
- Modify: `config/settings/_base.py`
- Create: `docs/media-platform.md`
- Modify: `tests/media/test_media_file.py`
- Modify: `tests/media/test_tasks.py`

- [ ] **Step 1: 先写失败测试，覆盖“无 provider 时不应删除历史媒体”**

在 `tests/media/test_media_file.py` 顶部增加一个供 import-string 测试使用的 provider：

```python
# tests/media/test_media_file.py
def fake_media_provider():
    return [101, 102, None]
```

并在文件末尾追加两个测试：

```python
# tests/media/test_media_file.py
from django.test import override_settings

from apps.media.services import CleanupResult, collect_referenced_media_ids


@override_settings(MEDIA_REFERENCE_PROVIDERS=["tests.media.test_media_file.fake_media_provider"])
def test_collect_referenced_media_ids_supports_import_string():
    assert collect_referenced_media_ids() == {101, 102}


@pytest.mark.django_db
@override_settings(MEDIA_REFERENCE_PROVIDERS=[])
def test_cleanup_is_noop_when_no_providers_configured():
    user = User.objects.create_user(username="cleanup_guard", password="secret")  # noqa: S106
    orphan = register_media_file(
        uploader=user,
        oss_path="uploads/users/1/orphan.png",
        original_filename="orphan.png",
        resource_type=ResourceType.AVATAR,
        file_size=100,
    )
    MediaFile.objects.filter(pk=orphan.pk).update(created_at=timezone.now() - timedelta(days=2))

    result = cleanup_unreferenced_media(older_than=timedelta(days=1))

    assert result == CleanupResult(deleted_count=0, deleted_ids=[])
    assert MediaFile.objects.filter(pk=orphan.pk).exists()
```

再在 `tests/media/test_tasks.py` 增加一个定时任务测试：

```python
# tests/media/test_tasks.py
from django.test import override_settings


@override_settings(MEDIA_REFERENCE_PROVIDERS=[])
def test_cleanup_task_returns_zero_when_no_provider_configured():
    assert cleanup_unreferenced_media_files() == 0
```

- [ ] **Step 2: 运行测试，确认现在会误删旧媒体**

Run:

```bash
docker compose exec web pytest tests/media/test_media_file.py::test_collect_referenced_media_ids_supports_import_string tests/media/test_media_file.py::test_cleanup_is_noop_when_no_providers_configured tests/media/test_tasks.py::test_cleanup_task_returns_zero_when_no_provider_configured -v
```

Expected:

- `PASSED tests/media/test_media_file.py::test_collect_referenced_media_ids_supports_import_string`
- `FAILED tests/media/test_media_file.py::test_cleanup_is_noop_when_no_providers_configured`
- 失败信息包含 `assert CleanupResult(deleted_count=1` 或 `assert not MediaFile.objects.filter(...).exists()`

- [ ] **Step 3: 实现 provider 保护，并把接入协议写进仓库文档**

更新服务层和配置注释：

```python
# apps/media/services.py
def cleanup_unreferenced_media(
    *,
    referenced_media_ids: Iterable[int] | None = None,
    older_than=DEFAULT_ORPHAN_RETENTION,
) -> CleanupResult:
    """删除超过保留窗口且没有被业务引用的媒体记录和物理文件。"""
    if referenced_media_ids is not None:
        referenced_ids = set(referenced_media_ids)
    else:
        providers = list(getattr(settings, "MEDIA_REFERENCE_PROVIDERS", []))
        if not providers:
            return CleanupResult(deleted_count=0, deleted_ids=[])
        referenced_ids = collect_referenced_media_ids(providers)

    cutoff = timezone.now() - older_than
    candidates = MediaFile.objects.filter(created_at__lt=cutoff).exclude(pk__in=referenced_ids).order_by("pk")

    deleted_ids = []
    for media_file in candidates:
        deleted_ids.append(media_file.pk)
        if media_file.file:
            media_file.file.delete(save=False)
        media_file.delete()
    return CleanupResult(deleted_count=len(deleted_ids), deleted_ids=deleted_ids)
```

```python
# config/settings/_base.py
# Media files that are not reported by MEDIA_REFERENCE_PROVIDERS are treated as
# orphan candidates only after this retention window.
MEDIA_ORPHAN_RETENTION_HOURS = env.int("MEDIA_ORPHAN_RETENTION_HOURS", default=24)

# Register one function path per business module that stores JSON list[int]
# media references. Each provider must return the MediaFile IDs that are still
# referenced by active business records. Keep this list empty until the first
# business consumer is actually wired; cleanup will safely no-op in that case.
MEDIA_REFERENCE_PROVIDERS: list[str] = []
```

新建一份长期可读的接入文档：

````markdown
# docs/media-platform.md

# Media 平台接入说明

## 业务字段约定

- 业务模型使用 `JSON list[int]` 保存媒体引用
- 列表顺序就是展示顺序
- 不允许重复 ID
- 删除某个 ID 只表示解除业务引用，不立即删除媒体文件

## 服务层约定

- 保存前调用 `validate_media_ids(media_ids)` 做存在性和重复校验
- 回显时调用 `get_media_list_info(media_ids)`，平台按输入顺序返回完整信息
- 业务自己负责权限校验

## Provider 约定

每个使用 `media_ids` 的业务模块都必须提供一个 provider，并把函数路径注册到 `MEDIA_REFERENCE_PROVIDERS`。

```python
# apps/example/media_references.py
from apps.example.models import ExampleThing


def collect_example_media_ids():
    media_ids = set()
    for row in ExampleThing.objects.values_list("media_ids", flat=True):
        if not row:
            continue
        media_ids.update(int(media_id) for media_id in row if media_id)
    return media_ids
```

```python
# config/settings/_base.py
MEDIA_REFERENCE_PROVIDERS = [
    "apps.example.media_references.collect_example_media_ids",
]
```

## 清理策略

- 当 `MEDIA_REFERENCE_PROVIDERS` 为空时，媒体清理任务安全 no-op
- 当 provider 已接入后，只清理超过保留期且没有任何业务引用的媒体
````

- [ ] **Step 4: 重新运行测试，确认 cleanup 在“未接入业务前”是安全的**

Run:

```bash
docker compose exec web pytest tests/media/test_media_file.py::test_collect_referenced_media_ids_supports_import_string tests/media/test_media_file.py::test_cleanup_is_noop_when_no_providers_configured tests/media/test_tasks.py::test_cleanup_task_returns_zero_when_no_provider_configured -v
```

Expected:

- 三条测试都 `PASSED`

- [ ] **Step 5: 提交 provider 协议和 cleanup 保护**

```bash
git add apps/media/services.py config/settings/_base.py docs/media-platform.md tests/media/test_media_file.py tests/media/test_tasks.py
git commit -m "refactor: 为 media 清理增加 provider 保护"
```

---

## Task 5: 运行回归测试，确认平台闭环成立

**Files:**
- Modify: none
- Test: `tests/media/test_media_file.py`
- Test: `tests/media/test_api.py`
- Test: `tests/media/test_tasks.py`

- [ ] **Step 1: 运行 media 单测全量回归**

Run:

```bash
docker compose exec web pytest tests/media -v
```

Expected:

- `tests/media/test_api.py` 全部通过
- `tests/media/test_media_file.py` 全部通过
- `tests/media/test_tasks.py` 全部通过
- `tests/media/test_sts.py` 全部通过

- [ ] **Step 2: 运行 Django migration 一致性检查**

Run:

```bash
docker compose exec web python manage.py makemigrations --check
```

Expected:

- 输出 `No changes detected`

- [ ] **Step 3: 运行 media 相关 lint 目标（最小范围）**

Run:

```bash
docker compose exec web ruff check apps/media tests/media config/settings/_base.py
```

Expected:

- 输出 `All checks passed!`

- [ ] **Step 4: 运行 Django 系统检查，确认改动没有引入额外配置问题**

Run:

```bash
docker compose exec web python manage.py check
```

Expected:

- 输出 `System check identified no issues` 或等价成功信息

- [ ] **Step 5: 确认工作区干净，可以直接交付**

```bash
git status --short
```

Expected:

- 没有未提交改动

---

## Self-Review

- **Spec coverage:** 已覆盖移除全局 `order`、统一 `media_ids` 校验、`list[id]` 顺序回显、org scope 上传、provider 协议和 cleanup 保护。
- **Placeholder scan:** 未发现占位描述；每个代码步骤都给出具体代码或文档内容。
- **Type consistency:** 统一使用 `validate_media_ids()`、`get_media_list_info()`、`upload_and_register(..., scope, object_id)` 这组接口名，没有前后不一致的命名。
