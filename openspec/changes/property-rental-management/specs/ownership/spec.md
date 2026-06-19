## ADDED Requirements

### Requirement: 房源登记房东绑定
系统 SHALL 不提供独立的 Ownership 模型，而是在 House 上通过 `owner_contact(FK→Contact, null=True, blank=True, PROTECT)` 直接保存登记房东。当前版本 SHALL 只支持“一套房一个登记房东”。

#### Scenario: 创建或更新房源时绑定登记房东
- **WHEN** 为 House 设置 `owner_contact=Contact`
- **THEN** 系统保存成功，并将该 Contact 视为该房源的登记房东

#### Scenario: 房东角色约束
- **WHEN** 为 House 设置 owner_contact，但该 Contact 不具备 landlord 角色
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 一套房当前仅允许一个登记房东
- **WHEN** 为同一 House 再次指定新的 owner_contact
- **THEN** 系统以字段替换方式更新登记房东，而不是创建第二条并存关系

#### Scenario: 当前版本不支持多人业主
- **WHEN** 业务希望为同一 House 登记多个房东
- **THEN** 当前版本不支持该建模，必须通过后续独立变更扩展，而不是绕过现有 `House.owner_contact` 单字段方案

#### Scenario: 删除保护
- **WHEN** 尝试删除仍被 House.owner_contact 引用的 Contact
- **THEN** 数据库 PROTECT 阻止删除

#### Scenario: 登记房东组织归属必须与房源一致
- **WHEN** 创建或更新 House，且 `owner_contact.organization != house.building.community.organization`
- **THEN** 系统阻止保存并返回校验错误

### Requirement: 房东视角查询
系统 SHALL 支持通过 User 查询其名下所有 House 及对应 Lease，查询链路 SHALL 基于 `House.owner_contact -> Contact.user` 且受当前 organization 约束。

#### Scenario: 房东查询名下房源
- **WHEN** 已登录 User 查询名下房源
- **THEN** 通过 `House.objects.filter(owner_contact__user=user)` 返回关联的所有 House

#### Scenario: 房东只看当前组织内已认领房源
- **WHEN** 已登录 User 在当前 organization 查询名下房源
- **THEN** 结果只包含 `owner_contact__user=user` 且 `building__community__organization=当前 organization` 的 House
