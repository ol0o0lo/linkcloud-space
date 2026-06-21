# Tenant Settings Business Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the organization tenant settings page from a key/value table into business-oriented setting rows while keeping the existing settings API as the storage layer.

**Architecture:** Add `category` to `DefaultSetting` and return it from settings APIs. In `frontend_admin`, replace the organization settings table with one section registry where each section owns its setting keys and optional custom control. Unknown settings render in a simple fallback section using `widget` first and `textarea` last.

**Tech Stack:** Django 5, django-ninja, pytest, React 19, antd 6, @tanstack/react-query, Vitest.

---

## File Map

- Modify: `apps/settings/constants.py` — keep setting enum definitions; no new enum for category.
- Modify: `apps/settings/models.py` — add `DefaultSetting.category`.
- Modify: `apps/settings/service.py` — include `category` in serialized setting output.
- Modify: `apps/settings/api.py` — expose `category` on `SettingOut`.
- Create: `apps/settings/migrations/0004_defaultsetting_category.py` — add the database field.
- Modify: `apps/house/services.py` — set category for `property_rental.default_building_id`.
- Modify: `tests/settings/test_service.py` — cover serialized category.
- Modify: `tests/settings/test_api.py` — cover API category.
- Modify: `frontend_admin/src/pages/settings-management/shared.tsx` — replace table-only shared UI with reusable setting control and row helpers.
- Modify: `frontend_admin/src/pages/settings-management/organization/index.tsx` — render business sections instead of `SettingsTableCard`.
- Modify: `frontend_admin/src/pages/settings-management/organization/index.test.tsx` — cover category sections, custom default-building control, fallback control, save and restore.

## Task 1: Backend Category Metadata

**Files:**
- Modify: `apps/settings/models.py`
- Modify: `apps/settings/service.py`
- Modify: `apps/settings/api.py`
- Modify: `apps/house/services.py`
- Create: `apps/settings/migrations/0004_defaultsetting_category.py`
- Test: `tests/settings/test_service.py`
- Test: `tests/settings/test_api.py`

- [ ] **Step 1: Write the failing service test**

In `tests/settings/test_service.py`, extend `default_text` and add this assertion to the existing metadata test:

```python
@pytest.fixture
def default_text(db):
    return DefaultSetting.objects.create(
        key="site_name",
        value="My SaaS",
        value_type="text",
        label="站点名称",
        widget="textarea",
        category="general",
    )


def test_includes_label_widget_ui_and_category_metadata(self, default_text, org):
    default_text.ui = {"placeholder": "请输入站点名称"}
    default_text.save(update_fields=["ui"])

    result = get_org_setting(org, "site_name")

    assert result["label"] == "站点名称"
    assert result["widget"] == "textarea"
    assert result["category"] == "general"
    assert result["ui"] == {"placeholder": "请输入站点名称"}
```

- [ ] **Step 2: Run the service test and confirm RED**

Run:

```bash
docker compose exec web pytest tests/settings/test_service.py::TestGetAllOrgSettings::test_includes_label_widget_ui_and_category_metadata -q
```

Expected: FAIL or ERROR because `DefaultSetting.category` does not exist or `result["category"]` is missing.

- [ ] **Step 3: Write the failing API test**

In `tests/settings/test_api.py`, update `default_text` and the response metadata test:

```python
@pytest.fixture
def default_text(db):
    return DefaultSetting.objects.create(
        key="site_name",
        value="My SaaS",
        value_type="text",
        label="站点名称",
        widget="textarea",
        category="general",
        ui={"placeholder": "请输入站点名称"},
        description="站点名称",
    )
```

Add:

```python
assert item["category"] == "general"
```

- [ ] **Step 4: Run the API test and confirm RED**

Run:

```bash
docker compose exec web pytest tests/settings/test_api.py::TestOrgSettingList::test_response_includes_description_and_value_type -q
```

Expected: FAIL or ERROR because `category` is not serialized yet.

- [ ] **Step 5: Implement the model, API, and serializer**

In `apps/settings/models.py`, add:

```python
category = models.CharField(max_length=50, blank=True)
```

In `apps/settings/service.py`, add to `_build_result`:

```python
"category": default.category,
```

In `apps/settings/api.py`, add to `SettingOut`:

```python
category: str
```

In `apps/house/services.py`, set the default-building category:

```python
"category": "property_rental",
```

- [ ] **Step 6: Add the migration**

Create `apps/settings/migrations/0004_defaultsetting_category.py`:

```python
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("app_settings", "0003_setting_schema_metadata"),
    ]

    operations = [
        migrations.AddField(
            model_name="defaultsetting",
            name="category",
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
```

- [ ] **Step 7: Run backend tests and migration check**

Run:

```bash
docker compose exec web pytest tests/settings -q
docker compose exec web python manage.py makemigrations --check --dry-run
```

Expected: `43 passed` or higher, and `No changes detected`.

- [ ] **Step 8: Commit backend category metadata**

Run:

```bash
git add apps/settings/models.py apps/settings/service.py apps/settings/api.py apps/house/services.py apps/settings/migrations/0004_defaultsetting_category.py tests/settings/test_service.py tests/settings/test_api.py
git commit -m "新增设置项业务分类"
```

## Task 2: Organization Settings Business Layout

**Files:**
- Modify: `frontend_admin/src/pages/settings-management/shared.tsx`
- Modify: `frontend_admin/src/pages/settings-management/organization/index.tsx`
- Test: `frontend_admin/src/pages/settings-management/organization/index.test.tsx`

- [ ] **Step 1: Write the failing organization page tests**

In `frontend_admin/src/pages/settings-management/organization/index.test.tsx`, make `mockListSettings` return:

```ts
mockListSettings.mockResolvedValue([
  { key: 'billing.enabled', category: 'general', label: '启用账单', value: true, value_type: 'boolean', widget: 'switch', ui: {}, description: '启用账单', is_customized: true },
  { key: 'quota.member_limit', category: 'general', label: '成员上限', value: 12, value_type: 'integer', widget: 'input_number', ui: {}, description: '成员上限', is_customized: false },
  { key: 'property_rental.default_building_id', category: 'property_rental', label: '默认楼栋', value: 10, value_type: 'integer', widget: 'select', ui: { options_source: 'house.buildings' }, description: '默认楼栋', is_customized: true },
  { key: 'unknown.raw', category: '', label: '未知设置', value: { a: 1 }, value_type: 'json', widget: 'not_real', ui: {}, description: '未知设置', is_customized: false },
]);
```

Add tests:

```ts
it('renders business sections instead of a settings table', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizationSettingsPage />
    </QueryClientProvider>,
  );

  await screen.findByText('房源租赁设置');
  expect(screen.getByText('通用设置')).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: '设置项' })).not.toBeInTheDocument();
});

it('uses the custom default building control inside the property rental section', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizationSettingsPage />
    </QueryClientProvider>,
  );

  await screen.findByText('默认楼栋');
  expect(screen.getAllByRole('button', { name: '新建楼栋' }).length).toBeGreaterThanOrEqual(1);
});

it('falls back to textarea for an unknown widget', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizationSettingsPage />
    </QueryClientProvider>,
  );

  await screen.findByText('未知设置');
  expect(screen.getByLabelText('未知设置')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run organization page tests and confirm RED**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm --dir frontend_admin test src/pages/settings-management/organization/index.test.tsx
```

Expected: FAIL because the page still renders the table.

- [ ] **Step 3: Add the smallest shared setting control**

In `frontend_admin/src/pages/settings-management/shared.tsx`, keep `parseSettingValue`, `stringifySettingValue`, and `settingFormValue`. Add:

```ts
export type SettingWithSchema = API.SettingOut & {
  category?: string;
  label?: string;
  widget?: string;
  ui?: SettingUi;
};

export type SettingControlProps = {
  value?: unknown;
  onChange?: (value: unknown) => void;
};

export function SettingSchemaControl({
  setting,
  value,
  onChange,
  options,
}: {
  setting: SettingWithSchema;
  value?: unknown;
  onChange?: (value: unknown) => void;
  options?: SettingOption[];
}) {
  const widget = setting.widget || defaultWidget(setting.value_type);
  if (widget === 'switch') return <Switch checked={Boolean(value)} onChange={onChange} />;
  if (widget === 'input_number') return <InputNumber value={typeof value === 'number' ? value : undefined} onChange={onChange} style={{ width: '100%' }} />;
  if (widget === 'select') return <Select value={value as string | number | undefined} onChange={onChange} options={options || []} />;
  if (widget === 'input') return <Input value={typeof value === 'string' ? value : ''} onChange={(event) => onChange?.(event.target.value)} />;
  return <Input.TextArea aria-label={setting.label || setting.key} value={stringifySettingValue(value)} onChange={(event) => onChange?.(event.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} />;
}
```

Remove `SettingsTableCard` usage from the organization page only; keep the export for team page until team settings is redesigned.

