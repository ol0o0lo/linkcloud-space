# Account Avatar MediaRefs Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把账户头像从 `User` 专用文件字段一步替换为 `MediaFile + MediaRefsField`，移除裁剪与缩略图专用逻辑，同时保持现有调用方继续消费 `avatar_url`。

**Architecture:** 以 `User.avatar` 单元素 `MediaRefsField` 作为头像唯一事实来源，上传与删除统一走 `apps.media.services`，历史数据通过 migration 直接转成 `MediaFile` 记录和头像引用。接口层保持 `/api/users/me/avatar/` 路径不变，但删除 `crop_data` 输入；展示层继续只依赖 `avatar_url`。

**Tech Stack:** Django 5, django-ninja, pytest, model-bakery, Django migrations, pnpm OpenAPI client

---

## File Map

| 动作 | 文件 | 责任 |
|------|------|------|
| 修改 | `apps/accounts/models.py` | 删除旧头像字段，新增 `avatar` 引用字段，重写 `avatar_url` |
| 修改 | `apps/accounts/services.py` | 删除专用裁剪逻辑，新增头像引用读写与旧媒体回收 |
| 修改 | `apps/accounts/api.py` | 调整头像上传/删除接口契约与调用 |
| 修改 | `apps/accounts/schemas.py` | 如有必要，更新头像接口说明 |
| 新建 | `apps/accounts/migrations/0014_user_avatar_media_refs.py` | 迁移旧头像数据到 `MediaFile + User.avatar` |
| 修改 | `tests/accounts/test_avatar_api.py` | 覆盖新头像模型、替换、删除行为 |
| 修改 | `frontend_admin/src/pages/account/settings/service.ts` | 去掉 `crop_data` 调用 |
| 可选修改 | `frontend_admin/src/services/openapi/userAccount.ts` | 重新生成后的客户端签名变化 |
| 可选修改 | `frontend_admin/src/pages/account/settings/service.test.ts` | 如果已有头像上传调用测试，则同步更新 |

---

### Task 1: 先用测试锁定新的头像数据模型与 API 行为

**Files:**
- Modify: `tests/accounts/test_avatar_api.py`

- [ ] **Step 1: Write the failing tests**

把 `tests/accounts/test_avatar_api.py` 改成围绕 `MediaFile + User.avatar` 断言，而不是旧的 `avatar_thumbnail/avatar_original`：

```python
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from PIL import Image

from apps.accounts.models import User
from apps.media.models import MediaFile
from tests.api_helpers import api_data

URL = "/api/users/me/avatar/"


def _make_png_bytes(size=(512, 512), color="red"):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


class TestAvatarAPI(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="user",
            email="user@example.com",
            password="secret",  # noqa: S106
        )

    def test_upload_avatar_persists_media_ref_and_returns_avatar_url(self):
        self.client.force_login(self.user)
        upload = SimpleUploadedFile("avatar.png", _make_png_bytes(), content_type="image/png")

        resp = self.client.post(URL, {"image": upload})

        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertIn("avatar_url", data)
        self.user.refresh_from_db()
        self.assertEqual(len(self.user.avatar), 1)
        self.assertEqual(self.user.avatar[0]["media_type"], "image")
        media = MediaFile.objects.get(pk=self.user.avatar[0]["media_id"])
        self.assertEqual(media.resource_type, "avatar")
        self.assertEqual(self.user.avatar_url, data["avatar_url"])

    def test_reupload_avatar_replaces_ref_and_deletes_old_media(self):
        self.client.force_login(self.user)
        first = SimpleUploadedFile("first.png", _make_png_bytes(color="red"), content_type="image/png")
        second = SimpleUploadedFile("second.png", _make_png_bytes(color="blue"), content_type="image/png")

        self.client.post(URL, {"image": first})
        self.user.refresh_from_db()
        first_media_id = self.user.avatar[0]["media_id"]

        resp = self.client.post(URL, {"image": second})

        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(len(self.user.avatar), 1)
        self.assertNotEqual(self.user.avatar[0]["media_id"], first_media_id)
        self.assertFalse(MediaFile.objects.filter(pk=first_media_id).exists())

    def test_delete_avatar_clears_ref_and_deletes_media(self):
        self.client.force_login(self.user)
        upload = SimpleUploadedFile("avatar.png", _make_png_bytes(), content_type="image/png")
        self.client.post(URL, {"image": upload})
        self.user.refresh_from_db()
        media_id = self.user.avatar[0]["media_id"]

        resp = self.client.delete(URL)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp), {})
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar, [])
        self.assertIsNone(self.user.avatar_url)
        self.assertFalse(MediaFile.objects.filter(pk=media_id).exists())
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
docker compose exec web pytest tests/accounts/test_avatar_api.py -q
```

