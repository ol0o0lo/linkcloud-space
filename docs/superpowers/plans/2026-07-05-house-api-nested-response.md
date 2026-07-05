# House API Nested Response Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `apps/house` read responses so top-level relationship IDs remain, while relationship display fields move into nested summary objects.

**Architecture:** Use Django Ninja/Pydantic nested `Schema` classes in `apps/house/schemas.py`; do not add a custom serializer framework. Backend query functions keep the current `select_related` pattern. Frontend property-rental pages read nested summaries directly and keep using top-level IDs for forms, URLs, filters, and mutations.

**Tech Stack:** Django 5, django-ninja, Pydantic schemas, pytest, Umi Max, React, TypeScript, Vitest, npm with Node 22.

---

## Current Workspace Safety

The workspace already contains modified files in `apps/house`, `frontend_admin/src/pages/property-rental`, generated OpenAPI files, and tests. Treat those as existing user/work-in-progress changes.

- Do not revert unrelated changes.
- Before editing any file already modified, inspect its current diff and preserve unrelated edits.
- Stage and commit only the files intentionally changed for each task.
- If a target file already contains unrelated edits in the same file, do not commit that file blindly. Report the overlap and either fold the whole file into the task intentionally or ask for user direction.
- Do not run `rm`, `git reset --hard`, `git checkout --`, or cleanup commands.

## File Structure

- Modify: `apps/house/schemas.py`
  - Adds summary output schemas.
  - Replaces flat display fields in `BuildingOut`, `DefaultBuildingOut`, `HouseOut`, `ViewingRecordOut`, and `LeaseOut`.
- Modify: `apps/house/api.py`
  - Updates manual `DefaultBuildingOut` dict responses to include nested `estate`.
  - Keeps current list/detail query logic.
- Modify: `tests/house/test_api.py`
  - Updates contract assertions from flat display fields to nested summaries.
- Generate: `frontend_admin/src/services/openapi/*`
  - Recreated by `npm run openapi`; do not hand edit generated files.
- Modify: `frontend_admin/src/services/manual/house.ts`
  - Keeps thin typed wrapper; no compatibility mapper.
- Modify: `frontend_admin/src/pages/property-rental/**/*.tsx`
  - Reads nested relationship summaries.
- Modify: `frontend_admin/src/pages/property-rental/**/*.test.tsx`
  - Updates mocks and assertions to nested data shape.

## Response Shape Rules

Keep top-level IDs:

```json
{
  "house_id": 99,
  "contact_id": 6
}
```

Move display fields into nested summary objects:

```json
{
  "house_id": 99,
  "house": {
    "id": 99,
    "label": "星河湾 / 1栋 / 101",
    "room_number": "101",
    "building_id": 2,
    "building": {
      "id": 2,
      "name": "1栋",
      "estate_id": 1,
      "estate": {
        "id": 1,
        "name": "xinghewan",
        "display_name": "星河湾"
      }
    }
  },
  "contact_id": 6,
  "contact": {
    "id": 6,
    "name": "王租客",
    "phone": "13700000000"
  }
}
```

Keep enum fields unchanged:

```json
{
  "status": "scheduled",
  "status__mapping": "已预约"
}
```

### Task 1: Backend Contract Tests

**Files:**
- Modify: `tests/house/test_api.py`

- [ ] **Step 1: Inspect current test diffs**

Run:

```bash
git diff -- tests/house/test_api.py
```

Expected: review any existing edits and keep them unless they conflict with this contract refactor.

- [ ] **Step 2: Update the API mapping contract test first**

Find the test that currently asserts enum mappings near the existing `test_api.py` assertions for `estate_payload`, `contact_payload`, `house_payload`, `viewing_payload`, and `lease_payload`.

Change the flat display assertions to nested summary assertions:

