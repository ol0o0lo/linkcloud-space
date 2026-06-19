# Media 平台接入说明

`apps/media` 用来做通用媒体存储，供其他业务模块复用。

## 适用方式

- 平台核心引用始终围绕 `media_id`
- 业务字段名由业务 app 自己决定，例如 `images`、`attachments`、`id_card_images`
- 平台方法接受 `list[int]` 或平铺后的 `list[dict]`
- 如果 list item 是 dict，平台默认从每个 item 中提取 `media_id` 做校验、回显、引用收集
- 顺序以业务保存的数据顺序为准
- 同一个媒体可被多个业务复用
- 业务删除引用时，只解除引用，不立即删除物理文件

推荐字段示例：

```python
from django.db import models


class ExampleThing(models.Model):
    title = models.CharField(max_length=100)
    images = models.JSONField(default=list, blank=True)
```

推荐结构：

```json
[
  {
    "media_id": 101,
    "media_type": "image",
    "label": "封面图"
  },
  {
    "media_id": 102,
    "media_type": "image",
    "label": "客厅图",
    "room": "living_room"
  }
]
```

约定如下：

- `media_id`：唯一必填字段，对应 `MediaFile.id`
- `media_type`：推荐字段，表达媒体大类，例如 `image`、`video`、`file`
- 其他字段全部由业务自行定义，并且直接平铺，不额外包一层 `meta`

## 平台职责

`apps/media` 当前负责：

- `GET /api/media/oss-token/`：生成直传 OSS/STS 凭证
- `POST /api/media/confirm/`：登记前端直传完成后的文件
- `POST /api/media/upload/`：服务端接收文件并上传
- `extract_media_ids()`：从 `list[int]` 或 `list[dict]` 中提取媒体 ID
- `validate_media_ids()`：校验 `list[int]` 或 `list[dict]` 中的媒体 ID 是否重复、是否存在
- `validate_media_refs()`：校验媒体引用列表并返回原始列表，便于业务继续保存
- `get_media_list_info()`：按传入列表原顺序返回完整媒体信息
- `get_media_refs_info()`：返回平铺增强后的媒体引用列表，字段冲突时保留业务方原值
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
5. 业务保存自己的媒体引用字段，例如 `images`

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
3. 业务保存自己的媒体引用字段，例如 `images`

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

业务保存前，推荐直接把列表传给平台校验函数：

```python
from apps.media.services import validate_media_refs


def update_example_thing(*, thing, images: list[dict]):
    thing.images = validate_media_refs(images)
    thing.save(update_fields=["images"])
    return thing
```

这里的约定是：业务层对外接受自己的媒体引用列表，平台底层兼容 `list[int]`，也兼容从 `list[dict]` 的每个 item 里提取 `media_id` 来做统一处理。

这里平台只校验“存在性、唯一性”；是否允许当前用户使用这些媒体，以及业务扩展字段是否合法，由业务自己校验。

### 4. 回显

业务详情可以直接返回平铺增强后的列表，适合前端展示：

示例：

```python
from apps.media.services import get_media_refs_info


def build_example_thing_payload(thing):
    return {
        "id": thing.pk,
        "title": thing.title,
        "images": get_media_refs_info(thing.images),
    }
```

`get_media_refs_info()` 会保持输入顺序不变，并补充媒体文件信息：

```json
[
  {
    "media_id": 101,
    "media_type": "image",
    "label": "封面图",
    "resource_type": "avatar",
    "original_filename": "cover.png",
    "url": "https://example.com/cover.png",
    "thumbnail": null,
    "file_size": 123456,
    "created_at": "2026-06-20T10:00:00+08:00"
  }
]
```

如果业务原始 item 中已经包含同名字段，例如 `url` 或 `file_size`，平台不会覆盖，返回时以业务方字段为准。

如果业务只需要纯媒体信息，也可以继续使用 `get_media_list_info(images)`；该方法同样兼容 `list[int]` 和 `list[dict]`。

推荐理解方式：

- 业务输入输出字段名由业务自己决定
- 平台兼容从业务列表的每个 item 提取 `media_id`
- `apps/media` 不直接解释 `label`、`side`、`room` 等业务字段

## 返回结构

上传接口 `/api/media/confirm/`、`/api/media/upload/` 返回的是 `MediaFileOut`，主要包含：

- `id`
- `resource_type`
- `original_filename`
- `url`
- `file_size`
- `created_at`

业务详情里的平铺增强列表来自 `get_media_refs_info()`，主要包含业务原始字段，并补充：

- `media_id`
- `resource_type`
- `original_filename`
- `url`
- `thumbnail`
- `file_size`
- `created_at`

## Provider 接入

只要业务模型保存了媒体引用，就应该提供一个 provider，并注册到 `MEDIA_REFERENCE_PROVIDERS`。

示例：

```python
# apps/example/media_references.py
from apps.example.models import ExampleThing
from apps.media.services import extract_media_ids


def collect_example_media_ids():
    media_ids = set()
    for row in ExampleThing.objects.values_list("images", flat=True):
        if not row:
            continue
        media_ids.update(extract_media_ids(row))
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

## 推荐最佳实例

### 房源图片

房源图片通常不是单纯的“图片 ID 列表”，业务往往还要保存图片角色、标题、房间类型等信息。推荐业务模型直接保存平铺对象：

```json
[
  {
    "media_id": 3001,
    "media_type": "image",
    "label": "房源封面",
    "image_role": "cover"
  },
  {
    "media_id": 3002,
    "media_type": "image",
    "label": "客厅实拍",
    "image_role": "gallery",
    "room": "living_room"
  },
  {
    "media_id": 3003,
    "media_type": "image",
    "label": "卧室实拍",
    "image_role": "gallery",
    "room": "bedroom"
  }
]
```

建议：

- `media_id` 始终作为平台唯一识别字段
- `media_type` 推荐保留，便于未来兼容视频或附件
- `label`、`image_role`、`room` 都属于房源业务字段，不进入 `apps/media`

### 实名认证图片

实名认证材料的重点是“材料语义”和“审核语义”，而不是让 `apps/media` 理解证件类型。推荐业务模型保存：

```json
[
  {
    "media_id": 4001,
    "media_type": "image",
    "label": "身份证人像面",
    "side": "front"
  },
  {
    "media_id": 4002,
    "media_type": "image",
    "label": "身份证国徽面",
    "side": "back"
  }
]
```

建议：

- `id_card_media` 字段已经表达身份证材料语义，列表项里保留 `side` 区分人像面和国徽面即可
- 审核状态、审核原因、OCR 标记等也放在业务模型自己的结构中
- 不要把身份证号、姓名明文等高敏感信息塞进媒体引用结构

## 推荐原则

- `apps/media` 只负责文件实体、上传、校验、回显、延迟清理
- 业务标准引用对象至少包含 `media_id`
- 业务扩展字段直接平铺，不额外包 `meta`
- 只有所有业务都稳定需要的字段，才值得提升为统一约定；目前推荐保留的只有 `media_id`，以及可选的 `media_type`
- 平铺增强返回时，如果平台字段和业务字段同名，以业务字段为准

## 注意事项

- 不要把房源、实名等业务语义字段存到 `MediaFile`
- 不要把顺序、标签、证件面别等业务字段硬编码到 `apps/media`
- 不要只存增强后的媒体展示数据，应保存稳定的业务媒体引用列表
- 不要在业务删除引用时立即删物理文件
