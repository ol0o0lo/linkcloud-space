## Why

系统需要管理住宅房源的出租业务，涵盖小区/楼栋/房源三级空间结构、联系人（房东/租客）、业权登记和租约管理。中介可先录入房东信息，房东注册账号后通过手机号自动关联，登录后只能查看自己名下房源和租约，实现完整的出租管理闭环。

现有项目已经具备 `organizations` 多租户基础设施，因此房源相关数据在第一版就应明确归属到组织，避免后续补租户隔离时对唯一约束、查询条件和数据迁移产生大面积返工。

## What Changes

- 新增 `Community`（小区）模型：基础档案 + 省市区地址 + 坐标
- 新增 `Building`（楼栋）模型：挂小区，含楼层、电梯、结构类型等
- 新增 `House`（房源）模型：挂楼栋，含户型、面积、朝向、装修、house_status
- 新增 `HouseImage`（房源图片）模型：独立图片表，引用现有 `apps.media.MediaFile`，支持排序和封面
- 新增 `Contact`（联系人）模型：房东/租客统一管理，支持延迟关联 User
- 新增 `Ownership`（业权）模型：House OneToOne 绑定房东 Contact
- 新增 `Lease`（租约）模型：House 绑定租客 Contact，含租期、租金、状态和合同文件引用
- 所有业务模型纳入 `Organization` 作用域，唯一约束按组织隔离
- 收紧关键数据约束：联系人归属、租约并发、房源状态重算、图片封面唯一
- 复用现有 `apps/media` + `S3MediaStorage` / MinIO 文件体系存储房源图片和租约合同
- 新增 Django admin 注册
- 新增 Django migrations

## Capabilities

### New Capabilities

- `space-hierarchy`: 小区/楼栋/房源三级空间结构管理
- `house-image`: 房源图片管理
- `contact-management`: 联系人管理，支持房东账号延迟关联
- `ownership`: 房源业权登记，关联房东 Contact
- `lease-management`: 租约管理，关联租客 Contact，含状态流转

### Modified Capabilities

（无）

## Impact

- 新增 Django app `apps/properties/`
- 新增 7 张数据库表
- 依赖现有 `apps/accounts/` 的 User 模型（Contact.user FK）
- 依赖现有 `apps/organizations/` 的 Organization 模型作为数据归属边界
- 依赖现有 `apps/media.MediaFile` 作为房源图片和租约合同的文件登记表
- 不新增房源业务 API；仅扩展现有媒体资源类型，为后续 ninja API 扩展做准备
