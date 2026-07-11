# 楼栋可选绑定小区与删除保护 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许楼栋不绑定小区，并为小区、楼栋提供带关联资源预览和并发保护的安全删除流程。

**Architecture:** 楼栋的 `organization` 成为房源空间层级的唯一租户边界，`estate` 降为可选归类；房源仍必须绑定楼栋。删除流程由独立检查接口提供前端预览，由 DELETE 在事务中再次检查并通过数据库 `PROTECT` 兜底；管理端使用统一楼栋列表，仅在实际存在关联时显示小区或楼栋关联卡片。

**Tech Stack:** Django 5、django-ninja、PostgreSQL 条件唯一约束、pytest/pytest-django、React 19、Umi Max、Ant Design 6、React Query、Vitest、OpenAPI 生成客户端。

---

## 文件结构与职责

- `apps/house/models.py`：楼栋可空小区关系、名称地址规范化、条件唯一约束、房源组织归属。
- `apps/house/migrations/0006_optional_building_estate.py`：规范化既有楼栋数据、放宽外键并替换唯一约束。
- `apps/house/schemas.py`：可空小区输出和关联资源检查响应结构。
- `apps/house/services.py`：组织范围查询、删除资源摘要和默认楼栋兼容逻辑。
- `apps/house/exceptions.py`：房源域的 `RESOURCE_IN_USE` 冲突异常。
- `apps/house/api.py`：楼栋创建/解绑、小区和楼栋删除检查、事务删除接口。
- `apps/house/admin.py`：小区可空后的后台筛选与搜索兼容。
- `apps/base/exceptions.py`、`apps/base/errors.py`：允许业务异常携带结构化 `data`，保持现有字段错误格式不变。
- `tests/house/test_models.py`：模型约束、规范化和独立楼栋组织归属测试。
- `tests/house/test_migrations.py`：既有楼栋规范化和冲突中止迁移测试。
- `tests/house/test_api.py`：API 空值语义、租户隔离、删除检查与竞态测试。
- `frontend_admin/src/services/openapi/`：通过 OpenAPI 命令重新生成，不手工修改。
- `frontend_miniprogram/src/services/openapi/`：通过 OpenAPI 命令重新生成，不手工修改。
- `frontend_admin/src/services/manual/house.ts`：房源域生成客户端的手写适配器。
- `frontend_admin/src/services/manual/apiError.ts`：从统一错误包络提取结构化冲突数据。
- `frontend_admin/src/pages/property-rental/estates/ResourceDeleteModal.tsx`：删除检查、确认、409 原地切换和资源跳转。
- `frontend_admin/src/pages/property-rental/estates/ResourceDeleteModal.test.tsx`：删除弹窗行为测试。
- `frontend_admin/src/pages/property-rental/estates/index.tsx`：楼栋可空小区表单、条件式关联卡片和删除入口。
- `frontend_admin/src/pages/property-rental/houses/index.tsx`：支持删除弹窗跳转携带的 `building_id` 精确筛选。
- `frontend_admin/src/pages/property-rental/houses/new.tsx`：快速新建楼栋时允许不选小区，并动态要求地址。
- `frontend_admin/src/pages/property-rental/constants.ts`、`frontend_admin/src/pages/property-rental/constants.test.ts`：绑定和未绑定小区楼栋的统一标签。
- `frontend_admin/src/pages/settings-management/organization/index.tsx`：默认楼栋配置兼容楼栋无小区。
- `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`、`frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx`、`frontend_admin/src/pages/settings-management/organization/index.test.tsx`：管理端回归测试。

## Task 1：调整楼栋领域模型和数据库约束

**Files:**
- Modify: `tests/house/test_models.py:105-150`
- Create: `tests/house/test_migrations.py`
- Modify: `apps/house/models.py:65-92,134-198`
- Create: `apps/house/migrations/0006_optional_building_estate.py`

- [ ] **Step 1：编写独立楼栋和唯一约束失败测试**

在 `TestSpaceHierarchyAndContacts` 增加：

```python
def test_building_can_exist_without_estate_and_normalizes_identity(self):
    building = Building.objects.create(
        organization=self.org,
        estate=None,
        name="  海滨  公寓  ",
        address="  海滨路  20  号  ",
        floors=8,
    )

    building.refresh_from_db()
    self.assertEqual(building.name, "海滨 公寓")
    self.assertEqual(building.address, "海滨路 20 号")


def test_independent_building_requires_address(self):
    with self.assertRaisesMessage(ValidationError, "非小区楼栋必须填写楼栋地址。"):
        Building.objects.create(
            organization=self.org,
            estate=None,
            name="海滨公寓",
            address="",
            floors=8,
        )


def test_independent_building_name_and_address_are_unique_inside_org(self):
    Building.objects.create(
        organization=self.org,
        estate=None,
        name="海滨公寓",
        address="海滨路 20 号",
        floors=8,
    )

    with self.assertRaises(ValidationError) as context:
        Building.objects.create(
            organization=self.org,
            estate=None,
            name=" 海滨公寓 ",
            address=" 海滨路 20 号 ",
            floors=9,
        )
    self.assertIn("address", context.exception.message_dict)

    second = Building.objects.create(
        organization=self.org,
        estate=None,
        name="海滨公寓",
        address="海滨路 21 号",
        floors=9,
    )
    self.assertIsNotNone(second.pk)


def test_house_organization_comes_from_building_without_estate(self):
    building = Building.objects.create(
        organization=self.org,
        estate=None,
        name="海滨公寓",
        address="海滨路 20 号",
        floors=8,
    )
    house = self.make_house(building=building)

    self.assertEqual(house.organization, self.org)
```

- [ ] **Step 2：运行模型测试并确认失败**

Run:

```bash
docker compose exec web pytest tests/house/test_models.py::TestSpaceHierarchyAndContacts -q
```

Expected: FAIL，失败原因依次表现为 `Building.estate` 不允许 `NULL`、独立楼栋地址未校验以及 `House.organization` 访问空小区。

- [ ] **Step 3：实现模型最小变更**

在 `apps/house/models.py` 增加规范化函数并修改模型：

