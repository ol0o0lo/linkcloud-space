## Why

系统需要管理住宅房源的出租业务，涵盖项目片区/楼栋/房源三级空间结构、联系人（房东/租客）、登记出租方绑定、轻量带看记录和租约管理。中介可先录入房东信息和带看过程，房东注册账号后通过手机号自动关联，登录后只能查看自己名下房源和租约，实现完整的出租管理闭环。

现有项目已经具备 `organizations` 多租户基础设施，因此房源相关数据在第一版就应明确归属到组织，避免后续补租户隔离时对唯一约束、查询条件和数据迁移产生大面积返工。

## What Changes

- 新增 `Estate`（项目片区/小区容器）模型：基础档案 + 展示名 + 省市区 + 详细地址 + 项目级坐标 + 项目图片媒体引用列表
- 新增 `Building`（楼栋）模型：挂项目片区，含楼层、电梯，以及楼栋级精确坐标
- 新增 `House`（房源）模型：挂楼栋，含出租方、户型、面积、朝向、装修、status、房源图片/视频媒体引用列表、内外描述与扩展字段
- 新增 `Contact`（联系人）模型：房东/租客统一管理，支持延迟关联 User
- 在 `House` 上直接新增 `landlord`（登记出租方）关联到 Contact，当前版本只支持单一登记出租方
- 新增 `ViewingRecord`（带看记录）模型：后台中介录入客户预约、已带看、取消、爽约、成交等轻量过程记录
- 新增 `Lease`（租约）模型：House 绑定租客 Contact，含签约时间、租期、租金、状态、合同文件媒体引用列表与扩展字段
- 顶层空间模型与核心业务事实纳入 `Organization` 作用域，其中 House 通过 `Building -> Estate` 推导组织归属，唯一约束按组织或父级隔离
- 收紧关键数据约束：联系人归属、带看归属、租约并发、房源状态重算、房源媒体引用仅允许合法 `MediaFile` 且首图为封面
- 复用现有 `apps/media` + `S3MediaStorage` / MinIO 文件体系存储项目图片、房源图片/视频和租约合同，并按 `docs/media-platform.md` 使用 `MediaRefsField` 保存 `media_id` 平铺引用对象
- 新增 Django admin 注册
- 新增 Django migrations

## Capabilities

### New Capabilities

- `space-hierarchy`: 项目片区/楼栋/房源三级空间结构管理
- `house-image`: 房源图片/视频媒体引用管理
- `contact-management`: 联系人管理，支持房东账号延迟关联
- `ownership`: 房源登记出租方绑定，基于 `House.landlord` 管理
- `viewing-management`: 轻量带看记录管理，不扩展完整 CRM 线索池
- `lease-management`: 租约管理，关联租客 Contact，含状态流转

### Modified Capabilities

（无）

## Impact

- 新增 Django app `apps/house/`
- 新增 6 张数据库表
- 依赖现有 `apps/accounts/` 的 User 模型（Contact.user FK）
- 依赖现有 `apps/organizations/` 的 Organization 模型作为数据归属边界
- 依赖现有 `apps/media.MediaFile` 作为房源图片/视频和租约合同的文件登记表
- 固定媒体字段使用 `MediaRefsField` 自动参与媒体引用收集；当前不为这些字段额外注册 `MEDIA_REFERENCE_PROVIDERS`
- 不新增房源业务 API；仅扩展现有媒体资源类型，为后续 ninja API 扩展做准备
