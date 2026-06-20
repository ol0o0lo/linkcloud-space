## ADDED Requirements

### Requirement: 房源图片管理
系统 SHALL 不提供独立的 HouseImage 模型，而是在 House 上通过 `images` 的 `MediaRefsField` 保存有序的房源图片媒体引用对象列表。每个 item SHALL 至少包含 `media_id`，并 MAY 包含 `media_type`、`label`、`image_role`、`room` 等房源业务字段。

#### Scenario: 保存图片列表
- **WHEN** 为 House 保存 `images`，提供已登记的媒体引用对象数组
- **THEN** 记录保存成功，数组顺序即图片展示顺序

#### Scenario: 允许空图片列表
- **WHEN** 为 House 保存空的 `images`
- **THEN** 记录保存成功，表示该房源当前暂无图片

#### Scenario: 图片列表数量上限
- **WHEN** 为 House 保存超过 9 个图片媒体引用对象
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 禁止裸 URL 图片
- **WHEN** 保存 House 的图片配置
- **THEN** 系统 SHALL 通过 `media_id` 引用 MediaFile，不保存裸 url 字符串，也不保存平台增强后的展示数据

#### Scenario: 默认排序
- **WHEN** 查询某套房源的图片列表
- **THEN** 按 House 中保存的数组顺序排列

#### Scenario: 图片详情通过 media app 解析
- **WHEN** 查询某套房源的图片展示信息
- **THEN** 系统 SHALL 优先使用 `images_resolved`，或复用 `apps.media.services.resolve_media_refs()`，根据 `images[].media_id` 按原顺序返回平铺增强后的 `images=[{"media_id": ..., "url": ..., ...}]`，而不是在房源域自行拼装文件 URL

#### Scenario: 第一张图片视为封面
- **WHEN** 查询某套房源的图片列表
- **THEN** 数组中的第一张图片视为封面图

#### Scenario: 图片业务字段直接平铺
- **WHEN** House.images 中保存 `label`、`image_role`、`room` 等业务字段
- **THEN** 系统保留这些字段并在回显增强时平铺返回，不把它们写入 MediaFile，也不额外包一层 `meta`

#### Scenario: 房源图片不允许重复引用
- **WHEN** 为同一 House 保存包含重复 `media_id` 的图片列表
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 图片允许跨房源复用
- **WHEN** 不同 House 引用同一个 `media_id`
- **THEN** 系统允许保存，不对 `MediaFile` 做跨房源唯一限制

#### Scenario: 房源图片必须使用合法资源类型
- **WHEN** 为 House 保存图片列表，且其中某个 MediaFile 不是 `house_image` 资源类型
- **THEN** 系统阻止保存并返回校验错误

### Requirement: 房源视频管理
系统 SHALL 在 House 上通过 `videos` 的 `MediaRefsField` 保存有序的房源视频媒体引用对象列表。每个 item SHALL 至少包含 `media_id`，并 SHOULD 包含 `media_type="video"`。

#### Scenario: 保存视频列表
- **WHEN** 为 House 保存 `videos`，提供已登记的媒体引用对象数组
- **THEN** 记录保存成功，数组顺序即视频展示顺序

#### Scenario: 允许空视频列表
- **WHEN** 为 House 保存空的 `videos`
- **THEN** 记录保存成功，表示该房源当前暂无视频

#### Scenario: 视频列表数量上限
- **WHEN** 为 House 保存超过 3 个视频媒体引用对象
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 视频详情通过 media app 解析
- **WHEN** 查询某套房源的视频展示信息
- **THEN** 系统 SHALL 优先使用 `videos_resolved`，或复用 `apps.media.services.resolve_media_refs()`，根据 `videos[].media_id` 按原顺序返回平铺增强后的 `videos=[{"media_id": ..., "url": ..., ...}]`

#### Scenario: 房源视频不允许重复引用
- **WHEN** 为同一 House 保存包含重复 `media_id` 的视频列表
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 视频允许跨房源复用
- **WHEN** 不同 House 引用同一个 `media_id`
- **THEN** 系统允许保存，不对 `MediaFile` 做跨房源唯一限制

