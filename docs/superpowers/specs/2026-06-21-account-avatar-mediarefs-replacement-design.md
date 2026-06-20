# Account Avatar MediaRefs 一步替换设计

## 背景

当前用户头像仍使用 `accounts` 内的专用方案：

- `User.avatar_original`
- `User.avatar_thumbnail`
- `User.avatar_crop_data`
- `/api/users/me/avatar/` 走 `process_and_save_avatar()`，服务端负责校验、裁剪、缩放、落盘

而项目中的 `media` app 已经成为通用媒体平台，业务资源逐步统一为：

- `MediaFile` 记录文件元数据
- 业务模型通过 `MediaRefsField` 保存媒体引用
- `resolve_media_refs()` 负责返回前端展示结构
- `cleanup_unreferenced_media()` 负责清理未被业务引用的媒体记录与文件

头像继续保留专用实现会造成双轨维护。项目仍处于早期阶段，允许一次性调整，因此本次改造目标是直接移除旧头像方案，统一迁入 `media` 通用模型。

## 目标

一步替换用户头像存储与上传链路，使头像成为 `MediaRefsField` 驱动的通用媒体引用，并移除旧头像字段、裁剪参数与服务端缩略图生成逻辑。

本次改造完成后：

- `User` 不再持有专用头像文件字段
- 用户头像与实名认证图片一样，走 `MediaFile + MediaRefsField`
- 头像引用可被 `media` 清理任务自动识别，不再需要单独保护逻辑
- API 仍然对外返回 `avatar_url`，尽量减少调用方改动

## 非目标

本次不处理以下内容：

- 不为 `media` 补齐真实缩略图生成能力
- 不保留旧头像裁剪交互与 `crop_data`
- 不做旧新方案并存的兼容期
- 不引入头像多图、版本历史或回滚能力

`media` 的缩略图、派生图、统一图片处理能力留待后续单独演进。

## 方案选型

### 备选方案

#### 方案 A：`User.avatar` 改为单值 `ForeignKey` / `IntegerField`

优点：

- 模型定义直观

缺点：

- 不能直接复用 `MediaRefsField` 的校验、解析与自动引用扫描
- 需要额外补充媒体清理保护逻辑
- 与项目中已建立的通用媒体边界不一致

#### 方案 B：继续保留 `accounts` 专用头像字段，只把上传链路改成写入 `MediaFile`

优点：

- 改动面较小

缺点：

- 数据事实来源会同时存在于用户字段和 `MediaFile`
- 会延续专用头像逻辑，违背“统一迁入 media”目标
- 后续还要再做一次清理

#### 方案 C：`User.avatar` 改为单元素 `MediaRefsField`

优点：

- 与当前实名认证图片等业务模型保持一致
- 自动纳入 `MediaRefsField` 校验与 `cleanup_unreferenced_media()` 引用扫描
- 数据结构统一，后续补齐缩略图能力时可被所有业务复用

缺点：

- 头像字段从文件字段切为 JSON 引用，读写逻辑需同步改造

### 结论

采用方案 C。

`User.avatar` 使用单元素 `MediaRefsField`，存储形态固定为：

- 空头像：`[]`
- 有头像：`[{"media_id": 123, "media_type": "image"}]`

## 数据模型设计

### `User` 字段调整

删除以下字段：

- `avatar_original`
- `avatar_thumbnail`
- `avatar_crop_data`

新增字段：

- `avatar = MediaRefsField(...)`

建议定义：

- `blank=True`
- `default=list`
- `max_items=1`
- `allowed_media_types=[MediaType.IMAGE]`
- `allowed_resource_types=[ResourceType.AVATAR]`
- `verbose_name="头像"`

不设置 `min_items`，允许用户没有头像。

### 头像 URL 计算

保留 `User.avatar_url` 属性，但实现改为：

- 若 `avatar_resolved` 为空，返回 `None`
- 否则返回首个元素的 `thumbnail`，若为空则回退到 `url`

虽然当前 `media` 还没有真正生成缩略图，`thumbnail` 现阶段会是 `None`，但这个回退顺序可以为未来 `media` 补齐缩略图能力保留稳定接口，避免再次修改调用方。

## 上传与删除链路

### 上传接口

接口路径保持不变：

- `POST /api/users/me/avatar/`

接口行为调整为：

1. 接收单个图片文件
2. 不再接收 `crop_data`
3. 通过 `apps.media.services.upload_and_register()` 上传并登记 `MediaFile`
4. 使用 `ResourceType.AVATAR`
5. 将 `request.user.avatar` 覆盖为新的单元素引用列表
6. 若用户原来已有头像，替换后立即删除旧头像对应的 `MediaFile` 与物理文件
7. 返回 `{ "avatar_url": "<resolved-url>" }`

### 删除接口

接口路径保持不变：

- `DELETE /api/users/me/avatar/`

接口行为调整为：

1. 读取当前用户已有头像引用
2. 将 `avatar` 置空列表
3. 立即删除原头像对应的 `MediaFile` 与物理文件
4. 返回空对象

### 为什么不依赖延迟清理

虽然 `media` 已具备孤儿清理能力，但头像替换和删除是强用户意图，应该立即释放旧资源，避免：

- 短时间内积累无用头像文件
- 后续清理窗口内出现重复资源
- 用户删除头像后后台仍保留旧头像记录

因此头像替换和删除都应主动回收旧媒体。

## 历史数据迁移

本次采用一步替换，不保留双写或兼容期。

