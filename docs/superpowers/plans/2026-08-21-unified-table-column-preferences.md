# 统一数据列表表头个人设置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立项目级通用的 Ant Design ProTable 表头个人设置能力，并先在房源列表接入验证。

**Architecture:** 后端复用单条 `UserSetting(key="internal.ui.table_columns")`；读取使用现有个人设置单项详情接口，按 `table_key` 的专用接口原子合并和重置单个列表配置。前端通用钩子直接消费 Ant Design `ColumnsState`，将服务端用户覆盖与当前前端列默认值合并，并负责防抖保存、失败回退和重置。

**Tech Stack:** Django 5、django-ninja、PostgreSQL JSONField、pytest、React 19、TypeScript、Ant Design ProComponents、TanStack Query、Vitest。

---

## 实施前提与文件边界

当前工作区包含大量与本功能无关的未提交修改，并且 `frontend_admin/src/services/openapi/typings.d.ts`、房源页面和房源综合测试已经存在用户改动。实施前先保存这些文件的基线 diff；提交重叠文件时使用 `git add -p` 只暂存本功能 hunks，并用 `git diff --cached` 复核，禁止把其他改动带入本功能提交。`frontend_admin/src/services/openapi/` 只能通过 OpenAPI 生成命令更新，不能手工编辑。

本功能不修改数据库模型，不新增 migration，不提供默认表头接口，也不实现旧设置兼容或迁移。

### 新建文件

- `apps/settings/table_columns.py`：表头设置常量、校验、事务合并和重置。
- `tests/settings/test_table_columns_service.py`：后端服务层、大小限制和并发合并测试。
- `tests/settings/test_table_columns_api.py`：统一读取、专用写入、重置和错误响应测试。

### 修改文件

- `apps/settings/service.py`：默认个人设置列表过滤 `internal.*`。
- `apps/settings/api.py`：增加按 `table_key` 的 PUT、DELETE 路由，并保护保留 key。
- `frontend_admin/config/codegen.openapi.json`：由 OpenAPI 命令更新接口快照。
- `frontend_admin/src/services/openapi/userSettings.ts`：由 OpenAPI 命令生成两个专用写入函数。
- `frontend_admin/src/services/openapi/typings.d.ts`：由 OpenAPI 命令生成请求参数和列状态类型。
- `frontend_admin/src/hooks/useUserTableColumnsState.ts`：将现有独立 key 实现升级为项目级通用钩子。
- `frontend_admin/src/hooks/useUserTableColumnsState.test.tsx`：覆盖默认状态合并、防抖保存、重置、失败回退和卸载提交。
- `frontend_admin/src/pages/rental/houses/index.tsx`：使用 `rental.houses` 接入统一钩子。
- `frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx`：更新 API mock 并验证房源页面使用统一 `table_key`。

## Task 1：实现后端表头设置服务

**Files:**

- Create: `tests/settings/test_table_columns_service.py`
- Create: `apps/settings/table_columns.py`

- [ ] **Step 1：先写服务层失败测试**

创建 `tests/settings/test_table_columns_service.py`，覆盖多个列表局部合并、重置、非法 key、非法列状态、列数限制、总大小限制和并发更新：

