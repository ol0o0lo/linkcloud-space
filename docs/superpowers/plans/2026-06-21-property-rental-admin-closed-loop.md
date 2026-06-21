# 房源租赁管理端闭环重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 `frontend_admin` 房源租赁模块，形成以房源为中心的后台闭环：建档、媒体维护、发布检查、带看、签约和履约状态回流。

**Architecture:** 后端只补第一阶段必须字段和状态规则：房源发布状态、挂牌字段、房源筛选、租约状态回写房态。前端废弃旧单页结构，改成房源租赁业务域路由，复用现有手写 `houseApi` 和媒体上传接口，不新增独立媒体库和聚合接口。

**Tech Stack:** Django 5 + django-ninja + pytest；React 19 + Umi Max + antd 6 + React Query + Vitest；已有 `MediaRefsField` 和 `appsMediaApiUploadFiles`。

---

## File Structure

Backend:

- Modify: `apps/house/constants.py`  
  Add `HousePublishStatus`.
- Modify: `apps/house/models.py`  
  Add `publish_status`, `asking_rent`, `deposit_amount`, `available_from`; sync house rental status from lease status.
- Modify: `apps/house/schemas.py`  
  Expose new fields in `HouseIn`, `HousePatchIn`, `HouseOut`.
- Modify: `apps/house/api.py`  
  Add `publish_status` filter on `list_houses`.
- Create: `apps/house/migrations/0003_house_publish_listing_fields.py`  
  Generated migration for new fields.
- Modify: `tests/house/test_models.py`  
  Add model defaults and lease-to-house status sync tests.
- Modify: `tests/house/test_api.py`  
  Add API create/patch/filter tests for listing and publish fields.

Frontend:

- Modify: `frontend_admin/config/routes.ts`  
  Replace the single `property-rental` route with nested routes.
- Modify: `frontend_admin/src/locales/zh-CN/menu.ts`
- Modify: `frontend_admin/src/locales/en-US/menu.ts`
- Modify: `frontend_admin/src/services/manual/house.ts`  
  Add listing/publish fields to `HouseOut`.
- Modify: `frontend_admin/src/pages/property-rental/constants.ts`  
  Add publish status constants, media utilities, completeness helpers.
- Replace: `frontend_admin/src/pages/property-rental/index.tsx`  
  Make it a minimal route redirect or business-domain placeholder; old CRUD logic is not kept.
- Create: `frontend_admin/src/pages/property-rental/workbench.tsx`
- Create: `frontend_admin/src/pages/property-rental/houses/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/houses/new.tsx`
- Create: `frontend_admin/src/pages/property-rental/houses/detail.tsx`
- Create: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/contacts/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/viewings/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/leases/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/components/MediaRefsUpload.tsx`
- Create: `frontend_admin/src/pages/property-rental/components/__tests__/media-refs-upload.test.tsx`
- Create: `frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx`
- Create: `frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx`
- Create: `frontend_admin/src/pages/property-rental/workbench.test.tsx`

Verification:

- Backend commands run with `docker compose exec web ...`.
- Frontend commands run after `nvm use 22`, under `frontend_admin`.

---

### Task 1: Backend House Listing Fields

**Files:**
- Modify: `apps/house/constants.py`
- Modify: `apps/house/models.py`
- Modify: `apps/house/schemas.py`
- Create: `apps/house/migrations/0003_house_publish_listing_fields.py`
- Modify: `tests/house/test_models.py`
- Modify: `tests/house/test_api.py`

- [ ] **Step 1: Add failing model tests**

Append to `tests/house/test_models.py`:

```python
class TestHousePublishAndListingFields(HouseDomainTestCase):
    def test_house_defaults_to_draft_publish_status_and_empty_listing_fields(self):
        house = self.make_house()

        self.assertEqual(house.publish_status, House.PublishStatus.DRAFT)
        self.assertIsNone(house.asking_rent)
        self.assertIsNone(house.deposit_amount)
        self.assertIsNone(house.available_from)

    def test_house_rejects_negative_listing_amounts(self):
        house = self.make_house()
        house.asking_rent = Decimal("-1")

        with self.assertRaises(ValidationError):
            house.full_clean()

        house.asking_rent = Decimal("1000")
        house.deposit_amount = Decimal("-1")

        with self.assertRaises(ValidationError):
            house.full_clean()
```

- [ ] **Step 2: Add failing API tests**

Append to `tests/house/test_api.py`:

```python
    def test_create_and_patch_house_listing_fields(self):
        response = self.client.post(
            "/api/house/houses/",
            data=json.dumps(
                {
                    "building_id": self.building.pk,
                    "room_number": "1601",
                    "asking_rent": "4200.00",
                    "deposit_amount": "4200.00",
                    "available_from": "2026-07-01",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = api_data(response)
        self.assertEqual(payload["publish_status"], "draft")
        self.assertEqual(payload["asking_rent"], "4200.00")
        self.assertEqual(payload["deposit_amount"], "4200.00")
        self.assertEqual(payload["available_from"], "2026-07-01")

        patched = self.client.patch(
            f"/api/house/houses/{payload['id']}/",
            data=json.dumps({"publish_status": "published", "asking_rent": "4300.00"}),
            content_type="application/json",
        )

        self.assertEqual(patched.status_code, 200)
        patched_payload = api_data(patched)
        self.assertEqual(patched_payload["publish_status"], "published")
        self.assertEqual(patched_payload["asking_rent"], "4300.00")

    def test_list_houses_filters_by_publish_status(self):
        draft_house = House.objects.create(building=self.building, room_number="1701")
        published_house = House.objects.create(building=self.building, room_number="1702", publish_status=House.PublishStatus.PUBLISHED)

        response = self.client.get("/api/house/houses/?publish_status=published")

        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in api_data(response)["items"]}
        self.assertIn(published_house.pk, ids)
        self.assertNotIn(draft_house.pk, ids)
```

- [ ] **Step 3: Run the new tests and verify failure**

Run:

```bash
docker compose exec web pytest tests/house/test_models.py::TestHousePublishAndListingFields tests/house/test_api.py::HouseApiTestCase::test_create_and_patch_house_listing_fields tests/house/test_api.py::HouseApiTestCase::test_list_houses_filters_by_publish_status -q
```

Expected: FAIL because `publish_status`, `asking_rent`, `deposit_amount`, and `available_from` do not exist.

- [ ] **Step 4: Add constants and model fields**

In `apps/house/constants.py`, add after `HouseStatus`:

```python
class HousePublishStatus(StrChoices):
    DRAFT = "draft", "草稿"
    PUBLISHED = "published", "已发布"
    UNPUBLISHED = "unpublished", "已下架"
```

In `apps/house/models.py`, import `HousePublishStatus` from `apps.house.constants`, then update `House`:

```python
class House(CreateUpdateTimeModelMixin):
    Orientation = HouseOrientation
    Decoration = HouseDecoration
    Status = HouseStatus
    PublishStatus = HousePublishStatus

    building = models.ForeignKey(Building, on_delete=models.PROTECT, related_name="houses")
    landlord = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name="landlord_houses", null=True, blank=True)
    room_number = models.CharField(max_length=64)
    floor = models.IntegerField(blank=True, null=True)
    area = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    interior_area = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    asking_rent = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    available_from = models.DateField(blank=True, null=True)
    bedrooms = models.PositiveIntegerField(blank=True, null=True)
    living_rooms = models.PositiveIntegerField(blank=True, null=True)
    bathrooms = models.PositiveIntegerField(blank=True, null=True)
    kitchens = models.PositiveIntegerField(blank=True, null=True)
    balconies = models.PositiveIntegerField(blank=True, null=True)
    orientation = models.CharField(max_length=32, choices=Orientation.choices, blank=True, null=True)
    decoration = models.CharField(max_length=32, choices=Decoration.choices, blank=True, null=True)
    has_elevator_access = models.BooleanField(default=False)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.VACANT, db_index=True)
    publish_status = models.CharField(max_length=32, choices=PublishStatus.choices, default=PublishStatus.DRAFT, db_index=True)
