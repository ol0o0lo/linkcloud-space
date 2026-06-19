## ADDED Requirements

### Requirement: 房源图片管理
系统 SHALL 不提供独立的 HouseImage 模型，而是在 House 上保存有序的房源图片 `MediaFile` ID 列表。

#### Scenario: 保存图片列表
- **WHEN** 为 House 保存房源图片列表，提供已登记的 MediaFile ID 数组
- **THEN** 记录保存成功，数组顺序即图片展示顺序

#### Scenario: 允许空图片列表
- **WHEN** 为 House 保存空的房源图片列表
- **THEN** 记录保存成功，表示该房源当前暂无图片

#### Scenario: 图片列表数量上限
- **WHEN** 为 House 保存超过 9 个 `media_file_id`
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 禁止裸 URL 图片
- **WHEN** 保存 House 的图片配置
- **THEN** 系统 SHALL 通过 MediaFile ID 引用图片，不保存裸 url 字符串

#### Scenario: 默认排序
- **WHEN** 查询某套房源的图片列表
- **THEN** 按 House 中保存的数组顺序排列

#### Scenario: 图片详情通过 media app 解析
- **WHEN** 查询某套房源的图片展示信息
- **THEN** 系统 SHALL 复用 `apps.media` 的既有能力，根据 `media_file_id` 解析图片 `url` 与媒体元信息，而不是在房源域自行拼装文件 URL

#### Scenario: 第一张图片视为封面
- **WHEN** 查询某套房源的图片列表
- **THEN** 数组中的第一张图片视为封面图

#### Scenario: 房源图片不允许重复引用
- **WHEN** 为同一 House 保存包含重复 `media_file_id` 的图片列表
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 图片允许跨房源复用
- **WHEN** 不同 House 引用同一个 `media_file_id`
- **THEN** 系统允许保存，不对 `MediaFile` 做跨房源唯一限制

#### Scenario: 房源图片必须使用合法资源类型
- **WHEN** 为 House 保存图片列表，且其中某个 MediaFile 不是 `house_image` 资源类型
- **THEN** 系统阻止保存并返回校验错误

### Requirement: 房源图片文件存储
系统 SHALL 复用现有 `apps.media.MediaFile` 与 `S3MediaStorage` 存储房源图片文件，图片文件使用组织作用域上传路径。

#### Scenario: 使用组织作用域上传路径
- **WHEN** 上传房源图片
- **THEN** 文件路径 SHALL 使用并校验为 `uploads/orgs/<organization_id>/...`

#### Scenario: 房源图片资源类型
- **WHEN** 登记房源图片 MediaFile
- **THEN** resource_type SHALL 为 `house_image`

#### Scenario: 房源图片格式限制
- **WHEN** 上传房源图片
- **THEN** 系统 SHALL 只允许 jpg、jpeg、png、webp 图片格式

### Requirement: 删除房源不物理删除媒体文件
系统 SHALL 在 House 删除时随 House 一并删除图片配置，但 SHALL NOT 在本 change 中物理删除关联的 MediaFile 或对象存储文件。

#### Scenario: 删除房源时删除图片配置
- **WHEN** 删除 House 记录
- **THEN** 该 House 的图片配置随 House 一并删除

#### Scenario: 保留媒体文件记录
- **WHEN** 房源图片配置移除某个 `media_file_id`
- **THEN** 关联的 MediaFile 记录和对象存储文件保持不变，等待统一媒体清理流程处理
