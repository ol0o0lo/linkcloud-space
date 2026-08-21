# 统一数据列表表头个人设置设计

## 背景

管理端数据列表的字段数量会持续增加。不同用户关注的字段不同，因此需要允许用户通过 Ant Design ProTable 自带的列设置能力调整列的显示、隐藏、顺序和固定位置，并在刷新页面、重新登录或切换组织后继续使用自己的配置。

项目当前已经具备通用 `UserSetting` JSON 存储，也已有房源列表表头状态钩子的局部实现，但尚未形成整个管理端可复用的统一能力。本次先在房源列表试用，设计边界必须能够直接覆盖客户、租约、带看及其他数据列表。

## 目标

1. 为管理端提供统一的表头个人设置存储和前端接入能力。
2. 直接使用 Ant Design ProTable 的 `columnsState` 数据结构，避免创建第二套列状态协议。
3. 使用一个个人设置保存多个列表的表头配置。
4. 配置按用户全局生效，不区分当前组织。
5. 默认列、默认显示状态和默认顺序继续由各列表的前端代码定义。
6. 第一期只接入房源列表，但新增其他列表时不需要修改后端。
7. 支持多个页面或浏览器标签页分别修改不同列表，不发生整份配置互相覆盖。

## 非目标

- 不提供后端默认表头接口。
- 不将列标题、渲染器、筛选器、编辑器、宽度等业务列定义存入个人设置。
- 不新增表头方案命名、方案分享或管理员统一下发能力。
- 不按组织、团队或设备保存不同配置。
- 不增加任何旧设置兼容或数据迁移逻辑；功能尚未上线，不存在需要保留的线上用户数据。
- 不在本次一次性接入管理端的所有列表。

## 已确认的设计决策

- 底层复用现有 `UserSetting`，不新增数据表。
- 使用唯一内部设置 key：`internal.ui.table_columns`。
- 设置值不包含版本字段。
- 第一层使用稳定的 `tableKey` 区分列表，例如 `rental.houses`。
- 第二层直接保存 Ant Design 的 `Record<string, ColumnsState>`。
- 持久化字段仅包含 `show`、`fixed`、`order`。
- `disable` 始终由前端列定义提供，不作为用户偏好保存。
- 读取复用现有个人设置列表和单项详情接口，写入与重置使用按 `tableKey` 的专用接口。
- 默认个人设置列表过滤所有 `internal.` 设置，内部偏好仍可通过通用单项详情接口按 key 读取。
- 前端页面通过统一钩子接入，不直接处理存储结构或请求细节。
- 第一期以房源列表作为试用入口。

## 总体架构

能力分为三个边界清晰的部分：

1. **列表页面**：定义业务列、默认顺序和稳定的 `tableKey`，并将通用钩子的结果绑定到 ProTable。
2. **前端表头偏好模块**：负责查询、清洗、合并前端默认状态、防抖保存、重置和请求状态。
3. **后端个人设置服务**：负责鉴权、结构校验、按 `tableKey` 原子合并以及删除。

后端不感知房源、客户等业务列表，也不维护列目录。新增列表只需要在前端声明新的 `tableKey` 和稳定列 key。

## 存储结构

`UserSetting` 中保存一条记录：

- `key`: `internal.ui.table_columns`
- `value`: 所有列表的表头个人配置

示例：

```json
{
  "rental.houses": {
    "room_number": {
      "show": true,
      "fixed": "left",
      "order": 0
    },
    "asking_rent": {
      "show": false,
      "order": 5
    }
  },
  "rental.contacts": {
    "name": {
      "show": true,
      "order": 0
    }
  }
}
```

概念类型：

```ts
type PersistedColumnsState = Pick<ColumnsState, 'show' | 'fixed' | 'order'>;

type UserTableColumnsSetting = Record<
  string,
  Record<string, PersistedColumnsState>
>;
```

第一层 key 是 `tableKey`，第二层 key 是稳定的 `column.key`。字段未出现表示沿用前端默认值。

## 列标识约定

### tableKey

- 使用小写英文命名空间，例如 `rental.houses`、`rental.contacts`。
- 允许小写字母、数字、点、下划线和连字符。
- 最大长度 100 个字符。
- 一旦上线不得因为页面路径调整而随意改名。
- 同一业务列表的普通表格和可编辑表格如果表达同一组列，应复用同一个 `tableKey`。

### column key

- 所有可配置列必须显式提供唯一且稳定的 `column.key`。
- 不依赖标题文本作为 key，避免文案调整导致配置失效。
- 不依赖数组位置，避免插入新列后配置错位。
- 最大长度 100 个字符。
- 列删除或改名后，前端清洗逻辑自动忽略旧 key。

## 个人设置可编辑性

`internal.` 前缀统一表示系统内部偏好。这类设置可以被业务功能按 key 读取，但不应出现在普通个人设置页面。默认个人设置列表在后端直接排除 `key__startswith="internal."` 的记录，因此不需要额外的数据库字段或 API 可编辑标记。