```python
self.assertEqual(building_payload["estate_id"], self.estate.pk)
self.assertEqual(building_payload["estate"]["id"], self.estate.pk)
self.assertEqual(building_payload["estate"]["display_name"], self.estate.display_name)

self.assertEqual(house_payload["building_id"], self.building.pk)
self.assertEqual(house_payload["building"]["id"], self.building.pk)
self.assertEqual(house_payload["building"]["name"], self.building.name)
self.assertEqual(house_payload["building"]["estate"]["id"], self.estate.pk)
self.assertEqual(house_payload["landlord_id"], self.landlord.pk)
self.assertEqual(house_payload["landlord"]["id"], self.landlord.pk)
self.assertEqual(house_payload["landlord"]["name"], self.landlord.name)
self.assertNotIn("building_name", house_payload)
self.assertNotIn("estate_name", house_payload)
self.assertNotIn("landlord_name", house_payload)
self.assertNotIn("landlord_phone", house_payload)
self.assertNotIn("house_label", house_payload)

self.assertEqual(viewing_payload["house_id"], self.house.pk)
self.assertEqual(viewing_payload["house"]["id"], self.house.pk)
self.assertEqual(viewing_payload["house"]["label"], f"{self.estate.display_name or self.estate.name} / {self.building.name} / {self.house.room_number}")
self.assertEqual(viewing_payload["contact_id"], self.tenant.pk)
self.assertEqual(viewing_payload["contact"]["id"], self.tenant.pk)
self.assertEqual(viewing_payload["contact"]["name"], self.tenant.name)
self.assertNotIn("house_label", viewing_payload)
self.assertNotIn("contact_name", viewing_payload)
self.assertNotIn("contact_phone", viewing_payload)

self.assertEqual(lease_payload["house_id"], self.house.pk)
self.assertEqual(lease_payload["house"]["id"], self.house.pk)
self.assertEqual(lease_payload["tenant_id"], self.tenant.pk)
self.assertEqual(lease_payload["tenant"]["id"], self.tenant.pk)
self.assertEqual(lease_payload["tenant"]["phone"], self.tenant.phone)
self.assertEqual(lease_payload["source_viewing_record_id"], viewing_payload["id"])
self.assertEqual(lease_payload["source_viewing_record"]["id"], viewing_payload["id"])
self.assertNotIn("house_label", lease_payload)
self.assertNotIn("tenant_name", lease_payload)
self.assertNotIn("tenant_phone", lease_payload)
self.assertNotIn("source_viewing_record_label", lease_payload)
```

Keep existing enum assertions such as:

```python
self.assertEqual(viewing_payload["status__mapping"], ViewingRecord.Status.get_choice_label(viewing_payload["status"]))
self.assertEqual(lease_payload["status__mapping"], Lease.Status.get_choice_label(lease_payload["status"]))
```

- [ ] **Step 3: Add or update null relationship assertions**

Where the tests create a viewing record without a contact, assert the new null shape:

```python
self.assertIsNone(viewing_payload["contact_id"])
self.assertIsNone(viewing_payload["contact"])
```

Where the tests create a house without a landlord, assert:

```python
self.assertIsNone(house_payload["landlord_id"])
self.assertIsNone(house_payload["landlord"])
```

- [ ] **Step 4: Run backend test and verify it fails before implementation**

Run:

```bash
docker compose exec web pytest tests/house/test_api.py -q
```

Expected: FAIL with missing nested keys such as `KeyError: 'house'` or assertions showing old flat fields still exist.

### Task 2: Backend Nested Schemas

**Files:**
- Modify: `apps/house/schemas.py`
- Modify: `apps/house/api.py`
- Test: `tests/house/test_api.py`

- [ ] **Step 1: Inspect current schema/API diffs**

Run:

```bash
git diff -- apps/house/schemas.py apps/house/api.py
```

Expected: understand any current edits before changing these files.

- [ ] **Step 2: Add summary schemas**

In `apps/house/schemas.py`, add these schema classes before `BuildingOut` and before any class that references them:

```python
class EstateSummaryOut(Schema):
    id: int
    name: str
    display_name: str


class BuildingSummaryOut(Schema):
    id: int
    name: str
    estate_id: int
    estate: EstateSummaryOut


class ContactSummaryOut(Schema):
    id: int
    name: str
    phone: str


class HouseSummaryOut(Schema):
    id: int
    label: str
    room_number: str
    building_id: int
    building: BuildingSummaryOut

    @staticmethod
    def resolve_label(obj):
        return f"{obj.building.estate.display_name or obj.building.estate.name} / {obj.building.name} / {obj.room_number}"


class ViewingRecordSummaryOut(Schema):
    id: int
    label: str
    customer_name: str
    customer_phone: str

    @staticmethod
    def resolve_label(obj):
        return f"{obj.customer_name} / {obj.customer_phone}"
```