Expected:

- FAIL because `User` 还没有 `avatar` 字段
- 或 FAIL because 上传接口仍在访问 `crop_data` / 旧头像字段

- [ ] **Step 3: Confirm the current breakage is the intended one**

记录失败点是否集中在以下旧实现上：

- `apps/accounts/models.py` 仍定义 `avatar_original/avatar_thumbnail/avatar_crop_data`
- `apps/accounts/services.py` 仍调用 `process_and_save_avatar()`
- `apps/accounts/api.py` 仍要求 `crop_data`

如果失败主要来自这些旧逻辑，继续下一任务；不要先修测试。

- [ ] **Step 4: Commit the test-only change**

```bash
git add tests/accounts/test_avatar_api.py
git commit -m "补充头像切换到通用媒体的失败测试"
```

---

### Task 2: 替换 `User` 头像模型并完成历史数据迁移

**Files:**
- Modify: `apps/accounts/models.py`
- Create: `apps/accounts/migrations/0014_user_avatar_media_refs.py`
- Modify: `tests/accounts/test_avatar_api.py`

- [ ] **Step 1: Write the migration-focused failing test**

在 `tests/accounts/test_avatar_api.py` 追加一个模型级测试，先锁定新的 `avatar_url` 读取契约：

```python
def test_avatar_url_prefers_thumbnail_then_falls_back_to_url(self):
    self.user.avatar = [{"media_id": 123, "media_type": "image"}]
    with self.assertRaises(Exception):
        _ = self.user.avatar_url
```

这一步只是先暴露“当前模型没有 `avatar` / `avatar_resolved`”的问题。实际实现时需要把它改写成基于真实 `MediaFile` 的断言：

```python
def test_avatar_url_falls_back_to_resolved_url_when_thumbnail_missing(self):
    media = MediaFile.objects.create(
        uploader=self.user,
        resource_type="avatar",
        original_filename="avatar.png",
        file="uploads/users/1/avatar.png",
        file_size=123,
    )
    self.user.avatar = [{"media_id": media.pk, "media_type": "image"}]
    self.user.save(update_fields=["avatar"])

    self.assertEqual(self.user.avatar_url, media.file.url)
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
docker compose exec web pytest tests/accounts/test_avatar_api.py::TestAvatarAPI::test_avatar_url_falls_back_to_resolved_url_when_thumbnail_missing -q
```

Expected:

- FAIL because `User` 还没有 `avatar` 字段或 `avatar_url` 仍依赖旧缩略图字段

- [ ] **Step 3: Replace the model fields and add the migration**

把 `apps/accounts/models.py` 的头像相关定义改为：

