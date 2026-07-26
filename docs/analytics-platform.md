# 通用数据埋点方案

`apps/analytics` 统一处理多租户事件的采集、归属、去重、存储和查询。接入业务只确定事件字典和指标口径，不在业务接口中直接写埋点逻辑。

## 1. 设计原则

- 事件只用于分析，不替代审计日志，也不反向修改业务状态。
- 组织由后端从目标对象解析，客户端不能指定 `organization_id`。
- 原始事件按追加式约定保存，不作为业务事实来源。
- `event_name`、`target_type`、`source` 会转为小写，并必须匹配 `^[a-z][a-z0-9_.-]*$`；事件名建议使用 `<namespace>.<action>`。
- 若请求已有 Django 登录会话，`visitor_key` 优先使用 `user:<id>`；否则使用匿名 ID 或会话 ID 的哈希值。原始标识不入库。
- `properties` 只允许注册过的字段名；平台不检查或脱敏字段值。
- 成功响应统一使用 `{ code, message, data, timestamp, traceId }` 外层结构。

## 2. 注册配置

注册项统一配置在 `config/settings/_base.py`。

### 2.1 目标

```python
ANALYTICS_TARGETS = {
    "<target_key>": {
        "label": "<target_label>",
        "model": "<app_label>.<ModelName>",
        "organization_path": "<organization_path>",
        "organization_filter": "<organization_filter>",
        "public_filters": {"<visibility_field>": "<public_value>"},
        "ranking_display": ({"target_type": "<display_key>", "target_id_path": "<id_path>", "label_path": "<label_path>"},),
    },
}
```

- `organization_path` 解析事件所属组织，`organization_filter` 限制组织查询范围。
- 匿名目标应配置并测试 `public_filters`；空配置不会被平台自动拒绝。
- `ranking_display` 只提供消费端展示信息，其中的 `target_type` 不会校验是否已注册。

### 2.2 事件

```python
ANALYTICS_EVENTS = [
    {
        "key": "<namespace>.<action>",
        "label": "<event_label>",
        "target_types": ("<target_key>",),
        "allow_anonymous": False,
        "client_collectible": True,
        "deduplicate_seconds": 0,
        "property_keys": ("<dimension_key>",),
    },
]
```

- `target_types` 和 `property_keys` 分别限制目标类型及属性字段。
- 客户端事件必须允许匿名且 `client_collectible=True`。
- 只能由服务端确认的事件设置 `client_collectible=False`。
- `deduplicate_seconds` 控制访客窗口去重。

## 3. 客户端采集

```text
POST /api/analytics/events/
```

作用：接收页面、H5、小程序等客户端行为，完成目标校验、组织归属、访客识别、去重和入库。接口无需登录或选择组织，也不执行 JWT / Session Token 鉴权；已有 Django 登录会话仍可关联 `actor`。

接口没有 `/batch/` 后缀，统一接收 1～50 条事件：

```json
{
  "events": [
    {
      "event_name": "<namespace>.<action>",
      "target_type": "<target_key>",
      "target_id": "<target_id>",
      "source": "<source_key>",
      "properties": {"<dimension_key>": "<dimension_value>"},
      "idempotency_key": "<optional_key>"
    }
  ]
}
```

`source` 默认是 `h5`。客户端还可提交 `anonymous_id`、`session_id` 和 `occurred_at`。

成功响应的 `data`：

```json
{"accepted": 1, "duplicates": 0, "event_ids": [9001], "errors": []}
```

- `event_ids` 包含新建及重复命中的事件 ID；单条校验失败不会回滚同批次已成功事件。
- 请求结构错误和限流属于整个 HTTP 请求错误。
- 目标会应用 `public_filters`，来源必须属于 `ANALYTICS_PUBLIC_SOURCES`，并按远端地址限流。
- `properties` 最大 8192 字节；事件时间允许补报 7 天，最多超前 5 分钟。
- 幂等范围是“组织 + 来源 + 幂等键”；窗口去重基于组织、事件、目标、来源、访客和 `received_at`。

