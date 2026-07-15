---
name: media-image-thumbnail-design
description: Media 图片资源异步缩略图生成与原图回退设计
metadata:
  type: project
---

# Media 图片缩略图设计

## 背景

`apps/media` 已为业务媒体引用返回 `url` 和 `thumbnail` 两个字段，但当前 `get_media_file_info()` 固定令 `thumbnail` 为 `None`。管理端房源列表、项目列表、实体预览和媒体上传组件均优先使用 `thumbnail`，缺失时回退到 `url`，因此目前列表展示仍会下载完整原图。

本次为所有图片类型的 `MediaFile` 增加统一缩略图能力，降低列表、卡片和小尺寸预览的图片流量。实现必须同时覆盖服务端上传与 OSS 直传确认两条链路，并兼容本地文件、MinIO、AWS S3 和阿里云 OSS 存储。

## 已确认决策

- 所有图片资源类型都生成缩略图，包括头像、组织 Logo、实名认证图片、项目图片和房源图片。
- 使用项目已有的 Pillow 处理图片，不引入 pyvips 或特定云厂商图片处理服务。
- 缩略图由 Celery 异步生成，不阻塞上传或确认接口。
- 不对存量图片执行扫描、批量回填或自动补生成。
- 存量图片、生成中图片和生成失败图片的 `thumbnail` 均返回原图 URL。
- 原图继续通过 `url` 返回，完整预览不受缩略图影响。
- 缩略图与原图使用相同的私有存储和签名 URL 访问策略。

## 方案选择

### 方案 A：应用层使用 Pillow 异步预生成（采用）

后端登记图片后投递 Celery 任务，任务读取原图、生成 WebP 缩略图并写回默认存储。

优点：

- 不绑定云厂商，所有当前存储后端行为一致。
- 生成规格、隐私处理、失败状态和清理策略由应用统一控制。
- 前端只消费稳定的 `thumbnail` URL，无需理解存储厂商参数。

代价：

- Worker 会承担少量图片解码和编码计算。
- 对象存储会增加一份小尺寸派生文件。

### 方案 B：OSS/CDN 动态图片处理

在访问 URL 上增加阿里云 OSS 或 CDN 图片处理参数。

该方案不采用，因为 MinIO、本地文件和不同 S3 服务不能保证同一处理协议，且私有签名 URL 的参数组合会增加存储后端耦合。

### 方案 C：客户端同时上传原图和缩略图

由浏览器或小程序生成缩略图并分别上传。

该方案不采用，因为多个客户端难以保持一致，服务端不能完全信任客户端生成结果，并且会扩大上传协议和失败补偿范围。

## 数据模型

在 `MediaFile` 增加以下字段：

| 字段 | 类型 | 含义 |
|------|------|------|
| `thumbnail` | `FileField(null=True, blank=True)` | 缩略图对象路径 |
| `thumbnail_status` | `CharField` | `not_requested`、`pending`、`ready`、`failed` |
| `thumbnail_generated_at` | `DateTimeField(null=True, blank=True)` | 成功生成时间 |

状态语义：

- `not_requested`：存量记录或不属于图片的文件；不会被自动任务扫描。
- `pending`：新图片已登记，等待或正在生成。
- `ready`：缩略图已生成且 `thumbnail` 有值。
- `failed`：图片内容无效、不可解码或重试后仍生成失败。

迁移时现有记录统一保留默认状态 `not_requested`，不创建 Celery 回填任务。

## 图片识别边界

是否需要缩略图由媒体平台的图片扩展名规则判定，而不是依赖前端传入的 `media_type`。当前图片扩展名包括 `jpg`、`jpeg`、`png`、`webp`。

登记阶段仍执行现有资源类型和扩展名校验。Celery 任务会实际解码文件内容，因此伪造扩展名或损坏图片不会产生缩略图，并会进入 `failed` 状态。

## 上传与任务触发

`register_media_file()` 是两条上传链路共同经过的登记入口：

1. 服务端上传：`POST /api/media/upload/`
2. OSS 直传确认：`POST /api/media/confirm/`

登记图片时：

1. 创建 `MediaFile`，将 `thumbnail_status` 设为 `pending`。
2. 使用 `transaction.on_commit()` 投递 `generate_media_thumbnail(media_file_id)`。
3. API 立即返回，不等待图片处理。

登记非图片时保持 `not_requested`，不投递任务。

使用 `transaction.on_commit()` 可以避免事务尚未提交时 Worker 查询不到记录，也避免数据库事务回滚后仍执行无效任务。

## Pillow 处理规则

任务通过 Django `FileField` 打开原图，因此不依赖本地文件系统路径。处理结果先写入 `BytesIO`，再通过 Django Storage 保存。

统一规格：

- 使用 `Image.open()` 解码并强制读取实际像素数据。
- 使用 `ImageOps.exif_transpose()` 修正手机照片方向。
- 对动态 WebP 取第一帧，生成静态缩略图。
- 使用 `Image.thumbnail((480, 480), Image.Resampling.LANCZOS)` 等比例缩放。
- 最大宽高为 480px，不裁剪、不放大小图。
- 普通图片转为 RGB；带透明通道的图片保留 RGBA。
- 统一输出 WebP，`quality=80`、`method=6`。
- 不复制 EXIF、GPS、ICC 注释等原始元数据。

