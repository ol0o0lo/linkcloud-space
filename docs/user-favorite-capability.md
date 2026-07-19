# 普通用户收藏通用能力

收藏是普通用户维度的跨业务平台能力。房源只是第一个收藏目标；后续文章、商品、活动等公开业务对象应复用同一收藏核心，而不是分别维护相互独立的用户收藏体系。

## 1. 边界

- 收藏归属于普通用户，不归属于租户、团队或联系人。
- 收藏接口要求用户登录，但不要求加入或选择租户。
- 只有当前可公开访问的业务对象才能新建收藏。
- 目标所属业务负责判断目标是否可收藏，以及生成对普通用户安全的展示摘要。
- 收藏核心只维护关系和通用状态，不读取或返回目标的内部字段。

## 2. 统一行为

- 同一用户对同一目标最多存在一条收藏关系。
- 收藏使用幂等 `PUT`；重复请求返回原收藏关系。
- 取消收藏使用 `DELETE`，业务上采用软取消，重复请求仍返回成功。
- 目标下架、归档或失去公开可见性后，收藏关系继续保留，并返回 `available=false`，不得借收藏接口读取已隐藏的目标详情。
- 目标重新公开后，原收藏可以恢复为可用状态。

## 3. API 风格

项目采用单数通用路径。所有已注册业务类型通过同一组接口读写收藏核心：

```text
GET    /api/users/me/favorite/
GET    /api/users/me/favorite/?target_type={target_type}
GET    /api/users/me/favorite/?target_type={target_type}&target_id={target_id}
PUT    /api/users/me/favorite/?target_type={target_type}&target_id={target_id}
DELETE /api/users/me/favorite/?target_type={target_type}&target_id={target_id}
```

房源使用：

```text
GET /api/users/me/favorite/?target_type=house
GET /api/users/me/favorite/?target_type=house&target_id={house_id}
PUT /api/users/me/favorite/?target_type=house&target_id={house_id}
DELETE /api/users/me/favorite/?target_type=house&target_id={house_id}
```

查询接口中的 `target_type` 可选；不传时汇总全部已注册收藏类型，传入时只返回指定业务类型。需要判断单个目标是否已收藏时，同时传入 `target_type` 和 `target_id`：返回列表为空表示未收藏，有记录表示已收藏。单独传入 `target_id` 返回 `422`。写接口根据 `target_type` 调用对应适配器校验目标并生成安全摘要。

## 4. 目标模型

通用收藏核心由独立的 `favorites` 应用维护，关系模型使用稳定业务类型，而不是业务模型名称：

```text
Favorite
├── user
├── target_type
├── target_id
├── is_active
├── created_at
└── updated_at
```

唯一约束为：

```text
user + target_type + target_id
```

`target_id` 应支持字符串表示，以兼容整数、UUID 等不同业务主键。`target_type` 必须来自显式注册表；当前房屋租赁业务注册 `house`、`building`、`estate`，后续可继续增加 `article`、`product` 等类型，不得直接接受客户端传入的 Django 模型路径。

## 5. 业务适配器

每一种收藏目标必须注册业务适配器，并负责：

- 校验目标是否存在且允许普通用户收藏。
- 批量解析当前仍公开可见的目标。
- 返回业务专属、对普通用户安全的摘要结构。
- 在目标不可见时只返回不可用状态，不返回内部数据。

房源适配器复用公开房源 QuerySet，只允许状态为“招租中”且所属租户有效的房源，并使用公开房源 Schema，禁止复用后台 `HouseOut`。楼栋和小区只有在至少包含一套公开招租房源时才允许收藏，并分别返回公开楼栋、小区安全摘要。

不建议直接向 API 暴露 Django `ContentType` 或任意 `GenericForeignKey` 目标，因为它会把 ORM 模型结构变成公共协议，也无法统一保证不同业务的公开可见性。

## 6. 当前实现状态

- `apps/favorites/` 已提供通用 `Favorite` 模型、服务和显式目标适配器注册表。
- 房源、楼栋和小区已分别注册为 `house`、`building`、`estate` 目标，并复用各自的公开可见性和安全摘要。
- 通用查询、收藏和取消收藏接口均读写通用收藏关系，不要求租户上下文。
- 数据迁移会把已有 `HouseFavorite` 复制到通用关系，并保持软取消状态。
- 旧 `HouseFavorite` 模型及表仅作为历史数据迁移来源保留，不再注册业务接口或承接新写入；验证存量环境后再单独决定归档方式。
- 新业务应直接注册目标适配器，不得复制房源专属收藏模型。

## 7. 非目标

收藏能力不同时承担以下职责：

- 浏览历史
- 点赞或投票
- 关注用户或租户
- 购物车
- 业务对象推荐排序

这些能力即使具有相似的“用户与目标关系”，也有不同的生命周期和业务语义，应独立建模。