- [ ] **Step 3: Replace flat relationship display fields in `BuildingOut` and `DefaultBuildingOut`**

Change:

```python
class BuildingOut(Schema):
    id: int
    estate_id: int
    estate_name: str
    name: str
```

to:

```python
class BuildingOut(Schema):
    id: int
    estate_id: int
    estate: EstateSummaryOut
    name: str
```

Remove `resolve_estate_name`.

Change:

```python
class DefaultBuildingOut(Schema):
    id: int
    estate_id: int
    estate_name: str
    name: str
    floors: int
    address: str
```

to:

```python
class DefaultBuildingOut(Schema):
    id: int
    estate_id: int
    estate: EstateSummaryOut
    name: str
    floors: int
    address: str
```

- [ ] **Step 4: Replace flat relationship display fields in `HouseOut`**

Change the top of `HouseOut` to:

```python
class HouseOut(Schema):
    id: int
    building_id: int
    building: BuildingSummaryOut
    landlord_id: int | None
    landlord: ContactSummaryOut | None
    room_number: str
```

Remove these fields and resolvers:

```python
building_name: str
estate_name: str
landlord_name: str | None
landlord_phone: str | None
house_label: str
resolve_building_name
resolve_estate_name
resolve_landlord_name
resolve_landlord_phone
resolve_house_label
```

Keep media and enum resolvers unchanged.

- [ ] **Step 5: Replace flat relationship display fields in `ViewingRecordOut`**

Change the relationship fields to:

```python
class ViewingRecordOut(Schema):
    id: int
    house_id: int
    house: HouseSummaryOut
    contact_id: int | None
    contact: ContactSummaryOut | None
    customer_name: str
    customer_phone: str
```

Remove:

```python
house_label: str
contact_name: str | None
contact_phone: str | None
resolve_house_label
resolve_contact_name
resolve_contact_phone
```

Keep `status__mapping` and `signed_lease_id` unchanged.

- [ ] **Step 6: Replace flat relationship display fields in `LeaseOut`**

Change the relationship fields to:

```python
class LeaseOut(Schema):
    id: int
    house_id: int
    house: HouseSummaryOut
    tenant_id: int
    tenant: ContactSummaryOut
    source_viewing_record_id: int | None
    source_viewing_record: ViewingRecordSummaryOut | None
```

Remove:

```python
house_label: str
tenant_name: str
tenant_phone: str
source_viewing_record_label: str | None
resolve_house_label
resolve_tenant_name
resolve_tenant_phone
resolve_source_viewing_record_label
```

Keep `status__mapping` and `contract_files` unchanged.

- [ ] **Step 7: Update manual default-building responses**

In `apps/house/api.py`, change both `get_default_building` and `put_default_building` dict responses from:

```python
{
    "id": building.pk,
    "estate_id": building.estate_id,
    "estate_name": building.estate.name,
    "name": building.name,
    "floors": building.floors,
    "address": building.address,
}
```

to:

```python
{
    "id": building.pk,
    "estate_id": building.estate_id,
    "estate": building.estate,
    "name": building.name,
    "floors": building.floors,
    "address": building.address,
}
```

- [ ] **Step 8: Run backend tests**

Run:

```bash
docker compose exec web pytest tests/house/test_api.py -q
```

Expected: PASS for `tests/house/test_api.py`. If failures mention missing `select_related`, add the minimal existing-style `select_related` to the affected queryset.

- [ ] **Step 9: Commit backend contract**

Run:

```bash
git diff -- apps/house/schemas.py apps/house/api.py tests/house/test_api.py
git add apps/house/schemas.py apps/house/api.py tests/house/test_api.py
git commit -m "refactor: 调整房源接口嵌套响应"
```

Expected: commit contains only backend schema/API/test changes for the house response contract. If the displayed diff includes unrelated pre-existing edits, stop before `git add` and report the overlap.

### Task 3: Regenerate OpenAPI Types

**Files:**
- Generate: `frontend_admin/src/services/openapi/*`

