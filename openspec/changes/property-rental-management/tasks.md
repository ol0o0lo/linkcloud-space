## 1. 创建 Django App

- [x] 1.1 在 `apps/` 下创建 `house/` app（`__init__.py`、`apps.py`、`models.py`、`admin.py`、`migrations/__init__.py`）
- [x] 1.2 在 `config/settings/_base.py` 的 `INSTALLED_APPS` 中注册 `apps.house`

## 2. 扩展媒体文件类型

- [x] 2.1 在 `apps/media/constants.py` 中新增 `ResourceType.ESTATE_IMAGE = "estate_image"`、`ResourceType.HOUSE_IMAGE = "house_image"`、`ResourceType.HOUSE_VIDEO = "house_video"` 和 `ResourceType.LEASE_CONTRACT = "lease_contract"`
- [x] 2.2 扩展 `MediaExtension`，至少支持租约合同 `pdf`，如业务需要再补 `doc` / `docx`
- [x] 2.3 确认项目图片、房源图片、房源视频和租约合同上传使用 `scope=org`，对象路径为 `uploads/orgs/<organization_id>/...`
- [x] 2.4 补充媒体服务或 schema 测试，覆盖新增资源类型和合同扩展名

## 3. 空间层级模型

- [x] 3.1 创建 `Estate` 模型：organization(FK→Organization, PROTECT)、name、display_name、developer、built_year、property_type(choices)、province、city、district、address、lat、lng、images(MediaRefsField, default=list, max_items=9)、description，并明确其坐标是项目/小区级定位
- [x] 3.2 创建 `Building` 模型：organization(FK→Organization, PROTECT)、estate(FK→Estate, PROTECT)、name、floors、under_floors、year_built、elevator(default=False)、lat、lng、address，并明确其坐标是楼栋级精确定位
- [x] 3.3 创建 `House` 模型：building(FK→Building, PROTECT)、landlord(FK→Contact, null=True, blank=True, PROTECT)、room_number、floor、area、interior_area、bedrooms、living_rooms、bathrooms、kitchens、balconies、orientation(choices)、decoration(choices)、has_elevator_access、status(choices: vacant/listed/rented/renovating/inactive, default=vacant)、images(MediaRefsField, default=list, max_items=9)、videos(MediaRefsField, default=list, max_items=3)、tags(JSONField, default=list)、public_description、internal_notes、extra(JSONField, default=dict)
- [x] 3.4 为 Estate/Building/House 添加所有 choices 常量、`__str__` 方法和唯一约束（项目片区名、楼栋名称、房号）
- [x] 3.5 为 Building 增加 organization 一致性校验，并明确 House 通过 `Building -> Estate` 推导组织归属
- [x] 3.6 明确并实现 Estate 与 Building 的定位分层语义：Estate 用于项目级展示，Building 用于精确导航；城中村场景以 Building 定位为主

## 4. 房源媒体配置

- [x] 4.1 在 `Estate` 和 `House` 上用 `MediaRefsField` 实现 `images` 有序媒体引用对象列表字段，每个 item 至少包含 `media_id`，可平铺保存 `media_type`、`label`、`image_role`、`room` 等业务字段
- [x] 4.2 为 `Estate.images` 声明 `allowed_media_types=[MediaType.IMAGE]`、`allowed_resource_types=[ResourceType.ESTATE_IMAGE]`，为 `House.images` 声明 `allowed_media_types=[MediaType.IMAGE]`、`allowed_resource_types=[ResourceType.HOUSE_IMAGE]`，由 `MediaRefsField` 调用 `validate_media_refs()` 校验存在性、重复引用并剔除平台派生字段
- [x] 4.3 明确并实现“第一张图片即封面图”的约定
- [x] 4.3.1 允许空图片列表，空列表表示“暂无图片”
- [x] 4.3.2 限制单套房源图片数量最多 9 张，并允许同一 `MediaFile` 被多个房源复用
- [x] 4.4 在 `House` 上用 `MediaRefsField` 实现 `videos` 有序媒体引用对象列表字段，声明 `max_items=3`、`allowed_media_types=[MediaType.VIDEO]`、`allowed_resource_types=[ResourceType.HOUSE_VIDEO]`，视频格式限制 mp4 / mov / avi
- [x] 4.5 图片/视频展示信息优先使用 `images_resolved` / `videos_resolved`，或显式复用 `apps.media.services.resolve_media_refs()` 回显平铺增强后的 `images` / `videos`，不在 `house` 域自行拼装文件地址或保存增强后的 URL 数据
- [x] 4.6 图片/视频说明文字使用业务字段 `label`，不写入 `MediaFile`，且不额外包一层 `meta`
- [x] 4.7 确认 Estate.images、House.images、House.videos 使用 `MediaRefsField` 后可被媒体平台自动收集引用，不为这些固定字段手写 provider
- [x] 4.8 若后续在 `extra` 等动态 JSON 中保存媒体引用，再新增 `MEDIA_REFERENCE_PROVIDERS`；当前版本不需要

## 5. 联系人模型

