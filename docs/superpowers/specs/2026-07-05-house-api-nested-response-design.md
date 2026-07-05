# House API 嵌套响应设计

## 背景

`apps/house` 当前读模型大量使用扁平展示字段，例如 `house_label`、`contact_name`、`tenant_phone`、`estate_name`、`building_name`。这些字段对表格直接，但关系边界不清晰：顶层同时混着本对象字段、外键 ID 和关联对象展示属性。

本次重构只覆盖 `apps/house` 房源租赁模块。账号、组织、通知、钱包等其他 API 不纳入本次范围。

## 目标

- 读接口返回嵌套的关系摘要对象。
- 顶层保留外键 ID，便于表单、筛选、跳转继续直接使用。
- 关联对象的展示属性只放在嵌套对象中。
- 枚举字段保持现状，不把 `status/status__mapping` 改成对象。
- 写接口继续接收 `*_id`，不接收嵌套对象。

## 非目标

- 不做全站 API 契约重构。
- 不做通用序列化框架。
- 不做动态 `include` / `expand` 参数。
- 不保留旧的顶层展示字段做兼容。
- 不修改分页结构，分页仍为 `{ items, total, page, page_size }`。

## 响应契约

顶层只保留关联 ID：

```json
{
  "house_id": 99,
  "contact_id": 6
}
```

关联展示信息放入同名嵌套摘要对象：

```json
{
  "house_id": 99,
  "house": {
    "id": 99,
    "label": "星河湾 / 1栋 / 101",
    "room_number": "101"
  },
  "contact_id": 6,
  "contact": {
    "id": 6,
    "name": "王租客",
    "phone": "13700000000"
  }
}
```

空关系返回 `null`：

```json
{
  "contact_id": null,
  "contact": null
}
```

枚举继续使用当前格式：

```json
{
  "status": "scheduled",
  "status__mapping": "已预约"
}
```

## Schema 设计

在 `apps/house/schemas.py` 中增加关系摘要 Schema，直接使用 Django Ninja / Pydantic 的嵌套能力：

- `EstateSummaryOut`
- `BuildingSummaryOut`
- `ContactSummaryOut`
- `HouseSummaryOut`
- `ViewingRecordSummaryOut`

只为模型上不存在的计算字段写 resolver，例如 `HouseSummaryOut.label`。

示例：

```python
class ContactSummaryOut(Schema):
    id: int
    name: str
    phone: str


class EstateSummaryOut(Schema):
    id: int
    name: str
    display_name: str


class BuildingSummaryOut(Schema):
    id: int
    name: str
    estate_id: int
    estate: EstateSummaryOut


class HouseSummaryOut(Schema):
    id: int
    label: str
    room_number: str
    building_id: int
    building: BuildingSummaryOut

    @staticmethod
    def resolve_label(obj):
        return f"{obj.building.estate.display_name or obj.building.estate.name} / {obj.building.name} / {obj.room_number}"
```

业务输出 Schema 使用摘要对象：

```python
class ViewingRecordOut(Schema):
    id: int
    house_id: int
    house: HouseSummaryOut
    contact_id: int | None
    contact: ContactSummaryOut | None
```

## 字段迁移

### BuildingOut

- 保留：`estate_id`
- 新增：`estate: EstateSummaryOut`
- 移除：`estate_name`

### DefaultBuildingOut

- 保留：`estate_id`
- 新增：`estate: EstateSummaryOut`
- 移除：`estate_name`

### HouseOut

- 保留：`building_id`、`landlord_id`
- 新增：`building: BuildingSummaryOut`、`landlord: ContactSummaryOut | None`
- 移除：`building_name`、`estate_name`、`landlord_name`、`landlord_phone`、`house_label`

### ViewingRecordOut

- 保留：`house_id`、`contact_id`、`assigned_to_id`、`signed_lease_id`
- 新增：`house: HouseSummaryOut`、`contact: ContactSummaryOut | None`
- 移除：`house_label`、`contact_name`、`contact_phone`

### LeaseOut

- 保留：`house_id`、`tenant_id`、`source_viewing_record_id`
- 新增：`house: HouseSummaryOut`、`tenant: ContactSummaryOut`、`source_viewing_record: ViewingRecordSummaryOut | None`
- 移除：`house_label`、`tenant_name`、`tenant_phone`、`source_viewing_record_label`

## 后端数据流

查询层继续复用当前 `select_related`，不新增查询服务层：

- 房源查询继续预取 `building__estate`、`landlord`
- 带看查询继续预取 `house__building__estate`、`contact`、`assigned_to`
- 租约查询继续预取 `house__building__estate`、`tenant`、`source_viewing_record`

返回时由 Ninja Schema 读取关联对象并输出嵌套摘要。

## 前端迁移

只改 `frontend_admin/src/pages/property-rental` 和相关测试。生成服务通过 `npm run openapi` 更新，不手改 `src/services/openapi`。

字段替换规则：

```ts
record.house_label        -> record.house?.label
record.contact_name       -> record.contact?.name
record.contact_phone      -> record.contact?.phone
record.tenant_name        -> record.tenant?.name
record.tenant_phone       -> record.tenant?.phone
record.landlord_name      -> record.landlord?.name
record.landlord_phone     -> record.landlord?.phone
record.estate_name        -> record.estate?.display_name || record.estate?.name
record.building_name      -> record.building?.name
```

表单值、URL 参数、跳转、筛选继续使用顶层 ID：

```ts
record.house_id
record.contact_id
record.tenant_id
record.landlord_id
record.building_id
record.estate_id
record.source_viewing_record_id
```

不增加旧字段兼容适配层。测试 mock 直接改成新结构。

## 测试与验证

后端：

- 更新 `tests/house/test_api.py`，断言嵌套对象和顶层 ID 同时存在。
- 继续断言枚举字段保持 `status/status__mapping` 等现状。

前端：

- 运行 `npm run openapi` 重新生成类型。
- 更新 `property-rental` 页面和测试 mock。
- 运行相关 Vitest。
- 运行 `npm run tsc`。

收口：

- 运行 `git diff --check`。
- 按改动范围运行后端和前端最小验证。

## 实施顺序

1. 修改 `apps/house/schemas.py`，增加摘要 Schema 并替换 `Out` 字段。
2. 调整 `apps/house/api.py` 中手工返回的 `DefaultBuildingOut` 字段。
3. 更新 `tests/house/test_api.py`。
4. 重新生成 `frontend_admin/src/services/openapi`。
5. 更新 `frontend_admin/src/services/manual/house.ts` 类型。
6. 更新 `frontend_admin/src/pages/property-rental` 页面读取路径。
7. 更新相关前端测试 mock 和断言。
8. 运行最小验证。

## 风险

- OpenAPI 类型变化会让前端 TypeScript 暴露大量旧字段引用，按编译错误逐个替换即可。
- 表格空值展示需要统一使用可选链和现有 fallback，避免空关系时报错。
- `DefaultBuildingOut` 当前由 API 手工返回 dict，容易漏改，需要单独覆盖。
