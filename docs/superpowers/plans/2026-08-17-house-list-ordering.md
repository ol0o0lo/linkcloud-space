# House List Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为管理端房源列表增加 Ant Design ProTable 单列服务端排序，并让房源 API 支持带白名单校验的最多三字段组合排序。

**Architecture:** 后端新增独立排序模块，将公开 `ordering` 别名转换为受控 Django ORM 表达式，并由列表接口通过带默认值、正则、说明和示例的 Ninja `Query` 暴露。前端继续使用 React Query 拉取分页数据，由 ProTable 产生单列排序事件，将状态同步到 URL 和请求参数；ProTable 用 `defaultSortOrder` 和排序状态 key 恢复表头箭头。

**Tech Stack:** Django 5、django-ninja、Django ORM、pytest/Django TestCase、React 19、Ant Design 6、ProComponents 3、React Query、Vitest。

---

### Task 1: 后端排序契约测试

**Files:**
- Modify: `tests/house/test_api.py`

- [ ] 新增测试，创建不同租金、房号、户型和房态的房源，并断言 `ordering=-asking_rent,room_number`、`ordering=layout`、`ordering=status` 的结果顺序。
- [ ] 新增测试，断言租金、押金、面积、楼层和空房东在升降序时均为空值置后。
- [ ] 新增测试，断言未知字段、显式空字符串、连续逗号和超过三个字段返回项目统一的 `400 VALIDATION_ERROR`。
- [ ] 新增 OpenAPI 测试，断言 `ordering` 为非必填字符串，默认值为 `building`，包含格式 `pattern`、说明和示例。
- [ ] 运行 `docker compose exec -T web pytest tests/house/test_api.py -k 'list_houses_ordering or list_houses_openapi' -q`，确认测试因接口尚无排序能力而失败。

### Task 2: 后端排序实现

**Files:**
- Create: `apps/house/ordering.py`
- Modify: `apps/house/api.py`

- [ ] 在 `apps/house/ordering.py` 定义：

```python
HOUSE_DEFAULT_ORDERING = "building"
HOUSE_ORDERING_PATTERN = r"^-?[a-z_]+(?:,-?[a-z_]+){0,2}$"
HOUSE_ORDERING_FIELDS = (
    "room_number",
    "layout",
    "building",
    "asking_rent",
    "deposit_amount",
    "landlord",
    "has_elevator_access",
    "status",
    "area",
    "floor",
    "created_at",
    "updated_at",
)
```

- [ ] 实现 `apply_house_ordering(queryset, ordering)`：校验白名单、忽略重复字段的后续出现、展开组合别名、对可空字段使用 `NULLS LAST`、按业务状态顺序排序，并追加 `pk ASC`。
- [ ] 项目排序注解使用 `display_name`，空字符串回退到 `name`，无项目楼栋回退到“未关联项目”。
- [ ] 在 `list_houses` 增加：

```python
ordering: str = Query(
    HOUSE_DEFAULT_ORDERING,
    description=HOUSE_ORDERING_DESCRIPTION,
    pattern=HOUSE_ORDERING_PATTERN,
    example="-asking_rent,room_number",
)
```

- [ ] 将原固定 `order_by()` 替换为筛选完成后的 `apply_house_ordering(qs, ordering)`。
- [ ] 重跑 Task 1 测试并确认通过。

### Task 3: 前端排序交互测试

**Files:**
- Modify: `frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx`

- [ ] 扩展测试中的 ProTable mock，使 `sorter: true` 的表头可模拟 `ascend → descend → 清除`，并通过 `onChange` 返回 `columnKey` 和 `order`。
- [ ] 新增测试，断言点击挂牌租金表头后依次请求 `asking_rent`、`-asking_rent` 和默认排序，且每次排序回到第 1 页。
- [ ] 新增测试，断言 `ordering=-asking_rent` 可从 URL 恢复请求和表头状态。
- [ ] 新增测试，断言多字段或未知字段不会被房源列表页面发送，并从 URL 清理。
- [ ] 执行 `source ~/.nvm/nvm.sh && nvm use 22 && npm --prefix frontend_admin exec -- vitest run src/pages/rental/__tests__/domain-list-pages.test.tsx`，确认新增测试因功能尚未实现而失败。

### Task 4: 前端排序实现

**Files:**
- Modify: `frontend_admin/src/pages/rental/houses/index.tsx`

- [ ] 定义前端可排序字段白名单和单字段 `ordering` 解析函数。
- [ ] 将 `ordering` 加入页面初始状态、URL 同步、`popstate` 恢复、React Query `queryKey` 和 `listHouses` 请求参数。
- [ ] 为房源、户型、所属楼栋、挂牌租金、押金、房东、电梯和房态列配置 API 别名 `key`、`sorter: true` 和按 URL 恢复的 `defaultSortOrder`。
- [ ] 在 ProTable `onChange` 中只处理 `extra.action === 'sort'`，排除数组 sorter，使用 `columnKey` 生成单字段 `ordering`，并把页码重置为 1。
- [ ] 使用由 `ordering` 派生的 ProTable React `key` 重新初始化外部 URL 恢复的排序箭头。
- [ ] 将房源表格列偏好 key 升级到 v2，并把 `house`、`status__mapping` 列键迁移为 `room_number`、`status`。
- [ ] 重跑 Task 3 测试并确认通过。

### Task 5: OpenAPI client 生成与验证

**Files:**
- Regenerate: `frontend_admin/src/services/openapi/propertyRentalManagement.ts`
- Regenerate: `frontend_admin/src/services/openapi/typings.d.ts`

- [ ] 执行 `source ~/.nvm/nvm.sh && nvm use 22 && npm --prefix frontend_admin run openapi`，不得手工编辑生成文件。
- [ ] 确认 `appsHouseApiListHousesParams` 包含 `ordering?: string`。
- [ ] 确认生成请求包含默认值注释和 `ordering: "building"`。

### Task 6: 范围验证

**Files:**
- Verify all modified files

- [ ] 运行后端范围测试：`docker compose exec -T web pytest tests/house/test_api.py -k 'list_houses' -q`。
- [ ] 运行前端房源领域测试：`source ~/.nvm/nvm.sh && nvm use 22 && npm --prefix frontend_admin exec -- vitest run src/pages/rental/__tests__/domain-list-pages.test.tsx`。
- [ ] 运行前端类型检查：`source ~/.nvm/nvm.sh && nvm use 22 && npm --prefix frontend_admin run tsc`。
- [ ] 运行 Ruff 范围检查：`docker compose exec -T web ruff check apps/house/api.py apps/house/ordering.py tests/house/test_api.py`。
- [ ] 检查最终 diff，确认未修改多语言、`package.json`、`package-lock.json`，且未执行 Git 提交。