```python
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import close_old_connections

from apps.accounts.models import User
from apps.settings.models import UserSetting
from apps.settings.table_columns import (
    USER_TABLE_COLUMNS_SETTING_KEY,
    TableColumnsValidationError,
    delete_user_table_columns,
    set_user_table_columns,
)


@pytest.fixture
def user(db):
    return User.objects.create_user(username="table-columns-user", password="secret")  # noqa: S106


@pytest.mark.django_db
def test_set_table_columns_preserves_other_tables(user):
    set_user_table_columns(user, "rental.houses", {"room_number": {"show": False, "order": 2}})
    set_user_table_columns(user, "rental.contacts", {"name": {"fixed": "left"}})

    setting = UserSetting.objects.get(user=user, key=USER_TABLE_COLUMNS_SETTING_KEY)
    assert setting.value == {
        "rental.houses": {"room_number": {"show": False, "order": 2}},
        "rental.contacts": {"name": {"fixed": "left"}},
    }


@pytest.mark.django_db
def test_delete_table_columns_is_idempotent_and_removes_empty_setting(user):
    set_user_table_columns(user, "rental.houses", {"room_number": {"show": False}})

    delete_user_table_columns(user, "rental.houses")
    delete_user_table_columns(user, "rental.houses")

    assert not UserSetting.objects.filter(user=user, key=USER_TABLE_COLUMNS_SETTING_KEY).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("key", ["", "Rental.Houses", "rental houses", "x" * 101])
def test_rejects_invalid_table_key(user, key):
    with pytest.raises(TableColumnsValidationError):
        set_user_table_columns(user, key, {"name": {"show": True}})


@pytest.mark.django_db
@pytest.mark.parametrize(
    "value",
    [
        {"name": {"show": None}},
        {"name": {"fixed": "center"}},
        {"name": {"order": True}},
        {"name": {"order": float("inf")}},
        {"name": {"disable": True}},
        {"bad column": {"show": True}},
    ],
)
def test_rejects_invalid_column_state(user, value):
    with pytest.raises(TableColumnsValidationError):
        set_user_table_columns(user, "rental.houses", value)


@pytest.mark.django_db
def test_normalizes_null_fixed_to_missing_field(user):
    result = set_user_table_columns(user, "rental.houses", {"room_number": {"show": True, "fixed": None}})
    assert result == {"room_number": {"show": True}}


@pytest.mark.django_db
def test_rejects_more_than_two_hundred_columns(user):
    value = {f"column_{index}": {"show": True} for index in range(201)}
    with pytest.raises(TableColumnsValidationError, match="200"):
        set_user_table_columns(user, "rental.houses", value)


@pytest.mark.django_db
def test_rejects_merged_setting_larger_than_limit(user):
    UserSetting.objects.create(
        user=user,
        key=USER_TABLE_COLUMNS_SETTING_KEY,
        value={"oversized.seed": {"payload": "x" * (256 * 1024)}},
    )
    with pytest.raises(TableColumnsValidationError, match="256"):
        set_user_table_columns(user, "rental.houses", {"room_number": {"show": True}})


@pytest.mark.django_db(transaction=True)
def test_concurrent_updates_for_different_tables_are_both_preserved():
    user = User.objects.create_user(username="concurrent-table-columns", password="secret")  # noqa: S106
    barrier = Barrier(2)

    def write_table(table_key, column_key):
        close_old_connections()
        thread_user = User.objects.get(pk=user.pk)
        barrier.wait()
        set_user_table_columns(thread_user, table_key, {column_key: {"show": False}})
        close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(write_table, "rental.houses", "room_number"),
            executor.submit(write_table, "rental.contacts", "name"),
        ]
        for future in futures:
            future.result()

    setting = UserSetting.objects.get(user=user, key=USER_TABLE_COLUMNS_SETTING_KEY)
    assert setting.value == {
        "rental.houses": {"room_number": {"show": False}},
        "rental.contacts": {"name": {"show": False}},
    }
```

- [ ] **Step 2：运行测试并确认失败原因正确**

Run:

```bash
docker compose exec web pytest tests/settings/test_table_columns_service.py -q
```

Expected: FAIL，错误为 `ModuleNotFoundError: No module named 'apps.settings.table_columns'`。

- [ ] **Step 3：实现最小服务模块**

创建 `apps/settings/table_columns.py`：

```python
import json
import math
import re
from collections.abc import Mapping

from django.db import transaction

from apps.settings.models import UserSetting

USER_TABLE_COLUMNS_SETTING_KEY = "internal.ui.table_columns"
MAX_KEY_LENGTH = 100
MAX_COLUMNS_PER_TABLE = 200
MAX_SETTING_BYTES = 256 * 1024
KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,99}$")
ALLOWED_COLUMN_STATE_FIELDS = {"show", "fixed", "order"}


class TableColumnsValidationError(ValueError):
    pass


def _validate_key(value: str, label: str) -> None:
    if not isinstance(value, str) or len(value) > MAX_KEY_LENGTH or not KEY_PATTERN.fullmatch(value):
        raise TableColumnsValidationError(f"{label} 格式不合法")


def normalize_table_columns_state(value: Mapping) -> dict[str, dict]:
    if not isinstance(value, Mapping):
        raise TableColumnsValidationError("表头设置必须是对象")
    if len(value) > MAX_COLUMNS_PER_TABLE:
        raise TableColumnsValidationError("单个列表最多保存 200 列")

    normalized: dict[str, dict] = {}
    for column_key, raw_state in value.items():
        _validate_key(column_key, "列 key")
        if not isinstance(raw_state, Mapping):
            raise TableColumnsValidationError("列状态必须是对象")
        unknown_fields = set(raw_state) - ALLOWED_COLUMN_STATE_FIELDS
        if unknown_fields:
            raise TableColumnsValidationError("列状态包含不支持的字段")

        state: dict = {}
        if "show" in raw_state:
            if not isinstance(raw_state["show"], bool):
                raise TableColumnsValidationError("show 必须是布尔值")
            state["show"] = raw_state["show"]
        if "fixed" in raw_state and raw_state["fixed"] is not None:
            if raw_state["fixed"] not in {"left", "right"}:
                raise TableColumnsValidationError("fixed 只能是 left、right 或 null")
            state["fixed"] = raw_state["fixed"]
        if "order" in raw_state:
            order = raw_state["order"]
            if isinstance(order, bool) or not isinstance(order, int | float) or not math.isfinite(order):
                raise TableColumnsValidationError("order 必须是有限数字")
            state["order"] = order
        normalized[column_key] = state
    return normalized


def _setting_size(value: dict) -> int:
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def _validate_setting_size(value: dict) -> None:
    if _setting_size(value) > MAX_SETTING_BYTES:
        raise TableColumnsValidationError("表头个人设置不能超过 256 KiB")


def set_user_table_columns(user, table_key: str, value: Mapping) -> dict[str, dict]:
    _validate_key(table_key, "table_key")
    normalized = normalize_table_columns_state(value)
    with transaction.atomic():
        UserSetting.objects.get_or_create(
            user=user,
            key=USER_TABLE_COLUMNS_SETTING_KEY,
            defaults={"value": {}},
        )
        setting = UserSetting.objects.select_for_update().get(user=user, key=USER_TABLE_COLUMNS_SETTING_KEY)
        all_tables = dict(setting.value) if isinstance(setting.value, dict) else {}
        all_tables[table_key] = normalized
        _validate_setting_size(all_tables)
        setting.value = all_tables
        setting.save()
    return normalized


def delete_user_table_columns(user, table_key: str) -> None:
    _validate_key(table_key, "table_key")
    with transaction.atomic():
        setting = (
            UserSetting.objects.select_for_update()
            .filter(user=user, key=USER_TABLE_COLUMNS_SETTING_KEY)
            .first()
        )
        if not setting:
            return
        all_tables = dict(setting.value) if isinstance(setting.value, dict) else {}
        all_tables.pop(table_key, None)
        if not all_tables:
            setting.delete()
            return
        setting.value = all_tables
        setting.save()
```