### 迁移目标

把历史用户头像从 `User` 专用文件字段迁移为：

- 一条新的 `MediaFile`
- 一条 `User.avatar` 引用

### 迁移来源选择

若旧数据同时存在 `avatar_original` 和 `avatar_thumbnail`：

- 优先迁移 `avatar_original`

原因：

- 本次目标态不再维护专用缩略图
- 迁移后头像将直接指向通用媒体原图
- 这更符合新的统一媒体模型

若只有其中之一存在，则迁移实际存在的那份文件。

### 迁移步骤

迁移应按以下顺序完成：

1. 新增 `User.avatar` 字段
2. 运行数据迁移：
   - 扫描所有用户
   - 找到旧头像文件字段中的有效值
   - 为每个头像创建 `MediaFile`
   - `resource_type` 设为 `avatar`
   - `original_filename` 从路径末尾提取，若缺失则构造稳定默认值
   - `file` 直接指向现有存储路径，不复制物理文件
   - `file_size` 尽量从存储后端获取；若无法可靠获取，则使用 `0` 作为兜底值
   - 将 `User.avatar` 写成单元素引用
3. 删除旧字段：
   - `avatar_original`
   - `avatar_thumbnail`
   - `avatar_crop_data`

### 为什么迁移时不复制文件

现有文件已经在有效存储位置上，数据库层只需要建立 `MediaFile` 记录并回填引用即可。复制文件会：

- 增加迁移成本
- 延长迁移时间
- 制造额外失败点

直接复用原路径更适合当前阶段的一步替换。

## 对 `media` 平台能力的依赖边界

本次改造只依赖 `media` 已经具备的能力：

- 文件上传登记
- 媒体引用校验
- 媒体引用解析
- 未引用媒体清理

本次明确不依赖以下能力：

- 缩略图生成
- 图片裁剪参数持久化
- 多规格图片派生

因此在 `media` 后续补齐缩略图能力之前，头像展示将直接使用原图 URL。这是本次改造接受的阶段性取舍。

## API 与前端影响

### API

`AvatarOut` 保持不变，继续只返回：

- `avatar_url`

这样可减少下游改动。

上传接口的输入变化：

- 删除 `crop_data`
- 仅保留图片文件上传

### 前端

`frontend_admin` 当前上传头像时固定传 `crop_data: '{}'`。本次改造后：

- 前端上传参数需要去掉 `crop_data`
- OpenAPI 重新生成后，对应客户端方法签名会变化
- 页面层只需继续消费 `avatar_url`

主站前端若存在头像上传入口，也需要同步按新接口调用。

## 错误处理

头像上传保留基本文件校验，但不再包含裁剪参数校验。

建议保留的错误类型：

- 未登录
- 缺少文件
- 上传失败
- 非法媒体类型或资源类型

不再保留：

- `crop_data` JSON 解析错误
- 裁剪框参数错误
- 服务端裁剪/缩放失败

## 测试策略

### 需要更新的测试

- `tests/accounts/test_avatar_api.py`

改为验证：

- 上传后 `user.avatar` 为单元素媒体引用
- 返回值包含 `avatar_url`
- 删除后 `user.avatar == []`

### 需要新增的测试

1. 上传头像会创建 `MediaFile`
2. 再次上传头像会替换引用并删除旧 `MediaFile`
3. 删除头像会删除对应 `MediaFile`
4. `avatar_url` 在 `thumbnail` 为空时回退到 `url`
5. 历史数据迁移后，旧头像字段数据能正确转为 `avatar` 引用

### 不需要新增的测试

本次不新增与裁剪、缩放、缩略图生成相关的测试，因为这些能力已被移出头像业务。

## 实施边界

本次改造应控制在以下范围：

- `apps/accounts/models.py`
- `apps/accounts/api.py`
- `apps/accounts/services.py`
- `apps/accounts/schemas.py`（如上传接口 schema 或说明有变化）
- `tests/accounts/test_avatar_api.py`
- 新增或调整相关 migration
- 必要时更新 `frontend_admin` 头像上传调用

本次不应顺带修改：

- `media` 的缩略图实现
- 组织 logo 业务
- 实名图片业务
- 其他非头像媒体消费方

## 验收标准

满足以下条件即视为完成：

1. 用户模型不再包含旧头像专用字段
2. 头像上传后，用户头像数据只存在于 `MediaFile + User.avatar`
3. `avatar_url` 仍可被现有调用方直接消费
4. 替换头像和删除头像都会主动删除旧媒体记录及物理文件
5. 历史头像数据可在 migration 后正常读取
6. `cleanup_unreferenced_media()` 不需要为头像额外配置 provider
7. 头像上传接口不再接受 `crop_data`

## 风险与接受项

### 已接受的取舍

- 头像将阶段性直接展示原图 URL
- 不再保留服务端裁剪结果
- 历史用户迁移后头像外观可能与过去缩略图版本略有差异

### 主要风险

- 数据迁移时旧文件路径异常，导致个别用户无法生成 `MediaFile`
- 替换头像时主动删除旧媒体，如果顺序处理不当可能产生短暂丢头像风险
- 前端若未同步移除 `crop_data`，OpenAPI 客户端会产生签名不匹配

### 风险控制

- 迁移逻辑对无效旧路径做跳过或兜底日志，不阻塞整批迁移
- 上传替换时先创建新媒体并保存新引用，再删除旧媒体
- 通过测试覆盖上传、替换、删除和迁移关键路径
