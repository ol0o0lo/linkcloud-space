## ADDED Requirements

### Requirement: 联系人统一管理
系统 SHALL 提供 Contact 模型统一管理房东和租客，字段包含：organization(FK→Organization)、name、phone、id_card、email、roles、user(FK→User, null=True, blank=True)、notes、is_active。

#### Scenario: 创建联系人
- **WHEN** 创建 Contact，提供 organization、name、phone
- **THEN** 记录保存成功，user 默认 null，is_active 默认 True

#### Scenario: 联系人角色约束
- **WHEN** 设置 Contact.roles
- **THEN** 系统允许：landlord（房东）、tenant（租客），且同一联系人可同时具备多个角色

#### Scenario: 组织内手机号唯一
- **WHEN** 在同一 organization 下尝试创建与已有 Contact 相同 phone 的记录
- **THEN** 数据库唯一约束阻止创建

#### Scenario: 跨组织允许相同手机号
- **WHEN** 在不同 organization 下创建相同 phone 的 Contact
- **THEN** 记录保存成功

### Requirement: 房东账号延迟关联
系统 SHALL 支持具有 landlord 角色的 Contact 先于 User 创建，房东在完成手机号绑定后通过手机号自动关联。

#### Scenario: 房东注册时自动认领
- **WHEN** 用户在当前 organization 内完成手机号绑定，且存在 phone 匹配、user 为 null、包含 landlord 角色的 Contact
- **THEN** 注册成功后自动设置 Contact.user = 新建 User

#### Scenario: 无匹配 Contact 时正常注册
- **WHEN** 用户完成手机号绑定，但当前 organization 内无匹配 Contact
- **THEN** 正常完成注册，不创建 Contact 关联
