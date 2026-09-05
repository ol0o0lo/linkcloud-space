# 房源范围与勘察筛选改造设计

日期：2026-08-30
状态：设计已确认，待书面规格审阅

## 1. 背景

房源列表当前通过顶部一级 `Tabs` 表达“全部房源 / 我的房源”，并在“我的房源”中使用 `Segmented` 表达“全部 / 待我勘察”。该结构虽然准确表达了“负责范围 → 待勘察子集”的数据关系，但额外增加了一整行导航，打乱了原房源列表以项目楼栋范围、表格工具栏和数据表格为主体的页面布局。

当前前端 URL 使用：

```text
无 view 参数       -> 全部房源
view=mine          -> 当前员工负责的房源
view=inspection    -> 当前员工负责且需要勘察的房源
```

当前后端接口使用：

```text
不传 responsibility      -> 组织内全部房源
responsibility=mine       -> 当前登录员工负责的房源
inspection_due=true       -> 仅缺照片、缺视频或资料过期的房源
inspection_reason=...     -> 按具体勘察原因筛选
responsible_member_id=... -> 管理员按指定成员筛选
```

现状已经包含“负责范围 + 勘察条件”两个独立维度，但前端 `view` 将两个维度合并为视图名称，后端负责范围又通过 `responsibility=mine` 与“不传参数”表达，契约不够对称。

## 2. 目标

- 恢复房源列表原有纵向结构，不再增加顶部大 Tab 或独立分段导航。
- 将“全部房源 / 我负责的房源”作为标准房源范围筛选。
- 将“待勘察”和具体原因作为普通筛选条件，与范围保持正交。
- 前端 URL 与后端 API 统一使用 `scope=all|mine` 表达负责范围。
- 暂时兼容旧 `view` URL 和 `responsibility=mine` API 调用。
- 保留管理员通过 `responsible_member_id` 查看指定成员负责房源的能力。
- 不改变待勘察的派生规则、工作台能力或资料更新闭环。

## 3. 非目标

- 不新增勘察任务模型、状态流转、奖励、抢占、放弃或审核。
- 不修改当前职责分配规则。
- 不读取照片或视频文件自身的更新时间。
- 不改造小程序、H5 或现场采集页面。
- 不在本次改造中立即删除旧 `responsibility` 参数。
- 不新增独立统计接口。

## 4. 已确认决策

- 删除房源列表顶部新增的一级 `Tabs`。
- 删除“全部 / 待我勘察”二级 `Segmented`。
- 范围和勘察状态统一进入现有表格工具栏筛选区域。
- 正式范围参数使用 `scope`，不使用含义过宽的 `type`。
- 前端 URL 和后端 API 同时改造为 `scope=all|mine`。
- 新前端、工作台链接和测试全部使用 `scope`。
- 旧 `responsibility=mine` 暂时兼容。
- `scope=all&inspection_due=true` 合法，表示组织内全部待勘察房源。

## 5. 页面设计

### 5.1 页面结构

房源列表恢复为原有结构：

```text
项目与楼栋范围侧栏

房源列表工具栏
├─ 房源范围
├─ 勘察状态
├─ 勘察原因
├─ 关键词
├─ 房态
└─ 页面操作

房源表格
```

不再在表格上方增加独立导航行，表格标题保持“房源列表”。

### 5.2 房源范围筛选

工具栏增加标准选择器“房源范围”：

- 全部房源。
- 我负责的房源。

对应值：

```text
全部房源       -> scope=all
我负责的房源   -> scope=mine
```

第一版不在范围筛选选项中展示数量，避免为非当前范围增加额外查询和视觉噪音。待勘察数量继续由个人工作台组件展示。

### 5.3 勘察筛选

“勘察状态”属于普通筛选条件：

- 全部。
- 待勘察。

筛选控件统一使用“待勘察”；当 `scope=mine` 且结果为空时，空状态使用员工语境文案“当前负责房源均无需勘察”。后端参数统一为：

```text
inspection_due=true
```

选择待勘察后显示“勘察原因”：

- 缺少照片：`missing_images`。
- 缺少视频：`missing_videos`。
- 资料过期：`expired`。

新前端始终在发送 `inspection_reason` 时同时发送 `inspection_due=true`。后端仍允许单独传入 `inspection_reason`，因为具体原因天然属于待勘察集合，并保持现有调用兼容。

### 5.4 筛选联动

- 切换 `scope`、`inspection_due` 或 `inspection_reason` 时回到第一页。
- 切换范围或勘察状态时清除当前已选择房源，避免批量操作跨范围残留。
- 关闭待勘察筛选时清除 `inspection_reason`。
- 项目、小区、楼栋、关键词、房态和排序继续保留。
- 编辑状态下禁止切换范围和勘察筛选，沿用当前表格编辑保护规则。

### 5.5 空状态

- `scope=mine` 且无数据：显示“当前没有分配给你的负责房源”。
- `scope=mine&inspection_due=true` 且无数据：显示“当前负责房源均无需勘察”。
- `scope=all&inspection_due=true` 且无数据：显示“当前没有需要勘察的房源”。
- 其他筛选导致无结果：显示“未找到符合条件的房源”并提供清除筛选。

## 6. 前端 URL 契约

正式 URL 参数：

```text
scope=all
scope=mine
scope=all&inspection_due=true
scope=mine&inspection_due=true
scope=mine&inspection_due=true&inspection_reason=expired
```

`scope` 未传时按 `all` 处理。URL 同步必须省略默认的 `scope=all`，但页面解析结果必须等价于 `scope=all`。

### 6.1 旧 URL 兼容

页面初始化时兼容：

```text
view=mine       -> scope=mine
view=inspection -> scope=mine&inspection_due=true
```