- [ ] **Step 4：运行服务层测试并修正类型或并发细节**

Run:

```bash
docker compose exec web pytest tests/settings/test_table_columns_service.py -q
```

Expected: PASS，全部服务层测试通过；并发测试最终同时包含 `rental.houses` 和 `rental.contacts`。

- [ ] **Step 5：运行 Ruff 检查**

Run:

```bash
docker compose exec web ruff check apps/settings/table_columns.py tests/settings/test_table_columns_service.py
```

Expected: PASS，无 lint 错误。

- [ ] **Step 6：提交服务层**

```bash
git add apps/settings/table_columns.py tests/settings/test_table_columns_service.py
git commit -m "feat: 增加列表表头个人设置服务"
```

## Task 2：增加专用个人设置 API

**Files:**

- Create: `tests/settings/test_table_columns_api.py`
- Modify: `apps/settings/service.py:166-190`
- Modify: `apps/settings/api.py:3-26,45-52,151-187`

- [ ] **Step 1：先写 API 失败测试**

创建 `tests/settings/test_table_columns_api.py`：

```python
import json

import pytest

from apps.accounts.models import User
from apps.settings.models import UserSetting
from apps.settings.table_columns import USER_TABLE_COLUMNS_SETTING_KEY
from tests.api_helpers import api_data


def table_columns_url(table_key="rental.houses"):
    return f"/api/settings/user/table-columns/{table_key}/"


def put_json(client, url, data):
    return client.put(url, data=json.dumps(data), content_type="application/json")


@pytest.fixture
def user(db):
    return User.objects.create_user(username="table-columns-api", password="secret")  # noqa: S106


@pytest.mark.django_db
def test_table_columns_write_api_requires_login(client):
    assert put_json(client, table_columns_url(), {"room_number": {"show": False}}).status_code in (401, 403)
    assert client.delete(table_columns_url()).status_code in (401, 403)


@pytest.mark.django_db
def test_put_and_generic_detail_get_use_ant_design_shape(client, user):
    client.force_login(user)
    payload = {
        "room_number": {"show": True, "fixed": "left", "order": 0},
        "asking_rent": {"show": False, "order": 5},
    }
    response = put_json(client, table_columns_url(), payload)
    assert response.status_code == 200
    assert api_data(response) == payload
    detail = api_data(client.get("/api/settings/user/internal.ui.table_columns/"))
    assert detail == {
        "key": "internal.ui.table_columns",
        "value": {"rental.houses": payload},
    }


@pytest.mark.django_db
def test_put_only_replaces_requested_table(client, user):
    client.force_login(user)
    put_json(client, table_columns_url("rental.houses"), {"room_number": {"show": False}})
    put_json(client, table_columns_url("rental.contacts"), {"name": {"show": True}})
    put_json(client, table_columns_url("rental.houses"), {"asking_rent": {"order": 1}})

    setting = UserSetting.objects.get(user=user, key=USER_TABLE_COLUMNS_SETTING_KEY)
    assert setting.value == {
        "rental.houses": {"asking_rent": {"order": 1}},
        "rental.contacts": {"name": {"show": True}},
    }


@pytest.mark.django_db
def test_delete_is_idempotent(client, user):
    client.force_login(user)
    put_json(client, table_columns_url(), {"room_number": {"show": False}})
    assert client.delete(table_columns_url()).status_code == 200
    assert client.delete(table_columns_url()).status_code == 200
    assert client.get("/api/settings/user/internal.ui.table_columns/").status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {"room_number": {"disable": True}},
        {"room_number": {"show": None}},
        {"room_number": {"fixed": "center"}},
        {"room_number": {"order": True}},
    ],
)
def test_put_rejects_invalid_ant_design_state(client, user, payload):
    client.force_login(user)
    response = put_json(client, table_columns_url(), payload)
    assert response.status_code == 422


@pytest.mark.django_db
def test_put_normalizes_null_fixed(client, user):
    client.force_login(user)
    response = put_json(client, table_columns_url(), {"room_number": {"show": True, "fixed": None}})
    assert response.status_code == 200
    assert api_data(response) == {"room_number": {"show": True}}


@pytest.mark.django_db
def test_generic_put_cannot_bypass_reserved_table_columns_api(client, user):
    client.force_login(user)
    response = put_json(
        client,
        "/api/settings/user/internal.ui.table_columns/",
        {"value": {"rental.houses": {"room_number": {"disable": True}}}},
    )
    assert response.status_code == 422


@pytest.mark.django_db
def test_generic_delete_cannot_remove_reserved_table_columns_setting(client, user):
    client.force_login(user)
    put_json(client, table_columns_url(), {"room_number": {"show": False}})
    response = client.delete("/api/settings/user/internal.ui.table_columns/")
    assert response.status_code == 422
    detail = api_data(client.get("/api/settings/user/internal.ui.table_columns/"))
    assert detail["value"] == {"rental.houses": {"room_number": {"show": False}}}


@pytest.mark.django_db
def test_default_user_setting_list_filters_internal_values(client, user):
    client.force_login(user)
    put_json(client, "/api/settings/user/theme/", {"value": "dark"})
    put_json(client, table_columns_url(), {"room_number": {"show": False}})

    assert api_data(client.get("/api/settings/user/")) == [{"key": "theme", "value": "dark"}]
```