```

Keep the existing `images`, `videos`, `tags`, `public_description`, `internal_notes`, `extra`, and `is_active` fields unchanged below this block.

- [ ] **Step 5: Expose the fields in schemas**

In `apps/house/schemas.py`, add these fields to `HouseIn` after `interior_area`:

```python
    asking_rent: Decimal | None = None
    deposit_amount: Decimal | None = None
    available_from: date | None = None
```

Add these fields to `HousePatchIn` after `interior_area`:

```python
    asking_rent: Decimal | None = None
    deposit_amount: Decimal | None = None
    available_from: date | None = None
    publish_status: str | None = None
```

Add these fields to `HouseOut` after `interior_area`:

```python
    asking_rent: Decimal | None
    deposit_amount: Decimal | None
    available_from: date | None
```

Add this field to `HouseOut` after `status`:

```python
    publish_status: str
```

- [ ] **Step 6: Add API filter**

In `apps/house/api.py`, change `list_houses` signature:

```python
def list_houses(
    request,
    building_id: int | None = Query(None),
    status: str | None = Query(None),
    publish_status: str | None = Query(None),
    q: str | None = Query(None),
):
```

Add after the `status` filter:

```python
    if publish_status:
        qs = qs.filter(publish_status=publish_status)
```

- [ ] **Step 7: Generate migration**

Run:

```bash
docker compose exec web python manage.py makemigrations house --name house_publish_listing_fields
```

Expected: creates `apps/house/migrations/0003_house_publish_listing_fields.py` with four new `House` fields.

- [ ] **Step 8: Run focused backend tests**

Run:

```bash
docker compose exec web pytest tests/house/test_models.py::TestHousePublishAndListingFields tests/house/test_api.py::HouseApiTestCase::test_create_and_patch_house_listing_fields tests/house/test_api.py::HouseApiTestCase::test_list_houses_filters_by_publish_status -q
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/house/constants.py apps/house/models.py apps/house/schemas.py apps/house/api.py apps/house/migrations/0003_house_publish_listing_fields.py tests/house/test_models.py tests/house/test_api.py
git commit -m "新增房源发布状态和挂牌字段"
```

---

### Task 2: Backend Lease Status Sync

**Files:**
- Modify: `apps/house/models.py`
- Modify: `tests/house/test_models.py`

- [ ] **Step 1: Add failing lease sync tests**

Append to `tests/house/test_models.py`:

```python
class TestLeaseHouseStatusSync(HouseDomainTestCase):
    def test_active_lease_marks_vacant_house_as_rented(self):
        tenant = self.make_contact(name="租客", phone="13900139010", roles=[Contact.Role.TENANT])
        house = self.make_house(status=House.Status.VACANT)

        Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date="2026-07-01",
            end_date="2027-06-30",
            monthly_rent=Decimal("4200"),
            status=Lease.Status.ACTIVE,
        )

        house.refresh_from_db()
        self.assertEqual(house.status, House.Status.RENTED)

    def test_ended_lease_returns_rented_house_to_vacant_without_other_active_lease(self):
        tenant = self.make_contact(name="租客", phone="13900139011", roles=[Contact.Role.TENANT])
        house = self.make_house(status=House.Status.VACANT)
        lease = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date="2026-07-01",
            end_date="2027-06-30",
            monthly_rent=Decimal("4200"),
            status=Lease.Status.ACTIVE,
        )

        lease.status = Lease.Status.TERMINATED
        lease.save()

        house.refresh_from_db()
        self.assertEqual(house.status, House.Status.VACANT)

    def test_lease_sync_does_not_override_locked_or_renovating_house(self):
        tenant = self.make_contact(name="租客", phone="13900139012", roles=[Contact.Role.TENANT])
        locked_house = self.make_house(status=House.Status.LOCKED, room_number="L1")
        renovating_house = self.make_house(status=House.Status.RENOVATING, room_number="R1")

        Lease.objects.create(
            organization=self.org,
            house=locked_house,
            tenant=tenant,
            start_date="2026-07-01",
            end_date="2027-06-30",
            monthly_rent=Decimal("4200"),
            status=Lease.Status.ACTIVE,
        )
        Lease.objects.create(
            organization=self.org,
            house=renovating_house,
            tenant=tenant,
            start_date="2026-07-01",
            end_date="2027-06-30",
            monthly_rent=Decimal("4200"),
            status=Lease.Status.ACTIVE,
        )

        locked_house.refresh_from_db()
        renovating_house.refresh_from_db()
        self.assertEqual(locked_house.status, House.Status.LOCKED)
        self.assertEqual(renovating_house.status, House.Status.RENOVATING)
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
docker compose exec web pytest tests/house/test_models.py::TestLeaseHouseStatusSync -q
```

Expected: FAIL because lease saves do not sync `House.status`.

- [ ] **Step 3: Implement minimal sync helper**

In `apps/house/models.py`, add this method inside `Lease` before `save`:

```python
    def sync_house_status(self):
        if not self.house_id:
            return
        house = self.house
        if house.status in {House.Status.LOCKED, House.Status.RENOVATING}:
            return
        if self.status == self.Status.ACTIVE:
            if house.status != House.Status.RENTED:
                house.status = House.Status.RENTED
                house.save(update_fields=["status", "updated_at"])
            return
        if self.status in {self.Status.EXPIRED, self.Status.TERMINATED}:
            has_other_active = type(self).objects.filter(house_id=house.pk, status=self.Status.ACTIVE).exclude(pk=self.pk).exists()
            if not has_other_active and house.status == House.Status.RENTED:
                house.status = House.Status.VACANT
                house.save(update_fields=["status", "updated_at"])