```python
def normalize_space_identity(value: str) -> str:
    return " ".join((value or "").split())


class Building(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="buildings")
    estate = models.ForeignKey(Estate, on_delete=models.PROTECT, related_name="buildings", null=True, blank=True)

    class Meta:
        ordering = ["estate__name", "name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["estate", "name"],
                condition=Q(estate__isnull=False),
                name="house_building_estate_name_unique",
            ),
            models.UniqueConstraint(
                fields=["organization", "name", "address"],
                condition=Q(estate__isnull=True),
                name="house_building_org_name_address_unique",
            ),
        ]

    def __str__(self):
        if self.estate_id:
            return f"{self.estate} {self.name}"
        return f"{self.name} {self.address}".strip()

    def clean(self):
        super().clean()
        self.name = normalize_space_identity(self.name)
        self.address = normalize_space_identity(self.address)
        if self.estate_id and self.organization_id and self.estate.organization_id != self.organization_id:
            raise ValidationError({"organization": "楼栋组织必须与项目片区组织一致。"})
        if not self.estate_id and not self.address:
            raise ValidationError({"address": "非小区楼栋必须填写楼栋地址。"})
        if self.organization_id and self.name:
            duplicates = Building.objects.exclude(pk=self.pk)
            if self.estate_id:
                if duplicates.filter(estate_id=self.estate_id, name=self.name).exists():
                    raise ValidationError({"name": "当前小区已存在同名楼栋。"})
            elif self.address and duplicates.filter(
                organization_id=self.organization_id,
                estate__isnull=True,
                name=self.name,
                address=self.address,
            ).exists():
                raise ValidationError({"address": "当前组织在该地址下已存在同名非小区楼栋。"})
```

将房源组织属性改为：

```python
@property
def organization(self):
    return self.building.organization
```

- [ ] **Step 4：生成并完善迁移**

Run:

```bash
docker compose exec web python manage.py makemigrations house --name optional_building_estate
```

Expected: 创建 `apps/house/migrations/0006_optional_building_estate.py`。

在迁移中把数据规范化放在新增条件唯一约束之前：

```python
def normalize_existing_buildings(apps, schema_editor):
    Building = apps.get_model("house", "Building")
    normalized = []
    seen = set()
    for building in Building.objects.order_by("pk").iterator():
        name = " ".join((building.name or "").split())
        address = " ".join((building.address or "").split())
        key = ("estate", building.estate_id, name) if building.estate_id else ("organization", building.organization_id, name, address)
        if key in seen:
            raise RuntimeError(f"楼栋规范化后发生唯一冲突，building_id={building.pk}, key={key}")
        seen.add(key)
        normalized.append((building.pk, name, address))
    for building_id, name, address in normalized:
        Building.objects.filter(pk=building_id).update(name=name, address=address)
```

迁移操作顺序必须是：删除旧约束、放宽 `estate`、运行数据规范化、添加两个条件唯一约束。

- [ ] **Step 5：运行模型测试和迁移检查**

在 `tests/house/test_migrations.py` 增加迁移函数测试。测试文件使用 Model Bakery 自行创建组织、小区和楼栋，不依赖未声明的 fixture：

```python
import importlib

import pytest
from django.apps import apps as django_apps
from model_bakery import baker

from apps.house.models import Building, Estate


@pytest.mark.django_db
def test_optional_building_migration_normalizes_existing_identity():
    org = baker.make("organizations.Organization")
    estate = Estate.objects.create(organization=org, name="项目", display_name="项目", province="广东", city="深圳", district="南山")
    building = Building.objects.create(organization=org, estate=estate, name="1栋", address="科技路 1 号", floors=8)
    Building.objects.filter(pk=building.pk).update(name="  1  栋  ", address="  科技路  1  号  ")
    migration = importlib.import_module("apps.house.migrations.0006_optional_building_estate")

    migration.normalize_existing_buildings(django_apps, None)

    building.refresh_from_db()
    assert building.name == "1 栋"
    assert building.address == "科技路 1 号"


@pytest.mark.django_db
def test_optional_building_migration_aborts_on_normalized_conflict():
    org = baker.make("organizations.Organization")
    estate = Estate.objects.create(organization=org, name="项目", display_name="项目", province="广东", city="深圳", district="南山")
    first = Building.objects.create(organization=org, estate=estate, name="1栋", address="科技路 1 号", floors=8)
    Building.objects.create(organization=org, estate=estate, name="1 栋", address="科技路 2 号", floors=8)
    Building.objects.filter(pk=first.pk).update(name=" 1  栋 ")
    migration = importlib.import_module("apps.house.migrations.0006_optional_building_estate")

    with pytest.raises(RuntimeError, match="楼栋规范化后发生唯一冲突"):
        migration.normalize_existing_buildings(django_apps, None)
```

Run:

```bash
docker compose exec web pytest tests/house/test_models.py::TestSpaceHierarchyAndContacts -q
docker compose exec web pytest tests/house/test_migrations.py -q
docker compose exec web python manage.py makemigrations --check --dry-run
```

Expected: 测试 PASS；迁移检查输出 `No changes detected`。

- [ ] **Step 6：提交领域模型变更**

```bash
git add apps/house/models.py apps/house/migrations/0006_optional_building_estate.py tests/house/test_models.py tests/house/test_migrations.py
git commit -m "feat: 支持楼栋不绑定小区"
```

## Task 2：将房源租户边界统一到楼栋组织

**Files:**
- Modify: `tests/house/test_models.py`
- Modify: `tests/house/test_api.py`
- Modify: `apps/house/services.py:79-103,233-272`
- Modify: `apps/house/api.py:52-53,213-242,295-400`
- Modify: `apps/house/schemas.py:101-149,256-330`
- Modify: `apps/house/admin.py:16-38`

- [ ] **Step 1：编写独立楼栋贯穿业务查询的失败测试**

在 `tests/house/test_api.py` 增加辅助方法和测试：

```python
def make_independent_house(self, *, room_number="独立-101", landlord=None):
    building = Building.objects.create(
        organization=self.org,
        estate=None,
        name="海滨公寓",
        address="海滨路 20 号",
        floors=8,
    )
    return House.objects.create(building=building, landlord=landlord, room_number=room_number)


def test_independent_building_house_is_visible_in_org_queries(self):
    house = self.make_independent_house()

    response = self.client.get("/api/house/houses/?page=1&page_size=20")

    self.assertEqual(response.status_code, 200)
    self.assertIn(house.pk, [item["id"] for item in api_data(response)["items"]])
```

在 `tests/house/test_models.py` 扩展房东查询：独立楼栋房源应由 `get_landlord_houses(self.user, self.org)` 返回，其他组织房源仍不可见。

- [ ] **Step 2：运行定向测试并确认失败**

```bash
docker compose exec web pytest tests/house/test_models.py::TestHouseMediaAndOwnership::test_landlord_query_is_user_and_org_scoped tests/house/test_api.py::HouseApiTestCase::test_independent_building_house_is_visible_in_org_queries -q
```

Expected: FAIL，独立楼栋房源被 `building__estate__organization` 过滤掉或序列化标签访问空小区。

- [ ] **Step 3：替换所有租户边界查询**

在 `apps/house/api.py` 和 `apps/house/services.py` 中将组织过滤统一为：

```python
House.objects.filter(building__organization=organization)
Lease.objects.filter(organization=organization, house__building__organization=organization)
get_object_or_404(House.objects.select_related("building__estate", "landlord"), pk=house_id, building__organization=organization)
```