- [ ] **Step 2：运行 API 测试并确认路由尚不存在**

Run:

```bash
docker compose exec web pytest tests/settings/test_table_columns_api.py -q
```

Expected: FAIL，专用 PUT/DELETE 返回 404；实现专用写入后，默认列表过滤测试在旧服务实现下仍会暴露内部设置。

- [ ] **Step 3：增加 Schema、导入和专用路由**

在 `apps/settings/api.py`：

1. 从 `typing` 导入 `Literal`。
2. 从 `ninja` 导入 `Body`。
3. 从 `pydantic` 导入 `ConfigDict`、`FiniteFloat`、`StrictBool`、`StrictInt`。
4. 导入表头设置常量、写入/删除服务函数和 `TableColumnsValidationError`。
5. 在通用 `/{key}/` 路由之前注册专用 PUT/DELETE 路由。
6. 将 `internal.ui.table_columns` 标记为保留 key，阻止通用 PUT/DELETE 绕过专用接口校验。

新增 Schema：

```python
class TableColumnState(Schema):
    model_config = ConfigDict(extra="forbid")

    show: StrictBool | None = None
    fixed: Literal["left", "right"] | None = None
    order: StrictInt | FiniteFloat | None = None
```

新增接口：

```python
@user_router.put(
    "/table-columns/{table_key}/",
    response=dict[str, TableColumnState],
    exclude_none=True,
    summary="更新列表表头个人设置",
)
def put_user_table_columns(
    request,
    table_key: str = Path(..., description="稳定的列表标识。"),
    payload: dict[str, TableColumnState] = Body(...),
):
    require_authenticated(request)
    raw_value = {column_key: state.model_dump(exclude_unset=True) for column_key, state in payload.items()}
    try:
        return set_user_table_columns(request.user, table_key, raw_value)
    except TableColumnsValidationError as exc:
        raise HttpError(422, str(exc)) from exc


@user_router.delete(
    "/table-columns/{table_key}/",
    response={200: dict},
    summary="重置列表表头个人设置",
)
def delete_user_table_columns_view(request, table_key: str = Path(..., description="稳定的列表标识。")):
    require_authenticated(request)
    try:
        delete_user_table_columns(request.user, table_key)
    except TableColumnsValidationError as exc:
        raise HttpError(422, str(exc)) from exc
    return Status(200, {})
```

在通用个人设置 PUT 和 DELETE 路由中调用以下保护函数；通用 GET 保持只读可用：

```python
def _reject_reserved_user_setting_write(key: str) -> None:
    if key == USER_TABLE_COLUMNS_SETTING_KEY:
        raise HttpError(422, "该设置项必须通过列表表头个人设置接口更新")
```

在 `apps/settings/service.py` 中让默认列表只返回可在设置页面维护的记录：

```python
def get_all_user_settings(user) -> list[dict]:
    settings = UserSetting.objects.filter(user=user).exclude(key__startswith="internal.")
    return [{"key": setting.key, "value": setting.value} for setting in settings]
```

通用单项详情 `GET /api/settings/user/{key}/` 不增加过滤，因此业务钩子仍可读取 `internal.ui.table_columns`。

- [ ] **Step 4：运行 API 与已有设置测试**

Run:

```bash
docker compose exec web pytest tests/settings/test_table_columns_api.py tests/settings/test_api.py -q
```