后续新增同类内部偏好时统一使用 `internal.*` key，即可自动从设置页面隐藏。需要特殊写入约束的内部设置，再由对应专用接口保护。

## 后端接口

接口位于现有个人设置路由下，全部要求用户已登录。

### 获取个人设置列表

```http
GET /api/settings/user/
```

默认只返回非 `internal.*` 设置，作为个人设置页面的数据源。内部设置由后端过滤，不再依赖前端隐藏。

### 获取表头内部设置

表头钩子复用现有通用单项详情接口：

```http
GET /api/settings/user/internal.ui.table_columns/
```

未保存时返回 404，前端按空配置处理。已保存时返回完整的表头内部设置：

```json
{
  "key": "internal.ui.table_columns",
  "value": {
    "rental.houses": {
      "room_number": {
        "show": true,
        "fixed": "left",
        "order": 0
      }
    }
  }
}
```

所有列表共享同一个 React Query 查询缓存。通用钩子只需读取 `setting.value[tableKey] ?? {}`，不需要专用 GET 接口。

### 保存指定列表配置

```http
PUT /api/settings/user/table-columns/{table_key}/
Content-Type: application/json
```

请求体直接使用经过通用钩子清洗的 `columnsState.onChange` 数据：

```json
{
  "room_number": {
    "show": true,
    "fixed": "left",
    "order": 0
  },
  "asking_rent": {
    "show": false,
    "order": 5
  }
}
```

响应直接返回保存后的当前列表 `ColumnsState`，便于钩子局部更新统一个人设置查询缓存。

后端必须在事务中读取并锁定 `internal.ui.table_columns` 对应记录，只替换当前 `tableKey` 的值，再写回整个 JSON。不同列表的配置不得被当前请求覆盖。首次创建记录时需要遵守 `(user, key)` 唯一约束并处理并发创建竞争。

同一用户在多个标签页同时修改同一个列表时采用最后一次成功写入生效；本期不增加冲突版本或合并列级变更。

### 重置指定列表配置

```http
DELETE /api/settings/user/table-columns/{table_key}/
```

删除当前 `tableKey`，返回 `200` 和空对象。删除操作幂等，不存在配置时仍返回成功。删除后如果整个设置值为空，则删除对应 `UserSetting` 记录。

通用个人设置 PUT/DELETE 必须拒绝 `internal.ui.table_columns`，防止绕过专用接口的结构校验和事务合并。通用单项 GET 保持可用。

## 后端校验与规范化

- `show` 必须为布尔值。
- `fixed` 只允许 `left`、`right` 或 `null`。
- `fixed: null` 在保存时规范化为不包含 `fixed` 字段。
- `order` 必须为有限数字；布尔值不视为数字。
- 每个列状态只接受 `show`、`fixed`、`order`，拒绝 `disable` 和未知字段。
- 单个列表最多保存 200 个列 key。
- 合并后的 `internal.ui.table_columns` JSON 最大为 256 KiB。
- 后端不校验列 key 是否真实存在，因为列目录由前端负责。
- 非法请求返回 422，不写入部分数据。

## 前端通用钩子

页面使用统一钩子：

```ts
const tableColumnsState = useUserTableColumnsState({
  tableKey: 'rental.houses',
  columns,
  // 可选；需要默认隐藏等状态时由页面显式提供
  defaultValue,
});
```

返回值：

```ts
{
  value,
  onChange,
  reset,
  isLoading,
  isSaving,
}
```

页面绑定方式：

```tsx
<ProTable
  columns={columns}
  columnsState={{
    value: tableColumnsState.value,
    onChange: tableColumnsState.onChange,
  }}
/>
```

同一封装同时支持 `ProTable` 和 `EditableProTable`。

### 运行时默认状态合并

通用单项详情接口返回完整设置对象。钩子从 `value[tableKey]` 取出的数据已经是 Ant Design `ColumnsState` 兼容结构，页面不需要转换。但通用钩子仍需完成统一的运行时清洗与合并：

1. 从当前 `columns` 递归提取稳定列 key。
2. 根据列定义和可选的 `defaultValue` 生成运行时默认状态，包括默认显示、默认顺序以及前端定义的 `fixed` 和 `disable`；没有显式默认值的普通列按 `show: true` 处理。
3. 过滤服务端配置中当前列表不存在的列 key。
4. 过滤用户不可持久化的字段并校验字段类型。
5. 将用户配置覆盖到运行时默认状态上。
6. 将合并结果作为可直接传给 `columnsState.value` 的值返回。

这一步不是业务格式转换，而是保证新列、删除列和 `disable` 约束始终以当前前端代码为准。

### 保存行为

- `onChange` 首先立即更新本地状态，保证操作无等待感。
- 对持久化请求使用约 500ms 防抖，连续拖动排序只保存最终结果。
- 保存前移除 `disable`，并只保留 `show`、`fixed`、`order`。
- 切换页面或组件卸载时，如果仍有待保存状态，立即发起最后一次保存请求。
- 保存成功后在 `internal.ui.table_columns` 的统一详情查询缓存中合并当前 `tableKey`。
- 保存失败时保留当前页面的本地显示效果，并通过项目统一消息提示“表头设置保存失败”。用户后续再次调整时可重新保存。

