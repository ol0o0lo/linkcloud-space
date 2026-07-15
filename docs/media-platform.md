# Media 平台接入说明

`apps/media` 是通用媒体存储层，只负责文件实体、上传、校验、回显、引用收集和延迟清理，不理解业务语义。

## 1. 核心约定

- 业务核心引用始终围绕 `media_id`
- 业务字段名自定义，如 `images`、`attachments`、`id_card_media`
- 平台兼容 `list[int]` 和 `list[dict]`
- 如果 item 是 dict，平台默认从中提取 `media_id`
- 顺序以业务保存顺序为准
- 同一个媒体可被多个业务复用
- 删除业务引用时，不立即删物理文件

推荐结构：

```json
[
  {
    "media_id": 101,
    "media_type": "image",
    "label": "封面图"
  }
]
```

约定：

- `media_id`：唯一必填
- `media_type`：推荐字段，可选值如 `image`、`video`、`file`
- 其他字段全部由业务定义，直接平铺，不包 `meta`

## 2. 平台职责

负责：

- `GET /api/media/oss-token/`：生成直传 OSS/STS 凭证
- `POST /api/media/confirm/`：登记前端直传完成后的文件
- `POST /api/media/upload/`：服务端接收文件并上传
- `extract_media_ids()`：从 `list[int]` 或 `list[dict]` 中提取媒体 ID
- `validate_media_refs()`：校验媒体引用列表并返回可安全入库的稳定引用
- `resolve_media_refs()`：返回平铺增强后的媒体引用列表，平台派生字段会动态刷新
- 基于 `MediaRefsField` 自动收集和 `MEDIA_REFERENCE_PROVIDERS` 做延迟清理

不负责：

- 业务权限校验
- 业务字段语义解释
- 业务删除引用时的即时物理删除

## 3. 保存规则

业务保存前可调用 `validate_media_refs()`：

- 校验媒体存在性、唯一性
- 兼容 `list[int]` 和 `list[dict]`
- 剔除平台派生字段，如 `url`、`resource_type`、`original_filename`、`thumbnail`、`file_size`、`created_at`

业务自己负责：

- 是否允许当前用户使用这些媒体
- 业务扩展字段是否合法

固定的业务媒体字段推荐使用 `MediaRefsField`。它仍然是 JSONField 存储，但保存时会自动校验、清洗并剔除平台派生字段。

```python
from django.db import models

from apps.media.constants import MediaType, ResourceType
from apps.media.fields import MediaRefsField


class ExampleThing(models.Model):
    title = models.CharField(max_length=100)
    images = MediaRefsField(
        default=list,
        blank=True,
        max_items=20,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.AVATAR],
    )
```

业务代码可以直接赋值并保存：

```python
thing.images = payload.images
thing.save(update_fields=["images"])
```

字段参数用于声明平台可统一执行的规则：

- `min_items` / `max_items`：数量约束；空列表仍允许保存，接口必填约束交给业务 schema
- `allowed_media_types`：校验引用 item 里的 `media_type`
- `allowed_resource_types`：校验对应 `MediaFile.resource_type`
- `business_validators`：可选业务 validator 路径，适合“只能引用当前模型关联用户/组织上传的媒体”这类不依赖 request 的规则

如果校验依赖当前请求操作者，例如管理员和普通用户权限不同，仍然应放在业务 service/view 层显式处理。

如果业务模型有动态字段，例如 `PropertyListing.extra = JSONField(...)`，不要强行使用 `MediaRefsField`。这类字段推荐继续保留业务 JSON，只保存稳定的 `media_id` 引用和业务元数据，不保存 `url`、`file_size` 等平台派生字段。

当前 `apps/media` 暂不提供通用 JSON path 清洗工具。等具体业务的 `extra` 字段结构落地后，再按真实字段定义补独立入口，避免提前做一层过宽的动态 JSON 抽象。

## 4. 回显规则

业务详情推荐返回 `resolve_media_refs()` 的结果：

- 保持原顺序
- 保留业务原始字段
- 动态补充 `resource_type`、`original_filename`、`url`、`thumbnail`、`file_size`、`created_at`
- 如果原始数据里已有这些平台字段，回显时会被当前媒体信息覆盖

因此私有 OSS 的临时签名 URL 会随接口响应刷新，不应入库。

`MediaRefsField` 会自动给模型挂一个只读属性 `<field_name>_resolved`。字段原值继续保持稳定引用，回显属性负责动态补全平台字段。

示例：

```python
def build_example_thing_payload(thing):
    return {
        "id": thing.pk,
        "title": thing.title,
        "images": thing.images_resolved,
    }
```

`resolve_media_refs()` 会保持输入顺序不变，并补充媒体文件信息：

```json
[
  {
    "media_id": 101,
    "media_type": "image",
    "label": "封面图",
    "resource_type": "avatar",
    "original_filename": "cover.png",
    "url": "https://example.com/cover.png",
    "thumbnail": "https://example.com/cover-thumbnail.webp",
    "file_size": 123456,
    "created_at": "2026-06-20T10:00:00+08:00"
  }
]
```

推荐理解方式：

