## ADDED Requirements

### Requirement: 项目片区档案管理
系统 SHALL 提供 Estate 模型，字段：organization(FK→Organization)、name、display_name、developer、built_year、property_type(choices)、province、city、district、address、lat、lng、images(MediaRefsField)、description。Estate.images SHALL 保存有序媒体引用对象列表，每项至少包含 `media_id`。Estate 的定位 SHALL 表示项目片区/小区容器级位置，而非单栋楼的精确门牌点。

#### Scenario: 创建项目片区
- **WHEN** 创建 Estate 记录，提供 name
- **THEN** 记录保存成功

#### Scenario: 物业类型约束
- **WHEN** 设置 Estate.property_type
- **THEN** 只允许：residential（住宅）、commercial（商业）、industrial（工业）、mixed（综合）

#### Scenario: 项目片区名称组织内唯一
- **WHEN** 在同一 organization 下创建同名 Estate
- **THEN** 数据库唯一约束阻止创建

### Requirement: 楼栋档案管理
系统 SHALL 提供 Building 模型，字段包含 organization(FK→Organization)、estate(FK→Estate, PROTECT)、name、floors、under_floors、year_built、elevator、lat、lng、address。Building 的定位 SHALL 表示楼栋级精确位置，`elevator` SHALL 为布尔值表示该楼栋是否有电梯。

#### Scenario: 创建楼栋
- **WHEN** 创建 Building 记录，提供 estate 和 name
- **THEN** 记录保存成功，elevator 默认 False

#### Scenario: 项目片区内楼栋名称唯一
- **WHEN** 在同一 Estate 下创建重复 Building.name
- **THEN** 数据库唯一约束阻止创建

#### Scenario: 删除项目片区级联保护
- **WHEN** 尝试删除有关联楼栋的 Estate
- **THEN** 数据库 PROTECT 阻止删除

#### Scenario: 楼栋组织归属必须与项目片区一致
- **WHEN** 创建或更新 Building，且 Building.organization 与 Estate.organization 不一致
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 项目片区定位用于项目级展示
- **WHEN** 查询 Estate 的 `lat/lng`
- **THEN** 系统将其解释为项目片区中心点或展示点，而不是具体某一栋楼的门口定位

#### Scenario: 楼栋定位用于精确导航
- **WHEN** 查询 Building 的 `lat/lng`
- **THEN** 系统将其解释为楼栋级精确定位，优先用于带看、导航、上门等操作

#### Scenario: 城中村场景以楼栋定位为主
- **WHEN** Estate 表示城中村片区或大范围项目，且内部多栋楼分散
- **THEN** 系统仍保留 Estate 作为上层容器，但实际业务定位以 Building 为主

### Requirement: 房源档案管理
系统 SHALL 提供 House 模型，字段包含 building(FK→Building, PROTECT)、landlord(FK→Contact, null=True, blank=True, PROTECT)、room_number(自由格式)、floor、area、interior_area、bedrooms、living_rooms、bathrooms、kitchens、balconies、orientation(choices)、decoration(choices)、has_elevator_access、status(choices, default=vacant)、images(MediaRefsField)、videos(MediaRefsField)、tags(JSONField)、public_description、internal_notes、extra(JSONField)。House.images 与 House.videos SHALL 保存有序媒体引用对象列表，每项至少包含 `media_id`。House 的组织归属 SHALL 通过 Building 推导。

#### Scenario: 创建房源
- **WHEN** 创建 House，提供 building 和 room_number
- **THEN** 记录保存成功，status 默认 vacant

#### Scenario: 朝向约束
- **WHEN** 设置 House.orientation
- **THEN** 只允许：south、north、east、west、south_north、east_west

#### Scenario: 装修约束
- **WHEN** 设置 House.decoration
- **THEN** 只允许：raw（毛坯）、simple（简装）、fine（精装）、luxury（豪装）

#### Scenario: status 约束
- **WHEN** 设置 House.status
- **THEN** 只允许：vacant（空置）、listed（招租中）、rented（已租）、renovating（装修中）、inactive（已停用）

#### Scenario: 楼栋内房号唯一
- **WHEN** 在同一 Building 下创建重复 room_number 的 House
- **THEN** 数据库唯一约束阻止创建

#### Scenario: 房源组织归属从楼栋和项目片区推导
- **WHEN** 查询 House 的组织归属
- **THEN** 系统通过 `house.building.estate.organization` 推导该房源所属组织，而不是在 House 上单独存储 organization 字段

#### Scenario: 房源可直接绑定登记出租方
- **WHEN** 创建或更新 House，并提供 landlord
- **THEN** 系统直接通过 `House.landlord` 保存登记出租方，不单独创建 Ownership 模型

#### Scenario: 登记出租方必须具备 landlord 角色
- **WHEN** 为 House 设置 landlord，但该 Contact 不具备 landlord 角色
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 登记出租方组织归属必须与房源一致
- **WHEN** 为 House 设置 landlord，且 `landlord.organization != house.building.estate.organization`
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 创建房源时可直接选择或新建登记出租方
- **WHEN** 管理员创建 House，需要录入登记出租方
- **THEN** 系统应支持直接选择已有 Contact，或在同一操作流内快速新建 landlord Contact 后绑定到 `House.landlord`

#### Scenario: 房源允许先不绑定登记出租方完成建档
- **WHEN** 管理员创建 House 时暂时缺少出租方资料
- **THEN** 系统允许 `landlord` 为空并完成房源建档

#### Scenario: 删除楼栋级联保护
- **WHEN** 尝试删除有关联房源的 Building
- **THEN** 数据库 PROTECT 阻止删除

### Requirement: 房源状态作为运营快照
系统 SHALL 将 House.status 作为独立的运营查询快照使用，由人工或显式业务操作维护；Lease 仅作为关联记录，不自动驱动房态。

#### Scenario: 新建房源默认空置
- **WHEN** 创建 House 且未关联生效中的 Lease
- **THEN** status 默认值为 vacant

#### Scenario: 生效租约不驱动房态
- **WHEN** 该 House 的 Lease 更新为 active
- **THEN** House.status 保持原值

#### Scenario: 租约到期不恢复空置
- **WHEN** 该 House 的 active Lease 更新为 expired 或 terminated
- **THEN** House.status 保持原值

#### Scenario: 显式维护房态
- **WHEN** 管理员通过房源维护入口修改 House.status
- **THEN** 系统保存合法的目标状态，不要求其与 Lease.status 自动一致