Expected: PASS，新接口与原有个人设置接口均通过。

- [ ] **Step 5：运行后端格式与 lint**

Run:

```bash
docker compose exec web ruff format apps/settings/service.py apps/settings/api.py tests/settings/test_table_columns_api.py
docker compose exec web ruff check apps/settings/service.py apps/settings/api.py tests/settings/test_table_columns_api.py
```

Expected: PASS。

- [ ] **Step 6：提交 API**

```bash
git add apps/settings/service.py apps/settings/api.py tests/settings/test_table_columns_api.py
git commit -m "feat: 增加列表表头个人设置接口"
```

## Task 3：重新生成管理端 OpenAPI 客户端

**Files:**

- Modify generated: `frontend_admin/config/codegen.openapi.json`
- Modify generated: `frontend_admin/src/services/openapi/userSettings.ts`
- Modify generated: `frontend_admin/src/services/openapi/typings.d.ts`

- [ ] **Step 1：确认本地 schema 已包含两个新 operationId**

Run:

```bash
curl -fsS http://localhost:18000/api/openapi.json | rg "put_user_table_columns|delete_user_table_columns_view"
```

Expected: 输出两个 operationId。若服务未启动，先运行 `just start` 并等待 web 服务可访问；不要运行包含删除操作的构建或清理命令。

- [ ] **Step 2：按项目规则切换 Node 22 并生成客户端**

Run:

```bash
cd frontend_admin
nvm use 22
ALLAUTH_OPENAPI_SCHEMA_URL=config/codegen.allauth.json npm run openapi
```

Expected: `userSettings.ts` 中生成以下函数，且没有手工修改生成文件：

```ts
appsSettingsApiPutUserTableColumns
appsSettingsApiDeleteUserTableColumnsView
```

- [ ] **Step 3：核对生成范围**

Run:

```bash
git diff -- frontend_admin/config/codegen.openapi.json frontend_admin/src/services/openapi/userSettings.ts frontend_admin/src/services/openapi/typings.d.ts
rg -n "UserTableColumns|TableColumnState|table_key" frontend_admin/src/services/openapi/userSettings.ts frontend_admin/src/services/openapi/typings.d.ts
```

Expected: schema 快照、个人设置 client 和类型声明包含两个专用写入接口；现有 `appsSettingsApiGetUserSettingView` 继续用于读取内部设置。不出现 `package.json` 或锁文件变化。若生成器因当前工作区其他后端改动更新了额外 API，提交前必须逐项识别并排除不属于本功能的内容。

- [ ] **Step 4：运行 TypeScript 类型检查，确认纯生成结果可用**

Run:

```bash
cd frontend_admin
nvm use 22
npm run tsc
```

Expected: PASS，或仅暴露下一任务中旧钩子尚未切换新函数的预期类型错误；不得出现生成文件语法错误。

- [ ] **Step 5：提交生成文件**

```bash
git add frontend_admin/config/codegen.openapi.json frontend_admin/src/services/openapi/userSettings.ts
git add -p frontend_admin/src/services/openapi/typings.d.ts
git diff --cached -- frontend_admin/config/codegen.openapi.json frontend_admin/src/services/openapi/userSettings.ts frontend_admin/src/services/openapi/typings.d.ts
git commit -m "chore: 更新列表表头个人设置客户端"
```

## Task 4：重构通用表头设置钩子

**Files:**

- Modify: `frontend_admin/src/hooks/useUserTableColumnsState.test.tsx`
- Modify: `frontend_admin/src/hooks/useUserTableColumnsState.ts`

- [ ] **Step 1：将钩子测试改为新接口并补齐失败用例**

读取复用现有通用单项详情函数，写入使用两个新函数：

```ts
const {
  mockDeleteTableColumns,
  mockGetUserSetting,
  mockPutTableColumns,
  mockMessageError,
} = vi.hoisted(() => ({
  mockDeleteTableColumns: vi.fn(),
  mockGetUserSetting: vi.fn(),
  mockPutTableColumns: vi.fn(),
  mockMessageError: vi.fn(),
}));

vi.mock('@/services/openapi/userSettings', () => ({
  appsSettingsApiDeleteUserTableColumnsView: mockDeleteTableColumns,
  appsSettingsApiGetUserSettingView: mockGetUserSetting,
  appsSettingsApiPutUserTableColumns: mockPutTableColumns,
}));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return { ...actual, message: { ...actual.message, error: mockMessageError } };
});
```

使用包含默认固定、禁用和新增列的列定义：

```ts
const columns = [
  { key: 'house', dataIndex: 'house', fixed: 'left' as const },
  { key: 'media', dataIndex: 'media' },
  { key: 'actions', dataIndex: 'actions', disable: true, fixed: 'right' as const },
];
```

至少新增以下测试：