保留 `select_related("building__estate")` 用于展示，但不得再用小区判断组织。对带看和租约的关键词搜索保留小区名称 OR 条件，因为 SQL 左连接能够兼容空小区。

- [ ] **Step 4：让标签和后台管理兼容空小区**

在 `apps/house/schemas.py` 使用统一标签函数：

```python
def building_display_label(building) -> str:
    if building.estate_id:
        estate_name = building.estate.display_name or building.estate.name
        return f"{estate_name} / {building.name}"
    return f"{building.name} · {building.address}"


class HouseSummaryOut(Schema):
    id: int
    label: str
    room_number: str
    building_id: int
    building: BuildingSummaryOut

    @staticmethod
    def resolve_label(obj):
        return f"{building_display_label(obj.building)} / {obj.room_number}"
```

将 `BuildingSummaryOut.estate_id`、`BuildingSummaryOut.estate`、`BuildingOut` 和 `DefaultBuildingOut` 的小区字段改为可空，并在 `BuildingSummaryOut` 增加 `address: str`，供无小区标签使用。修改 `apps/house/admin.py` 的房源组织筛选：

```python
list_filter = ("building__organization", "status", "decoration", "orientation", "is_active")
```

- [ ] **Step 5：运行房源、房东、带看和租约回归测试**

```bash
docker compose exec web pytest tests/house/test_models.py tests/house/test_api.py -q
```

Expected: 全部 PASS，独立楼栋房源不会漏出当前组织，也不会跨组织可见。

- [ ] **Step 6：提交查询边界变更**

```bash
git add apps/house/api.py apps/house/services.py apps/house/schemas.py apps/house/admin.py tests/house/test_models.py tests/house/test_api.py
git commit -m "refactor: 统一房源楼栋组织边界"
```

## Task 3：实现楼栋可空小区的创建、绑定和解绑 API

**Files:**
- Modify: `tests/house/test_api.py:100-180,260-360`
- Modify: `apps/house/schemas.py:69-92,137-162`
- Modify: `apps/house/api.py:98-136`

- [ ] **Step 1：编写创建、解绑和跨组织测试**

```python
def test_create_independent_building_and_patch_estate_relationship(self):
    create_response = self.client.post(
        "/api/house/buildings/",
        data=json.dumps({"estate_id": None, "name": "海滨公寓", "address": "海滨路 20 号", "floors": 8}),
        content_type="application/json",
    )
    self.assertEqual(create_response.status_code, 201)
    building_id = api_data(create_response)["id"]
    self.assertIsNone(api_data(create_response)["estate"])

    bind_response = self.client.patch(
        f"/api/house/buildings/{building_id}/",
        data=json.dumps({"estate_id": self.estate.pk}),
        content_type="application/json",
    )
    self.assertEqual(bind_response.status_code, 200)
    self.assertEqual(api_data(bind_response)["estate_id"], self.estate.pk)

    unbind_response = self.client.patch(
        f"/api/house/buildings/{building_id}/",
        data=json.dumps({"estate_id": None}),
        content_type="application/json",
    )
    self.assertEqual(unbind_response.status_code, 200)
    self.assertIsNone(api_data(unbind_response)["estate_id"])


def test_unbind_building_requires_address(self):
    building = Building.objects.create(organization=self.org, estate=self.estate, name="无地址楼", address="", floors=8)
    response = self.client.patch(
        f"/api/house/buildings/{building.pk}/",
        data=json.dumps({"estate_id": None}),
        content_type="application/json",
    )
    self.assertEqual(response.status_code, 400)
    self.assertIn("address", api_error(response)["data"]["fields"])


def test_default_building_can_be_an_independent_building(self):
    building = Building.objects.create(
        organization=self.org,
        estate=None,
        name="默认公寓",
        address="海滨路 20 号",
        floors=8,
    )
    response = self.client.put(
        "/api/house/default-building/",
        data=json.dumps({"building_id": building.pk}),
        content_type="application/json",
    )

    self.assertEqual(response.status_code, 200)
    self.assertIsNone(api_data(response)["estate_id"])
    self.assertIsNone(api_data(response)["estate"])
```

增加跨组织 `estate_id` 创建和更新测试：

```python
def test_create_and_patch_building_reject_estate_outside_current_org(self):
    other_org = baker.make("organizations.Organization", name="异组织", slug="building-other-org")
    other_estate = Estate.objects.create(
        organization=other_org,
        name="异组织项目",
        display_name="异组织项目",
        province="广东",
        city="广州",
        district="天河",
    )
    create_response = self.client.post(
        "/api/house/buildings/",
        data=json.dumps({"estate_id": other_estate.pk, "name": "越权楼栋", "address": "天河路 1 号", "floors": 8}),
        content_type="application/json",
    )
    patch_response = self.client.patch(
        f"/api/house/buildings/{self.building.pk}/",
        data=json.dumps({"estate_id": other_estate.pk}),
        content_type="application/json",
    )

    self.assertEqual(create_response.status_code, 404)
    self.assertEqual(patch_response.status_code, 404)
```

- [ ] **Step 2：运行 API 测试并确认失败**

```bash
docker compose exec web pytest tests/house/test_api.py -k "independent_building or unbind_building" -q
```

Expected: FAIL，`BuildingIn.estate_id` 仍必填或 PATCH 无法区分未传与显式 `null`。

- [ ] **Step 3：修改 Schema 和创建逻辑**

```python
class BuildingIn(Schema):
    estate_id: int | None = None
    name: str
    floors: int


class BuildingOut(Schema):
    id: int
    estate_id: int | None
    estate: EstateSummaryOut | None
```

创建楼栋时：

```python
estate = None
if payload.estate_id is not None:
    estate = get_object_or_404(Estate, pk=payload.estate_id, organization=org)
data = payload.dict()
data.pop("estate_id")
building = Building.objects.create(organization=org, estate=estate, **data)
```

- [ ] **Step 4：实现 PATCH 的三态语义**

```python
data = payload.dict(exclude_unset=True)
if "estate_id" in data:
    estate_id = data.pop("estate_id")
    building.estate = (
        get_object_or_404(Estate, pk=estate_id, organization=building.organization)
        if estate_id is not None
        else None
    )
for field, value in data.items():
    setattr(building, field, value)
building.save()
```

- [ ] **Step 5：运行 API 测试**

```bash
docker compose exec web pytest tests/house/test_api.py -k "building" -q
```

Expected: PASS；未传 `estate_id` 不修改，具体 ID 绑定，`null` 解绑。

- [ ] **Step 6：提交可空关系 API**

```bash
git add apps/house/schemas.py apps/house/api.py tests/house/test_api.py
git commit -m "feat: 支持楼栋绑定与解绑小区"
```

