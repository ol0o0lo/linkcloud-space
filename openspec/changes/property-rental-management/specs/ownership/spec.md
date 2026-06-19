## ADDED Requirements

### Requirement: 房源登记出租方绑定
系统 SHALL 不提供独立的 Ownership 模型，而是在 House 上通过 `landlord(FK→Contact, null=True, blank=True, PROTECT)` 直接保存登记出租方。当前版本 SHALL 只支持“一套房一个登记出租方”，其中 `landlord` 可表示业主或二房东。

#### Scenario: 创建或更新房源时绑定登记出租方
- **WHEN** 为 House 设置 `landlord=Contact`
- **THEN** 系统保存成功，并将该 Contact 视为该房源的登记出租方

#### Scenario: 出租方角色约束
- **WHEN** 为 House 设置 landlord，但该 Contact 不具备 landlord 角色
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 一套房当前仅允许一个登记出租方
- **WHEN** 为同一 House 再次指定新的 landlord
- **THEN** 系统以字段替换方式更新登记出租方，而不是创建第二条并存关系

#### Scenario: 当前版本不支持多人业主或多出租方
- **WHEN** 业务希望为同一 House 登记多个房东或多个出租方
- **THEN** 当前版本不支持该建模，必须通过后续独立变更扩展，而不是绕过现有 `House.landlord` 单字段方案

#### Scenario: 删除保护
- **WHEN** 尝试删除仍被 House.landlord 引用的 Contact
- **THEN** 数据库 PROTECT 阻止删除

#### Scenario: 登记出租方组织归属必须与房源一致
- **WHEN** 创建或更新 House，且 `landlord.organization != house.building.estate.organization`
- **THEN** 系统阻止保存并返回校验错误

### Requirement: 房东视角查询
系统 SHALL 支持通过 User 查询其名下所有 House 及对应 Lease，查询链路 SHALL 基于 `House.landlord -> Contact.user` 且受当前 organization 约束。

#### Scenario: 房东查询名下房源
- **WHEN** 已登录 User 查询名下房源
- **THEN** 通过 `House.objects.filter(landlord__user=user)` 返回关联的所有 House

#### Scenario: 房东只看当前组织内已认领房源
- **WHEN** 已登录 User 在当前 organization 查询名下房源
- **THEN** 结果只包含 `landlord__user=user` 且 `building__estate__organization=当前 organization` 的 House