- [ ] **Step 4: Replace organization table with inline business sections**

In `frontend_admin/src/pages/settings-management/organization/index.tsx`, define one registry:

```ts
const organizationSettingSections = [
  {
    category: 'property_rental',
    title: '房源租赁设置',
    items: [
      {
        key: 'property_rental.default_building_id',
        control: DefaultBuildingControl,
      },
    ],
  },
  {
    category: 'general',
    title: '通用设置',
    items: [],
  },
] as const;
```

Add local draft state:

```ts
const [draftValues, setDraftValues] = useState<Record<string, unknown>>({});
```

When settings load, initialize missing drafts:

```ts
useEffect(() => {
  const next: Record<string, unknown> = {};
  for (const setting of settingsQuery.data || []) {
    next[setting.key] = draftValues[setting.key] ?? settingFormValue(setting);
  }
  setDraftValues(next);
}, [settingsQuery.data]);
```

Render sections with `Card`, `Space`, `Typography`, `Button`, and `SettingSchemaControl`. For each row:

```tsx
const value = draftValues[setting.key] ?? settingFormValue(setting);
const Control = item.control;

<Space direction="vertical" style={{ width: '100%' }}>
  <Typography.Text strong>{setting.label || setting.key}</Typography.Text>
  <Typography.Text type="secondary">{setting.description}</Typography.Text>
  {Control ? (
    <Control value={value} onChange={(next) => setDraftValues((items) => ({ ...items, [setting.key]: next }))} />
  ) : (
    <SettingSchemaControl setting={setting} value={value} onChange={(next) => setDraftValues((items) => ({ ...items, [setting.key]: next }))} options={optionSources[setting.ui?.options_source || '']} />
  )}
  <Space>
    <Button type="primary" loading={updateMutation.isPending} onClick={() => updateMutation.mutate({ setting, value })}>保存</Button>
    {setting.is_customized ? <Button onClick={() => restoreMutation.mutate(setting)}>恢复默认</Button> : null}
  </Space>
</Space>
```

- [ ] **Step 5: Keep default building as a value-only control**

In `frontend_admin/src/pages/settings-management/organization/index.tsx`, define:

```ts
const DefaultBuildingControl: React.FC<SettingControlProps> = ({ value, onChange }) => (
  <Space wrap>
    <Select
      loading={buildingsQuery.isLoading}
      value={typeof value === 'number' ? value : undefined}
      onChange={onChange}
      options={buildingItems.map((item) => ({ value: item.id, label: item.name }))}
      style={{ width: 240 }}
    />
    <Button onClick={() => setBuildingOpen(true)}>新建楼栋</Button>
  </Space>
);
```

After `createBuildingMutation` succeeds, keep:

```ts
setDraftValues((items) => ({ ...items, 'property_rental.default_building_id': building.id }));
```

Do not call the settings save API from inside `DefaultBuildingControl`.

- [ ] **Step 6: Run organization page tests and confirm GREEN**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm --dir frontend_admin test src/pages/settings-management/organization/index.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run frontend type check**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm --dir frontend_admin tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 8: Commit frontend business layout**

Run:

```bash
git add frontend_admin/src/pages/settings-management/shared.tsx frontend_admin/src/pages/settings-management/organization/index.tsx frontend_admin/src/pages/settings-management/organization/index.test.tsx
git commit -m "租户设置改为业务功能布局"
```

## Task 3: Final Verification

**Files:**
- Verify only; no code files should change.

- [ ] **Step 1: Run backend verification**

Run:

```bash
docker compose exec web pytest tests/settings -q
docker compose exec web python manage.py makemigrations --check --dry-run
```

Expected: all settings tests pass and migration check reports `No changes detected`.

- [ ] **Step 2: Run frontend verification**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm --dir frontend_admin test src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx
source ~/.nvm/nvm.sh && nvm use 22 && pnpm --dir frontend_admin tsc --noEmit
```

Expected: all listed tests pass and TypeScript exits 0.

- [ ] **Step 3: Check working tree scope**

Run:

```bash
git status --short
```

Expected: only unrelated pre-existing user changes remain, or the worktree is clean if those changes were committed separately.

## Self-Review

- Spec coverage: backend `category`, business sections, custom default-building control, schema fallback, textarea fallback, unified save, and unified restore are covered by Tasks 1 and 2.
- Placeholder scan: no placeholder steps; every command and file path is concrete.
- Type consistency: `SettingWithSchema`, `SettingControlProps`, `SettingSchemaControl`, and `organizationSettingSections` are named consistently across tasks.
