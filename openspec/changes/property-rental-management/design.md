## Context

项目采用 Django 5 + django-ninja 架构，已有 `apps/accounts/`（User 模型）、`apps/organizations/` 等 app。本次新增房源出租管理数据层，建立空间层级 + 人员 + 业权 + 租约的完整闭环，为后续 ninja API 和前端 SPA 提供数据基础。

## Goals / Non-Goals

**Goals:**
- 建立 7 张模型：Community / Building / House / HouseImage / Contact / Ownership / Lease
- 所有业务模型显式归属 `Organization`
- Contact 支持延迟关联 User（房东注册时通过手机号自动认领）
- Ownership 实现房源与房东的绑定，支持房东视角查询
- HouseImage 和 Lease 合同文件复用现有 `apps.media.MediaFile` 文件登记表
- House.house_status 作为冗余快照字段，真相来自 Lease 表
- 用数据库约束兜底关键唯一性与数据合法性
- 注册 Django admin，生成完整 migrations

**Non-Goals:**
- 不包含 ninja API（后续单独 change）
- 不包含前端页面
- 不包含 LeaseRenewal、PaymentRecord（后续迭代）
- 不包含出售相关字段
- 不包含租金账单、付款流水、催收流程

## Decisions

### 1. 新建独立 app `apps/properties/`

**选择**：新建独立 app。

**理由**：房源出租是独立业务域，边界清晰，便于后续扩展 API、Celery 任务、信号等。

### 2. 所有业务模型都带 `organization` 归属

**选择**：`Community / Building / House / Contact / Ownership / Lease` 均直接带 `organization` FK；`HouseImage` 通过 `house` 间接归属。

**理由**：项目已有组织维度的权限和上下文，请求期有 `request.org`。在第一版就建立组织边界，可以让 admin、后续 API、唯一约束和查询逻辑保持一致，避免事后补列和回填数据。

### 3. 地址字段内嵌于 Community，Building 不重复存地址

**选择**：省市区地址和坐标放在 Community，Building 只存楼栋自身属性。

**理由**：同一小区内所有楼栋地址相同，放 Community 避免重复；楼栋只需要名称、楼层数等自身信息。

### 4. Contact 统一管理房东和租客，支持延迟关联 User

**选择**：
```
Contact
  organization: FK→Organization
  roles: landlord / tenant（可同时具备）
  user: FK→User, null=True
  phone: 组织内唯一
```

**延迟关联流程**：
1. 中介创建 Contact(landlord)，user=null
2. 房东注册或绑定手机号完成后，系统查 `Contact.objects.filter(organization=当前组织, phone=注册手机号, user__isnull=True)`
3. 找到则自动关联 `Contact.user = 新建User`

**理由**：统一 Contact 表避免 Landlord/Tenant 分表冗余；联系人在真实业务里可能既是房东又是租客，因此角色不应强制互斥；手机号只在组织内唯一，避免跨组织录入冲突。

### 5. Ownership 使用 OneToOne 约束一房一东

**选择**：`house = OneToOneField(House, on_delete=PROTECT)`

**理由**：业务上一套房只有一个登记房东，OneToOne 在数据库层强制保证，无需业务层额外校验。

### 6. House.house_status 是冗余快照字段，采用“重算”而不是“直写”

**选择**：House 上保留 `house_status` 字段，但在 Lease 新增、更新、删除后重新计算房态：
- 若存在 active Lease，则设为 `rented`
- 若不存在 active Lease，且当前房态不是 `locked` / `renovating`，则设为 `vacant`
- `locked` / `renovating` 视为人工控制状态，不被普通租约结束直接覆盖

**理由**：直接过滤 `House.objects.filter(house_status='vacant')` 比 JOIN Lease 表快；但真相来源是 Lease。使用“重算”可避免多条租约切换、删除、或人工锁房时的状态误写。

### 7. 关键一致性优先用数据库约束兜底