## Task 4：建立结构化资源占用错误和删除检查服务

**Files:**
- Modify: `apps/base/exceptions.py:1-65`
- Modify: `apps/base/errors.py:80-93`
- Create: `apps/house/exceptions.py`
- Modify: `apps/house/schemas.py`
- Modify: `apps/house/services.py`
- Modify: `tests/house/test_api.py`
- Test: `tests/access/test_api.py`

- [ ] **Step 1：编写资源检查响应测试**

```python
def test_estate_delete_check_returns_building_preview_and_target(self):
    for index in range(6):
        Building.objects.create(
            organization=self.org,
            estate=self.estate,
            name=f"{index + 1}栋",
            address=f"科技路 {index + 1} 号",
            floors=8,
        )

    response = self.client.get(f"/api/house/estates/{self.estate.pk}/delete-check/")

    self.assertEqual(response.status_code, 200)
    payload = api_data(response)
    self.assertFalse(payload["can_delete"])
    resource = payload["resources"][0]
    self.assertEqual(resource["type"], "building")
    self.assertEqual(resource["count"], 7)
    self.assertEqual(len(resource["items"]), 5)
    self.assertTrue(resource["truncated"])
    self.assertEqual(resource["target"]["query"], {"view": "buildings", "estate_id": self.estate.pk})


def test_building_delete_check_returns_house_preview_and_target(self):
    house = House.objects.create(building=self.building, room_number="101")
    response = self.client.get(f"/api/house/buildings/{self.building.pk}/delete-check/")
    resource = api_data(response)["resources"][0]

    self.assertEqual(resource["type"], "house")
    self.assertEqual(resource["items"][0]["id"], house.pk)
    self.assertEqual(resource["target"]["query"], {"building_id": self.building.pk})
```

- [ ] **Step 2：运行检查接口测试并确认失败**

```bash
docker compose exec web pytest tests/house/test_api.py -k "delete_check" -q
```

Expected: FAIL with 404，检查接口尚不存在。

- [ ] **Step 3：让 AppException 支持结构化 data**

在 `apps/base/exceptions.py`：

```python
from typing import Any, ClassVar

class AppException(Exception):
    error: ClassVar[str] = "APP_ERROR"
    code: ClassVar[int] = 400
    message: ClassVar[str] = _("服务异常")

    def __init__(
        self,
        message: str | None = None,
        *,
        fields: dict[str, list[str]] | None = None,
        data: Any = None,
    ):
        self.message = message if message is not None else self.__class__.message
        self.fields = fields
        self.data = data
        super().__init__(self.message)
```

在 `apps/base/errors.py` 保持旧字段错误包络兼容：

```python
@api.exception_handler(AppException)
def _app_exception(request, exc: AppException):
    data = exc.data
    if data is None and exc.fields:
        data = {"fields": exc.fields}
    payload = error_envelope(
        code=exc.__class__.code,
        error=exc.__class__.error,
        message=str(exc.message),
        data=data,
    )
    return JsonResponse(payload, status=exc.__class__.code)
```

运行 `tests/access/test_api.py`，确认现有 `ROLE_IN_USE` 的 `data.fields` 格式不变。

- [ ] **Step 4：定义检查 Schema、服务和异常**

在 `apps/house/schemas.py` 增加：

```python
class RelatedResourceItemOut(Schema):
    id: int
    label: str

class RelatedResourceTargetOut(Schema):
    path: str
    query: dict[str, int | str]

class RelatedResourceOut(Schema):
    type: str
    label: str
    count: int
    items: list[RelatedResourceItemOut]
    truncated: bool
    target: RelatedResourceTargetOut

class DeleteCheckOut(Schema):
    can_delete: bool
    resources: list[RelatedResourceOut]
```

在 `apps/house/services.py` 增加纯查询函数：

```python
RESOURCE_PREVIEW_LIMIT = 5

def get_estate_delete_check(estate):
    qs = estate.buildings.order_by("name", "id")
    count = qs.count()
    if count == 0:
        return {"can_delete": True, "resources": []}
    items = [
        {"id": item.pk, "label": f"{item.name} · {item.address}" if item.address else item.name}
        for item in qs[:RESOURCE_PREVIEW_LIMIT]
    ]
    return {
        "can_delete": False,
        "resources": [{
            "type": "building",
            "label": "关联楼栋",
            "count": count,
            "items": items,
            "truncated": count > RESOURCE_PREVIEW_LIMIT,
            "target": {"path": "/property-rental/estates", "query": {"view": "buildings", "estate_id": estate.pk}},
        }],
    }

def get_building_delete_check(building):
    qs = building.houses.order_by("room_number", "id")
    count = qs.count()
    if count == 0:
        return {"can_delete": True, "resources": []}
    items = [{"id": item.pk, "label": f"{building.name} / {item.room_number}"} for item in qs[:RESOURCE_PREVIEW_LIMIT]]
    return {
        "can_delete": False,
        "resources": [{
            "type": "house",
            "label": "关联房源",
            "count": count,
            "items": items,
            "truncated": count > RESOURCE_PREVIEW_LIMIT,
            "target": {"path": "/property-rental/houses", "query": {"building_id": building.pk}},
        }],
    }
```

创建 `apps/house/exceptions.py`：

```python
from apps.base.exceptions import ConflictException

class ResourceInUseException(ConflictException):
    error = "RESOURCE_IN_USE"

    def __init__(self, message: str, check: dict):
        super().__init__(message, data=check)
```

- [ ] **Step 5：增加检查路由并运行测试**

```python
@router.get("/estates/{estate_id}/delete-check/", response=DeleteCheckOut, summary="检查项目删除关联资源")
def check_estate_delete(request, estate_id: int):
    return get_estate_delete_check(get_estate(request, estate_id))

@router.get("/buildings/{building_id}/delete-check/", response=DeleteCheckOut, summary="检查楼栋删除关联资源")
def check_building_delete(request, building_id: int):
    return get_building_delete_check(get_building(request, building_id))
```

Run:

```bash
docker compose exec web pytest tests/house/test_api.py -k "delete_check" -q
docker compose exec web pytest tests/access/test_api.py -k "cannot_delete" -q
```

Expected: 全部 PASS；现有访问控制错误包络未改变。

- [ ] **Step 6：提交检查服务**

```bash
git add apps/base/exceptions.py apps/base/errors.py apps/house/exceptions.py apps/house/schemas.py apps/house/services.py apps/house/api.py tests/house/test_api.py
git commit -m "feat: 增加关联资源删除检查"
```

## Task 5：实现事务删除和 409 并发保护

**Files:**
- Modify: `tests/house/test_api.py`
- Modify: `apps/house/api.py`
- Modify: `apps/house/services.py`