```ts
it('合并前端默认值并过滤服务端旧列', async () => {
  mockGetUserSetting.mockResolvedValue({
    key: 'internal.ui.table_columns',
    value: {
      'rental.houses': {
        house: { show: false, order: 2 },
        obsolete: { show: false },
      },
    },
  });
  const { result } = renderHook(
    () => useUserTableColumnsState({ tableKey: 'rental.houses', columns, debounceMs: 10 }),
    { wrapper: createWrapper() },
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.value).toEqual({
    house: { show: false, fixed: 'left', order: 2 },
    media: { show: true },
    actions: { show: true, fixed: 'right', disable: true },
  });
});

it('立即更新并只保存可持久化的 Ant Design 字段', async () => {
  mockGetUserSetting.mockRejectedValue({ response: { status: 404 } });
  const { result } = renderHook(
    () => useUserTableColumnsState({ tableKey: 'rental.houses', columns, debounceMs: 10 }),
    { wrapper: createWrapper() },
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  act(() => {
    result.current.onChange({
      house: { show: false, fixed: 'left', order: 2 },
      media: { show: true },
      actions: { show: true, fixed: 'right', disable: true },
    });
  });
  await waitFor(() =>
    expect(mockPutTableColumns).toHaveBeenCalledWith(
      { table_key: 'rental.houses' },
      {
        house: { show: false, fixed: 'left', order: 2 },
        media: { show: true },
        actions: { show: true, fixed: 'right' },
      },
      { skipErrorHandler: true },
    ),
  );
});

it('Ant Design 重置为默认状态时删除远端配置', async () => {
  mockGetUserSetting.mockResolvedValue({
    key: 'internal.ui.table_columns',
    value: { 'rental.houses': { house: { show: false } } },
  });
  const { result } = renderHook(
    () => useUserTableColumnsState({ tableKey: 'rental.houses', columns, debounceMs: 10 }),
    { wrapper: createWrapper() },
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  act(() => {
    result.current.onChange({
      house: { show: true, fixed: 'left' },
      media: { show: true },
      actions: { show: true, fixed: 'right', disable: true },
    });
  });
  await waitFor(() =>
    expect(mockDeleteTableColumns).toHaveBeenCalledWith(
      { table_key: 'rental.houses' },
      { skipErrorHandler: true },
    ),
  );
});
```

同时保留并调整以下行为测试：GET 失败使用默认状态、重复 `onChange` 不请求、PUT/DELETE 失败调用 `message.error('表头设置保存失败')`、卸载时提交待保存状态、`reset()` 主动删除当前配置。

- [ ] **Step 2：运行钩子测试并确认旧实现失败**

Run:

```bash
cd frontend_admin
nvm use 22
npm exec -- vitest run src/hooks/useUserTableColumnsState.test.tsx
```

Expected: FAIL，旧实现仍要求 `preferenceKey`、`columnKeys` 并调用通用个人设置接口。

- [ ] **Step 3：实现稳定默认状态与持久化状态辅助函数**

在 `useUserTableColumnsState.ts` 中保留导出的 `TableColumnsState`，新增以下职责明确的辅助函数：

```ts
export type TableColumnsState = Record<string, ColumnsState>;

export function sanitizePersistedColumnsState(
  value: unknown,
  allowedColumnKeys: ReadonlySet<string>,
): TableColumnsState;

function buildDefaultColumnsState<T>(
  columns: readonly ProColumns<T>[],
  defaultValue: TableColumnsState = {},
): TableColumnsState;

function mergeRuntimeColumnsState(
  defaults: TableColumnsState,
  persisted: TableColumnsState,
): TableColumnsState;

function isSamePersistedColumnsState(
  left: TableColumnsState,
  right: TableColumnsState,
): boolean;
```

实现要求：

- `buildDefaultColumnsState` 递归读取 `children`，只接纳显式 `column.key`。
- 默认状态包含 `show: true`、列定义的 `fixed`、列定义的 `disable`，再应用可选 `defaultValue`。
- `sanitizePersistedColumnsState` 只保留允许列的 `show`、`fixed`、`order`，明确移除 `disable`。
- 通过规范化结果的稳定 JSON 签名复用默认状态引用，避免页面每次创建新 `columns` 数组导致重复 hydration。

- [ ] **Step 4：实现新钩子接口与查询缓存**

钩子签名调整为：

```ts
type UseUserTableColumnsStateOptions<T> = {
  tableKey: string;
  columns: readonly ProColumns<T>[];
  defaultValue?: TableColumnsState;
  debounceMs?: number;
};

export function useUserTableColumnsState<T>({
  tableKey,
  columns,
  defaultValue = {},
  debounceMs = 500,
}: UseUserTableColumnsStateOptions<T>)
```

查询与 mutation 使用以下约定：

```ts
const USER_TABLE_COLUMNS_SETTING_KEY = 'internal.ui.table_columns';
const queryKey = ['user-setting', USER_TABLE_COLUMNS_SETTING_KEY] as const;

appsSettingsApiGetUserSettingView(
  { key: USER_TABLE_COLUMNS_SETTING_KEY },
  { skipErrorHandler: true },
);

appsSettingsApiPutUserTableColumns(
  { table_key: tableKey },
  persistedValue,
  { skipErrorHandler: true },
);

appsSettingsApiDeleteUserTableColumnsView(
  { table_key: tableKey },
  { skipErrorHandler: true },
);
```

