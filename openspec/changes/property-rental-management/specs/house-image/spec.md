## ADDED Requirements

### Requirement: 房源图片管理
系统 SHALL 提供 HouseImage 模型，FK 到 House(CASCADE)，字段：media_file(OneToOne→MediaFile, PROTECT)、caption、is_cover(default=False)、order(default=0)。

#### Scenario: 创建图片
- **WHEN** 为 House 创建 HouseImage，提供已登记的 MediaFile
- **THEN** 记录保存成功，is_cover 默认 False，order 默认 0

#### Scenario: 禁止裸 URL 图片
- **WHEN** 创建 HouseImage
- **THEN** 系统 SHALL 通过 MediaFile 引用图片，不保存裸 url 字符串

#### Scenario: 默认排序
- **WHEN** 查询某套房源的图片列表
- **THEN** 按 order 升序排列

#### Scenario: 单套房源只有一张封面
- **WHEN** 为同一 House 设置第二张 `is_cover=True` 的 HouseImage
- **THEN** 数据库唯一约束阻止保存

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

### Requirement: 删除房源级联删除图片
系统 SHALL 在 House 删除时级联删除所有关联 HouseImage 记录，但 SHALL NOT 在本 change 中物理删除关联的 MediaFile 或对象存储文件。

#### Scenario: 级联删除
- **WHEN** 删除 House 记录
- **THEN** 所有关联 HouseImage 自动删除

#### Scenario: 保留媒体文件记录
- **WHEN** HouseImage 被删除
- **THEN** 关联的 MediaFile 记录和对象存储文件保持不变，等待统一媒体清理流程处理