```

Replace `Lease.save` with:

```python
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        self.sync_house_status()
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
docker compose exec web pytest tests/house/test_models.py::TestLeaseHouseStatusSync -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/house/models.py tests/house/test_models.py
git commit -m "同步租约状态到房源房态"
```

---

### Task 3: Frontend Types, Constants, and Routes

**Files:**
- Modify: `frontend_admin/config/routes.ts`
- Modify: `frontend_admin/src/locales/zh-CN/menu.ts`
- Modify: `frontend_admin/src/locales/en-US/menu.ts`
- Modify: `frontend_admin/src/services/manual/house.ts`
- Modify: `frontend_admin/src/pages/property-rental/constants.ts`
- Replace: `frontend_admin/src/pages/property-rental/index.tsx`

- [ ] **Step 1: Update manual service types**

In `frontend_admin/src/services/manual/house.ts`, add to `HouseOut` after `interior_area`:

```ts
  asking_rent?: string | null;
  deposit_amount?: string | null;
  available_from?: string | null;
```

Add after `status`:

```ts
  publish_status: string;
```

- [ ] **Step 2: Add frontend constants and helpers**

In `frontend_admin/src/pages/property-rental/constants.ts`, add:

```ts
export const HOUSE_PUBLISH_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
} as const;

export const HOUSE_PUBLISH_STATUS_OPTIONS = [
  { value: HOUSE_PUBLISH_STATUS.DRAFT, label: '草稿' },
  { value: HOUSE_PUBLISH_STATUS.PUBLISHED, label: '已发布' },
  { value: HOUSE_PUBLISH_STATUS.UNPUBLISHED, label: '已下架' },
];

export const HOUSE_PUBLISH_STATUS_TEXT: Record<string, string> = {
  [HOUSE_PUBLISH_STATUS.DRAFT]: '草稿',
  [HOUSE_PUBLISH_STATUS.PUBLISHED]: '已发布',
  [HOUSE_PUBLISH_STATUS.UNPUBLISHED]: '已下架',
};

export const HOUSE_PUBLISH_STATUS_COLOR: Record<string, string> = {
  [HOUSE_PUBLISH_STATUS.DRAFT]: 'default',
  [HOUSE_PUBLISH_STATUS.PUBLISHED]: 'green',
  [HOUSE_PUBLISH_STATUS.UNPUBLISHED]: 'orange',
};

export type MediaRefValue = {
  media_id: number;
  media_type: string;
  label?: string;
  image_role?: string;
  url?: string;
  thumbnail?: string | null;
  file_size?: number;
  original_filename?: string;
  created_at?: string;
};

export function stripDerivedMediaFields(items: MediaRefValue[]) {
  return items.map(({ media_id, media_type, label, image_role }) => ({
    media_id,
    media_type,
    ...(label ? { label } : {}),
    ...(image_role ? { image_role } : {}),
  }));
}

export function getCoverImage(images: Record<string, unknown>[] = []) {
  return images.find((item) => item.image_role === 'cover') || images[0] || null;
}

export function getHouseMediaCompleteness(house: { images?: Record<string, unknown>[]; videos?: Record<string, unknown>[]; landlord_id?: number | null }) {
  const images = house.images || [];
  const hasCover = images.some((item) => item.image_role === 'cover');
  const hasFloorPlan = images.some((item) => item.image_role === 'floor_plan');
  return {
    imageCount: images.length,
    videoCount: house.videos?.length || 0,
    hasCover,
    hasFloorPlan,
    hasLandlord: Boolean(house.landlord_id),
  };
}
```

- [ ] **Step 3: Replace property-rental routes**

In `frontend_admin/config/routes.ts`, replace the current single `property-rental` route with:

```ts
  {
    path: '/property-rental',
    name: 'property-rental',
    icon: 'home',
    routes: [
      {
        path: '/property-rental',
        redirect: '/property-rental/workbench',
      },
      {
        name: 'workbench',
        icon: 'appstore',
        path: '/property-rental/workbench',
        component: './property-rental/workbench',
      },
      {
        name: 'houses',
        icon: 'home',
        path: '/property-rental/houses',
        component: './property-rental/houses',
      },
      {
        name: 'house-new',
        icon: 'plusCircle',
        path: '/property-rental/houses/new',
        component: './property-rental/houses/new',
      },
      {
        name: 'house-detail',
        icon: 'profile',
        path: '/property-rental/houses/:id',
        component: './property-rental/houses/detail',
      },
      {
        name: 'estates',
        icon: 'apartment',
        path: '/property-rental/estates',
        component: './property-rental/estates',
      },
      {
        name: 'contacts',
        icon: 'contacts',
        path: '/property-rental/contacts',
        component: './property-rental/contacts',
      },
      {
        name: 'viewings',
        icon: 'calendar',
        path: '/property-rental/viewings',
        component: './property-rental/viewings',
      },
      {
        name: 'leases',
        icon: 'fileText',
        path: '/property-rental/leases',
        component: './property-rental/leases',
      },
    ],
  },
```

- [ ] **Step 4: Add menu labels**

In `frontend_admin/src/locales/zh-CN/menu.ts`, add:

```ts
  'menu.property-rental.workbench': '房源工作台',
  'menu.property-rental.houses': '房源',
  'menu.property-rental.house-new': '新建房源',
  'menu.property-rental.house-detail': '房源详情',
  'menu.property-rental.estates': '项目楼栋',
  'menu.property-rental.contacts': '联系人',
  'menu.property-rental.viewings': '带看',
  'menu.property-rental.leases': '租约',
```

In `frontend_admin/src/locales/en-US/menu.ts`, add:

```ts
  'menu.property-rental.workbench': 'Rental Workbench',
  'menu.property-rental.houses': 'Houses',
  'menu.property-rental.house-new': 'New House',
  'menu.property-rental.house-detail': 'House Detail',
  'menu.property-rental.estates': 'Estates & Buildings',
  'menu.property-rental.contacts': 'Contacts',
  'menu.property-rental.viewings': 'Viewings',
  'menu.property-rental.leases': 'Leases',
```

- [ ] **Step 5: Replace old index with redirect component**

Replace `frontend_admin/src/pages/property-rental/index.tsx` content with:

```tsx
import { Navigate } from '@umijs/max';

const PropertyRentalIndex = () => <Navigate to="/property-rental/workbench" replace />;