- [ ] **Step 1：编写删除成功、资源占用和检查后新增资源测试**

```python
def test_delete_empty_estate_and_building(self):
    empty_estate = Estate.objects.create(
        organization=self.org,
        name="空项目",
        display_name="空项目",
        province="广东",
        city="深圳",
        district="南山",
    )
    independent = Building.objects.create(
        organization=self.org,
        estate=None,
        name="空楼栋",
        address="科技路 99 号",
        floors=8,
    )

    self.assertEqual(self.client.delete(f"/api/house/estates/{empty_estate.pk}/").status_code, 200)
    self.assertEqual(self.client.delete(f"/api/house/buildings/{independent.pk}/").status_code, 200)


def test_delete_returns_latest_resources_when_binding_appears_after_check(self):
    empty_estate = Estate.objects.create(
        organization=self.org,
        name="竞态项目",
        display_name="竞态项目",
        province="广东",
        city="深圳",
        district="南山",
    )
    check_response = self.client.get(f"/api/house/estates/{empty_estate.pk}/delete-check/")
    self.assertTrue(api_data(check_response)["can_delete"])

    building = Building.objects.create(
        organization=self.org,
        estate=empty_estate,
        name="新绑定楼栋",
        address="科技路 100 号",
        floors=8,
    )
    delete_response = self.client.delete(f"/api/house/estates/{empty_estate.pk}/")

    error = api_error(delete_response)
    self.assertEqual(delete_response.status_code, 409)
    self.assertEqual(error["error"], "RESOURCE_IN_USE")
    self.assertEqual(error["data"]["resources"][0]["items"][0]["id"], building.pk)
```

楼栋删除增加以下竞态测试：

```python
def test_delete_building_returns_latest_houses_when_house_appears_after_check(self):
    independent = Building.objects.create(
        organization=self.org,
        estate=None,
        name="竞态楼栋",
        address="科技路 101 号",
        floors=8,
    )
    check_response = self.client.get(f"/api/house/buildings/{independent.pk}/delete-check/")
    self.assertTrue(api_data(check_response)["can_delete"])

    house = House.objects.create(building=independent, room_number="101")
    delete_response = self.client.delete(f"/api/house/buildings/{independent.pk}/")

    error = api_error(delete_response)
    self.assertEqual(delete_response.status_code, 409)
    self.assertEqual(error["error"], "RESOURCE_IN_USE")
    self.assertEqual(error["data"]["resources"][0]["items"][0]["id"], house.pk)
```

- [ ] **Step 2：运行删除测试并确认失败**

```bash
docker compose exec web pytest tests/house/test_api.py -k "delete_empty or binding_appears" -q
```

Expected: FAIL，DELETE 路由不存在。

- [ ] **Step 3：实现事务删除函数**

在 `apps/house/services.py` 增加：

```python
from django.db import transaction
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404

def delete_estate_safely(estate_id: int, organization):
    from apps.house.models import Estate

    with transaction.atomic():
        estate = get_object_or_404(Estate.objects.select_for_update(), pk=estate_id, organization=organization)
        check = get_estate_delete_check(estate)
        if not check["can_delete"]:
            raise ResourceInUseException("当前小区已关联楼栋，不能删除。", check)
        try:
            estate.delete()
        except ProtectedError as exc:
            check = get_estate_delete_check(estate)
            raise ResourceInUseException("当前小区已关联楼栋，不能删除。", check) from exc

def delete_building_safely(building_id: int, organization):
    from apps.house.models import Building

    with transaction.atomic():
        building = get_object_or_404(Building.objects.select_for_update(), pk=building_id, organization=organization)
        check = get_building_delete_check(building)
        if not check["can_delete"]:
            raise ResourceInUseException("当前楼栋已关联房源，不能删除。", check)
        try:
            building.delete()
        except ProtectedError as exc:
            check = get_building_delete_check(building)
            raise ResourceInUseException("当前楼栋已关联房源，不能删除。", check) from exc
```

API 层将模型 `DoesNotExist` 转换为现有 404 行为，成功返回删除 ID：

```python
@router.delete("/estates/{estate_id}/", response=dict, summary="删除项目片区")
def delete_estate(request, estate_id: int):
    org = require_org_selected(request)
    delete_estate_safely(estate_id, org)
    return {"deleted": estate_id}
```

楼栋路由使用相同模式。

- [ ] **Step 4：运行删除与租户隔离测试**

```bash
docker compose exec web pytest tests/house/test_api.py -k "delete" -q
```

Expected: PASS；其他组织的小区或楼栋 DELETE 返回 404。

- [ ] **Step 5：提交安全删除实现**

```bash
git add apps/house/api.py apps/house/services.py tests/house/test_api.py
git commit -m "feat: 增加小区楼栋安全删除"
```

## Task 6：重新生成 OpenAPI 客户端并补充手写适配器

**Files:**
- Regenerate: `frontend_admin/src/services/openapi/`
- Regenerate: `frontend_miniprogram/src/services/openapi/`
- Modify: `frontend_admin/src/services/manual/house.ts`
- Create: `frontend_admin/src/services/manual/apiError.ts`
- Create: `frontend_admin/src/services/manual/apiError.test.ts`

- [ ] **Step 1：启动后端并确认 OpenAPI 可访问**

Run from repository root:

```bash
just start
curl -s http://localhost:18000/api/openapi.json
```

Expected: HTTP 200，Schema 中包含两个 `delete-check` 和两个 DELETE 路由，`BuildingOut.estate` 允许 `null`。

- [ ] **Step 2：生成管理端客户端**

Run from `frontend_admin/`:

```bash
nvm use 22
npm run openapi
```

Expected: `propertyRentalManagement.ts` 生成检查和删除函数，`typings.d.ts` 中楼栋小区字段可空。不得手工编辑生成文件。

- [ ] **Step 3：生成小程序客户端**

Run from `frontend_miniprogram/`:

```bash
nvm use 22
pnpm run openapi
```

Expected: `src/services/openapi/` 更新，楼栋小区字段可空。

- [ ] **Step 4：扩展管理端手写房源服务**

在 `frontend_admin/src/services/manual/house.ts` 导入新生成函数并增加：

```typescript
export type DeleteCheckOut = API.DeleteCheckOut;

checkEstateDelete: (estateId: number) =>
  appsHouseApiCheckEstateDelete({ estate_id: estateId }) as Promise<DeleteCheckOut>,
deleteEstate: (estateId: number) =>
  appsHouseApiDeleteEstate({ estate_id: estateId }, { skipErrorHandler: true }) as Promise<{ deleted: number }>,
checkBuildingDelete: (buildingId: number) =>
  appsHouseApiCheckBuildingDelete({ building_id: buildingId }) as Promise<DeleteCheckOut>,
deleteBuilding: (buildingId: number) =>
  appsHouseApiDeleteBuilding({ building_id: buildingId }, { skipErrorHandler: true }) as Promise<{ deleted: number }>,
```