- [x] 5.1 创建 `Contact` 模型：organization(FK→Organization, PROTECT)、name、phone、email、roles、user(FK→settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=SET_NULL)、notes、is_active
- [x] 5.2 为 Contact 添加组织内手机号唯一约束、角色校验和 `__str__` 方法
- [x] 5.3 设计 Contact 角色存储方式（可多角色），保证 landlord / tenant 可并存
- [x] 5.4 明确并实现 Contact 自动认领规则：仅当前组织、仅未绑定联系人、已绑定不抢占、同用户重复绑定幂等成功、换号后仅认领新手机号联系人
- [x] 5.5 创建统一 Contact 自动认领入口（如 `claim_landlord_contact_for_bound_phone(user, organization, phone)`），只在手机号成功绑定后触发
- [x] 5.6 注册、补绑手机号、第三方登录补绑手机号、换绑手机号等流程统一委托到该入口；无明确 organization 上下文时跳过自动认领

## 6. 登记出租方绑定

- [x] 6.1 在 `House` 上添加 `landlord(FK→Contact, null=True, blank=True, PROTECT)` 字段，直接保存登记出租方
- [x] 6.2 添加 `landlord` 必须具备 landlord 角色的校验
- [x] 6.3 添加 `House.building.estate.organization` 与 `landlord.organization` 一致性校验（当 landlord 非空时）
- [x] 6.4 在模型与文档层明确 V1 仅支持单一登记出租方，不为多人业主/多主体提供隐式兼容实现
- [x] 6.5 房东视角查询统一基于 `House.landlord -> Contact.user` 实现
- [x] 6.6 管理员创建房源时支持直接选择已有 landlord Contact，或在同一操作流内快速新建 landlord Contact
- [x] 6.7 允许 `House.landlord` 为空完成建档，但在签约前必须补齐

## 7. 带看记录模型

- [x] 7.1 创建 `ViewingRecord` 模型：organization(FK→Organization, PROTECT)、house(FK→House, PROTECT)、contact(FK→Contact, null=True, blank=True, PROTECT)、customer_name、customer_phone、scheduled_at、viewed_at、status(choices: scheduled/viewed/canceled/no_show/converted, default=scheduled)、assigned_to(FK→settings.AUTH_USER_MODEL, null=True, blank=True, SET_NULL)、notes、extra(JSONField, default=dict)、is_active
- [x] 7.2 添加 ViewingRecord.status choices 常量、`__str__` 方法和字段合法性校验
- [x] 7.3 校验 ViewingRecord.organization 与 House.building.estate.organization 一致
- [x] 7.4 当 contact 非空时，校验 contact.organization 与 ViewingRecord.organization 一致，并建议 contact 具备 tenant 角色
- [x] 7.5 明确并实现临时客户信息允许不建 Contact：customer_name/customer_phone 可直接记录预约客户
- [x] 7.6 明确 V1 只做轻量带看记录，不实现线索池、渠道归因、跟进任务、佣金结算

## 8. 租约模型

- [x] 8.1 创建 `Lease` 模型：organization(FK→Organization, PROTECT)、house(FK→House, PROTECT)、tenant(FK→Contact, PROTECT)、sign_at、start_date、end_date、monthly_rent、deposit、payment_day(default=1)、status(choices: pending/active/expired/terminated, default=pending)、contract_files(MediaRefsField, default=list, max_items=1)、notes、extra(JSONField, default=dict)
- [x] 8.2 添加 tenant 角色校验、日期范围校验、金额非负校验、payment_day 范围校验和 `__str__` 方法
- [x] 8.3 为同一 House 的 active Lease 添加条件唯一约束
- [x] 8.4 为 Lease.contract_files 声明 `max_items=1`、`allowed_media_types=[MediaType.FILE]`、`allowed_resource_types=[ResourceType.LEASE_CONTRACT]`，由 `MediaRefsField` 校验并清洗稳定引用
- [x] 8.5 添加 Lease.organization、House.building.estate.organization、tenant.organization 一致性校验
- [x] 8.6 添加“创建 Lease 前 House.landlord 必须非空”的校验
- [x] 8.7 为 Lease 增加可选 `source_viewing_record`，记录成交来源带看，并校验同组织、同房源、converted 状态及已关联租客一致性

## 9. 租约与房态弱关系

- [x] 9.1 Lease 仅通过 House 外键保留业务记录和历史追溯能力
- [x] 9.2 Lease 新增、更新、到期、迁移或删除不自动修改 House.status
- [x] 9.3 移除 Lease 保存、删除信号和自动房态重算服务
- [x] 9.4 House.status 由房源维护接口或其他显式运营动作独立修改
- [x] 9.5 通过测试锁定租约状态变化不影响房态的行为

## 10. 租约重复激活校验

- [x] 10.1 在 `Lease.clean()` 中校验：同一 House 不能有两条 active 状态租约
- [x] 10.2 在 `Lease.save()` 中调用 `full_clean()` 触发校验
- [x] 10.3 用数据库条件唯一约束兜底并发场景
- [x] 10.4 当前版本不额外校验 `pending`、历史或未来租约的日期重叠，只约束 `active` 并发