**选择**：
- 同一 `organization` 下 `Community.name` 唯一
- 同一 `community` 下 `Building.code` 唯一
- 同一 `building` 下 `House.room_number` 唯一
- 同一 `organization` 下 `Contact.phone` 唯一
- 同一 `house` 仅允许一条 `is_cover=True` 的 HouseImage
- 同一 `house` 仅允许一条 `status='active'` 的 Lease

**理由**：`clean()` 适合业务提示，但并发场景仍需数据库保证最终一致性。

### 8. 房源图片和租约合同复用 `apps/media`

**选择**：不在 `apps/properties` 中直接定义 `ImageField` / `FileField`，也不保存裸 `url`；统一通过 `MediaFile` 引用对象存储中的文件。

```
HouseImage
  house: FK→House, CASCADE
  media_file: OneToOneField→MediaFile, PROTECT
  caption: str
  is_cover: bool
  order: int

Lease
  contract_file: FK→MediaFile, null=True, blank=True, on_delete=PROTECT
```

**上传流程**：
1. 前端或后续 API 使用 `apps/media` 获取组织作用域上传路径，`scope=org`，`object_id=Organization.pk`
2. 文件上传到 `S3MediaStorage` 管理的对象存储，本地开发落到 MinIO
3. 调用媒体确认接口登记 `MediaFile`
4. 创建 `HouseImage` 或 `Lease` 时保存 `media_file_id`

**媒体类型**：
- 房源图片使用 `ResourceType.HOUSE_IMAGE`，允许 `jpg` / `jpeg` / `png` / `webp`
- 租约合同使用 `ResourceType.LEASE_CONTRACT`，至少允许 `pdf`；若业务需要可扩展 `doc` / `docx`

**归属边界**：`MediaFile` 只负责文件元数据和对象存储路径，业务归属仍以 `House.organization` / `Lease.organization` 为准。后续 API 在绑定 `media_file` 时必须校验当前用户属于该组织，并优先使用、校验 `uploads/orgs/<organization_id>/...` 路径。

**删除策略**：删除 `House` 时 `HouseImage` 记录随 House 级联删除；`MediaFile` 及对象存储中的文件不在本 change 中物理删除，避免误删仍被其他业务引用的文件。后续可通过媒体清理任务处理孤儿文件。

**理由**：项目已经有 `MediaFile.file = FileField(storage=S3MediaStorage())`、直传确认和服务端上传能力。复用这一层可以统一 MinIO/S3 URL 生成、上传审计、文件元数据和后续权限控制，避免房源域单独维护一套文件存储规则。

## Risks / Trade-offs

- [状态不一致] house_status 与 Lease 状态可能不同步 → 在 Lease save/delete 信号或服务层统一重算
- [手机号认领边界] 项目同时存在手机注册、验证码登录、微信绑定手机号 → 后续实现需把 Contact 自动认领挂到统一手机号绑定流程
- [跨组织数据串读] 若后续 API 忘记按 organization 过滤会越权 → 第一版就建立组织外键和约束，减少漏过滤概率
- [删除限制] House 被 Ownership / Lease PROTECT 后，HouseImage 的 CASCADE 只会在 House 真正可删除时发生 → admin 需给出可读提示
- [媒体孤儿文件] 删除 HouseImage 不直接删除 MediaFile 或对象存储文件 → 后续通过统一媒体清理任务处理，避免误删共享或误关联文件
- [合同扩展名] 当前媒体模块只允许图片扩展名 → 实现本 change 时需扩展 `MediaExtension` 和 `ResourceType`

## Migration Plan

1. 新建 `apps/properties/` app，注册到 `INSTALLED_APPS`
2. 扩展 `apps/media` 的 `ResourceType` 和合同文件扩展名
3. 按依赖顺序建模型：Community → Building → House → HouseImage → Contact → Ownership → Lease
4. 运行 `makemigrations properties`
5. 为唯一约束、检查约束和条件唯一约束生成 migration
6. 注册 admin
7. 运行测试确认 migration 正常执行