生成后的函数名应为 `appsHouseApiCheckEstateDelete`、`appsHouseApiDeleteEstate`、`appsHouseApiCheckBuildingDelete` 和 `appsHouseApiDeleteBuilding`；若生成结果不符合这些 operation 名称，先调整后端路由函数名后重新生成，不手改生成代码。

- [ ] **Step 5：编写并实现结构化错误提取工具**

测试：

```typescript
import { describe, expect, it } from 'vitest';
import { getResourceInUseData } from './apiError';

describe('getResourceInUseData', () => {
  it('reads RESOURCE_IN_USE from BizError and HTTP response shapes', () => {
    const data = { can_delete: false, resources: [] };
    expect(getResourceInUseData({ info: { error: 'RESOURCE_IN_USE', data } })).toEqual(data);
    expect(getResourceInUseData({ response: { data: { error: 'RESOURCE_IN_USE', data } } })).toEqual(data);
  });
});
```

实现：

```typescript
import type { DeleteCheckOut } from './house';

export function getResourceInUseData(error: unknown): DeleteCheckOut | undefined {
  const candidate = error as {
    info?: { error?: string; data?: DeleteCheckOut };
    response?: { data?: { error?: string; data?: DeleteCheckOut } };
  };
  const envelope = candidate.info || candidate.response?.data;
  return envelope?.error === 'RESOURCE_IN_USE' ? envelope.data : undefined;
}
```

- [ ] **Step 6：运行客户端类型和工具测试**

Run from `frontend_admin/`:

```bash
nvm use 22
npm exec -- vitest run src/services/manual/apiError.test.ts
npm run tsc
```

Run from `frontend_miniprogram/`:

```bash
nvm use 22
pnpm run type-check
```

Expected: 全部 PASS。

- [ ] **Step 7：提交生成客户端和适配器**

```bash
git add frontend_admin/src/services/openapi frontend_admin/src/services/manual/house.ts frontend_admin/src/services/manual/apiError.ts frontend_admin/src/services/manual/apiError.test.ts frontend_miniprogram/src/services/openapi
git commit -m "chore: 更新楼栋关系接口客户端"
```

## Task 7：更新楼栋表单和条件式关联卡片

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/constants.ts`
- Create: `frontend_admin/src/pages/property-rental/constants.test.ts`
- Modify: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/new.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx`
- Modify: `frontend_admin/src/pages/settings-management/organization/index.tsx`
- Modify: `frontend_admin/src/pages/settings-management/organization/index.test.tsx`

- [ ] **Step 1：编写管理端可空小区表单测试**

先为标签函数增加独立测试：

```typescript
import { describe, expect, it } from 'vitest';
import { buildingLabel, houseLabel } from './constants';

describe('property rental labels', () => {
  it('uses the estate for bound buildings and the address for unbound buildings', () => {
    expect(buildingLabel({ name: '1栋', address: '科技路 1 号', estate: { display_name: '星河湾' } })).toBe('星河湾 / 1栋');
    expect(buildingLabel({ name: '海滨公寓', address: '海滨路 20 号', estate: null })).toBe('海滨公寓 · 海滨路 20 号');
    expect(houseLabel({ room_number: '101', building: { name: '海滨公寓', address: '海滨路 20 号', estate: null } })).toBe('海滨公寓 · 海滨路 20 号 / 101');
  });
});
```

修改测试辅助函数，允许显式传入空小区，避免非小区楼栋被恢复成默认小区楼栋：

```typescript
const estateId = overrides.estate_id === undefined ? defaultEstate.id : overrides.estate_id;
return {
  id: overrides.id || 2,
  name: overrides.name || '1栋',
  address: overrides.address || '',
  estate_id: estateId,
  estate: overrides.estate === undefined ? (estateId ? defaultEstate : null) : overrides.estate,
  floors: overrides.floors || 8,
  elevator: overrides.elevator || false,
  is_active: overrides.is_active ?? true,
};
```

在相关测试中覆盖：

```typescript
it('creates a building without an estate when address is provided', async () => {
  render(<EstatesPage />);
  fireEvent.click(await screen.findByRole('button', { name: /新建楼栋/ }));
  fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '海滨公寓' } });
  fireEvent.change(screen.getByLabelText('地址'), { target: { value: '海滨路 20 号' } });
  fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));

  await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({
    estate_id: null,
    name: '海滨公寓',
    address: '海滨路 20 号',
    floors: 8,
  })));
});

it('requires address when no estate is selected', async () => {
  render(<EstatesPage />);
  fireEvent.click(await screen.findByRole('button', { name: /新建楼栋/ }));
  fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '海滨公寓' } });
  fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByText('非小区楼栋必须填写楼栋地址')).toBeInTheDocument();
});

it('shows relationship cards only when associations exist', async () => {
  mockListEstates.mockResolvedValue({ items: [defaultEstate], total: 1, page: 1, page_size: 20 });
  mockListBuildings.mockResolvedValue({ items: [buildingItem({ estate_id: defaultEstate.id })], total: 1, page: 1, page_size: 20 });
  render(<EstatesPage />);

  fireEvent.click((await screen.findAllByRole('button', { name: '编辑' }))[0]);
  expect(await screen.findByText('关联楼栋')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Close'));
  fireEvent.click((await screen.findAllByRole('button', { name: '编辑' }))[1]);
  expect(await screen.findByText('所属小区')).toBeInTheDocument();
});
```

增加无关联数据测试：

```typescript
it('hides relationship cards when associations do not exist', async () => {
  mockListEstates.mockResolvedValue({ items: [defaultEstate], total: 1, page: 1, page_size: 20 });
  mockListBuildings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
  render(<EstatesPage />);
  fireEvent.click((await screen.findAllByRole('button', { name: '编辑' }))[0]);
  expect(screen.queryByText('关联楼栋')).not.toBeInTheDocument();

  cleanup();
  mockListBuildings.mockResolvedValue({ items: [buildingItem({ estate_id: null, estate: null, address: '海滨路 20 号' })], total: 1, page: 1, page_size: 20 });
  render(<EstatesPage />);
  fireEvent.click((await screen.findAllByRole('button', { name: '编辑' }))[0]);
  expect(screen.queryByText('所属小区')).not.toBeInTheDocument();
});
```

- [ ] **Step 2：运行前端测试并确认失败**

Run from `frontend_admin/`:

```bash
nvm use 22
npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/settings-management/organization/index.test.tsx
```

Expected: FAIL，所属项目仍必填且表单自动回填第一个小区。

- [ ] **Step 3：修改楼栋表单类型和提交值**

在 `constants.ts` 为楼栋标签源增加 `address` 并统一标签：