```python
from apps.media.constants import MediaType, ResourceType
from apps.media.fields import MediaRefsField


class User(AbstractUser):
    timezone = models.CharField(max_length=63, default="Asia/Shanghai")
    avatar = MediaRefsField(
        blank=True,
        default=list,
        max_items=1,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.AVATAR],
        verbose_name="头像",
    )
    phone_country_code = models.CharField(max_length=8, blank=True, default="")
    phone_national_number = models.CharField(max_length=32, blank=True, default="")
    phone_verified = models.BooleanField(default=False)
    real_name_status = models.CharField(max_length=32, choices=RealNameStatus.choices, default=RealNameStatus.UNVERIFIED, db_index=True)
    real_name_verified_at = models.DateTimeField(null=True, blank=True)
    real_name_masked = models.CharField(max_length=64, blank=True, default="")
    id_number_masked = models.CharField(max_length=32, blank=True, default="")

    @property
    def avatar_url(self):
        if not self.avatar_resolved:
            return None
        return self.avatar_resolved[0].get("thumbnail") or self.avatar_resolved[0].get("url")
```

新增 migration `apps/accounts/migrations/0014_user_avatar_media_refs.py`，分三段操作：

```python
from pathlib import Path

from django.db import migrations


def forwards(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    MediaFile = apps.get_model("media", "MediaFile")

    for user in User.objects.exclude(avatar_original="").iterator():
        source_field = user.avatar_original or user.avatar_thumbnail
        if not source_field:
            continue

        source_name = getattr(source_field, "name", "") or str(source_field)
        if not source_name:
            continue

        original_filename = Path(source_name).name or f"user-{user.pk}-avatar"
        media = MediaFile.objects.create(
            uploader_id=user.pk,
            resource_type="avatar",
            original_filename=original_filename,
            file=source_name,
            file_size=0,
        )
        user.avatar = [{"media_id": media.pk, "media_type": "image"}]
        user.save(update_fields=["avatar"])


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0005_alter_mediafile_resource_type"),
        ("accounts", "0013_alter_realnameverification_id_card_media"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar",
            field=apps.media.fields.MediaRefsField(
                allowed_media_types=["image"],
                allowed_resource_types=["avatar"],
                blank=True,
                default=list,
                max_items=1,
                verbose_name="头像",
            ),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.RemoveField(model_name="user", name="avatar_original"),
        migrations.RemoveField(model_name="user", name="avatar_thumbnail"),
        migrations.RemoveField(model_name="user", name="avatar_crop_data"),
    ]
```

实现时注意两点：

- 不要复制物理文件，只复用原路径
- 如果需要更稳妥地挑选数据源，把循环条件写成遍历全部用户，然后优先取 `avatar_original`，否则回退 `avatar_thumbnail`

- [ ] **Step 4: Re-run the targeted backend tests**

Run:

```bash
docker compose exec web pytest tests/accounts/test_avatar_api.py -q
```

Expected:

- 仍可能 FAIL because API/service 还在调用旧头像上传逻辑
- 但模型相关报错应已消失，`User.avatar` 和 `avatar_url` 可以被解析

- [ ] **Step 5: Commit the model and migration slice**

```bash
git add apps/accounts/models.py apps/accounts/migrations/0014_user_avatar_media_refs.py tests/accounts/test_avatar_api.py
git commit -m "账户头像模型切换到 MediaRefsField"
```

---

### Task 3: 用 `media` 服务替换头像上传与删除逻辑

**Files:**
- Modify: `apps/accounts/services.py`
- Modify: `apps/accounts/api.py`
- Modify: `apps/accounts/schemas.py`
- Modify: `tests/accounts/test_avatar_api.py`

- [ ] **Step 1: Extend the failing tests for old-media cleanup**

在 `tests/accounts/test_avatar_api.py` 里把替换和删除测试补得更严格，验证旧 `MediaFile.file.name` 也随之消失：

```python
def test_reupload_avatar_replaces_ref_and_deletes_old_media(self):
    self.client.force_login(self.user)
    first = SimpleUploadedFile("first.png", _make_png_bytes(color="red"), content_type="image/png")
    second = SimpleUploadedFile("second.png", _make_png_bytes(color="blue"), content_type="image/png")
    self.client.post(URL, {"image": first})
    self.user.refresh_from_db()
    first_media_id = self.user.avatar[0]["media_id"]
    first_media = MediaFile.objects.get(pk=first_media_id)
    first_path = first_media.file.name

    resp = self.client.post(URL, {"image": second})

    self.assertEqual(resp.status_code, 200)
    self.user.refresh_from_db()
    self.assertEqual(len(self.user.avatar), 1)
    self.assertNotEqual(self.user.avatar[0]["media_id"], first_media_id)
    self.assertFalse(MediaFile.objects.filter(pk=first_media_id).exists())
    self.assertFalse(default_storage.exists(first_path))
```

