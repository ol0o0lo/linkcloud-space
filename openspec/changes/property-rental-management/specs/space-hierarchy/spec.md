## ADDED Requirements

### Requirement: 小区档案管理
系统 SHALL 提供 Community 模型，字段：organization(FK→Organization)、name、developer、built_year、property_type(choices)、province、city、district、street_address、lat、lng、description、is_active。

#### Scenario: 创建小区
- **WHEN** 创建 Community 记录，提供 name
- **THEN** 记录保存成功，is_active 默认 True

#### Scenario: 物业类型约束
- **WHEN** 设置 Community.property_type
- **THEN** 只允许：residential（住宅）、commercial（商业）、industrial（工业）、mixed（综合）

#### Scenario: 小区名称组织内唯一
- **WHEN** 在同一 organization 下创建同名 Community
- **THEN** 数据库唯一约束阻止创建

### Requirement: 楼栋档案管理
系统 SHALL 提供 Building 模型，字段包含 organization(FK→Organization)、community(FK→Community, PROTECT)、name、code、total_floors、underground_floors、year_built、structure_type(choices)、elevator、is_active。

#### Scenario: 创建楼栋
- **WHEN** 创建 Building 记录，提供 community 和 name
- **THEN** 记录保存成功，elevator 默认 False，is_active 默认 True

#### Scenario: 结构类型约束
- **WHEN** 设置 Building.structure_type
- **THEN** 只允许：brick_concrete（砖混）、frame（框架）、shear_wall（剪力墙）、steel（钢结构）

#### Scenario: 小区内楼栋编码唯一
- **WHEN** 在同一 Community 下创建重复 Building.code
- **THEN** 数据库唯一约束阻止创建

#### Scenario: 删除小区级联保护
- **WHEN** 尝试删除有关联楼栋的 Community
- **THEN** 数据库 PROTECT 阻止删除

#### Scenario: 楼栋组织归属必须与小区一致
- **WHEN** 创建或更新 Building，且 Building.organization 与 Community.organization 不一致
- **THEN** 系统阻止保存并返回校验错误

### Requirement: 房源档案管理
系统 SHALL 提供 House 模型，字段包含 building(FK→Building, PROTECT)、owner_contact(FK→Contact, null=True, blank=True, PROTECT)、room_number(自由格式)、floor、area、interior_area、bedrooms、living_rooms、bathrooms、kitchens、balconies、layout_desc、orientation(choices)、decoration(choices)、has_elevator_access、house_status(choices, default=vacant)、image_media_file_ids(JSONField)、tags(JSONField)、notes、is_active。House 的组织归属 SHALL 通过 `Building -> Community -> Organization` 推导。

#### Scenario: 创建房源
- **WHEN** 创建 House，提供 building 和 room_number
- **THEN** 记录保存成功，house_status 默认 vacant，is_active 默认 True

#### Scenario: 朝向约束
- **WHEN** 设置 House.orientation
- **THEN** 只允许：south、north、east、west、south_north、east_west

#### Scenario: 装修约束
- **WHEN** 设置 House.decoration
- **THEN** 只允许：raw（毛坯）、simple（简装）、fine（精装）、luxury（豪装）

#### Scenario: house_status 约束
- **WHEN** 设置 House.house_status
- **THEN** 只允许：vacant（空置）、rented（已租）、renovating（装修中）、locked（封存）

#### Scenario: 楼栋内房号唯一
- **WHEN** 在同一 Building 下创建重复 room_number 的 House
- **THEN** 数据库唯一约束阻止创建

#### Scenario: 房源组织归属从楼栋和小区推导
- **WHEN** 查询 House 的组织归属
- **THEN** 系统通过 `house.building.community.organization` 推导该房源所属组织，而不是在 House 上单独存储 organization 字段

#### Scenario: 房源可直接绑定登记房东
- **WHEN** 创建或更新 House，并提供 owner_contact
- **THEN** 系统直接通过 `House.owner_contact` 保存登记房东，不单独创建 Ownership 模型

#### Scenario: 登记房东必须具备 landlord 角色
- **WHEN** 为 House 设置 owner_contact，但该 Contact 不具备 landlord 角色
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 登记房东组织归属必须与房源一致
- **WHEN** 为 House 设置 owner_contact，且 `owner_contact.organization != house.building.community.organization`
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 删除楼栋级联保护
- **WHEN** 尝试删除有关联房源的 Building
- **THEN** 数据库 PROTECT 阻止删除

### Requirement: 房源状态作为运营快照
系统 SHALL 将 House.house_status 作为运营查询快照使用，租赁真相来源 SHALL 为 Lease；当 House 不处于人工锁定状态时，系统根据 Lease 重算房态。

#### Scenario: 新建房源默认空置
- **WHEN** 创建 House 且未关联生效中的 Lease
- **THEN** house_status 默认值为 vacant

#### Scenario: 生效租约驱动已租状态
- **WHEN** 该 House 存在至少一条 active 状态 Lease
- **THEN** house_status 为 rented

#### Scenario: 无生效租约恢复空置
- **WHEN** 该 House 不存在 active 状态 Lease，且当前 house_status 不是 locked 或 renovating
- **THEN** house_status 为 vacant

#### Scenario: 手工封存和装修状态优先级更高
- **WHEN** 该 House 当前 house_status 为 locked 或 renovating，且不存在 active 状态 Lease
- **THEN** 系统保留当前 house_status，不自动恢复为 vacant
