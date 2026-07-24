# 普通用户收藏通用能力

本文记录仓库当前已经实现的收藏能力及其接入方式。当前注册的收藏目标为房源 `house`、楼栋 `building` 和小区 `estate`。

这里的“通用”不仅指不同目标共用同一个关系模型和 API，还包括收藏核心不导入具体业务：每个业务应用自行注册目标适配器，管理端根据后端能力动态生成类型页签，并在没有专用渲染器时使用通用摘要展示新类型。

核心设计决策是将收藏定义为普通用户能力，而不是租户或单个业务域的附属功能。平台通过统一关系模型维护用户与公开业务对象的关系，各目标适配器负责可见性校验和安全摘要；公共协议采用显式 `target_type` 注册表，不直接暴露 Django `ContentType`，旧 `HouseFavorite` 仅用于历史迁移兼容。

架构选择见 [ADR 0001：将收藏定义为普通用户通用能力](./adr/0001-favorite-is-generic-user-capability.md)。

## 1. 能力边界

- 收藏归属于普通用户。`Favorite` 不保存组织、团队或联系人字段。
- 收藏接口要求用户登录，但不调用租户选择或租户权限检查。
- 当前三个目标适配器只允许收藏公开可见的对象。
- 目标是否可收藏、如何查询公开对象以及返回哪些摘要字段由适配器定义；收藏核心不会自动对适配器返回的数据做字段脱敏。
- 收藏核心保存关系，不保存目标摘要快照，也不读取目标的后台 Schema。
- 收藏核心只依赖适配器协议和注册表，不导入房源、文章、商品等具体业务应用。
- 当前实现没有使用 Django `ContentType`、`GenericForeignKey` 或目标外键，公共协议使用 `target_type + target_id`。

## 2. 收藏关系与统一行为

收藏关系是否存在表示用户当前是否收藏；`available` 不入库，而是在查询时根据适配器能否解析到当前公开目标动态计算。

具体行为如下：

| 关系与目标状态 | 查询结果 |
| --- | --- |
| 收藏关系存在，目标公开可见 | 返回 `available=true` 和适配器返回的摘要 |
| 收藏关系存在，目标已下架、不可见或已删除 | 保留关系，返回 `available=false`、`target=null` |
| 收藏关系不存在 | 不出现在收藏列表中 |
| 目标重新公开且收藏关系仍存在 | 再次查询时自动恢复为 `available=true` |

- `PUT` 会先确认目标当前可收藏。没有收藏关系时创建新关系；关系已经存在时，重复 `PUT` 返回原关系。
- 取消后再次收藏会创建新关系和新的 `created_at`，并再次产生一次收藏行为记录。
- 已收藏目标变为不可见后，再次 `PUT` 返回 `404`，不会绕过公开可见性校验。
- `DELETE` 不要求目标仍然存在或公开，只会规范化目标 ID 并物理删除匹配的收藏关系；关系不存在时仍返回成功，因此该操作是幂等的。
- 用户被删除时，其收藏关系通过用户外键级联删除。目标没有外键，目标被物理删除时通用收藏关系不会自动删除。

## 3. API 契约

收藏能力当前使用以下单数路径：

```text
GET    /api/users/me/favorite/type/
GET    /api/users/me/favorite/
GET    /api/users/me/favorite/?target_type={target_type}
GET    /api/users/me/favorite/?target_type={target_type}&target_id={target_id}
PUT    /api/users/me/favorite/?target_type={target_type}&target_id={target_id}
DELETE /api/users/me/favorite/?target_type={target_type}&target_id={target_id}
```

例如房源收藏使用 `target_type=house`。

查询规则：

- `GET /type/` 返回当前已注册的全部收藏目标类型；每项包含 `target_type`、`display_name`、`order` 和当前用户的 `favorite_count`，客户端可据此生成类型入口。
- `GET` 支持 `page`、`page_size`、`target_type` 和 `target_id` query params。
- 不传 `target_type` 时，查询全部当前已注册类型的活动收藏；传入时只查询该类型。
- `target_id` 只能和 `target_type` 一起使用。查询单个目标时，分页列表为空表示未收藏，有记录表示已收藏。
- 单独传入 `target_id` 或传入未注册的 `target_type` 返回 `422`。
- 列表先对收藏关系完成计数和分页，再按当前页的 `target_type` 分组批量解析目标，不会为了返回一页数据而解析用户的全部收藏。