export default PropertyRentalIndex;
```

- [ ] **Step 6: Typecheck routes and service**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin tsc
```

Expected: PASS or only pre-existing errors outside touched files. If errors mention touched files, fix them before continuing.

- [ ] **Step 7: Commit**

```bash
git add frontend_admin/config/routes.ts frontend_admin/src/locales/zh-CN/menu.ts frontend_admin/src/locales/en-US/menu.ts frontend_admin/src/services/manual/house.ts frontend_admin/src/pages/property-rental/constants.ts frontend_admin/src/pages/property-rental/index.tsx
git commit -m "重组房源租赁管理端路由"
```

---

### Task 4: MediaRefsUpload Component

**Files:**
- Create: `frontend_admin/src/pages/property-rental/components/MediaRefsUpload.tsx`
- Create: `frontend_admin/src/pages/property-rental/components/__tests__/media-refs-upload.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/constants.ts`

- [ ] **Step 1: Add focused component tests**

Create `frontend_admin/src/pages/property-rental/components/__tests__/media-refs-upload.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MediaRefsUpload from '../MediaRefsUpload';

const { mockUploadFiles } = vi.hoisted(() => ({ mockUploadFiles: vi.fn() }));

vi.mock('@/services/openapi/mediaFiles', () => ({
  appsMediaApiUploadFiles: mockUploadFiles,
}));

describe('MediaRefsUpload', () => {
  beforeEach(() => {
    mockUploadFiles.mockReset();
  });

  it('strips derived fields from value changes', () => {
    const onChange = vi.fn();
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        value={[{ media_id: 1, media_type: 'image', label: '客厅', image_role: 'cover', url: '/stale.png', file_size: 10 }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '设为卧室' }));

    expect(onChange).toHaveBeenCalledWith([{ media_id: 1, media_type: 'image', label: '客厅', image_role: 'bedroom' }]);
  });

  it('keeps one cover when setting cover', () => {
    const onChange = vi.fn();
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        value={[
          { media_id: 1, media_type: 'image', label: '客厅', image_role: 'cover' },
          { media_id: 2, media_type: 'image', label: '卧室', image_role: 'bedroom' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '将卧室设为封面' }));

    expect(onChange).toHaveBeenCalledWith([
      { media_id: 1, media_type: 'image', label: '客厅' },
      { media_id: 2, media_type: 'image', label: '卧室', image_role: 'cover' },
    ]);
  });

  it('uploads selected files and appends media refs', async () => {
    mockUploadFiles.mockResolvedValue([{ id: 3, original_filename: 'kitchen.png', url: '/kitchen.png' }]);
    const onChange = vi.fn();
    render(<MediaRefsUpload mediaType="image" resourceType="house_image" value={[]} onChange={onChange} />);

    const file = new File(['x'], 'kitchen.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('选择文件'), { target: { files: [file] } });

    await waitFor(() => expect(mockUploadFiles).toHaveBeenCalledWith({ resource_type: 'house_image', scope: 'org' }, [file]));
    expect(onChange).toHaveBeenCalledWith([{ media_id: 3, media_type: 'image', label: 'kitchen.png' }]);
  });

  it('reorders items by native drag and drop', () => {
    const onChange = vi.fn();
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        value={[
          { media_id: 1, media_type: 'image', label: '客厅' },
          { media_id: 2, media_type: 'image', label: '卧室' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.dragStart(screen.getByLabelText('客厅媒体项'));
    fireEvent.dragOver(screen.getByLabelText('卧室媒体项'));
    fireEvent.drop(screen.getByLabelText('卧室媒体项'));

    expect(onChange).toHaveBeenCalledWith([
      { media_id: 2, media_type: 'image', label: '卧室' },
      { media_id: 1, media_type: 'image', label: '客厅' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/property-rental/components/__tests__/media-refs-upload.test.tsx
```

Expected: FAIL because `MediaRefsUpload` does not exist.

- [ ] **Step 3: Implement minimal component**

Create `frontend_admin/src/pages/property-rental/components/MediaRefsUpload.tsx`:

```tsx
import { DeleteOutlined } from '@ant-design/icons';
import { Button, Image, Select, Space, message } from 'antd';
import React, { useRef, useState } from 'react';
import { appsMediaApiUploadFiles } from '@/services/openapi/mediaFiles';
import { HOUSE_IMAGE_ROLE_OPTIONS, type MediaRefValue, stripDerivedMediaFields } from '../constants';

type Props = {
  value?: MediaRefValue[];
  onChange?: (value: ReturnType<typeof stripDerivedMediaFields>) => void;
  resourceType: string;
  mediaType: 'image' | 'video' | 'file';
  maxCount?: number;
};

function clean(items: MediaRefValue[]) {
  return stripDerivedMediaFields(items);
}

const MediaRefsUpload: React.FC<Props> = ({ value = [], onChange, resourceType, mediaType, maxCount }) => {
  const [uploading, setUploading] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const emit = (items: MediaRefValue[]) => onChange?.(clean(items));

  const setRole = (mediaId: number, role: string) => {
    const next = value.map((item) => {
      if (role === 'cover' && item.media_id !== mediaId && item.image_role === 'cover') {
        const { image_role, ...rest } = item;
        return rest;
      }
      return item.media_id === mediaId ? { ...item, image_role: role } : item;
    });
    emit(next);
  };

  const remove = (mediaId: number) => emit(value.filter((item) => item.media_id !== mediaId));

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    emit(next);
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await appsMediaApiUploadFiles({ resource_type: resourceType, scope: 'org' }, files);
      const refs = uploaded.map((item) => ({
        media_id: item.id,
        media_type: mediaType,
        label: item.original_filename || files[0]?.name,
        url: item.url,
      }));
      emit([...(value || []), ...refs]);
    } catch (error) {
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <input
        aria-label="选择文件"
        type="file"
        multiple={(maxCount || 2) > 1}
        accept={mediaType === 'image' ? '.jpg,.jpeg,.png,.webp' : undefined}
        disabled={uploading}
        onChange={(event) => uploadFiles(Array.from(event.target.files || []))}
      />
      <Space wrap>
        {value.map((item, index) => {
          const title = item.label || item.original_filename || `#${item.media_id}`;
          return (
            <div
              key={item.media_id}
              aria-label={`${title}媒体项`}
              draggable
              onDragStart={() => { dragIndex.current = index; }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null) move(dragIndex.current, index);
                dragIndex.current = null;
              }}
              style={{ width: 160 }}
            >
              {mediaType === 'image' && item.url ? <Image width={144} height={96} style={{ objectFit: 'cover' }} src={item.url} alt={title} /> : <div>{title}</div>}
              <Space direction="vertical" size={4}>
                <Select
                  aria-label={`${title}角色`}
                  size="small"
                  value={item.image_role}
                  placeholder="角色"
                  options={HOUSE_IMAGE_ROLE_OPTIONS}
                  onChange={(role) => setRole(item.media_id, role)}
                  style={{ width: 144 }}
                />
                <Space>
                  <Button size="small" onClick={() => setRole(item.media_id, 'cover')}>{item.image_role === 'cover' ? '已是封面' : `将${title}设为封面`}</Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(item.media_id)}>删除</Button>
                </Space>
                <Space wrap>
                  {HOUSE_IMAGE_ROLE_OPTIONS.filter((role) => role.value !== 'cover').map((role) => (
                    <Button key={role.value} size="small" onClick={() => setRole(item.media_id, role.value)}>{`设为${role.label}`}</Button>
                  ))}
                </Space>
              </Space>
            </div>
          );
        })}
      </Space>
    </Space>
  );
};