- [ ] **Step 1: Confirm backend server availability for OpenAPI generation**

Run:

```bash
curl --noproxy '*' -fsS http://localhost:18000/api/openapi.json >/tmp/linkcloud-house-openapi.json
```

Expected: command exits with status 0. If it fails because the backend is not running, ask the user to start the backend or confirm that running `just start` is acceptable. Do not run build, clean, docker removal, or database reset commands.

- [ ] **Step 2: Regenerate frontend OpenAPI client**

Run:

```bash
cd frontend_admin && source ~/.nvm/nvm.sh && nvm use 22 && npm run openapi
```

Expected: generated files under `frontend_admin/src/services/openapi` update to include nested `estate`, `building`, `landlord`, `house`, `contact`, `tenant`, and `source_viewing_record` types.

- [ ] **Step 3: Inspect generated diff**

Run:

```bash
git diff -- frontend_admin/src/services/openapi
```

Expected: generated property-rental types and service metadata reflect backend schema changes. No hand edits.

- [ ] **Step 4: Commit generated client**

Run:

```bash
git diff -- frontend_admin/src/services/openapi/propertyRentalManagement.ts frontend_admin/src/services/openapi/typings.d.ts
git add frontend_admin/src/services/openapi/propertyRentalManagement.ts frontend_admin/src/services/openapi/typings.d.ts
git commit -m "chore: 更新房源接口生成类型"
```

Expected: commit contains generated OpenAPI changes for the house contract only. If `npm run openapi` changes additional generated files, inspect them and stage only files whose diff is caused by the house schema change.

### Task 4: Frontend Manual Types and Helpers

**Files:**
- Modify: `frontend_admin/src/services/manual/house.ts`
- Modify: `frontend_admin/src/pages/property-rental/constants.ts`
- Test: TypeScript compile later in Task 7

- [ ] **Step 1: Inspect current diffs**

Run:

```bash
git diff -- frontend_admin/src/services/manual/house.ts frontend_admin/src/pages/property-rental/constants.ts
```

Expected: preserve unrelated edits.

- [ ] **Step 2: Keep manual service as a thin wrapper**

In `frontend_admin/src/services/manual/house.ts`, keep `PageResult<T>` and exported types mapped to generated API types. Do not add compatibility fields like `house_label?: string`.

Use this shape:

```ts
export type EstateOut = API.EstateOut & {
  property_type__mapping?: string;
};
export type BuildingOut = API.BuildingOut;
export type DefaultBuildingOut = API.DefaultBuildingOut;
export type ContactOut = API.ContactOut & {
  roles__mapping?: string[];
};
export type HouseOut = API.HouseOut & {
  orientation__mapping?: string;
  decoration__mapping?: string;
  status__mapping?: string;
  publish_status__mapping?: string;
};
export type ViewingRecordOut = API.ViewingRecordOut & {
  status__mapping?: string;
};
export type LeaseOut = API.LeaseOut & {
  status__mapping?: string;
};
```

- [ ] **Step 3: Update label helpers to prefer nested objects**

In `frontend_admin/src/pages/property-rental/constants.ts`, update helper input types to accept nested summaries and keep ID fallback.

Use this logic:

```ts
export function houseLabel(house?: {
  id?: number;
  room_number?: string | null;
  label?: string | null;
  building?: { name?: string | null; estate?: { name?: string | null; display_name?: string | null } | null } | null;
}) {
  if (!house) return '-';
  if (house.label) return house.label;
  const estateName = house.building?.estate?.display_name || house.building?.estate?.name;
  const scopedLabel = [estateName, house.building?.name, house.room_number].filter(Boolean).join(' / ');
  return scopedLabel || (house.id ? `房源 #${house.id}` : '-');
}

export function buildingLabel(building?: {
  id?: number;
  name?: string | null;
  estate?: { name?: string | null; display_name?: string | null } | null;
}) {
  if (!building) return '-';
  const name = building.name || (building.id ? `楼栋 #${building.id}` : '');
  const estateName = building.estate?.display_name || building.estate?.name;
  return [estateName, name].filter(Boolean).join(' / ') || '-';
}