```typescript
type BuildingLabelSource = {
  id?: number;
  name?: string | null;
  address?: string | null;
  estate?: EstateLabelSource | null;
};

export function buildingLabel(building?: BuildingLabelSource) {
  if (!building) return '-';
  const name = building.name || (building.id ? `楼栋 #${building.id}` : '');
  const estateName = building.estate?.display_name || building.estate?.name;
  if (estateName) return [estateName, name].filter(Boolean).join(' / ');
  return [name, building.address].filter(Boolean).join(' · ') || '-';
}
```

`houseLabel()` 复用相同的楼栋标签语义，再追加房号，不能直接访问 `estate.name`：

```typescript
export function houseLabel(source?: HouseLabelSource) {
  const house = source?.house || source;
  if (!house) return '-';
  if (house.label) return house.label;
  const buildingText = buildingLabel(house.building);
  const scopedLabel = [buildingText === '-' ? undefined : buildingText, house.room_number].filter(Boolean).join(' / ');
  if (scopedLabel) return scopedLabel;
  return house.id ? `房源 #${house.id}` : '-';
}
```

```typescript
type BuildingFormValues = {
  estate_id?: number | null;
  name: string;
  floors: number;
  elevator?: boolean;
  address?: string;
  is_active?: boolean;
};
```

不要再默认选择第一个小区；仅从小区入口创建时带入 `draftBuildingEstateId`。所属项目使用 `allowClear`：

```tsx
<Form.Item label="所属项目" name="estate_id">
  <Select
    allowClear
    options={(allEstates.data?.items || []).map((item) => ({ value: item.id, label: item.display_name || item.name }))}
  />
</Form.Item>
<Form.Item noStyle shouldUpdate={(previous, current) => previous.estate_id !== current.estate_id}>
  {({ getFieldValue }) => (
    <Form.Item
      label="地址"
      name="address"
      rules={getFieldValue('estate_id') ? [] : [{ required: true, message: '非小区楼栋必须填写楼栋地址' }]}
    >
      <Input />
    </Form.Item>
  )}
</Form.Item>
```

提交前将空选择显式转换为 `null`：

```typescript
const payload = { ...values, estate_id: values.estate_id ?? null, floors: Number(values.floors) };
```

将相同规则应用到房源建档和组织设置中的快速新建楼栋表单。

- [ ] **Step 4：实现条件式关联卡片**

编辑小区时，独立请求前 5 条关联楼栋；仅有数据时渲染：

```tsx
{editingEstate && estateBuildings.data?.items.length ? (
  <Card size="small" title="关联楼栋" style={{ marginBottom: 16 }}>
    <Space orientation="vertical">
      {estateBuildings.data.items.map((item) => <Typography.Text key={item.id}>{item.name}</Typography.Text>)}
      <Button type="link" href={`/dashboard/property-rental/estates?view=buildings&estate_id=${editingEstate.id}`}>
        查看全部关联楼栋
      </Button>
    </Space>
  </Card>
) : null}
```

编辑楼栋且 `editingBuilding.estate` 非空时渲染“所属小区”卡片；为空时完全不渲染该卡片。楼栋列表的小区列空值固定显示 `-`，不增加类型标签或分类筛选。

- [ ] **Step 5：运行相关前端测试和 TypeScript 检查**

```bash
nvm use 22
npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/settings-management/organization/index.test.tsx
npm exec -- vitest run src/pages/property-rental/constants.test.ts
npm run tsc
```

Expected: 全部 PASS。

- [ ] **Step 6：提交表单和关联展示**

```bash
git add frontend_admin/src/pages/property-rental/constants.ts frontend_admin/src/pages/property-rental/constants.test.ts frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx frontend_admin/src/pages/property-rental/houses/new.tsx frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx frontend_admin/src/pages/settings-management/organization/index.tsx frontend_admin/src/pages/settings-management/organization/index.test.tsx
git commit -m "feat: 支持管理端非小区楼栋"
```

## Task 8：实现删除检查弹窗和快速跳转

**Files:**
- Create: `frontend_admin/src/pages/property-rental/estates/ResourceDeleteModal.tsx`
- Create: `frontend_admin/src/pages/property-rental/estates/ResourceDeleteModal.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/estates/index.tsx`

- [ ] **Step 1：编写删除弹窗状态测试**

```typescript
it('blocks deletion and links to related resources when check finds bindings', async () => {
  mockCheck.mockResolvedValue({
    can_delete: false,
    resources: [{
      type: 'building', label: '关联楼栋', count: 1,
      items: [{ id: 11, label: '1栋 · 科技路 1 号' }],
      truncated: false,
      target: { path: '/property-rental/estates', query: { view: 'buildings', estate_id: 10 } },
    }],
  });
  render(<ResourceDeleteModal open target={{ type: 'estate', id: 10, label: '星河湾' }} onClose={onClose} onDeleted={onDeleted} />);

  expect(await screen.findByText('当前记录存在关联资源，不能删除')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '确认删除' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '查看全部关联楼栋' })).toHaveAttribute('href', '/dashboard/property-rental/estates?view=buildings&estate_id=10');
});

