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

### Requirement: 房源档案管理
系统 SHALL 提供 House 模型，字段包含 organization(FK→Organization)、building(FK→Building, PROTECT)、room_number(自由格式)、floor、area、interior_area、bedrooms、living_rooms、bathrooms、kitchens、balconies、layout_desc、orientation(choices)、decoration(choices)、has_elevator_access、house_status(choices, default=vacant)、tags(JSONField)、notes、is_active。

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