export default MediaRefsUpload;
```

This first version uses native file input and native drag/drop. Do not add a drag dependency.

- [ ] **Step 4: Run focused tests**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/property-rental/components/__tests__/media-refs-upload.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend_admin/src/pages/property-rental/components/MediaRefsUpload.tsx frontend_admin/src/pages/property-rental/components/__tests__/media-refs-upload.test.tsx frontend_admin/src/pages/property-rental/constants.ts
git commit -m "新增房源媒体引用上传组件"
```

---

### Task 5: Workbench and House List

**Files:**
- Create: `frontend_admin/src/pages/property-rental/workbench.tsx`
- Create: `frontend_admin/src/pages/property-rental/workbench.test.tsx`
- Create: `frontend_admin/src/pages/property-rental/houses/index.tsx`

- [ ] **Step 1: Add workbench test**

Create `frontend_admin/src/pages/property-rental/workbench.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkbenchPage from './workbench';

const { mockListHouses, mockListViewings, mockListLeases } = vi.hoisted(() => ({
  mockListHouses: vi.fn(),
  mockListViewings: vi.fn(),
  mockListLeases: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listHouses: mockListHouses,
    listViewingRecords: mockListViewings,
    listLeases: mockListLeases,
  },
}));

describe('Property rental workbench', () => {
  beforeEach(() => {
    mockListHouses.mockResolvedValue({
      items: [
        { id: 1, room_number: '101', landlord_id: null, images: [], videos: [], status: 'vacant', publish_status: 'draft' },
        { id: 2, room_number: '102', landlord_id: 5, images: [{ media_id: 1, media_type: 'image', image_role: 'cover' }], videos: [], status: 'vacant', publish_status: 'published' },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
    mockListViewings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    mockListLeases.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
  });

  it('shows actionable house tasks', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await waitFor(() => expect(screen.getByText('待补房东')).toBeInTheDocument());
    expect(screen.getByText('待补封面')).toBeInTheDocument();
    expect(screen.getAllByText('1')[0]).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/property-rental/workbench.test.tsx
```

Expected: FAIL because `workbench.tsx` does not exist.

- [ ] **Step 3: Implement workbench**

Create `frontend_admin/src/pages/property-rental/workbench.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Table } from 'antd';
import React, { useMemo } from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type HouseOut } from '@/services/manual/house';
import { getHouseMediaCompleteness } from './constants';

const WorkbenchPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houses = useQuery({ queryKey: ['house', 'workbench', 'houses', workspace.selectedOrgSlug], queryFn: () => houseApi.listHouses({ page: 1, page_size: 100 }), enabled });
  const viewings = useQuery({ queryKey: ['house', 'workbench', 'viewings', workspace.selectedOrgSlug], queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 100 }), enabled });
  const leases = useQuery({ queryKey: ['house', 'workbench', 'leases', workspace.selectedOrgSlug], queryFn: () => houseApi.listLeases({ page: 1, page_size: 100 }), enabled });

  const tasks = useMemo(() => {
    const items = houses.data?.items || [];
    return [
      { key: 'landlord', title: '待补房东', count: items.filter((item) => !item.landlord_id).length },
      { key: 'cover', title: '待补封面', count: items.filter((item) => !getHouseMediaCompleteness(item).hasCover).length },
      { key: 'images', title: '图片少于 3 张', count: items.filter((item) => (item.images?.length || 0) < 3).length },
      { key: 'floor_plan', title: '缺户型图', count: items.filter((item) => !getHouseMediaCompleteness(item).hasFloorPlan).length },
      { key: 'converted', title: '已成交待签约', count: (viewings.data?.items || []).filter((item) => item.status === 'converted').length },
      { key: 'contract', title: '合同缺失', count: (leases.data?.items || []).filter((item) => !item.contract_files?.length).length },
    ];
  }, [houses.data, leases.data, viewings.data]);

  return (
    <TenantSelectionGuard title="房源工作台" subtitle="优先处理会阻断发布、带看和签约的事项。">
      <Row gutter={[16, 16]}>
        {tasks.map((task) => (
          <Col key={task.key} xs={24} sm={12} lg={8}>
            <Card>
              <Statistic title={task.title} value={task.count} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="房源待办明细" style={{ marginTop: 16 }}>
        <Table<HouseOut>
          rowKey="id"
          loading={houses.isLoading}
          columns={[
            { title: '房号', dataIndex: 'room_number' },
            { title: '发布', dataIndex: 'publish_status' },
            { title: '房态', dataIndex: 'status' },
            { title: '图片', dataIndex: 'images', render: (value) => `${value?.length || 0} 张` },
          ]}
          dataSource={houses.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default WorkbenchPage;
```

- [ ] **Step 4: Implement house list page**

Create `frontend_admin/src/pages/property-rental/houses/index.tsx`:

```tsx
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Button, Card, Image, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useState } from 'react';
import { AdminToolbar, adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type HouseOut } from '@/services/manual/house';
import { getCoverImage, HOUSE_PUBLISH_STATUS_COLOR, HOUSE_PUBLISH_STATUS_OPTIONS, HOUSE_PUBLISH_STATUS_TEXT, HOUSE_STATUS_OPTIONS, STATUS_COLOR, STATUS_TEXT } from '../constants';

const HousesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [status, setStatus] = useState<string>();
  const [publishStatus, setPublishStatus] = useState<string>();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houses = useQuery({
    queryKey: ['house', 'houses', workspace.selectedOrgSlug, status, publishStatus],
    queryFn: () => houseApi.listHouses({ page: 1, page_size: 100, status, publish_status: publishStatus }),
    enabled,
  });

  const columns: ColumnsType<HouseOut> = [
    {
      title: '封面',
      dataIndex: 'images',
      width: 100,
      render: (images) => {
        const cover = getCoverImage(images);
        return cover?.url ? <Image width={72} height={48} style={{ objectFit: 'cover' }} src={cover.url as string} /> : '-';
      },
    },
    { title: '房号', dataIndex: 'room_number', width: 120 },
    { title: '面积', dataIndex: 'area', width: 100, render: (value) => value || '-' },
    { title: '挂牌租金', dataIndex: 'asking_rent', width: 120, render: (value) => value || '-' },
    { title: '房态', dataIndex: 'status', width: 120, render: (value) => <Tag color={STATUS_COLOR[value] || 'default'}>{STATUS_TEXT[value] || value}</Tag> },
    { title: '发布', dataIndex: 'publish_status', width: 120, render: (value) => <Tag color={HOUSE_PUBLISH_STATUS_COLOR[value] || 'default'}>{HOUSE_PUBLISH_STATUS_TEXT[value] || value}</Tag> },
    { title: '房东', dataIndex: 'landlord_id', width: 120, render: (value) => value || '待补' },
    { title: '媒体', dataIndex: 'images', width: 120, render: (_value, record) => `${record.images?.length || 0} 图 / ${record.videos?.length || 0} 视频` },
    { title: '操作', dataIndex: 'actions', width: 120, render: (_value, record) => <a onClick={() => history.push(`/property-rental/houses/${record.id}`)}>详情</a> },
  ];

  return (
    <TenantSelectionGuard title="房源" subtitle="按房源发现资料、媒体、房态和发布问题。">
      <Card
        title="房源列表"
        extra={<AdminToolbar><Button type="primary" icon={<PlusOutlined />} onClick={() => history.push('/property-rental/houses/new')}>新建房源</Button></AdminToolbar>}
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select allowClear placeholder="房态" options={HOUSE_STATUS_OPTIONS} value={status} onChange={setStatus} style={{ width: 160 }} />
          <Select allowClear placeholder="发布状态" options={HOUSE_PUBLISH_STATUS_OPTIONS} value={publishStatus} onChange={setPublishStatus} style={{ width: 160 }} />
        </Space>
        <Table rowKey="id" loading={houses.isLoading} columns={columns} dataSource={houses.data?.items || []} pagination={false} scroll={adminTableScroll} />
      </Card>
    </TenantSelectionGuard>
  );
};

export default HousesPage;
```

- [ ] **Step 5: Run focused frontend tests**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/property-rental/workbench.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend_admin/src/pages/property-rental/workbench.tsx frontend_admin/src/pages/property-rental/workbench.test.tsx frontend_admin/src/pages/property-rental/houses/index.tsx
git commit -m "新增房源工作台和房源列表"
```

---

### Task 6: House Wizard and Detail Center

**Files:**
- Create: `frontend_admin/src/pages/property-rental/houses/new.tsx`
- Create: `frontend_admin/src/pages/property-rental/houses/detail.tsx`
- Create: `frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx`
- Create: `frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx`

- [ ] **Step 1: Add wizard tests**

Create `frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HouseNewPage from '../new';

const { mockCreateHouse, mockListBuildings, mockListContacts } = vi.hoisted(() => ({
  mockCreateHouse: vi.fn(),
  mockListBuildings: vi.fn(),
  mockListContacts: vi.fn(),
}));

vi.mock('@umijs/max', () => ({ history: { push: vi.fn() } }));
vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }),
}));
vi.mock('@/services/manual/house', () => ({
  houseApi: {
    createHouse: mockCreateHouse,
    listBuildings: mockListBuildings,
    listContacts: mockListContacts,
  },
}));

describe('HouseNewPage', () => {
  beforeEach(() => {
    mockCreateHouse.mockResolvedValue({ id: 10 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 1, name: '1栋', estate_id: 1 }], total: 1, page: 1, page_size: 100 });
    mockListContacts.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
  });

  it('saves a draft with building and room number', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    fireEvent.mouseDown(await screen.findByLabelText('楼栋'));
    fireEvent.click(await screen.findByText('1栋 #1'));
    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '1801' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    await waitFor(() => expect(mockCreateHouse).toHaveBeenCalledWith(expect.objectContaining({ building_id: 1, room_number: '1801', publish_status: 'draft' })));
  });
});
```

- [ ] **Step 2: Add detail tests**

Create `frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HouseDetailPage from '../detail';

const { mockGetHouse, mockPatchHouse, mockListViewings, mockListLeases } = vi.hoisted(() => ({
  mockGetHouse: vi.fn(),
  mockPatchHouse: vi.fn(),
  mockListViewings: vi.fn(),
  mockListLeases: vi.fn(),
}));

vi.mock('@umijs/max', () => ({ useParams: () => ({ id: '7' }) }));
vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }),
}));
vi.mock('@/services/manual/house', () => ({
  houseApi: {
    getHouse: mockGetHouse,
    patchHouse: mockPatchHouse,
    listViewingRecords: mockListViewings,
    listLeases: mockListLeases,
  },
}));

