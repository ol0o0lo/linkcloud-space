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

- `GET /api/media/oss-token/`
- `POST /api/media/confirm/`
- `POST /api/media/upload/`
- `extract_media_ids()`
- `validate_media_ids()`
- `validate_media_refs()`
- `get_media_list_info()`
- `resolve_media_refs()`
- 基于 `MEDIA_REFERENCE_PROVIDERS` 的延迟清理

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

## 4. 回显规则

业务详情推荐返回 `resolve_media_refs()` 的结果：

- 保持原顺序
- 保留业务原始字段
- 动态补充 `resource_type`、`original_filename`、`url`、`thumbnail`、`file_size`、`created_at`
- 如果原始数据里已有这些平台字段，回显时会被当前媒体信息覆盖

因此私有 OSS 的临时签名 URL 会随接口响应刷新，不应入库。

## 5. 上传与返回

上传方式：

- 前端直传 OSS：先取 `/api/media/oss-token/`，上传后调 `/api/media/confirm/`
- 服务端上传：直接调 `/api/media/upload/`

上传接口返回 `MediaFileOut`，主要字段：

- `id`
- `resource_type`
- `original_filename`
- `url`
- `file_size`
- `created_at`

## 6. Provider 约定

只要业务模型保存了媒体引用，就应提供 provider，并注册到 `MEDIA_REFERENCE_PROVIDERS`，用于引用扫描和延迟清理。

provider 的职责只是收集正在被业务引用的 `media_id`。

## 7. 当前边界

- `resource_type` 必须先在 `apps/media/constants.py` 的 `ResourceType` 中声明
- 当前内置值只有 `avatar`、`org_logo`
- 新业务如需商品图、内容图、附件等类型，需要先扩展 `ResourceType`

## 8. 最佳实践

房源图片推荐：

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