it('switches confirmation modal to blocked state when delete returns 409', async () => {
  mockCheck.mockResolvedValue({ can_delete: true, resources: [] });
  mockDelete.mockRejectedValue({ info: { error: 'RESOURCE_IN_USE', data: blockedCheck } });
  render(<ResourceDeleteModal open target={{ type: 'estate', id: 10, label: '星河湾' }} onClose={onClose} onDeleted={onDeleted} />);
  expect(await screen.findByText('确认删除“星河湾”？')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(await screen.findByText('当前记录存在关联资源，不能删除')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '确认删除' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2：运行组件测试并确认失败**

```bash
nvm use 22
npm exec -- vitest run src/pages/property-rental/estates/ResourceDeleteModal.test.tsx
```

Expected: FAIL，组件不存在。

- [ ] **Step 3：实现删除弹窗状态机**

组件状态固定为：

```typescript
type DeletePhase = 'checking' | 'confirm' | 'blocked';
type DeleteTarget = { type: 'estate' | 'building'; id: number; label: string };
```

打开时调用对应检查接口；`can_delete=true` 进入 `confirm`，否则进入 `blocked`。确认删除时调用带 `skipErrorHandler` 的 DELETE；捕获 `RESOURCE_IN_USE` 后用 `getResourceInUseData()` 更新检查结果并原地进入 `blocked`：

```typescript
try {
  await removeTarget(target);
  await onDeleted();
  onClose();
} catch (error) {
  const conflict = getResourceInUseData(error);
  if (conflict) {
    setCheck(conflict);
    setPhase('blocked');
    return;
  }
  message.error('删除失败，请稍后重试');
}
```

使用受控 `Modal`：`checking` 显示加载；`confirm` 显示危险确认按钮；`blocked` 的 footer 只保留关闭按钮。资源跳转 URL 用 `URLSearchParams` 根据后端 `target.query` 构造，并加 `/dashboard` 前缀。

- [ ] **Step 4：在小区和楼栋操作列接入删除按钮**

在 `estates/index.tsx` 增加一个共享 `deleteTarget` 状态，小区和楼栋的操作列均增加危险文本按钮：

```tsx
<Button type="link" danger size="small" onClick={() => setDeleteTarget({ type: 'estate', id: record.id, label: record.display_name || record.name })}>
  删除
</Button>
```

删除成功后关闭弹窗，并分别失效 `['house', 'estates']`、`['house', 'buildings']` 查询。关闭被 409 阻止的弹窗时也刷新当前列表。

- [ ] **Step 5：运行弹窗和页面测试**

```bash
nvm use 22
npm exec -- vitest run src/pages/property-rental/estates/ResourceDeleteModal.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx
```

Expected: PASS；有关联资源时不会调用 DELETE，无关联资源时必须二次确认。

- [ ] **Step 6：提交删除交互**

```bash
git add frontend_admin/src/pages/property-rental/estates/ResourceDeleteModal.tsx frontend_admin/src/pages/property-rental/estates/ResourceDeleteModal.test.tsx frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
git commit -m "feat: 增加楼栋资源删除保护交互"
```

## Task 9：让快速跳转筛选在页面中可见且可清除

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1：编写 estate_id 和 building_id URL 筛选测试**

```typescript
it('loads related buildings from estate_id and lets the user clear the filter', async () => {
  window.history.replaceState({}, '', '/dashboard/property-rental/estates?view=buildings&estate_id=10');
  render(<EstatesPage />);
  await waitFor(() => expect(mockListBuildings).toHaveBeenCalledWith(expect.objectContaining({ estate_id: 10 })));
  expect(screen.getByText(/当前小区/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '清除小区筛选' }));
  expect(window.location.search).not.toContain('estate_id=10');
});

it('loads related houses from building_id and lets the user clear the filter', async () => {
  window.history.replaceState({}, '', '/dashboard/property-rental/houses?building_id=11');
  render(<HousesPage />);
  await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ building_id: 11 })));
  expect(screen.getByText(/当前楼栋/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '清除楼栋筛选' }));
  expect(window.location.search).not.toContain('building_id=11');
});
```

- [ ] **Step 2：运行 URL 筛选测试并确认失败**

```bash
nvm use 22
npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx
```

Expected: FAIL，两个页面尚未读取对应 URL 参数。

- [ ] **Step 3：实现楼栋列表的小区筛选状态**

为 `getEstateListStateFromSearch`、React state、查询 key 和 `listBuildings` 参数增加 `estateId`。同步 URL 时仅保留实际存在的数字 ID：

```typescript
const estateIdValue = Number(params.get('estate_id'));
estateId: Number.isFinite(estateIdValue) && estateIdValue > 0 ? estateIdValue : undefined,
```

页面顶部显示可关闭的当前小区筛选提示；清除时设置 `estateId` 为 `undefined`、页码重置为 1，并移除 URL 参数。

- [ ] **Step 4：实现房源列表的楼栋筛选状态**

扩展 `HouseScopeFilters`：

```typescript
type HouseScopeFilters = {
  q?: string;
  status?: string;
  buildingId?: number;
};
```

解析和同步 `building_id`，传入 `houseApi.listHouses()`。使用 `houseApi.getBuilding(buildingId)` 获取标签，并显示可关闭提示：

```tsx
{buildingId ? (
  <Tag closable aria-label="清除楼栋筛选" onClose={() => { setBuildingId(undefined); setPage(1); }}>
    当前楼栋：{buildingLabel(selectedBuilding.data)}
  </Tag>
) : null}
```

- [ ] **Step 5：运行页面测试和 TypeScript 检查**

```bash
nvm use 22
npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx
npm run tsc
```

Expected: PASS。

- [ ] **Step 6：提交快速跳转筛选**

```bash
git add frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/houses/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
git commit -m "feat: 支持关联资源快速筛选"
```

## Task 10：全量验证和设计一致性检查

**Files:**
- Verify: `apps/house/`
- Verify: `tests/house/`
- Verify: `frontend_admin/src/pages/property-rental/`
- Verify: `frontend_admin/src/pages/settings-management/organization/`
- Verify: `frontend_miniprogram/src/services/openapi/`

- [ ] **Step 1：扫描残留的小区组织依赖和非空假设**

```bash
rg -n "building__estate__organization|house__building__estate__organization|building\.estate\.organization" apps tests
rg -n "estate_id: number;|estate: EstateSummaryOut;|\.estate\.display_name|\.estate\.name" frontend_admin/src frontend_miniprogram/src
```

Expected: 第一条无业务代码命中；第二条只保留 Estate 自身定义或带 `?.` 空值保护的消费位置。任何不满足该条件的命中都必须在对应任务中修正，不能通过类型断言绕过。

- [ ] **Step 2：运行完整后端测试和迁移检查**

```bash
docker compose exec web pytest tests/house tests/settings/test_service.py -q
docker compose exec web python manage.py check
docker compose exec web python manage.py makemigrations --check --dry-run
```

Expected: 全部 PASS；无缺失迁移。

- [ ] **Step 3：运行管理端测试、类型和组件规范检查**

Run from `frontend_admin/`:

```bash
nvm use 22
npm exec -- vitest run src/pages/property-rental src/pages/settings-management/organization src/services/manual/apiError.test.ts
npm run lint
npm exec -- antd lint ./src
```

Expected: 全部 PASS，无 Ant Design 废弃或错误用法。

- [ ] **Step 4：运行小程序类型检查**

Run from `frontend_miniprogram/`:

```bash
nvm use 22
pnpm run type-check
```

Expected: PASS。

- [ ] **Step 5：执行最终业务验收**

按顺序验证：

1. 创建一个绑定小区的楼栋。
2. 创建两个同名、不同地址的非小区楼栋。
3. 验证同名、同地址的非小区楼栋被拒绝。
4. 在非小区楼栋下登记房源，并确认房源、房东、带看和租约查询可见。
5. 将非小区楼栋绑定小区，再解除绑定；解除前地址为空时必须被拒绝。
6. 删除空小区和空楼栋成功。
7. 删除有关联楼栋的小区、有房源的楼栋时展示关联资源并禁止删除。
8. 删除检查通过后新增关联资源，再确认删除时弹窗原地切换为禁止删除。
9. 从删除弹窗跳转到关联楼栋或房源，筛选条件可见且可以清除。
10. 小区没有楼栋、楼栋没有小区时，不显示对应关联卡片。
