## 1. 创建 Django App

- [ ] 1.1 在 `apps/` 下创建 `properties/` app（`__init__.py`、`apps.py`、`models.py`、`admin.py`、`migrations/__init__.py`）
- [ ] 1.2 在 `config/settings/_base.py` 的 `INSTALLED_APPS` 中注册 `apps.properties`

## 2. 扩展媒体文件类型

- [ ] 2.1 在 `apps/media/constants.py` 中新增 `ResourceType.HOUSE_IMAGE = "house_image"` 和 `ResourceType.LEASE_CONTRACT = "lease_contract"`
- [ ] 2.2 扩展 `MediaExtension`，至少支持租约合同 `pdf`，如业务需要再补 `doc` / `docx`
- [ ] 2.3 确认房源图片和租约合同上传使用 `scope=org`，对象路径为 `uploads/orgs/<organization_id>/...`
- [ ] 2.4 补充媒体服务或 schema 测试，覆盖新增资源类型和合同扩展名

## 3. 空间层级模型

- [ ] 3.1 创建 `Community` 模型：organization(FK→Organization, PROTECT)、name、developer、built_year、property_type(choices)、province、city、district、street_address、lat、lng、description、is_active
- [ ] 3.2 创建 `Building` 模型：organization(FK→Organization, PROTECT)、community(FK→Community, PROTECT)、name、code、total_floors、underground_floors、year_built、structure_type(choices)、elevator(default=False)、is_active
- [ ] 3.3 创建 `House` 模型：organization(FK→Organization, PROTECT)、building(FK→Building, PROTECT)、room_number、floor、area、interior_area、bedrooms、living_rooms、bathrooms、kitchens、balconies、layout_desc、orientation(choices)、decoration(choices)、has_elevator_access、house_status(choices, default=vacant)、tags(JSONField, default=list)、notes、is_active
- [ ] 3.4 为 Community/Building/House 添加所有 choices 常量、`__str__` 方法和唯一约束（社区名、楼栋编码、房号）

## 4. 房源图片模型

- [ ] 4.1 创建 `HouseImage` 模型：house(FK→House, CASCADE)、media_file(OneToOneField→apps.media.MediaFile, PROTECT)、caption、is_cover(default=False)、order(default=0)
- [ ] 4.2 添加 `Meta.ordering = ['order']` 和 `__str__` 方法
- [ ] 4.3 为同一 House 的封面图添加 `is_cover=True` 条件唯一约束
- [ ] 4.4 校验 HouseImage.media_file.resource_type 必须为 `house_image`

## 5. 联系人模型

- [ ] 5.1 创建 `Contact` 模型：organization(FK→Organization, PROTECT)、name、phone、id_card、email、roles、user(FK→settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=SET_NULL)、notes、is_active
- [ ] 5.2 为 Contact 添加组织内手机号唯一约束、角色校验和 `__str__` 方法
- [ ] 5.3 设计 Contact 角色存储方式（可多角色），保证 landlord / tenant 可并存

## 6. 业权模型

- [ ] 6.1 创建 `Ownership` 模型：organization(FK→Organization, PROTECT)、house(OneToOneField→House, PROTECT)、owner(FK→Contact, PROTECT)、notes
- [ ] 6.2 添加 owner 必须具备 landlord 角色的校验和 `__str__` 方法

## 7. 租约模型

- [ ] 7.1 创建 `Lease` 模型：organization(FK→Organization, PROTECT)、house(FK→House, PROTECT)、tenant(FK→Contact, PROTECT)、start_date、end_date、monthly_rent、deposit、payment_day(default=1)、status(choices: pending/active/expired/terminated, default=pending)、contract_file(FK→apps.media.MediaFile, null=True, blank=True, on_delete=PROTECT)、notes
- [ ] 7.2 添加 tenant 角色校验、日期范围校验、金额非负校验、payment_day 范围校验和 `__str__` 方法
- [ ] 7.3 为同一 House 的 active Lease 添加条件唯一约束
- [ ] 7.4 校验 Lease.contract_file 为空或 resource_type 必须为 `lease_contract`

## 8. 租约状态信号

- [ ] 8.1 创建 `apps/properties/signals.py`，监听 Lease 的保存与删除事件
- [ ] 8.2 补充 Lease post_delete 信号，在新增、更新、删除后统一重算 House.house_status
- [ ] 8.3 若存在 active Lease，自动设 House.house_status = rented
- [ ] 8.4 若不存在 active Lease，且当前房态不是 locked / renovating，则自动设 House.house_status = vacant
- [ ] 8.5 在 `apps/properties/apps.py` 的 `ready()` 中注册信号

## 9. 租约重复激活校验

- [ ] 9.1 在 `Lease.clean()` 中校验：同一 House 不能有两条 active 状态租约
- [ ] 9.2 在 `Lease.save()` 中调用 `full_clean()` 触发校验
- [ ] 9.3 用数据库条件唯一约束兜底并发场景

## 10. 生成 Migration

- [ ] 10.1 运行 `python manage.py makemigrations properties` 生成初始 migration
- [ ] 10.2 检查 migration 文件内容正确
- [ ] 10.3 运行 `python manage.py migrate` 验证可执行

## 11. Django Admin 注册

- [ ] 11.1 注册 `CommunityAdmin`：list_display=(name, property_type, city, is_active)，search_fields=(name,)
- [ ] 11.2 注册 `BuildingAdmin`：list_display=(name, community, total_floors, elevator, is_active)，list_filter=(community, is_active)
- [ ] 11.3 注册 `HouseAdmin`：list_display=(room_number, building, floor, house_status, is_active)，list_filter=(house_status, decoration, orientation)，HouseImage 作为 TabularInline
- [ ] 11.4 注册 `ContactAdmin`：list_display=(name, phone, roles, user, is_active)，list_filter=(is_active,)，并提供 roles 可读展示
- [ ] 11.5 注册 `OwnershipAdmin`：list_display=(house, owner)
- [ ] 11.6 注册 `LeaseAdmin`：list_display=(house, tenant, start_date, end_date, monthly_rent, status)，list_filter=(status,)
- [ ] 11.7 在 admin 中按 organization 提供过滤与搜索字段，并为删除受 PROTECT 阻止的模型提供清晰提示

## 12. 测试

- [ ] 12.1 创建 `tests/properties/__init__.py` 和 `tests/properties/test_models.py`
- [ ] 12.2 测试 Community/Building/House 层级创建、组织归属和删除保护
- [ ] 12.3 测试 Contact 组织内手机号唯一、跨组织可重复、以及 landlord 自动认领逻辑
- [ ] 12.4 测试 Ownership OneToOne 唯一约束和 owner 角色校验
- [ ] 12.5 测试 Lease 状态变更与删除后的 House.house_status 重算
- [ ] 12.6 测试 Lease 重复 active 校验、数据库条件唯一约束和字段合法性校验
- [ ] 12.7 测试 HouseImage 单封面约束、MediaFile 引用和 `house_image` 类型校验
- [ ] 12.8 测试 Lease.contract_file 可选、MediaFile 引用和 `lease_contract` 类型校验
- [ ] 12.9 运行 `pytest tests/properties/` 确保全部通过