返回值必须包含：

```ts
return {
  value: runtimeValue,
  onChange,
  reset,
  isLoading: columnsQuery.isPending,
  isSaving: putMutation.isPending || deleteMutation.isPending,
};
```

`onChange` 将运行时值立即写入本地状态；清洗后的持久化状态与默认持久化状态相同时安排 DELETE，否则安排 PUT。GET 失败时使用默认运行时状态。mutation 失败时保留本地状态并显示 `message.error('表头设置保存失败')`。

通用 GET 返回完整的 `internal.ui.table_columns` 值。钩子读取 `setting.value[tableKey] ?? {}`；PUT 成功后在统一查询缓存中合并当前 `tableKey`，DELETE 成功后从同一缓存中移除当前 `tableKey`。404 表示尚未创建内部设置，不作为加载错误。

- [ ] **Step 5：实现防抖和卸载提交**

使用明确的待写入联合类型，避免用 `null` 同时表达删除和无任务：

```ts
type PendingWrite =
  | { kind: 'put'; value: TableColumnsState }
  | { kind: 'delete' };
```

每次变化覆盖前一个 pending write；500ms 后执行最后一次 PUT 或 DELETE。组件卸载时清除定时器，并使用生成请求函数直接提交尚未执行的 pending write，失败时不在卸载阶段弹出消息。

- [ ] **Step 6：运行钩子测试和 TypeScript 检查**

Run:

```bash
cd frontend_admin
nvm use 22
npm exec -- vitest run src/hooks/useUserTableColumnsState.test.tsx
npm run tsc
```

Expected: 钩子测试 PASS；TypeScript 不再报告旧参数或旧生成函数错误。

- [ ] **Step 7：运行 Biome 并提交通用钩子**

Run:

```bash
cd frontend_admin
nvm use 22
npm exec -- biome check src/hooks/useUserTableColumnsState.ts src/hooks/useUserTableColumnsState.test.tsx
```

Expected: PASS。

Commit:

```bash
git add frontend_admin/src/hooks/useUserTableColumnsState.ts frontend_admin/src/hooks/useUserTableColumnsState.test.tsx
git commit -m "feat: 统一列表表头个人设置钩子"
```

## Task 5：在房源列表接入统一能力

**Files:**

- Modify: `frontend_admin/src/pages/rental/houses/index.tsx:87-115,374-385,583-1235`
- Modify: `frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx:20-75,573-576,720-740,3460-3490`

- [ ] **Step 1：更新页面测试 mock 并写失败断言**

将旧的 `mockListUserSettings`、`mockPutUserSetting` 替换为：

```ts
mockDeleteTableColumns,
mockGetUserSetting,
mockPutTableColumns,
```

对应 mock：

```ts
vi.mock('@/services/openapi/userSettings', () => ({
  appsSettingsApiDeleteUserTableColumnsView: mockDeleteTableColumns,
  appsSettingsApiGetUserSettingView: mockGetUserSetting,
  appsSettingsApiPutUserTableColumns: mockPutTableColumns,
}));
```

在 `beforeEach` 中设置：

```ts
mockGetUserSetting.mockRejectedValue({ response: { status: 404 } });
mockPutTableColumns.mockResolvedValue({});
mockDeleteTableColumns.mockResolvedValue({});
```

在房源列表测试区域新增：

```ts
it('使用统一内部设置 key 加载房源表头个人设置', async () => {
  renderPage(<HousesPage />);

  await waitFor(() =>
    expect(mockGetUserSetting).toHaveBeenCalledWith(
      { key: 'internal.ui.table_columns' },
      { skipErrorHandler: true },
    ),
  );
});
```

- [ ] **Step 2：运行页面测试并确认旧房源 key 导致失败**

Run:

```bash
cd frontend_admin
nvm use 22
npm exec -- vitest run src/pages/rental/__tests__/domain-list-pages.test.tsx -t "使用统一内部设置 key"
```

Expected: FAIL，旧页面仍调用通用个人设置列表接口，而不是按内部 key 调用单项详情接口。

- [ ] **Step 3：移除房源专用个人设置 key 和重复列 key 数组**

在 `frontend_admin/src/pages/rental/houses/index.tsx`：

```ts
const HOUSE_TABLE_KEY = 'rental.houses';
```

删除：

```ts
const HOUSE_TABLE_COLUMNS_PREFERENCE_KEY = 'ui.table.property-rental.houses.columns.v11';
const HOUSE_TABLE_COLUMN_KEYS = [];
```

不要保留旧 key 读取、双写或迁移代码。

- [ ] **Step 4：确保全部可配置房源列具有显式稳定 key**

逐列核对 `columns`，每一列都必须包含稳定 `key`。现有房源列应继续使用以下 key，不使用标题或数组位置：

