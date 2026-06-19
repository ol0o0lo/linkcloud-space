## 1. 创建 Django App

- [ ] 1.1 在 `apps/` 下创建 `house/` app（`__init__.py`、`apps.py`、`models.py`、`admin.py`、`migrations/__init__.py`）
- [ ] 1.2 在 `config/settings/_base.py` 的 `INSTALLED_APPS` 中注册 `apps.house`

## 2. 扩展媒体文件类型

- [ ] 2.1 在 `apps/media/constants.py` 中新增 `ResourceType.HOUSE_IMAGE = "house_image"`、`ResourceType.HOUSE_VIDEO = "house_video"` 和 `ResourceType.LEASE_CONTRACT = "lease_contract"`
- [ ] 2.2 扩展 `MediaExtension`，至少支持租约合同 `pdf`，如业务需要再补 `doc` / `docx`
- [ ] 2.3 确认房源图片和租约合同上传使用 `scope=org`，对象路径为 `uploads/orgs/<organization_id>/...`
- [ ] 2.4 补充媒体服务或 schema 测试，覆盖新增资源类型和合同扩展名

## 3. 空间层级模型

- [ ] 3.1 创建 `Estate` 模型：organization(FK→Organization, PROTECT)、name、display_name、developer、built_year、property_type(choices)、province、city、district、address、lat、lng、images(JSONField, default=list)、description、is_active，并明确其坐标是项目/小区级定位
- [ ] 3.2 创建 `Building` 模型：organization(FK→Organization, PROTECT)、estate(FK→Estate, PROTECT)、name、floors、under_floors、year_built、elevator(default=False)、lat、lng、address、is_active，并明确其坐标是楼栋级精确定位
- [ ] 3.3 创建 `House` 模型：building(FK→Building, PROTECT)、landlord(FK→Contact, null=True, blank=True, PROTECT)、room_number、floor、area、interior_area、bedrooms、living_rooms、bathrooms、kitchens、balconies、orientation(choices)、decoration(choices)、has_elevator_access、status(choices, default=vacant)、images(JSONField, default=list)、videos(JSONField, default=list)、tags(JSONField, default=list)、public_description、internal_notes、extra(JSONField, default=dict)、is_active
- [ ] 3.4 为 Estate/Building/House 添加所有 choices 常量、`__str__` 方法和唯一约束（项目片区名、楼栋名称、房号）
- [ ] 3.5 为 Building 增加 organization 一致性校验，并明确 House 通过 `Building -> Estate` 推导组织归属
- [ ] 3.6 明确并实现 Estate 与 Building 的定位分层语义：Estate 用于项目级展示，Building 用于精确导航；城中村场景以 Building 定位为主

## 4. 房源媒体配置

- [ ] 4.1 在 `Estate` 和 `House` 上实现 `images` 有序媒体引用对象列表字段，每个 item 至少包含 `media_id`，可平铺保存 `media_type`、`label`、`image_role`、`room` 等业务字段
- [ ] 4.2 保存 `images` 前调用 `apps.media.services.validate_media_refs()` 校验 `media_id` 存在性和重复引用，并在 house 域校验每个 `MediaFile.resource_type` 必须为 `house_image`
- [ ] 4.3 明确并实现“第一张图片即封面图”的约定
- [ ] 4.3.1 允许空图片列表，空列表表示“暂无图片”
- [ ] 4.3.2 限制单套房源图片数量最多 9 张，并允许同一 `MediaFile` 被多个房源复用
- [ ] 4.4 在 `House` 上实现 `videos` 有序媒体引用对象列表字段，校验不允许重复 `media_id`、上限 3 个、每个 `MediaFile.resource_type` 必须为 `house_video`，视频格式限制 mp4 / mov / avi
- [ ] 4.5 图片/视频展示信息复用 `apps.media.services.get_media_refs_info()` 回显平铺增强后的 `images` / `videos`，不在 `house` 域自行拼装文件地址或保存增强后的 URL 数据
- [ ] 4.6 图片/视频说明文字使用业务字段 `label`，不写入 `MediaFile`，且不额外包一层 `meta`
- [ ] 4.7 创建 `apps/house/media_references.py`，收集 Estate.images、House.images、House.videos、Lease.contract_files 中的所有 `media_id`
- [ ] 4.8 在 `MEDIA_REFERENCE_PROVIDERS` 中注册 house 域 provider，接入媒体平台延迟清理