如果同时存在新旧参数，以新 `scope`、`inspection_due` 和 `inspection_reason` 为准。初始化完成后使用 `history.replaceState` 写回正式参数并移除 `view`，形成唯一可复制 URL。

### 6.2 工作台链接

个人工作台“待勘察房源”的“查看全部”改为：

```text
/rental/properties/list?scope=mine&inspection_due=true
```

## 7. 后端 API 正式契约

房源列表接口增加正式参数：

```python
scope: Literal["all", "mine"] | None = Query(None)
```

未传 `scope` 时，归一为 `all`。使用可空输入而不是直接将函数默认值写成 `all`，是为了区分“调用方未传新参数”和“调用方明确传入 `scope=all`”，从而正确处理旧 `responsibility=mine` 的兼容逻辑。

正式请求示例：

```text
GET /api/house/houses/?scope=all
GET /api/house/houses/?scope=mine
GET /api/house/houses/?scope=all&inspection_due=true
GET /api/house/houses/?scope=mine&inspection_due=true
GET /api/house/houses/?scope=mine&inspection_due=true&inspection_reason=expired
```

### 7.1 范围解析规则

| `scope` | `responsibility` | 有效范围 | 结果 |
| --- | --- | --- | --- |
| 未传 | 未传 | `all` | 组织内全部房源 |
| `all` | 未传 | `all` | 组织内全部房源 |
| `mine` | 未传 | `mine` | 当前员工负责的房源 |
| 未传 | `mine` | `mine` | 旧参数兼容 |
| `mine` | `mine` | `mine` | 允许，相同语义 |
| `all` | `mine` | 无 | 返回 422 参数冲突 |

冲突错误应明确指出：

```text
scope 与 responsibility 表达了不同的房源范围，请只使用 scope。
```

### 7.2 指定成员筛选

`responsible_member_id` 保留原有管理员用途：

- `scope=all&responsible_member_id=<id>`：从组织房源中筛选指定成员负责的房源。
- `scope=mine&responsible_member_id=<id>`：两个员工范围同时存在，返回 422。
- 旧 `responsibility=mine&responsible_member_id=<id>`：同样返回 422。

这样可以避免将“当前员工”和“指定员工”两个范围静默求交集，导致难以理解的空结果。

### 7.3 勘察条件

`inspection_due` 和 `inspection_reason` 是独立于负责范围的筛选条件：

- `scope=all&inspection_due=true`：组织内全部待勘察房源。
- `scope=mine&inspection_due=true`：当前员工负责且待勘察的房源。
- `scope=all&responsible_member_id=<id>&inspection_due=true`：指定员工负责且待勘察的房源。

待勘察派生规则保持不变：

```text
缺少照片
OR 缺少视频
OR House.updated_at 超过组织配置的复查周期
```

## 8. 前端数据流

前端列表状态拆分为正交字段：

```text
scope
inspectionDue
inspectionReason
keyword
status
estateId
buildingId
ordering
page
pageSize
```

请求时直接将新参数发送给后端，不再通过 `view` 转换为 `responsibility`：

```text
scope=all  -> API scope=all
scope=mine -> API scope=mine
```

页面不再需要 `HouseListView = all | mine | inspection`。待勘察由 `inspectionDue` 表达，具体原因由 `inspectionReason` 表达。

更新房源或确认资料仍有效后，继续失效：

- 当前房源列表查询。
- 工作台待勘察查询。

## 9. 加载与错误处理

- 主列表继续使用当前加载、错误和重试能力。
- 422 范围冲突通过项目统一请求错误处理展示后端消息。
- 旧 URL 转换只使用 `replaceState`，不产生额外浏览历史记录。
- 浏览器前进、后退和刷新必须恢复相同筛选状态。

## 10. 测试范围

### 10.1 后端

- 未传范围参数返回组织内全部房源。
- `scope=all` 返回组织内全部房源。
- `scope=mine` 只返回当前员工负责的房源。
- `scope=all&inspection_due=true` 返回组织内全部待勘察房源。
- `scope=mine&inspection_due=true` 返回当前员工负责且待勘察的房源。
- `inspection_reason` 与 `scope` 正确组合。
- 旧 `responsibility=mine` 保持兼容。
- `scope=mine&responsibility=mine` 正常工作。
- `scope=all&responsibility=mine` 返回 422。
- 当前员工范围与 `responsible_member_id` 同时存在时返回 422。

### 10.2 前端

- 页面不再渲染顶部房源范围 Tabs 和二级 Segmented。
- “房源范围”筛选正确发送 `scope=all|mine`。
- 勘察状态和原因正确发送独立参数。
- 关闭待勘察时清除原因。
- 旧 `view=mine`、`view=inspection` 链接正确转换并写回正式 URL。
- 新 URL 在刷新和前进后退时恢复状态。
- 工作台跳转使用 `scope=mine&inspection_due=true`。
- 切换筛选时重置分页和已选择房源。

## 11. 迁移与移除计划

第一阶段：

- 后端增加 `scope` 并保留 `responsibility`。
- 前端、工作台和测试全部切换到 `scope`。
- OpenAPI 文档将 `scope` 作为正式范围参数。
- `responsibility` 在说明中标记为兼容参数。

第二阶段：

- 搜索仓库和运行日志，确认没有旧 `responsibility` 调用。
- 单独提出移除变更，不在本次实现中直接删除兼容参数。

## 12. 实现边界

- 复用现有房源列表接口和筛选逻辑。
- 复用 Ant Design / ProComponents 现有筛选控件。
- 不新增 App、业务模型、数据库字段或勘察迁移。
- 后端只调整查询参数解析、冲突校验和范围过滤入口。
- 前端只调整页面状态、URL、工具栏筛选、工作台链接和相关测试。
