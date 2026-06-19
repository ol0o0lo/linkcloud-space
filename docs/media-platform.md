# Media 平台接入说明

`apps/media` 用来做通用媒体存储，供其他业务模块复用。

## 适用方式

- 平台核心引用始终围绕 `media_id`
- 业务模型统一保存“平铺后的媒体引用对象列表”
- 平台接受业务传入整个列表，并兼容从每个 list item 中提取 `media_id` 做校验、回显、引用收集
- 顺序以业务保存的数据顺序为准
- 同一个媒体可被多个业务复用
- 业务删除引用时，只解除引用，不立即删除物理文件

推荐字段：

```python
from django.db import models


class ExampleThing(models.Model):
    title = models.CharField(max_length=100)
    media_refs = models.JSONField(default=list, blank=True)
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
- `validate_media_ids()`：校验从业务列表中提取出的 `media_id` 列表是否重复、是否存在
- `get_media_list_info()`：按从业务列表中提取出的 `media_id` 列表原顺序返回完整媒体信息
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
5. 业务保存 `media_refs`

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
3. 业务保存 `media_refs`

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

业务保存前，推荐直接把列表传给业务侧规范化函数，由它统一提取 `media_id` 再校验：

```python
from apps.media.services import validate_media_ids


def normalize_media_refs(media_refs: list[dict]) -> list[dict]:
    media_ids = [int(item["media_id"]) for item in media_refs]
    validate_media_ids(media_ids)
    return media_refs


def update_example_thing(*, thing, media_refs: list[dict]):
    thing.media_refs = normalize_media_refs(media_refs)
    thing.save(update_fields=["media_refs"])
    return thing
```

这里的约定是：业务层对外接受整个 `media_refs` 列表，平台底层兼容从每个 item 里提取 `media_id` 来做统一处理。

这里平台只校验“存在性、唯一性”；是否允许当前用户使用这些媒体，以及业务扩展字段是否合法，由业务自己校验。

### 4. 回显

业务详情建议同时返回：

- `media_refs`
- `media_list`

示例：

```python
from apps.media.services import get_media_list_info


def build_example_thing_payload(thing):
    media_ids = [int(item["media_id"]) for item in thing.media_refs]
    media_list = get_media_list_info(media_ids)
    media_map = {item["id"]: item for item in media_list}
    return {
        "id": thing.pk,
        "title": thing.title,
        "media_refs": thing.media_refs,
        "media_list": [media_map[item["media_id"]] for item in thing.media_refs if item["media_id"] in media_map],
    }
```

`get_media_list_info()` 会保持输入顺序不变。

推荐理解方式：

- 业务输入输出始终是 `media_refs`
- 平台兼容从 `media_refs` 的每个 item 提取 `media_id`
- `apps/media` 不直接解释 `label`、`side`、`room` 等业务字段

如果前端需要“媒体文件信息 + 业务扩展字段”的单列表，也建议在业务层完成合并，而不是要求 `apps/media` 理解业务字段语义。

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

只要业务模型保存了媒体引用，就应该提供一个 provider，并注册到 `MEDIA_REFERENCE_PROVIDERS`。

示例：

```python
# apps/example/media_references.py
from apps.example.models import ExampleThing


def collect_example_media_ids():
    media_ids = set()
    for row in ExampleThing.objects.values_list("media_refs", flat=True):
        if not row:
            continue
        media_ids.update(int(item["media_id"]) for item in row if item and item.get("media_id"))
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
    "document_type": "id_card",
    "side": "front"
  },
  {
    "media_id": 4002,
    "media_type": "image",
    "label": "身份证国徽面",
    "document_type": "id_card",
    "side": "back"
  }
]
```

建议：

- `side`、`document_type` 由实名认证业务自己定义
- 审核状态、审核原因、OCR 标记等也放在业务模型自己的结构中
- 不要把身份证号、姓名明文等高敏感信息塞进媒体引用结构

## 推荐原则

- `apps/media` 只负责文件实体、上传、校验、回显、延迟清理
- 业务标准引用对象至少包含 `media_id`
- 业务扩展字段直接平铺，不额外包 `meta`
- 只有所有业务都稳定需要的字段，才值得提升为统一约定；目前推荐保留的只有 `media_id`，以及可选的 `media_type`

## 注意事项

- 不要把房源、实名等业务语义字段存到 `MediaFile`
- 不要把顺序、标签、证件面别等业务字段硬编码到 `apps/media`
- 不要只存 `media_list`，应存稳定的 `media_refs`
- 不要在业务删除引用时立即删物理文件
