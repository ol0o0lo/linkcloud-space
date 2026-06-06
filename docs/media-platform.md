# Media 平台接入说明

`apps/media` 用来做通用媒体存储，供其他业务模块复用。

## 适用方式

- 业务模型保存 `media_ids`
- 顺序以业务保存的 `media_ids` 顺序为准
- 同一个媒体可被多个业务复用
- 业务删除引用时，只解除引用，不立即删除物理文件

推荐字段：

```python
from django.db import models


class ExampleThing(models.Model):
    title = models.CharField(max_length=100)
    media_ids = models.JSONField(default=list, blank=True)
```

## 平台职责

`apps/media` 当前负责：

- `GET /api/media/oss-token/`：生成直传 OSS/STS 凭证
- `POST /api/media/confirm/`：登记前端直传完成后的文件
- `POST /api/media/upload/`：服务端接收文件并上传
- `validate_media_ids()`：校验 `media_ids` 是否重复、是否存在
- `get_media_list_info()`：按 `media_ids` 原顺序返回完整媒体信息
- 基于 `MEDIA_REFERENCE_PROVIDERS` 做延迟清理

`apps/media` 不负责：

- 业务权限校验
- 业务字段语义解释
- 业务删除引用时的即时物理删除

## 接入约定

### 1. 上传

支持两种方式：

#### 前端直传 OSS

1. 调用 `GET /api/media/oss-token/`
2. 前端用返回凭证和 `path` 直传对象存储
3. 上传成功后调用 `POST /api/media/confirm/`
4. 获取 `media_id`
5. 业务保存 `media_ids`

示例：

```http
GET /api/media/oss-token/?scope=user&filename=cover.png
```

```http
POST /api/media/confirm/
Content-Type: application/json

{
  "oss_path": "uploads/users/12/7b9d...png",
  "original_filename": "cover.png",
  "resource_type": "avatar",
  "file_size": 123456
}
```

#### 服务端上传

1. 调用 `POST /api/media/upload/`
2. 获取 `media_id`
3. 业务保存 `media_ids`

示例：

```http
POST /api/media/upload/
Content-Type: multipart/form-data

files=<binary>
resource_type=avatar
scope=user
```

### 2. 作用域

- `user`：个人目录
- `org`：当前组织目录

建议用户私有素材使用 `user`，组织共享素材使用 `org`。

### 3. 保存

业务保存前先调用 `validate_media_ids()`：

```python
from apps.media.services import validate_media_ids


def update_example_thing(*, thing, media_ids: list[int]):
    thing.media_ids = validate_media_ids(media_ids)
    thing.save(update_fields=["media_ids"])
    return thing
```

这里平台只校验“存在性、唯一性”；是否允许当前用户使用这些媒体，由业务自己校验。

### 4. 回显

业务详情建议同时返回：

- `media_ids`
- `media_list`

示例：

```python
from apps.media.services import get_media_list_info


def build_example_thing_payload(thing):
    return {
        "id": thing.pk,
        "title": thing.title,
        "media_ids": thing.media_ids,
        "media_list": get_media_list_info(thing.media_ids),
    }
```

`get_media_list_info()` 会保持输入顺序不变。

## 返回结构

上传接口 `/api/media/confirm/`、`/api/media/upload/` 返回的是 `MediaFileOut`，主要包含：

- `id`
- `resource_type`
- `original_filename`
- `url`
- `file_size`
- `created_at`

业务详情里的 `media_list` 来自 `get_media_list_info()`，主要包含：

- `id`
- `resource_type`
- `original_filename`
- `original.url`
- `thumbnail`
- `file_size`
- `created_at`

## Provider 接入

只要业务模型保存了 `media_ids`，就应该提供一个 provider，并注册到 `MEDIA_REFERENCE_PROVIDERS`。

示例：

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
MEDIA_REFERENCE_PROVIDERS = [
    "apps.example.media_references.collect_example_media_ids",
]
```

## 当前实现边界

- `resource_type` 需要先在 `apps/media/constants.py` 的 `ResourceType` 中声明
- 目前内置值只有 `avatar`、`org_logo`
- 如果新业务需要商品图、内容图、附件等类型，需要先扩展 `ResourceType`

## 注意事项

- 不要把顺序存到 `MediaFile`
- 不要只存 `media_list`，应存稳定的 `media_ids`
- 不要在业务删除引用时立即删物理文件