项目适配器可简化单条调用：

```typescript
trackAnalyticsEventSafely({
  event_name: '<namespace>.<action>',
  target_type: '<target_key>',
  target_id: target.id,
  properties: { '<dimension_key>': '<dimension_value>' },
})
```

适配器补充访客标识和事件时间；批量缓冲与重试由各客户端按需实现，失败不能阻断主流程。

## 4. 服务端采集

能够由模型保存表达的业务结果统一使用 `post_save` 监听。监听规则集中定义在 `apps/analytics/receivers.py` 的 `POST_SAVE_EVENT_DEFINITIONS`，业务 API 和模型不需要调用埋点服务。

```python
PostSaveEventDefinition(
    model="<app_label>.<ModelName>",
    event_name="<namespace>.<action>",
    build=<event_builder>,
)
```

- 构建函数决定创建或更新时是否采集，并返回目标、可选操作人、属性及稳定幂等键。
- Signal 在业务事务提交成功后写入；保存失败或事务回滚不会留下事件。
- 操作人不是必填项，模型无法直接确定时保持为空。
- 无法由模型保存表达的动作，才直接调用 `track_event_safely()`；采集错误不得阻断业务流程。
- `source=server` 只表示采集来源，不是权限证明。

## 5. 查询接口

| 接口 | 作用 |
| --- | --- |
| `GET /api/analytics/definitions/` | 返回事件标签、目标类型和客户端采集权限 |
| `GET /api/analytics/overview/` | 汇总事件总量、独立访客和各事件指标 |
| `GET /api/analytics/trends/` | 按日期和事件聚合数量及独立访客 |
| `GET /api/analytics/targets/` | 按目标聚合事件、访客和分项指标 |

`definitions` 要求已选择组织；其余查询还要求 `analytics.analytics_view` 权限，并按当前组织过滤。

查询参数：

- `start_date`、`end_date`、`source`
- `event_names`：趋势和排行使用
- `target_type`、`page`、`page_size`：排行使用
- 日期范围默认 30 天，最大 366 天

排行 `data` 使用 `{ items, total, page, page_size }`。每项包含 `target_id`、`label`、`display_items`、`total`、`unique_visitors` 和 `metrics`；`display_items` 可以为空。

平台只提供通用聚合，不定义业务指标、漏斗或页面解释。

### UV 口径

- 系统按 `TIME_ZONE`（当前为 `UTC`）切分自然日。
- 最近 30 个自然日保留原始事件，区间 `unique_visitors` 精确计算。
- 更早数据只保留每日聚合；`trends` 的每日 UV 有效，但跨天历史或冷热混合区间的整体、事件和目标 UV 返回 `null`，不得把每日 UV 相加。
- 单日历史查询可返回该日 UV；目标排行传入多个 `event_names` 时，历史目标 UV 同样返回 `null`，因为事件间访客可能重复。

### 数据保留

每天 02:00（当前为 UTC）执行 `rollup_and_purge_analytics_events_task`：先按组织、来源、事件和目标重建当日汇总，再在同一数据库事务内删除原始事件。任务漏跑会在下次补齐；聚合失败不会删除明细。

聚合表只保存事件次数和每日 UV，不保存原始访客标识、属性或独立运行状态。单日事务无法承受时，再按实际数据量引入分区或进度记录。

## 6. 接入检查

1. 维护事件字典、统计口径、负责人、保留期限和下线策略。
2. 注册目标与事件，测试组织归属、`public_filters`、属性白名单和客户端权限。
3. 客户端行为走统一接口；模型保存型结果在 Analytics 应用中注册 `post_save` 规则，其他服务端动作才显式调用采集函数。
4. `properties` 不得包含个人信息、OpenID、令牌或任意用户输入；维度值使用稳定枚举。
5. 测试批量采集、幂等、时间限制、限流和聚合结果。
6. `source` 只用于分析，不是权限声明。
7. 删除目标不会删除历史事件，查询时会回退为类型和 ID 标签。
8. 历史聚合只保存每日 UV，不承诺跨天 UV。