describe('HouseDetailPage', () => {
  beforeEach(() => {
    mockGetHouse.mockResolvedValue({ id: 7, room_number: '1801', status: 'vacant', publish_status: 'draft', images: [], videos: [], landlord_id: null, public_description: '' });
    mockPatchHouse.mockResolvedValue({ id: 7 });
    mockListViewings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    mockListLeases.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
  });

  it('shows publish check gaps before publishing', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseDetailPage /></QueryClientProvider>);

    fireEvent.click(await screen.findByRole('button', { name: '发布检查' }));

    expect(screen.getByText('待补房东')).toBeInTheDocument();
    expect(screen.getByText('待补封面')).toBeInTheDocument();
    expect(screen.getByText('待补公开描述')).toBeInTheDocument();
    expect(mockPatchHouse).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx
```

Expected: FAIL because pages do not exist.

- [ ] **Step 4: Implement wizard**

Create `frontend_admin/src/pages/property-rental/houses/new.tsx`:

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Button, Card, Form, Input, InputNumber, Select, Space, Steps } from 'antd';
import React, { useMemo, useState } from 'react';
import { fullWidthStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import MediaRefsUpload from '../components/MediaRefsUpload';
import { CONTACT_ROLE, HOUSE_MEDIA_RESOURCE_TYPE, HOUSE_MEDIA_TYPE, HOUSE_PUBLISH_STATUS } from '../constants';

const HouseNewPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const buildings = useQuery({ queryKey: ['house', 'buildings', workspace.selectedOrgSlug], queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100 }), enabled });
  const contacts = useQuery({ queryKey: ['house', 'contacts', 'landlord', workspace.selectedOrgSlug], queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, role: CONTACT_ROLE.LANDLORD }), enabled });
  const createMutation = useMutation({ mutationFn: houseApi.createHouse, onSuccess: (house) => history.push(`/property-rental/houses/${house.id}`) });

  const buildingOptions = useMemo(() => (buildings.data?.items || []).map((item) => ({ label: `${item.name} #${item.id}`, value: item.id })), [buildings.data]);
  const landlordOptions = useMemo(() => (contacts.data?.items || []).map((item) => ({ label: `${item.name} ${item.phone}`, value: item.id })), [contacts.data]);

  const save = async (publish = false) => {
    const values = await form.validateFields(['building_id', 'room_number']);
    const allValues = form.getFieldsValue();
    await createMutation.mutateAsync({
      ...allValues,
      ...values,
      images,
      videos,
      publish_status: publish ? HOUSE_PUBLISH_STATUS.PUBLISHED : HOUSE_PUBLISH_STATUS.DRAFT,
    });
  };

  return (
    <TenantSelectionGuard title="新建房源" subtitle="先保存草稿，再到详情页补齐资料和发布。">
      <Card>
        <Steps current={step} items={[{ title: '项目楼栋' }, { title: '基础资料' }, { title: '房东' }, { title: '媒体' }, { title: '确认' }]} />
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          {step === 0 ? <Form.Item label="楼栋" name="building_id" rules={[{ required: true }]}><Select aria-label="楼栋" options={buildingOptions} /></Form.Item> : null}
          {step === 1 ? (
            <>
              <Form.Item label="房号" name="room_number" rules={[{ required: true }]}><Input aria-label="房号" /></Form.Item>
              <Space.Compact block>
                <Form.Item label="面积" name="area" style={fullWidthStyle}><InputNumber min={0} style={fullWidthStyle} /></Form.Item>
                <Form.Item label="挂牌租金" name="asking_rent" style={fullWidthStyle}><InputNumber min={0} style={fullWidthStyle} /></Form.Item>
              </Space.Compact>
            </>
          ) : null}
          {step === 2 ? <Form.Item label="房东" name="landlord_id"><Select allowClear options={landlordOptions} /></Form.Item> : null}
          {step === 3 ? (
            <>
              <Form.Item label="房源图片"><MediaRefsUpload mediaType={HOUSE_MEDIA_TYPE.IMAGE} resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_IMAGE} value={images} onChange={setImages} maxCount={9} /></Form.Item>
              <Form.Item label="房源视频"><MediaRefsUpload mediaType={HOUSE_MEDIA_TYPE.VIDEO} resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_VIDEO} value={videos} onChange={setVideos} maxCount={3} /></Form.Item>
            </>
          ) : null}
        </Form>
        <Space>
          <Button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</Button>
          <Button disabled={step === 4} onClick={() => setStep(step + 1)}>下一步</Button>
          <Button type="primary" loading={createMutation.isPending} onClick={() => save(false)}>保存草稿</Button>
        </Space>
      </Card>
    </TenantSelectionGuard>
  );
};

export default HouseNewPage;
```

- [ ] **Step 5: Implement detail page**

Create `frontend_admin/src/pages/property-rental/houses/detail.tsx`:

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from '@umijs/max';
import { Button, Card, Descriptions, List, Space, Tabs, Tag, message } from 'antd';
import React, { useMemo } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import { getHouseMediaCompleteness, HOUSE_PUBLISH_STATUS, HOUSE_PUBLISH_STATUS_COLOR, HOUSE_PUBLISH_STATUS_TEXT, STATUS_COLOR, STATUS_TEXT } from '../constants';

function getPublishGaps(house: any) {
  const media = getHouseMediaCompleteness(house);
  return [
    !house.landlord_id ? '待补房东' : '',
    !house.asking_rent ? '待补挂牌租金' : '',
    !house.public_description ? '待补公开描述' : '',
    !media.hasCover ? '待补封面' : '',
    !house.images?.length ? '待补房源图片' : '',
  ].filter(Boolean);
}

const HouseDetailPage: React.FC = () => {
  const params = useParams();
  const houseId = Number(params.id);
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug && houseId);
  const house = useQuery({ queryKey: ['house', 'detail', houseId, workspace.selectedOrgSlug], queryFn: () => houseApi.getHouse(houseId), enabled });
  const viewings = useQuery({ queryKey: ['house', 'detail', houseId, 'viewings'], queryFn: () => houseApi.listViewingRecords({ house_id: houseId, page: 1, page_size: 100 }), enabled });
  const leases = useQuery({ queryKey: ['house', 'detail', houseId, 'leases'], queryFn: () => houseApi.listLeases({ house_id: houseId, page: 1, page_size: 100 }), enabled });
  const patchMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => houseApi.patchHouse(houseId, data), onSuccess: async () => workspace.queryClient.invalidateQueries({ queryKey: ['house'] }) });
  const gaps = useMemo(() => (house.data ? getPublishGaps(house.data) : []), [house.data]);

  const runPublishCheck = async () => {
    if (gaps.length) {
      message.warning('请先补齐发布检查项');
      return;
    }
    await patchMutation.mutateAsync({ publish_status: HOUSE_PUBLISH_STATUS.PUBLISHED });
  };

  return (
    <TenantSelectionGuard title="房源详情" subtitle="围绕一个房源维护资料、媒体、带看和租约。">
      <Card
        loading={house.isLoading}
        title={house.data ? `${house.data.room_number} 房源详情` : '房源详情'}
        extra={<Space><Button onClick={runPublishCheck}>发布检查</Button><Button onClick={() => patchMutation.mutateAsync({ publish_status: HOUSE_PUBLISH_STATUS.UNPUBLISHED })}>下架</Button></Space>}
      >
        {house.data ? (
          <>
            <Descriptions bordered column={3}>
              <Descriptions.Item label="房态"><Tag color={STATUS_COLOR[house.data.status] || 'default'}>{STATUS_TEXT[house.data.status] || house.data.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="发布"><Tag color={HOUSE_PUBLISH_STATUS_COLOR[house.data.publish_status] || 'default'}>{HOUSE_PUBLISH_STATUS_TEXT[house.data.publish_status] || house.data.publish_status}</Tag></Descriptions.Item>
              <Descriptions.Item label="挂牌租金">{house.data.asking_rent || '-'}</Descriptions.Item>
              <Descriptions.Item label="房东">{house.data.landlord_id || '待补'}</Descriptions.Item>
              <Descriptions.Item label="图片">{house.data.images?.length || 0} 张</Descriptions.Item>
              <Descriptions.Item label="视频">{house.data.videos?.length || 0} 个</Descriptions.Item>
            </Descriptions>
            <Tabs
              style={{ marginTop: 16 }}
              items={[
                { key: 'base', label: '基础资料', children: <List dataSource={gaps} header="发布检查缺口" renderItem={(item) => <List.Item>{item}</List.Item>} /> },
                { key: 'media', label: '媒体相册', children: <div>{house.data.images?.length || 0} 张图片 / {house.data.videos?.length || 0} 个视频</div> },
                { key: 'landlord', label: '房东联系人', children: <div>{house.data.landlord_id || '待补房东'}</div> },
                { key: 'viewings', label: '带看记录', children: <List dataSource={viewings.data?.items || []} renderItem={(item) => <List.Item>{item.customer_name}</List.Item>} /> },
                { key: 'leases', label: '租约合同', children: <List dataSource={leases.data?.items || []} renderItem={(item) => <List.Item>{item.start_date} 至 {item.end_date}</List.Item>} /> },
                { key: 'notes', label: '内部备注', children: <div>{house.data.internal_notes || '-'}</div> },
              ]}
            />
          </>
        ) : null}
      </Card>
    </TenantSelectionGuard>
  );
};

export default HouseDetailPage;
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend_admin/src/pages/property-rental/houses/new.tsx frontend_admin/src/pages/property-rental/houses/detail.tsx frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx
git commit -m "新增房源创建向导和详情中心"
```