### 重置行为

Ant Design 列设置中的“重置”会触发默认列状态。通用钩子应将收到的状态与基于当前 `columns` 生成的默认状态比较：

- 等价时调用 DELETE，而不是保存一份默认配置。
- 删除成功后从 `internal.ui.table_columns` 的统一详情查询缓存中移除当前 `tableKey`。
- 页面恢复使用当前前端列定义，因此未来新增列可以自然出现。

钩子同时暴露 `reset()`，供未来页面在 Ant Design 列设置之外提供重置入口时复用。

## 数据流

1. 列表页面定义 `columns`、默认顺序和 `tableKey`。
2. 表格数据请求与 `internal.ui.table_columns` 通用单项详情请求并行执行；所有列表共享同一查询缓存。
3. 未完成配置请求时，表格可先使用前端默认状态；钩子暴露 `isLoading`，高字段量页面可选择将其合并到表格加载状态以避免列跳动。
4. GET 成功后，钩子读取 `setting.value[tableKey]`，清洗并合并用户配置，更新 `columnsState.value`。
5. 用户调整列状态后，`onChange` 立即更新本地状态。
6. 防抖结束后，钩子 PUT 当前列表的完整持久化列状态。
7. 后端事务内只更新当前 `tableKey`，其他列表保持不变。
8. 用户切换组织后继续使用同一份用户级配置。

## 异常处理

- 通用单项 GET 返回 404：视为尚未保存，使用前端默认状态。
- GET 失败：不阻塞业务列表，使用前端默认状态；请求错误交给项目统一错误处理。
- PUT 失败：不回滚当前页面列状态，显示保存失败提示。
- DELETE 失败：保留当前本地默认显示，但提示重置未同步，下一次进入页面仍可能读取旧配置。
- 旧列 key：前端忽略，不影响表格渲染；下一次成功保存时自然从当前列表配置中移除。
- 新列 key：从前端默认状态进入运行时配置，不依赖后端数据升级。
- 未登录请求：沿用项目统一的 401 处理和登录跳转。

## 房源列表试用

第一期只接入房源列表：

- `tableKey` 使用 `rental.houses`。
- 现有房源列必须具有稳定且唯一的 `column.key`。
- 移除当前按独立用户设置 key 保存房源表头的实现，改用统一接口和通用钩子。
- 不增加旧设置读取、迁移或双写分支，直接启用统一结构。
- 房源页面只负责声明业务列和绑定钩子，不包含个人设置请求代码。

完成房源试用后，客户、租约、带看等列表的接入只需要补充稳定 `tableKey`、列 key 和相同的钩子绑定。

## 测试设计

### 后端

- 默认个人设置列表过滤 `internal.*`。
- 通用单项详情仍可以按 key 读取 `internal.ui.table_columns`。
- 未保存内部设置时通用单项 GET 返回 404。
- PUT 可以创建和更新当前列表配置。
- 更新一个 `tableKey` 不覆盖同一用户的其他列表配置。
- DELETE 只移除指定列表，且具备幂等性。
- 删除最后一个列表配置后移除整个 `UserSetting`。
- `show`、`fixed`、`order`、未知字段、列数量和总大小校验正确。
- `fixed: null` 正确规范化。
- 两个不同列表的并发更新不会丢失其中一个列表。
- 通用个人设置 PUT/DELETE 无法直接修改 `internal.ui.table_columns`。

### 前端通用钩子

- 通用详情 GET 的 `value[tableKey]` 可以生成可直接绑定的 `columnsState.value`。
- 当前不存在的旧列 key 被过滤。
- 新列使用前端默认显示、固定和禁用状态。
- `disable` 不会发送到后端。
- 连续变化会立即更新界面，并只防抖保存最终状态。
- 与默认列状态等价时执行 DELETE。
- GET 失败时回退到默认列。
- PUT 和 DELETE 失败时状态与提示符合设计。
- 组件卸载时会提交尚未发送的最终状态。

### 房源页面

- 列设置的显示、隐藏、排序和固定位置可以保存。
- 页面刷新后恢复用户配置。
- 切换组织后配置保持不变。
- 重置后恢复当前前端默认列和默认顺序。
- 表头配置加载或保存失败不影响房源数据查询和编辑能力。

## 验收标准

1. 房源列表使用 Ant Design 原生列设置完成显示、隐藏、排序和固定位置调整。
2. 调整结果在刷新、重新登录和切换组织后保持。
3. 重置后不保留房源列表的个人配置，并使用前端默认列状态。
4. 后端只存一个 `internal.ui.table_columns` 用户设置，且其中能够同时容纳多个列表。
5. 保存一个列表不会覆盖同一用户的其他列表配置。
6. 页面代码不直接调用个人设置接口，也不自行解析后端存储结构；读取、局部缓存合并和保存均由通用钩子负责。
7. 新列表可以在不修改后端的前提下通过稳定 `tableKey` 和通用钩子接入。