## 11. 生成 Migration

- [x] 11.1 运行 `python manage.py makemigrations house` 生成初始 migration
- [x] 11.2 检查 migration 文件内容正确
- [x] 11.3 运行 `python manage.py migrate` 验证可执行

## 12. Django Admin 注册

- [x] 12.1 注册 `EstateAdmin`：list_display=(name, display_name, property_type, city)，search_fields=(name, display_name)
- [x] 12.2 注册 `BuildingAdmin`：list_display=(name, estate, floors, elevator, lat, lng)，list_filter=(estate)
- [x] 12.3 注册 `HouseAdmin`：list_display=(room_number, building, landlord, floor, status)，list_filter=(status, decoration, orientation)，并提供登记出租方与房源媒体引用配置的可读编辑方式
- [x] 12.3.1 在 HouseAdmin 中优化管理员建房流程：支持直接选择已有 landlord，或快速新建 landlord Contact 后回填 landlord
- [x] 12.4 注册 `ContactAdmin`：list_display=(name, phone, roles, user, is_active)，list_filter=(is_active,)，并提供 roles 可读展示
- [x] 12.5 注册 `ViewingRecordAdmin`：list_display=(house, customer_name, customer_phone, scheduled_at, viewed_at, status, assigned_to, is_active)，list_filter=(status, is_active, assigned_to)，search_fields=(customer_name, customer_phone, house__room_number)
- [x] 12.6 注册 `LeaseAdmin`：list_display=(house, tenant, source_viewing_record, sign_at, start_date, end_date, monthly_rent, status)，list_filter=(status,)
- [x] 12.7 在 admin 中按 organization 提供过滤与搜索字段，并为删除受 PROTECT 阻止的模型提供清晰提示

## 13. 测试

- [x] 13.1 创建 `tests/house/__init__.py` 和 `tests/house/test_models.py`
- [x] 13.2 测试 Estate/Building/House 层级创建、组织归属、定位字段和删除保护
- [x] 13.2.1 测试 Building 的 organization 一致性校验、楼栋级定位字段，以及 House 组织归属通过 `Building -> Estate` 推导
- [x] 13.3 测试 Contact 组织内手机号唯一、跨组织可重复、以及 landlord 自动认领逻辑
- [x] 13.3.1 测试 Contact 自动认领的幂等、跨组织隔离、已绑定不抢占、手机号变更后仅认领新手机号联系人
- [x] 13.3.2 测试所有手机号绑定入口都委托到统一 Contact 自动认领服务，且无 organization 上下文时安全跳过
- [x] 13.4 测试 `House.landlord` 的 landlord 角色校验、可为空和替换更新行为
- [x] 13.4.1 测试 `House.landlord.organization` 与房源组织归属一致性，以及房东视角查询范围
- [x] 13.4.2 测试当前版本多人业主场景被明确阻止
- [x] 13.4.3 测试管理员可在建房时直接绑定已有 landlord，或先空置 landlord 完成建档
- [x] 13.5 测试 ViewingRecord 创建、状态枚举、临时客户信息、contact 可空、assigned_to 可空和 is_active 默认值
- [x] 13.5.1 测试 ViewingRecord.organization 与 House.building.estate.organization 一致性，以及 contact 组织一致性校验
- [x] 13.5.2 测试 ViewingRecord 标记为 converted 时不自动创建 Lease，成交租约仍需显式创建
- [x] 13.6 测试 Lease 状态变更、房源迁移与删除均不修改 House.status
- [x] 13.6.1 测试 API 激活租约时保持房态不变
- [x] 13.7 测试 Lease 重复 active 校验、数据库条件唯一约束和字段合法性校验
- [x] 13.7.1 测试 Lease 与 House.building.estate、tenant 的 organization 一致性校验
- [x] 13.7.2 测试对 `landlord is null` 的 House 创建 Lease 会被明确阻止
- [x] 13.7.3 测试 Lease 可追溯 converted ViewingRecord 成交来源，并拒绝非 converted、跨房源或已关联租客不一致的来源记录
- [x] 13.8 测试 `Estate.images` 与 `House.images` 的顺序、首图封面约定、空列表、9 张上限、重复 `media_id` 校验、跨对象复用、平铺业务字段保留，以及 `house_image` 类型校验
- [x] 13.8.1 测试项目图片与房源图片详情查询使用 `images_resolved` 或 `resolve_media_refs()`，并按 `images` 顺序回显增强列表
- [x] 13.8.2 测试 `House.videos` 的顺序、空列表、3 个上限、重复 `media_id` 校验、`house_video` 类型校验，以及视频详情查询使用 `videos_resolved` 或 `resolve_media_refs()`
- [x] 13.8.3 测试 Estate.images、House.images、House.videos、Lease.contract_files 作为 `MediaRefsField` 可被媒体平台自动收集引用，且当前不需要额外 provider
- [x] 13.9 测试 Lease.contract_files 可选、最多 1 个、媒体引用校验和 `lease_contract` 类型校验
- [x] 13.10 运行 `pytest tests/house/` 确保全部通过