---

### Task 7: Remaining Domain Pages and Final Verification

**Files:**
- Create: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/contacts/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/viewings/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/leases/index.tsx`

- [ ] **Step 1: Create simple table pages**

Create each page with the same pattern: `TenantSelectionGuard`, `useQuery`, `Card`, `Table`, no modal logic.

Use this exact structure for `frontend_admin/src/pages/property-rental/estates/index.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card, Table } from 'antd';
import React from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';

const EstatesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const estates = useQuery({ queryKey: ['house', 'estates', workspace.selectedOrgSlug], queryFn: () => houseApi.listEstates({ page: 1, page_size: 100 }), enabled });

  return (
    <TenantSelectionGuard title="项目楼栋" subtitle="维护房源所属项目和楼栋。">
      <Card title="项目">
        <Table
          rowKey="id"
          loading={estates.isLoading}
          columns={[
            { title: '项目', dataIndex: 'display_name' },
            { title: '城市', dataIndex: 'city' },
            { title: '地址', dataIndex: 'address' },
            { title: '图片', dataIndex: 'images', render: (value) => `${value?.length || 0} 张` },
          ]}
          dataSource={estates.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default EstatesPage;
```

Use the same shape for:

`frontend_admin/src/pages/property-rental/contacts/index.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag } from 'antd';
import React from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';

const ContactsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const contacts = useQuery({ queryKey: ['house', 'contacts', workspace.selectedOrgSlug], queryFn: () => houseApi.listContacts({ page: 1, page_size: 100 }), enabled });

  return (
    <TenantSelectionGuard title="联系人" subtitle="维护房东和租客联系人。">
      <Card title="联系人">
        <Table
          rowKey="id"
          loading={contacts.isLoading}
          columns={[
            { title: '姓名', dataIndex: 'name' },
            { title: '手机号', dataIndex: 'phone' },
            { title: '角色', dataIndex: 'roles', render: (roles: string[]) => roles.map((role) => <Tag key={role}>{role}</Tag>) },
          ]}
          dataSource={contacts.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default ContactsPage;
```

`frontend_admin/src/pages/property-rental/viewings/index.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import { STATUS_COLOR, STATUS_TEXT } from '../constants';

const ViewingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const viewings = useQuery({ queryKey: ['house', 'viewings', workspace.selectedOrgSlug], queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 100 }), enabled });

  return (
    <TenantSelectionGuard title="带看" subtitle="维护预约、已看、爽约、成交等转化记录。">
      <Card title="带看记录">
        <Table
          rowKey="id"
          loading={viewings.isLoading}
          columns={[
            { title: '客户', dataIndex: 'customer_name' },
            { title: '手机号', dataIndex: 'customer_phone' },
            { title: '房源 ID', dataIndex: 'house_id' },
            { title: '预约时间', dataIndex: 'scheduled_at', render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
            { title: '状态', dataIndex: 'status', render: (value) => <Tag color={STATUS_COLOR[value] || 'default'}>{STATUS_TEXT[value] || value}</Tag> },
          ]}
          dataSource={viewings.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default ViewingsPage;
```

`frontend_admin/src/pages/property-rental/leases/index.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag } from 'antd';
import React from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import { STATUS_COLOR, STATUS_TEXT } from '../constants';

const LeasesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const leases = useQuery({ queryKey: ['house', 'leases', workspace.selectedOrgSlug], queryFn: () => houseApi.listLeases({ page: 1, page_size: 100 }), enabled });

  return (
    <TenantSelectionGuard title="租约" subtitle="维护租约、合同和履约状态。">
      <Card title="租约">
        <Table
          rowKey="id"
          loading={leases.isLoading}
          columns={[
            { title: '房源 ID', dataIndex: 'house_id' },
            { title: '租客 ID', dataIndex: 'tenant_id' },
            { title: '租期', dataIndex: 'start_date', render: (_value, record) => `${record.start_date} 至 ${record.end_date}` },
            { title: '月租', dataIndex: 'monthly_rent' },
            { title: '状态', dataIndex: 'status', render: (value) => <Tag color={STATUS_COLOR[value] || 'default'}>{STATUS_TEXT[value] || value}</Tag> },
            { title: '合同', dataIndex: 'contract_files', render: (value) => `${value?.length || 0} 份` },
          ]}
          dataSource={leases.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default LeasesPage;
```

- [ ] **Step 2: Run backend suite for house app**

Run:

```bash
docker compose exec web pytest tests/house -q
```

Expected: PASS.

- [ ] **Step 3: Run frontend focused tests**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/property-rental
```

Expected: PASS.

- [ ] **Step 4: Run frontend typecheck**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin tsc
```

Expected: PASS or only pre-existing errors outside touched files. If touched files are listed, fix them.

- [ ] **Step 5: Commit**

```bash
git add frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/contacts/index.tsx frontend_admin/src/pages/property-rental/viewings/index.tsx frontend_admin/src/pages/property-rental/leases/index.tsx
git commit -m "补齐房源租赁管理端基础页面"
```

---

## Final Verification

Run:

```bash
docker compose exec web pytest tests/house -q
nvm use 22
pnpm --dir frontend_admin test src/pages/property-rental
pnpm --dir frontend_admin tsc
```

Expected:

- `tests/house` passes.
- Property rental frontend tests pass.
- TypeScript passes, or any remaining failures are confirmed pre-existing and outside touched files.

Skipped: standalone media task page, operation log, backend aggregation APIs, and a drag library. Add them only when the workbench/list/detail flow proves the need.