分页数据结构为：

```text
{
  items,
  total,
  page,
  page_size
}
```

每个收藏项包含：

```text
FavoriteOut
├── id
├── target_type
├── target_id
├── created_at
├── available
├── display
└── target
```

`created_at` 表示本次收藏关系的创建时间。重复 `PUT` 不会更新它；取消后再次收藏会创建新关系并产生新的 `created_at`。

`display` 是所有业务共用的安全展示摘要：

```text
display
├── title
├── subtitle
├── cover_url
├── description
├── tags
└── facts[]
    ├── label
    └── value
```

`target` 保留适配器返回的业务专属 payload，供已注册的专用客户端渲染器使用。目标不可见时，`available=false`，且 `display`、`target` 都为 `null`；接口不会通过收藏关系泄露已隐藏的业务数据。接口不返回持久化字段 `updated_at`。

所有成功响应还会被项目统一包装为：

```text
{
  code,
  message,
  data,
  timestamp,
  traceId
}
```

主要状态码：

- 未登录：`401`。
- `PUT` 创建收藏关系：`201`。
- `PUT` 重复收藏已有关系：`200`。
- `DELETE` 成功或关系本来不存在：`200`，数据为 `{ "success": true }`。
- `PUT` 的目标不存在或当前不可收藏：`404`。
- 参数组合错误或目标类型未注册：`422`。

## 4. 数据模型

通用关系由 `apps/favorites/models.py` 中的 `Favorite` 维护：

```text
Favorite
├── user
├── target_type
├── target_id
├── created_at
└── updated_at
```

- 唯一约束为 `user + target_type + target_id`。
- `target_type` 和 `target_id` 都是最大长度为 64 的字符串字段。
- 核心以字符串存储目标 ID；具体格式由适配器决定。当前 `house`、`building`、`estate` 三个适配器只接受正整数 ID，并以十进制字符串保存。
- 注册表约束位于 API 和服务层；数据库字段本身没有 `choices` 或检查约束，Django Admin 也不会自动限制为已注册类型。
- 收藏列表按 `created_at`、主键倒序返回。

## 5. 目标适配器

适配器协议定义在 `apps/favorites/registry.py`。每个目标适配器实现以下方法：

- `target_type`：稳定的公共业务类型，会持久化到收藏关系。
- `display_name`、`order`：用于类型能力接口和客户端排序。
- `normalize_target_id()`：校验并规范化客户端目标 ID。
- `get_collectible_target()`：供 `PUT` 查询当前允许收藏的单个目标。
- `get_visible_targets()`：按一组 ID 批量查询当前仍公开的目标。
- `serialize_target()`：生成业务专属且对普通用户安全的 payload。
- `serialize_display()`：生成符合统一字段结构的通用展示摘要。

收藏列表在分页后按 `target_type` 分组，再由对应适配器批量解析当前页目标。收藏核心根据解析结果生成 `available`，并在不可见时把 `display`、`target` 设为 `null`。

具体业务适配器由各业务应用自行实现并注册。收藏核心的 `apps/favorites/targets.py` 只提供整数 ID 规范化辅助类，不导入房源 Schema、QuerySet 或分析服务。当前 `apps.house.HouseConfig.ready()` 注册 `house`、`building`、`estate` 三个适配器；移除房产业务不会让收藏核心因业务导入失败而无法启动。重复注册相同 `target_type` 会在启动阶段抛出错误。

### Analytics 收藏行为记录

Analytics 在自身应用中通过 `post_save` 监听 `Favorite(created=True)`，并将新建的 `house` 收藏记录为 `house.favorite`。重复 `PUT` 不会创建关系，因此不产生埋点；`DELETE` 不触发埋点；取消后再次收藏会新建关系，因此会再次记录。