以及验证上传接口不再接受 `crop_data`：

```python
def test_upload_avatar_ignores_removed_crop_data_contract(self):
    self.client.force_login(self.user)
    upload = SimpleUploadedFile("avatar.png", _make_png_bytes(), content_type="image/png")

    resp = self.client.post(URL, {"image": upload, "crop_data": "{}"})

    self.assertEqual(resp.status_code, 200)
```

如果你决定对“额外传入的 `crop_data`”直接报错而不是忽略，就把期望值改成 `400`，并在实现中保持一致。默认推荐“忽略额外 multipart 字段”，这样前端联调更平滑。

- [ ] **Step 2: Run the avatar suite again**

Run:

```bash
docker compose exec web pytest tests/accounts/test_avatar_api.py -q
```

Expected:

- FAIL because `process_and_save_avatar()` / `delete_user_avatar()` 仍依赖旧字段

- [ ] **Step 3: Replace the service and API implementation**

将 `apps/accounts/services.py` 中旧头像实现替换为基于 `apps.media.services.upload_and_register()` 的版本：

```python
from apps.media.constants import MediaScope, ResourceType
from apps.media.models import MediaFile
from apps.media.services import upload_and_register


def _delete_media_file(media_id: int) -> None:
    media = MediaFile.objects.filter(pk=media_id).first()
    if not media:
        return
    if media.file:
        media.file.delete(save=False)
    media.delete()


def upload_user_avatar(user, image_file) -> str:
    old_avatar = list(user.avatar or [])
    media = upload_and_register(
        uploader=user,
        file=image_file,
        resource_type=ResourceType.AVATAR,
        scope=MediaScope.USER,
    )
    user.avatar = [{"media_id": media.pk, "media_type": "image"}]
    user.save(update_fields=["avatar"])

    for item in old_avatar:
        old_media_id = int(item["media_id"])
        if old_media_id != media.pk:
            _delete_media_file(old_media_id)
    return user.avatar_url


def delete_user_avatar(user) -> None:
    old_avatar = list(user.avatar or [])
    user.avatar = []
    user.save(update_fields=["avatar"])
    for item in old_avatar:
        _delete_media_file(int(item["media_id"]))
```

相应地更新 `apps/accounts/api.py`：

```python
@users_router.post("/me/avatar/", response=AvatarOut, summary="上传用户头像")
def upload_avatar(
    request,
    image: UploadedFile = File(..., description="头像图片文件。"),
):
    require_authenticated(request)
    try:
        avatar_url = upload_user_avatar(request.user, image)
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    return {"avatar_url": avatar_url}
```

并删除：

- `process_and_save_avatar()`
- `crop_data` JSON 解析
- 与裁剪、缩放、Pillow 相关的专用头像逻辑

如果删除后 `PIL` 在 `apps/accounts/services.py` 已无其他用途，一并移除相关 import。

- [ ] **Step 4: Re-run backend tests**

Run:

```bash
docker compose exec web pytest tests/accounts/test_avatar_api.py tests/media/test_api.py -q
```

Expected:

- PASS for all avatar tests
- `tests/media/test_api.py` 继续 PASS，说明复用 `upload_and_register()` 没破坏通用媒体上传

- [ ] **Step 5: Commit the service/API replacement**

```bash
git add apps/accounts/services.py apps/accounts/api.py apps/accounts/schemas.py tests/accounts/test_avatar_api.py
git commit -m "账户头像上传删除改为复用通用媒体服务"
```

---