#### Scenario: 房源视频必须使用合法资源类型
- **WHEN** 为 House 保存视频列表，且其中某个 MediaFile 不是 `house_video` 资源类型
- **THEN** 系统阻止保存并返回校验错误

### Requirement: 项目与房源媒体文件存储
系统 SHALL 复用现有 `apps.media.MediaFile` 与 `S3MediaStorage` 存储项目图片、房源图片和房源视频文件，文件使用组织作用域上传路径。

#### Scenario: MediaRefsField 保存前校验媒体引用
- **WHEN** 保存 House.images 或 House.videos
- **THEN** 系统 SHALL 通过 `MediaRefsField` 调用 `apps.media.services.validate_media_refs()` 校验 `media_id` 存在性和重复引用，剔除平台派生字段，并在 house 域继续校验组织权限

#### Scenario: MediaRefsField 声明资源类型
- **WHEN** 定义 House.images 和 House.videos 字段
- **THEN** images SHALL 声明 `allowed_media_types=[MediaType.IMAGE]` 和 `allowed_resource_types=[ResourceType.HOUSE_IMAGE]`，videos SHALL 声明 `allowed_media_types=[MediaType.VIDEO]` 和 `allowed_resource_types=[ResourceType.HOUSE_VIDEO]`

#### Scenario: 项目图片使用独立资源类型
- **WHEN** 定义 Estate.images 字段
- **THEN** Estate.images SHALL 声明 `allowed_media_types=[MediaType.IMAGE]` 和 `allowed_resource_types=[ResourceType.ESTATE_IMAGE]`

#### Scenario: 使用组织作用域上传路径
- **WHEN** 上传项目图片、房源图片或房源视频
- **THEN** 文件路径 SHALL 使用并校验为 `uploads/orgs/<organization_id>/...`

#### Scenario: 项目图片资源类型
- **WHEN** 登记项目图片 MediaFile
- **THEN** resource_type SHALL 为 `estate_image`

#### Scenario: 房源图片资源类型
- **WHEN** 登记房源图片 MediaFile
- **THEN** resource_type SHALL 为 `house_image`

#### Scenario: 房源图片格式限制
- **WHEN** 上传房源图片
- **THEN** 系统 SHALL 只允许 jpg、jpeg、png、webp 图片格式

#### Scenario: 房源视频资源类型
- **WHEN** 登记房源视频 MediaFile
- **THEN** resource_type SHALL 为 `house_video`

#### Scenario: 房源视频格式限制
- **WHEN** 上传房源视频
- **THEN** 系统 SHALL 只允许 mp4、mov、avi 视频格式

### Requirement: 删除房源不物理删除媒体文件
系统 SHALL 在 House 删除时随 House 一并删除图片和视频配置，但 SHALL NOT 在本 change 中物理删除关联的 MediaFile 或对象存储文件。

#### Scenario: 删除房源时删除媒体配置
- **WHEN** 删除 House 记录
- **THEN** 该 House 的图片和视频配置随 House 一并删除

#### Scenario: 保留媒体文件记录
- **WHEN** 房源媒体配置移除某个 `media_id`
- **THEN** 关联的 MediaFile 记录和对象存储文件保持不变，等待统一媒体延迟清理流程处理

### Requirement: 媒体引用自动清理收集
系统 SHALL 使用 `MediaRefsField` 保存 Estate.images、House.images、House.videos、Lease.contract_files，使媒体平台可自动收集这些固定字段中的所有 `media_id`。当前版本 SHALL NOT 为这些固定字段额外注册 `MEDIA_REFERENCE_PROVIDERS`。

#### Scenario: 自动收集固定媒体字段引用
- **WHEN** 媒体平台执行延迟清理前收集引用
- **THEN** 媒体平台通过 `MediaRefsField` 自动收集所有仍被 Estate、House、Lease 引用的 `media_id`

#### Scenario: 动态 JSON 媒体引用才需要 provider
- **WHEN** 后续在 `extra` 等动态 JSON 或普通 JSONField 中保存媒体引用
- **THEN** house 域才需要新增 provider 并注册到 `MEDIA_REFERENCE_PROVIDERS`