收藏核心的当前关系与 Analytics 的历史事实彼此分离：`Favorite` 表示用户当前是否收藏，`AnalyticsEvent` 追加记录已经发生的收藏行为。删除收藏关系不会删除或修改既有 Analytics 历史事件。

收藏核心不包含埋点事件代码，也不依赖 Analytics；Analytics 自行维护接收器和业务埋点语义。

当前目标规则：

- `house`：复用 `get_public_houses_queryset()`，只接受状态为“招租中”且所属组织有效的房源，摘要使用 `PublicHouseListOut`。
- `building`：只接受所属组织有效且至少包含一套公开招租房源的楼栋，摘要使用 `FavoriteBuildingTargetOut`。
- `estate`：只接受所属组织有效且至少包含一套公开招租房源的小区，摘要使用 `FavoriteEstateTargetOut`。

## 6. 数据迁移与旧模型

- `apps/favorites/migrations/0002_migrate_house_favorites.py` 会把执行迁移时已有的 `HouseFavorite` 复制到 `Favorite(target_type="house")`。
- 迁移链将旧表中仍有效的收藏保留到通用 `Favorite`，已取消的旧关系不会保留；已有收藏继续使用原 `created_at`。
- 反向迁移是 `noop`，不会删除已经生成的通用收藏关系。
- 通用收藏 API 不再读取或写入 `HouseFavorite`，旧房源收藏 API 路由也已移除。
- `HouseFavorite` 模型和表仍然保留，并且当前仍注册在 Django Admin，因此后台仍可新增或编辑旧记录；迁移完成后的旧表新写入不会自动同步到 `Favorite`。

## 7. 客户端实现状态

- 管理端已有通用手写客户端，收藏读写均调用 `/api/users/me/favorite/`，并通过 `/api/users/me/favorite/type/` 获取已注册类型及当前用户的收藏数量。
- `/personal-business/favorites` 根据后端类型列表动态生成、排序页签，支持分页、取消收藏以及不可见目标占位展示。
- 管理端提供收藏目标渲染注册表。房源、楼栋、小区注册了专用渲染器；后端新增但前端尚未注册的类型会直接使用 `display` 通用卡片，不需要修改收藏页面主体。
- 管理端提供 `useFavoriteState(targetType, targetId)` 和 `useToggleFavorite(targetType, targetId)`，统一处理单个目标状态、收藏切换以及目标、列表、类型数量缓存同步。
- 管理端房源管理详情已接入房源收藏和取消收藏，但该页面本身依赖已选择组织。
- 楼栋、小区当前有收藏列表展示，但管理端尚未提供对应的收藏创建入口。
- 小程序/H5 当前尚未接入收藏服务或收藏页面。
- 后端已有 `tests/favorites/` 定向测试；管理端已有客户端、收藏页和房源详情交互测试；当前没有收藏 E2E 测试。

## 8. 新目标接入步骤

接入新的收藏目标时，无需修改收藏模型、收藏核心 API、收藏核心服务或管理端收藏页面主体：

1. 在目标所属业务应用中实现适配器，确定稳定的 `target_type`、`display_name` 和 `order`。`target_type` 会持久化，后续改名需要迁移历史关系。
2. 为适配器提供明确的公开 QuerySet、安全的业务 payload 和完整的通用 `display` 摘要，并在该业务应用的 `AppConfig.ready()` 中注册。
3. 为公开可见性、类型能力元数据、收藏时间、重复收藏、物理取消、Analytics 新建关系监听和不可见目标补充后端测试。
4. 业务页面使用通用 API 或共享 Hooks 提供收藏入口。新类型注册后会自动出现在管理端收藏页；需要更丰富的业务卡片时，再额外注册前端 Renderer，否则使用通用卡片。

后端已有测试用非房产业务适配器，验证不同主键格式和业务类型可以在不修改收藏核心的前提下接入统一查询、收藏与取消收藏。

## 9. 非目标

`apps/favorites` 当前不实现以下能力：

- 浏览历史
- 点赞或投票
- 关注用户或租户
- 购物车
- 业务对象推荐排序