export function contactLabel(contact?: {
  id?: number;
  name?: string | null;
  phone?: string | null;
}) {
  if (!contact) return '-';
  const name = contact.name || (contact.id ? `联系人 #${contact.id}` : '');
  return [name, contact.phone].filter(Boolean).join(' / ') || '-';
}
```

- [ ] **Step 4: Commit helpers**

Run:

```bash
git diff -- frontend_admin/src/services/manual/house.ts frontend_admin/src/pages/property-rental/constants.ts
git add frontend_admin/src/services/manual/house.ts frontend_admin/src/pages/property-rental/constants.ts
git commit -m "refactor: 调整房源前端关系标签"
```

Expected: commit contains only manual types and shared label helper changes. If either file contains unrelated pre-existing edits, stop before `git add` and report the overlap.

### Task 5: Frontend Pages

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/detail.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/new.tsx`
- Modify: `frontend_admin/src/pages/property-rental/viewings/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/leases/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/workbench.tsx`
- Modify: other `frontend_admin/src/pages/property-rental/**/*.tsx` files only if TypeScript reports old flat fields there

- [ ] **Step 1: Find all old flat field reads**

Run:

```bash
rg -n "house_label|contact_name|contact_phone|tenant_name|tenant_phone|landlord_name|landlord_phone|estate_name|building_name|source_viewing_record_label" frontend_admin/src/pages/property-rental frontend_admin/src/services/manual/house.ts
```

Expected: list of frontend call sites to update.

- [ ] **Step 2: Replace field reads**

Use these replacements:

```ts
record.house_label -> record.house?.label
record.contact_name -> record.contact?.name
record.contact_phone -> record.contact?.phone
record.tenant_name -> record.tenant?.name
record.tenant_phone -> record.tenant?.phone
record.landlord_name -> record.landlord?.name
record.landlord_phone -> record.landlord?.phone
record.estate_name -> record.estate?.display_name || record.estate?.name
record.building_name -> record.building?.name
record.source_viewing_record_label -> record.source_viewing_record?.label
```

For labels, prefer shared helpers:

```ts
houseLabel(record.house)
buildingLabel(record.building)
contactLabel(record.contact)
contactLabel(record.tenant)
contactLabel(record.landlord)
```

- [ ] **Step 3: Keep all mutation payloads ID-based**

When editing forms or submit handlers, keep payload fields as IDs:

```ts
{
  house_id: values.house_id,
  contact_id: values.contact_id,
  tenant_id: values.tenant_id,
  landlord_id: values.landlord_id,
  source_viewing_record_id: values.source_viewing_record_id,
}
```

Do not send nested objects in create or patch payloads.

- [ ] **Step 4: Run a first TypeScript check to expose missed reads**

Run:

```bash
cd frontend_admin && source ~/.nvm/nvm.sh && nvm use 22 && npm run tsc
```

Expected: initially may FAIL with remaining old property reads. Fix each old flat field read using Step 2 replacements.

- [ ] **Step 5: Commit frontend page updates**

Run:

```bash
git diff -- frontend_admin/src/pages/property-rental frontend_admin/src/services/manual/house.ts
git add frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/houses/index.tsx frontend_admin/src/pages/property-rental/houses/detail.tsx frontend_admin/src/pages/property-rental/houses/new.tsx frontend_admin/src/pages/property-rental/viewings/index.tsx frontend_admin/src/pages/property-rental/leases/index.tsx frontend_admin/src/pages/property-rental/workbench.tsx frontend_admin/src/services/manual/house.ts
git commit -m "refactor: 迁移房源页面嵌套响应"
```

Expected: commit contains page code changes, not generated files already committed in Task 3. If TypeScript required edits in additional property-rental page files, inspect and add those exact files too.

