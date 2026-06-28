# 枚举映射契约设计

## 背景

前端当前在多个页面硬编码枚举值、中文回显和筛选选项，例如用户列表里的实名状态。枚举真实来源在后端 `constants.py` / Django choices 中，前端重复维护会导致文案漂移、筛选项缺失和接口契约不清。

## 目标

- 后端输出枚举字段时，同时返回对应中文映射字段。
- 前端展示枚举值时优先使用后端返回的映射。
- 前端筛选下拉需要全量枚举值时，从后端统一枚举元数据接口获取。
- 保持现有分页响应 `{ items, total, page, page_size }` 不变。

## 非目标

- 不自动暴露所有 Python 枚举。
- 不把前端视图任务项强行后端化，例如“待补资料队列”“停用队列”。
- 不在每个分页列表响应外层追加 mapping 元数据。

## 后端设计

### 行数据映射字段

所有 API 输出 schema 中，凡是字段值来自后端枚举的字段，都补一个同名 `__mapping` 字符串字段。

示例：

```json
{
  "status": "pending",
  "status__mapping": "处理中",
  "real_name_status": "verified",
  "real_name_status__mapping": "已实名"
}
```

规则：

- 命名固定为 `<field_name>__mapping`。
- 值固定为对应枚举 label。
- 如果枚举值未知，mapping 回落为原始值。
- `__mapping` 只返回字符串，不返回 `{ value, label }` 对象。

### 枚举元数据接口

新增系统元数据接口：

```http
GET /api/enums/?keys=accounts.real_name_status,wallet.withdrawal_status
```

返回：

```json
{
  "accounts.real_name_status": [
    { "value": "unverified", "mapping": "未实名" },
    { "value": "verified", "mapping": "已实名" }
  ]
}
```

设计细节：

- 接口放在 `apps.base.api`，属于系统元数据能力。
- 使用显式 `ENUM_REGISTRY` 注册可暴露枚举。
- key 使用命名空间，避免多个 app 都有 `status` 时冲突。
- 未知 key 返回 400，避免静默漏配。

## 前端设计

- 表格和详情展示：使用 `record.xxx__mapping || record.xxx`。
- 筛选下拉：调用 `/api/enums/` 获取完整 options。
- 业务枚举的前端硬编码 options/text map 逐步删除。
- 前端自有视图状态继续保留在前端，例如页面任务筛选、治理队列入口。

## 数据流

1. 后端模型或服务产生枚举原始值。
2. API serializer/schema 输出原始字段和 `__mapping` 字段。
3. 前端列表/详情直接展示 `__mapping`。
4. 前端筛选组件按 enum key 请求 `/api/enums/`。
5. Select options 使用 `{ value, label: mapping }`。

## 测试

后端：

- 测试枚举字段输出包含 `__mapping`。
- 测试 `/api/enums/` 返回显式注册枚举。
- 测试未知 enum key 返回 400。

前端：

- 测试筛选下拉 options 来自枚举接口。
- 测试表格优先展示 `xxx__mapping`。
- 保留现有分页和搜索参数行为测试。

## 实施顺序

1. 后端增加枚举 registry 和 `/api/enums/`。
2. 给核心输出 schema 补 `__mapping` 字段。
3. 前端增加枚举查询复用方法。
4. 替换用户、实名、通知、钱包、房源等页面硬编码业务枚举。
5. 补后端和前端最小覆盖测试。