### Task 4: 同步前端调用并完成全量验证

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/service.ts`
- Modify: `frontend_admin/src/services/openapi/userAccount.ts`
- Modify: `frontend_admin/src/pages/account/settings/service.test.ts`

- [ ] **Step 1: Write the failing frontend assertion**

如果 `frontend_admin/src/pages/account/settings/service.test.ts` 已有头像上传测试，就把断言改成不再传 `crop_data`；如果没有，就补一个最小测试：

```ts
it('uploads avatar without crop_data', async () => {
  const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
  await updateAvatar(file)
  expect(appsAccountsApiUploadAvatar).toHaveBeenCalledWith(undefined, file, expect.anything())
})
```

若当前项目没有为这个 service 建测试，也可以在本任务里只记录“无现成测试文件，直接修改并以类型检查/构建验证”，但要在执行时明确说明。

- [ ] **Step 2: Run the frontend test or targeted type check**

Run:

```bash
cd frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/service.test.ts
```

Expected:

- FAIL because当前调用仍传 `crop_data: '{}'`

如果没有测试文件，改跑：

```bash
cd frontend_admin && nvm use 22 && pnpm eslint src/pages/account/settings/service.ts
```

Expected:

- PASS/FAIL 均可，但先记录当前文件状态

- [ ] **Step 3: Update the frontend service and regenerate client if needed**

将 `frontend_admin/src/pages/account/settings/service.ts` 里的旧调用：

```ts
return appsAccountsApiUploadAvatar({ crop_data: '{}' }, file, {
  requestKey: 'upload-avatar',
})
```

改为：

```ts
return appsAccountsApiUploadAvatar(undefined, file, {
  requestKey: 'upload-avatar',
})
```

如果 OpenAPI 生成客户端签名已经改成只接收 `(file, options)`，则先运行：

```bash
cd frontend_admin && nvm use 22 && pnpm openapi
```

然后按新签名更新调用代码与测试。

- [ ] **Step 4: Run the frontend verification**

Run:

```bash
cd frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/service.test.ts
```

或在没有测试时运行：

```bash
cd frontend_admin && nvm use 22 && pnpm eslint src/pages/account/settings/service.ts
```

Expected:

- PASS

- [ ] **Step 5: Run the final backend verification set**

Run:

```bash
docker compose exec web pytest tests/accounts/test_avatar_api.py tests/accounts/test_api.py tests/media/test_api.py -q
```

Expected:

- PASS

如果迁移测试单独写在新文件中，再把它一起加入命令。

- [ ] **Step 6: Review migration safety before merging**

人工核对以下点：

- migration 依赖顺序正确，能访问 `media.MediaFile`
- 数据迁移不会复制物理文件，只复用原路径
- 用户旧头像为空时不会创建空的 `MediaFile`
- `User.avatar` 最终只会有 0 或 1 个引用

- [ ] **Step 7: Commit the frontend and verification slice**

```bash
git add frontend_admin/src/pages/account/settings/service.ts frontend_admin/src/services/openapi/userAccount.ts frontend_admin/src/pages/account/settings/service.test.ts
git commit -m "前端头像上传改为匹配新接口契约"
```

---

## Self-Review

- Spec coverage:
  - `User.avatar` 单元素 `MediaRefsField`：Task 2
  - 删除旧头像字段：Task 2
  - 上传/删除复用 `media` 服务：Task 3
  - `avatar_url` 继续稳定输出：Task 2 + Task 3
  - 移除 `crop_data`：Task 3 + Task 4
  - 前端同步：Task 4
  - 回归验证：Task 1, 3, 4
- Placeholder scan:
  - 无 `TODO/TBD/implement later`
  - 前端测试文件可能不存在的情况已明确给出替代验证命令
- Type consistency:
  - 统一使用 `User.avatar`
  - 统一使用 `{"media_id": ..., "media_type": "image"}`
  - 统一使用 `upload_user_avatar()` 作为新的服务入口