### Task 6: Frontend Tests

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/workbench.test.tsx`
- Modify: other property-rental tests found by `rg`

- [ ] **Step 1: Find old mock fields**

Run:

```bash
rg -n "house_label|contact_name|contact_phone|tenant_name|tenant_phone|landlord_name|landlord_phone|estate_name|building_name|source_viewing_record_label" frontend_admin/src/pages/property-rental --glob "*.test.tsx"
```

Expected: list of mocks and assertions to update.

- [ ] **Step 2: Update house mocks**

Change mocks like:

```ts
{
  id: 1,
  room_number: '101',
  estate_name: '星河湾',
  building_name: '1 栋',
  landlord_id: 3,
  landlord_name: '周房东',
  landlord_phone: '13800000000',
}
```

to:

```ts
{
  id: 1,
  room_number: '101',
  building_id: 2,
  building: {
    id: 2,
    name: '1 栋',
    estate_id: 1,
    estate: { id: 1, name: '星河湾', display_name: '星河湾' },
  },
  landlord_id: 3,
  landlord: { id: 3, name: '周房东', phone: '13800000000' },
}
```

- [ ] **Step 3: Update viewing mocks**

Change mocks like:

```ts
{
  id: 4,
  house_id: 99,
  house_label: 'A-101',
  contact_id: 6,
  contact_name: '王租客',
  customer_name: '李客户',
  customer_phone: '13900000000',
}
```

to:

```ts
{
  id: 4,
  house_id: 99,
  house: {
    id: 99,
    label: 'A-101',
    room_number: '101',
    building_id: 2,
    building: {
      id: 2,
      name: '1 栋',
      estate_id: 1,
      estate: { id: 1, name: '星河湾', display_name: '星河湾' },
    },
  },
  contact_id: 6,
  contact: { id: 6, name: '王租客', phone: '13700000000' },
  customer_name: '李客户',
  customer_phone: '13900000000',
}
```

- [ ] **Step 4: Update lease mocks**

Change mocks like:

```ts
{
  id: 5,
  house_id: 99,
  house_label: 'A-101',
  tenant_id: 6,
  tenant_name: '王租客',
  tenant_phone: '13700000000',
  source_viewing_record_id: 4,
  source_viewing_record_label: '李客户 / 13900000000',
}
```

to:

```ts
{
  id: 5,
  house_id: 99,
  house: {
    id: 99,
    label: 'A-101',
    room_number: '101',
    building_id: 2,
    building: {
      id: 2,
      name: '1 栋',
      estate_id: 1,
      estate: { id: 1, name: '星河湾', display_name: '星河湾' },
    },
  },
  tenant_id: 6,
  tenant: { id: 6, name: '王租客', phone: '13700000000' },
  source_viewing_record_id: 4,
  source_viewing_record: {
    id: 4,
    label: '李客户 / 13900000000',
    customer_name: '李客户',
    customer_phone: '13900000000',
  },
}
```

- [ ] **Step 5: Run targeted property-rental tests**

Run:

```bash
cd frontend_admin && source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/property-rental/workbench.test.tsx
```

Expected: PASS for targeted property-rental tests.

- [ ] **Step 6: Commit frontend tests**

Run:

```bash
git diff -- frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx frontend_admin/src/pages/property-rental/workbench.test.tsx
git add frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx frontend_admin/src/pages/property-rental/workbench.test.tsx
git commit -m "test: 更新房源嵌套响应前端用例"
```

Expected: commit contains test changes and any tiny page adjustments needed only to satisfy tests. If `rg` found additional test files, inspect and add those exact files too.

### Task 7: Final Verification

**Files:**
- Verify all changed files

- [ ] **Step 1: Check for stale flat response fields in house domain**

Run:

```bash
rg -n "house_label|contact_name|contact_phone|tenant_name|tenant_phone|landlord_name|landlord_phone|estate_name|building_name|source_viewing_record_label" apps/house tests/house frontend_admin/src/pages/property-rental frontend_admin/src/services/manual/house.ts
```

Expected: no matches except documentation or intentional comments. If matches remain in executable code or tests, replace them with nested reads.

- [ ] **Step 2: Run backend test**

Run:

```bash
docker compose exec web pytest tests/house/test_api.py -q
```

Expected: PASS.

- [ ] **Step 3: Run frontend type check**

Run:

```bash
cd frontend_admin && source ~/.nvm/nvm.sh && nvm use 22 && npm run tsc
```

Expected: PASS.

- [ ] **Step 4: Run targeted frontend tests**

Run:

```bash
cd frontend_admin && source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/property-rental/workbench.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run diff hygiene**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 6: Inspect final status**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: only unrelated pre-existing workspace changes remain unstaged; commits for this implementation are visible.