- 业务输入输出字段名由业务自己决定
- 平台兼容从业务列表的每个 item 提取 `media_id`
- `apps/media` 不直接解释 `label`、`side`、`room` 等业务字段
- 新上传的图片由 Celery 使用 Pillow 异步生成最大 480×480 的 WebP 缩略图
- 图片原文件上限为 25 MB，直传确认会从对象存储读取真实大小进行校验
- Worker 异常或 Broker 短暂不可用时，恢复任务会重新投递仍处于等待状态的新图片
- 缩略图复用公共 Celery Worker，并通过任务限速、字节上限、像素上限和超时控制资源占用
- 存量图片、生成中图片和生成失败图片的 `thumbnail` 回退为原图 URL
- 视频和普通文件等非图片资源的 `thumbnail` 为 `null`

## 5. 上传与返回

上传方式：

- 前端直传 OSS：先取 `/api/media/oss-token/`，上传后调 `/api/media/confirm/`
- 服务端上传：直接调 `/api/media/upload/`

直传凭证可以带 `resource_type`，平台会在签发前校验作用域和文件扩展名：

```http
GET /api/media/oss-token/?scope=org&filename=cover.png&resource_type=house_image
```

服务端上传示例：

```http
POST /api/media/upload/
Content-Type: multipart/form-data

files=<binary>
resource_type=avatar
scope=user
```

作用域：

- `user`：个人目录
- `org`：当前组织目录

建议用户私有素材使用 `user`，组织共享素材使用 `org`。

上传接口 `/api/media/confirm/`、`/api/media/upload/` 返回的是 `MediaFileOut`，主要包含：

- `id`
- `resource_type`
- `original_filename`
- `url`
- `thumbnail`（图片未生成缩略图时与 `url` 相同，非图片为 `null`）
- `file_size`
- `created_at`

`/api/media/confirm/` 返回单个 `MediaFileOut`；`/api/media/upload/` 支持多文件上传，返回 `list[MediaFileOut]`。

## 6. Provider 约定

`MEDIA_REFERENCE_PROVIDERS` 不是“上传入口”也不是“业务回调”，而是媒体平台和业务模块之间的引用上报协议。

媒体平台并不知道房源、实名、合同等业务语义，它只知道：

- 哪些 `MediaFile` 已经上传
- 哪些 `MediaFile` 仍然被业务数据引用

其中第 2 件事就依赖两类来源共同完成：

- `MediaRefsField`：平台可以自动扫描
- `MEDIA_REFERENCE_PROVIDERS`：业务主动上报平台无法自动发现的引用

清理链路如下：

1. 业务先保存 `media_id` 引用
2. 平台定时任务运行前，先汇总所有仍被引用的 `media_id`
3. 汇总来源包括 `MediaRefsField` 自动扫描结果和 provider 上报结果
4. 超过保留时间且不在这份引用集合里的 `MediaFile`，才会被视为孤儿候选并删除

所以 provider 的核心职责只有一个：告诉媒体平台“这些媒体还在被我用，先不要删”。

使用 `MediaRefsField` 的固定字段会被清理任务自动收集，不需要手写 provider。

动态 `extra` JSON、普通 `JSONField` 或其他非 `MediaRefsField` 的保存方式，需要提供 provider 并注册到 `MEDIA_REFERENCE_PROVIDERS`，用于引用扫描和延迟清理。provider 的职责只是收集正在被业务引用的 `media_id`。

示例：

```python
# apps/example/services.py
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
    "apps.example.services.collect_example_media_ids",
]
```

provider 约束建议明确写在业务代码注释里：

- 返回值是 `Iterable[int]` 或 `set[int]`
- 返回的必须是“当前仍被有效业务记录引用”的 `MediaFile.id`
- 不要在 provider 里做删除动作
- 不要把“历史上出现过但现在已解绑”的 media_id 一并返回，否则会阻止孤儿清理

## 7. 当前边界

- `resource_type` 必须先在 `apps/media/constants.py` 的 `ResourceType` 中声明
- 目前内置值有 `avatar`、`org_logo`、`real_name_id_card`、`estate_image`、`house_image`、`house_video`、`lease_contract`
- 平台会按资源类型限制作用域和扩展名，例如房源图片/视频/租约合同必须走组织作用域
- 图片类支持 `jpg`、`jpeg`、`png`、`webp`；视频类支持 `mp4`、`mov`、`avi`；租约合同支持 `pdf`、`doc`、`docx`
- 如果新业务需要商品图、内容图、附件等类型，需要先扩展 `ResourceType`

## 8. 最佳实践

### 房源图片

房源图片通常不是单纯的“图片 ID 列表”，业务往往还要保存图片角色、标题、房间类型等信息。推荐业务模型直接保存平铺对象：

```json
[
  {
    "media_id": 3001,
    "media_type": "image",
    "label": "房源封面",
    "image_role": "cover"
  }
]
```

### 实名认证图片

实名认证图片推荐：

```json
[
  {
    "media_id": 4001,
    "media_type": "image",
    "side": "front"
  },
  {
    "media_id": 4002,
    "media_type": "image",
    "side": "back"
  }
]
```

要点：

- `id_card_media` 已表达业务语义，列表项只需用 `side` 区分正反面
- `side` 的合法值由业务 schema 校验
- 审核状态、审核原因、OCR 标记等留在业务模型
- 不把身份证号、姓名明文等高敏感信息放进媒体引用结构

## 9. 总原则

- `apps/media` 不保存房源、实名等业务语义
- 业务标准引用对象至少包含 `media_id`
- 业务扩展字段直接平铺，不额外包 `meta`
- 只有所有业务都稳定需要的字段，才提升为统一约定；当前推荐保留 `media_id`，可选 `media_type`
- 不保存增强后的展示数据
- 不保存临时签名 URL