## 5. 联系人模型

- [ ] 5.1 创建 `Contact` 模型：organization(FK→Organization, PROTECT)、name、phone、email、roles、user(FK→settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=SET_NULL)、notes、is_active
- [ ] 5.2 为 Contact 添加组织内手机号唯一约束、角色校验和 `__str__` 方法
- [ ] 5.3 设计 Contact 角色存储方式（可多角色），保证 landlord / tenant 可并存
- [ ] 5.4 明确并实现 Contact 自动认领规则：仅当前组织、仅未绑定联系人、已绑定不抢占、同用户重复绑定幂等成功、换号后仅认领新手机号联系人
- [ ] 5.5 创建统一 Contact 自动认领入口（如 `claim_landlord_contact_for_bound_phone(user, organization, phone)`），只在手机号成功绑定后触发
- [ ] 5.6 注册、补绑手机号、第三方登录补绑手机号、换绑手机号等流程统一委托到该入口；无明确 organization 上下文时跳过自动认领

## 6. 登记出租方绑定

- [ ] 6.1 在 `House` 上添加 `landlord(FK→Contact, null=True, blank=True, PROTECT)` 字段，直接保存登记出租方
- [ ] 6.2 添加 `landlord` 必须具备 landlord 角色的校验
- [ ] 6.3 添加 `House.building.estate.organization` 与 `landlord.organization` 一致性校验（当 landlord 非空时）
- [ ] 6.4 在模型与文档层明确 V1 仅支持单一登记出租方，不为多人业主/多主体提供隐式兼容实现
- [ ] 6.5 房东视角查询统一基于 `House.landlord -> Contact.user` 实现
- [ ] 6.6 管理员创建房源时支持直接选择已有 landlord Contact，或在同一操作流内快速新建 landlord Contact
- [ ] 6.7 允许 `House.landlord` 为空完成建档，但在签约前必须补齐

## 7. 租约模型

- [ ] 7.1 创建 `Lease` 模型：organization(FK→Organization, PROTECT)、house(FK→House, PROTECT)、tenant(FK→Contact, PROTECT)、sign_at、start_date、end_date、monthly_rent、deposit、payment_day(default=1)、status(choices: pending/active/expired/terminated, default=pending)、contract_files(JSONField, default=list)、notes、extra(JSONField, default=dict)
- [ ] 7.2 添加 tenant 角色校验、日期范围校验、金额非负校验、payment_day 范围校验和 `__str__` 方法
- [ ] 7.3 为同一 House 的 active Lease 添加条件唯一约束
- [ ] 7.4 校验 Lease.contract_files 为空或最多 1 个；保存前调用 `validate_media_refs()`，且每个 `MediaFile.resource_type` 必须为 `lease_contract`
- [ ] 7.5 添加 Lease.organization、House.building.estate.organization、tenant.organization 一致性校验
- [ ] 7.6 添加“创建 Lease 前 House.landlord 必须非空”的校验

## 8. 租约状态信号

- [ ] 8.1 创建统一房态重算入口（服务层或领域方法），集中实现 House.status 的判定逻辑
- [ ] 8.2 创建 `apps/house/signals.py`，监听 Lease 的保存与删除事件，并委托给统一房态重算入口
- [ ] 8.3 若存在 active Lease，自动设 House.status = rented
- [ ] 8.4 若不存在 active Lease，且当前房态不是 locked / renovating，则自动设 House.status = vacant
- [ ] 8.5 在 `apps/house/apps.py` 的 `ready()` 中注册信号
- [ ] 8.6 明确 `locked / renovating > rented > vacant` 的房态优先级，并通过测试锁定行为

## 9. 租约重复激活校验

- [ ] 9.1 在 `Lease.clean()` 中校验：同一 House 不能有两条 active 状态租约
- [ ] 9.2 在 `Lease.save()` 中调用 `full_clean()` 触发校验
- [ ] 9.3 用数据库条件唯一约束兜底并发场景
- [ ] 9.4 当前版本不额外校验 `pending`、历史或未来租约的日期重叠，只约束 `active` 并发

