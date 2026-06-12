## ADDED Requirements

### Requirement: 房源业权登记
系统 SHALL 提供 Ownership 模型，字段包含 organization(FK→Organization)、house(OneToOneField→House, PROTECT)、owner(FK→Contact, PROTECT)、notes。一套房只能有一个登记房东。

#### Scenario: 创建业权登记
- **WHEN** 为 House 创建 Ownership，提供 owner(Contact)
- **THEN** 记录保存成功

#### Scenario: 房东角色约束
- **WHEN** 为 House 创建 Ownership，但 owner 不具备 landlord 角色
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 一房一东唯一约束
- **WHEN** 尝试为已有 Ownership 的 House 再次创建 Ownership
- **THEN** 数据库 OneToOne 约束阻止创建

#### Scenario: 删除保护
- **WHEN** 尝试删除有 Ownership 的 House
- **THEN** 数据库 PROTECT 阻止删除

### Requirement: 房东视角查询
系统 SHALL 支持通过 User 查询其名下所有 House 及对应 Lease。

#### Scenario: 房东查询名下房源
- **WHEN** 已登录 User 查询名下房源
- **THEN** 通过 `Ownership.objects.filter(owner__user=user)` 返回关联的所有 House