派生文件使用版本化、不可变路径：

```text
derived/thumbnails/v1/<media_file_id>.webp
```

版本目录允许未来调整尺寸或质量时生成新版本，避免覆盖后浏览器或 CDN 继续命中旧内容。

## Celery 任务行为

新增 `generate_media_thumbnail(media_file_id)` 任务，满足以下要求：

- 幂等：`ready` 且缩略图对象存在时直接返回。
- 记录不存在时安全结束。
- 非图片或 `not_requested` 记录不处理。
- 存储读取、网络和临时写入错误自动重试 3 次，使用指数退避。
- `UnidentifiedImageError`、解压炸弹错误、截断图片等确定性内容错误不重试，状态设为 `failed`。
- 重试耗尽后将状态设为 `failed`，保留原图可访问能力。
- 只有缩略图成功写入存储后才将数据库状态更新为 `ready`。

任务应配置 Pillow 最大像素限制，并将解压炸弹警告视为错误，避免超大尺寸压缩图消耗 Worker 过多内存。

## API 返回契约

`get_media_file_info()` 统一计算一次原图 URL，并按状态返回：

- 图片且 `ready`：`thumbnail` 为缩略图签名 URL。
- 图片且为 `not_requested`、`pending` 或 `failed`：`thumbnail` 与 `url` 相同。
- 非图片：`thumbnail` 为 `null`。

这样存量图片和任务失败场景无需修改前端，现有的 `item.thumbnail || item.url` 逻辑继续有效。异步任务完成后，业务接口下一次解析媒体引用时会自然返回缩略图 URL。

`MediaFileOut` 增加 `thumbnail: str | None`，保证上传接口与 `resolve_media_refs()` 的媒体返回结构一致。刚上传的图片在任务完成前，其 `thumbnail` 等于原图 URL。

私有存储下，原图与缩略图 URL 均在响应阶段动态签名，不写入业务 JSON 字段。

## 清理行为

现有孤儿媒体清理在删除 `MediaFile.file` 前，需要同步删除 `MediaFile.thumbnail`。缩略图只是原媒体的派生资源，不单独参与业务引用统计，也不单独设置保留期。

本设计不新增存量缩略图扫描任务。状态为 `not_requested` 的存量图片会一直使用原图回退，除非以后另行明确启动回填需求。

## 失败与并发处理

- 上传完成但任务尚未执行：接口返回原图作为 `thumbnail`。
- Worker 暂时不可用：状态保持 `pending`，接口继续返回原图。
- 图片无法解码：状态改为 `failed`，接口继续返回原图。
- 同一任务重复投递：任务通过状态和目标对象存在性保持幂等。
- 孤儿清理与任务重叠：孤儿清理已有 24 小时保留窗口；任务仍需容忍记录或原图已不存在。
- 缩略图保存成功但数据库更新失败：重试时复用确定性对象路径并完成状态更新，不产生多个派生文件。

## 配置

缩略图参数作为 Django 设置提供默认值，避免散落魔法数字：

- `MEDIA_THUMBNAIL_SIZE = (480, 480)`
- `MEDIA_THUMBNAIL_FORMAT = "WEBP"`
- `MEDIA_THUMBNAIL_QUALITY = 80`
- `MEDIA_THUMBNAIL_VERSION = "v1"`
- `MEDIA_IMAGE_MAX_PIXELS = 50_000_000`：Pillow 最大像素限制

首版只生成一个通用缩略图规格，不增加 small、medium、large 多档尺寸，也不做业务场景裁剪。

## 测试范围

实现阶段补充必要测试：

- 新图片登记后状态为 `pending`，事务提交后投递任务。
- 非图片登记不投递任务。
- Pillow 正确处理 EXIF 方向、RGB、RGBA 和动态 WebP 首帧。
- 输出不超过 480×480，不放大小图，格式为 WebP。
- 任务成功后状态为 `ready`，并保存缩略图路径。
- 无效图片进入 `failed`，不会影响原图返回。
- 存量 `not_requested`、`pending`、`failed` 图片的 `thumbnail` 返回原图 URL。
- `ready` 图片返回缩略图 URL。
- 非图片的 `thumbnail` 返回 `null`。
- 孤儿清理同时清理原图和缩略图。
- 服务端上传和 OSS 直传确认都触发同一缩略图链路。

测试使用内存生成的小尺寸 Pillow 图片和临时文件存储，不依赖真实 OSS。

## 非目标

本次不包括：

- 存量图片回填。
- 多尺寸响应式图片或 `srcset`。
- 智能裁剪、人脸识别、水印和内容审核。
- 视频封面生成。
- 云厂商图片处理参数。
- 前端上传前压缩。
- 调整当前媒体引用的数据库查询策略。

## 验收标准

- 所有新登记的图片都会异步尝试生成缩略图。
- 上传与确认接口不等待 Pillow 处理完成。
- 新缩略图成功生成后，房源和项目列表不再加载完整原图作为卡片图片。
- 未生成缩略图的存量图片以及生成中、生成失败的图片仍能正常展示原图。
- 非图片媒体行为保持不变。
- 原图和缩略图都遵循现有私有存储访问控制。
- 孤儿媒体清理不会遗留对应缩略图。
