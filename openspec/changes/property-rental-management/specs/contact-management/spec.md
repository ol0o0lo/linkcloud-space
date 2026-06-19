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

#### Scenario: 自动认领必须通过统一手机号绑定入口触发
- **WHEN** 注册、补绑手机号、第三方登录后补绑手机号或换绑手机号等流程完成手机号确认
- **THEN** 系统必须统一调用同一套 Contact 自动认领服务，而不是在各流程中分散直写 `Contact.user`

#### Scenario: 房东注册时自动认领
- **WHEN** 用户在当前 organization 内完成手机号绑定，且存在 phone 匹配、user 为 null、包含 landlord 角色的 Contact
- **THEN** 注册成功后自动设置 Contact.user = 新建 User

#### Scenario: 无匹配 Contact 时正常注册
- **WHEN** 用户完成手机号绑定，但当前 organization 内无匹配 Contact
- **THEN** 正常完成注册，不创建 Contact 关联

#### Scenario: 跨组织重复手机号不自动串联
- **WHEN** 用户在当前 organization 完成手机号绑定，其他 organization 中存在相同 phone 的 Contact
- **THEN** 系统只在当前 organization 内尝试自动认领，不跨组织关联 Contact

#### Scenario: 已绑定其他用户的 Contact 不被自动抢占
- **WHEN** 用户完成手机号绑定，但匹配到的 landlord Contact 已绑定其他 User
- **THEN** 系统跳过该 Contact，不自动覆盖既有 `Contact.user`

#### Scenario: 同一用户重复绑定手机号视为幂等成功
- **WHEN** 同一 User 重复完成手机号绑定，且匹配 Contact 已绑定到该 User
- **THEN** 系统视为幂等成功，不重复创建 Contact，也不变更既有绑定关系

#### Scenario: 用户更换手机号后只尝试认领新手机号联系人
- **WHEN** 已存在 User 后续变更手机号
- **THEN** 系统仅对当前 organization 内 `phone=新手机号` 且 `user is null` 的 landlord Contact 尝试自动认领，不自动解除旧 Contact 绑定

#### Scenario: 无明确组织上下文时不自动认领
- **WHEN** 用户完成手机号绑定，但当前流程无法明确 organization 上下文
- **THEN** 系统跳过本次自动认领，不跨组织猜测或扫描 Contact