## 10. 生成 Migration

- [ ] 10.1 运行 `python manage.py makemigrations house` 生成初始 migration
- [ ] 10.2 检查 migration 文件内容正确
- [ ] 10.3 运行 `python manage.py migrate` 验证可执行

## 11. Django Admin 注册

- [ ] 11.1 注册 `EstateAdmin`：list_display=(name, display_name, property_type, city, is_active)，search_fields=(name, display_name)
- [ ] 11.2 注册 `BuildingAdmin`：list_display=(name, estate, floors, elevator, lat, lng, is_active)，list_filter=(estate, is_active)
- [ ] 11.3 注册 `HouseAdmin`：list_display=(room_number, building, landlord, floor, status, is_active)，list_filter=(status, decoration, orientation)，并提供登记出租方与房源媒体引用配置的可读编辑方式
- [ ] 11.3.1 在 HouseAdmin 中优化管理员建房流程：支持直接选择已有 landlord，或快速新建 landlord Contact 后回填 landlord
- [ ] 11.4 注册 `ContactAdmin`：list_display=(name, phone, roles, user, is_active)，list_filter=(is_active,)，并提供 roles 可读展示
- [ ] 11.5 注册 `LeaseAdmin`：list_display=(house, tenant, sign_at, start_date, end_date, monthly_rent, status)，list_filter=(status,)
- [ ] 11.6 在 admin 中按 organization 提供过滤与搜索字段，并为删除受 PROTECT 阻止的模型提供清晰提示

## 12. 测试

- [ ] 12.1 创建 `tests/house/__init__.py` 和 `tests/house/test_models.py`
- [ ] 12.2 测试 Estate/Building/House 层级创建、组织归属、定位字段和删除保护
- [ ] 12.2.1 测试 Building 的 organization 一致性校验、楼栋级定位字段，以及 House 组织归属通过 `Building -> Estate` 推导
- [ ] 12.3 测试 Contact 组织内手机号唯一、跨组织可重复、以及 landlord 自动认领逻辑
- [ ] 12.3.1 测试 Contact 自动认领的幂等、跨组织隔离、已绑定不抢占、手机号变更后仅认领新手机号联系人
- [ ] 12.3.2 测试所有手机号绑定入口都委托到统一 Contact 自动认领服务，且无 organization 上下文时安全跳过
- [ ] 12.4 测试 `House.landlord` 的 landlord 角色校验、可为空和替换更新行为
- [ ] 12.4.1 测试 `House.landlord.organization` 与房源组织归属一致性，以及房东视角查询范围
- [ ] 12.4.2 测试当前版本多人业主场景被明确阻止
- [ ] 12.4.3 测试管理员可在建房时直接绑定已有 landlord，或先空置 landlord 完成建档
- [ ] 12.5 测试 Lease 状态变更与删除后的 House.status 重算
- [ ] 12.5.1 测试所有 Lease 入口和 signal 都委托到统一房态重算方法
- [ ] 12.6 测试 Lease 重复 active 校验、数据库条件唯一约束和字段合法性校验
- [ ] 12.6.1 测试 Lease 与 House.building.estate、tenant 的 organization 一致性校验
- [ ] 12.6.2 测试对 `landlord is null` 的 House 创建 Lease 会被明确阻止
- [ ] 12.7 测试 `Estate.images` 与 `House.images` 的顺序、首图封面约定、空列表、9 张上限、重复 `media_id` 校验、跨对象复用、平铺业务字段保留，以及 `house_image` 类型校验
- [ ] 12.7.1 测试项目图片与房源图片详情查询复用 `get_media_refs_info()`，并按 `images` 顺序回显增强列表
- [ ] 12.7.2 测试 `House.videos` 的顺序、空列表、3 个上限、重复 `media_id` 校验、`house_video` 类型校验，以及视频详情查询复用 `get_media_refs_info()`
- [ ] 12.7.3 测试 house 域 `media_references` provider 能收集 Estate.images、House.images、House.videos、Lease.contract_files 中的所有 `media_id`
- [ ] 12.8 测试 Lease.contract_files 可选、最多 1 个、媒体引用校验和 `lease_contract` 类型校验
- [ ] 12.9 运行 `pytest tests/house/` 确保全部通过