```ts
[
  'room_number',
  'estate',
  'room_layout_edit',
  'bathrooms',
  'kitchens',
  'balconies',
  'area',
  'interior_area',
  'floor',
  'orientation',
  'decoration',
  'building_id',
  'building_elevator',
  'has_elevator_access',
  'asking_rent',
  'deposit_amount',
  'landlord_id',
  'media',
  'tags',
  'public_description',
  'internal_notes',
  'status',
  'actions',
]
```

- [ ] **Step 5：在 columns 定义后调用通用钩子**

删除组件顶部旧调用，在完整 `columns` 数组创建后、任何条件返回之前调用：

```ts
const tableColumnsState = useUserTableColumnsState({
  tableKey: HOUSE_TABLE_KEY,
  columns,
});
```

保留现有 ProTable 绑定：

```tsx
columnsState={{
  value: tableColumnsState.value,
  onChange: tableColumnsState.onChange,
}}
```

不在页面中直接调用个人设置 API，不设置 ProTable 的 `persistenceKey` 或浏览器 storage。

- [ ] **Step 6：运行房源页面与钩子测试**

Run:

```bash
cd frontend_admin
nvm use 22
npm exec -- vitest run src/hooks/useUserTableColumnsState.test.tsx src/pages/rental/__tests__/domain-list-pages.test.tsx
```

Expected: PASS，房源页面现有行为没有回归，新测试确认 `rental.houses` 请求。

- [ ] **Step 7：运行前端静态检查并提交房源试用**

Run:

```bash
cd frontend_admin
nvm use 22
npm exec -- biome check src/pages/rental/houses/index.tsx src/pages/rental/__tests__/domain-list-pages.test.tsx
npm run tsc
```

Expected: PASS。

Commit:

```bash
git add -p frontend_admin/src/pages/rental/houses/index.tsx frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx
git diff --cached -- frontend_admin/src/pages/rental/houses/index.tsx frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx
git commit -m "feat: 接入房源列表表头个人设置"
```

## Task 6：完成端到端验证与范围审计

**Files:**

- Verify only; no planned source changes.

- [ ] **Step 1：运行全部设置后端测试**

Run:

```bash
docker compose exec web pytest tests/settings -q
```

Expected: PASS。

- [ ] **Step 2：运行管理端相关测试**

Run:

```bash
cd frontend_admin
nvm use 22
npm exec -- vitest run src/hooks/useUserTableColumnsState.test.tsx src/pages/rental/__tests__/domain-list-pages.test.tsx src/utils/userSettings.test.ts
```

Expected: PASS。

- [ ] **Step 3：运行后端静态检查**

Run:

```bash
docker compose exec web ruff format --check apps/settings/table_columns.py apps/settings/service.py apps/settings/api.py tests/settings/test_table_columns_service.py tests/settings/test_table_columns_api.py
docker compose exec web ruff check apps/settings/table_columns.py apps/settings/service.py apps/settings/api.py tests/settings/test_table_columns_service.py tests/settings/test_table_columns_api.py
```

Expected: PASS。

- [ ] **Step 4：运行管理端类型与 lint**

Run:

```bash
cd frontend_admin
nvm use 22
npm run tsc
npm run biome:lint
```

Expected: PASS。若全量 Biome 报告与本功能无关的既有问题，记录具体文件，并额外确认本计划涉及的文件均通过定向 `biome check`。

- [ ] **Step 5：核对实现范围和禁止项**

Run:

```bash
git diff --stat HEAD~5..HEAD
git diff HEAD~5..HEAD -- apps/settings frontend_admin/src/hooks/useUserTableColumnsState.ts frontend_admin/src/pages/rental/houses/index.tsx frontend_admin/src/services/openapi tests/settings
```

Expected:

- 没有新增 Django migration。
- 没有修改 `package.json`、`package-lock.json` 或多语言文件。
- 没有默认表头后端接口。
- 默认个人设置列表不返回 `internal.*`，通用单项详情仍可按 key 读取内部设置。
- 没有旧设置 key 兼容、迁移或双写逻辑。
- `internal.ui.table_columns` 是唯一的新内部设置 key。
- 通用个人设置 PUT/DELETE 不能绕过专用接口修改该保留 key。
- 房源列表之外没有被强制迁移。

- [ ] **Step 6：手工验收房源列表**

在已登录管理端执行：

1. 打开房源列表，隐藏一列并拖动一列顺序。
2. 刷新页面，确认显示和顺序恢复。
3. 固定一列到左侧或右侧，刷新确认恢复。
4. 切换组织，确认仍使用同一配置。
5. 点击 Ant Design 列设置中的重置，刷新确认使用前端默认列和顺序。
6. 在数据库或 Django shell 中确认同一用户只新增 `internal.ui.table_columns`，值的第一层为 `rental.houses`。

- [ ] **Step 7：确认工作区只剩用户原有改动或计划外问题**

Run:

```bash
git status --short
```

Expected: 本功能涉及文件已提交；其余状态与实施前记录的用户改动一致。
