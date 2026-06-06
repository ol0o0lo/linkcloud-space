# Admin Page Experience Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the first two admin pages, System Settings and Notification Center, so they follow the approved task-based admin page experience rules while staying compatible with Vben Admin and Ant Design Vue.

**Architecture:** Keep the existing Vben `Page` shell, route structure, API functions, and Ant Design Vue component stack. Refactor only page-level Vue components in `frontend_admin/apps/web-antdv-next/src/views/settings/admin.vue` and `frontend_admin/apps/web-antdv-next/src/views/notifications/index.vue`, using local computed state and template structure instead of introducing global abstractions too early.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Vben Admin `Page`, Ant Design Vue via `antdv-next`, Tailwind utility classes, existing Django API wrappers in `#/api/django/resources`.

---

## Scope

This first implementation phase covers:

- `系统设置` as a task-based configuration center.
- `通知中心` as a Vben-compatible message handling page.
- Type checking and visual verification for these two pages.

This phase does not cover:

- Users, teams, organizations, real-name verification, or dashboard refactors.
- Backend API changes.
- New global design-system components.
- Notification top-bar internals unless a broken integration is discovered while testing.

## File Structure

- Modify: `frontend_admin/apps/web-antdv-next/src/views/settings/admin.vue`
  - Responsibility: Present settings by configuration domain, value source, override state, and business impact.
- Modify: `frontend_admin/apps/web-antdv-next/src/views/notifications/index.vue`
  - Responsibility: Present notification processing as unread handling, filtered history, batch operations, and detail inspection.
- Read only: `frontend_admin/apps/web-antdv-next/src/api/django/resources.ts`
  - Responsibility: Existing API types and functions for settings, notifications, and preferences.
- Read only: `docs/superpowers/specs/2026-06-06-admin-page-experience-design.md`
  - Responsibility: Approved design rules this plan implements.

## Verification Commands

Run commands from the repository root unless noted.

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next typecheck
pnpm --filter @vben/web-antdv-next build
```

Expected result:

- Typecheck exits with code 0.
- Build exits with code 0 and writes the configured admin dist output.

If the local dev server is needed for visual checks:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next dev
```

Then open the Vite URL, sign in if needed, and inspect:

- `/settings/admin`
- `/notifications`

---

### Task 1: Refactor System Settings Into A Configuration Center

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/settings/admin.vue`
- Test by command: `cd frontend_admin && pnpm --filter @vben/web-antdv-next typecheck`

- [ ] **Step 1: Inspect the current page and confirm existing API field names**

Run:

```bash
sed -n '1,280p' frontend_admin/apps/web-antdv-next/src/views/settings/admin.vue
sed -n '284,340p' frontend_admin/apps/web-antdv-next/src/api/django/resources.ts
```

Expected:

- `SettingRow` values are loaded through `listOrgSettingsApi()` and `listUserSettingsApi()`.
- Notification preferences are loaded through `listNotificationPreferencesApi()`.
- Existing mutation functions are `updateOrgSettingApi`, `resetOrgSettingApi`, `updateUserSettingApi`, and `updateNotificationPreferenceApi`.

- [ ] **Step 2: Add typed view helpers for setting domains and value display**

In `frontend_admin/apps/web-antdv-next/src/views/settings/admin.vue`, update the Ant Design Vue import to include `Alert`, `InputNumber`, `Select`, `Tabs`, `Textarea`, and `Tooltip` if they are available from `antdv-next`.

Use this import shape:

```ts
import { Alert, Button, Card, Empty, Input, InputNumber, Modal, Select, Switch, Table, Tabs, Tag, Textarea, Tooltip } from 'antdv-next';
```

Add these helpers after the existing refs:

```ts
type SettingDomainKey = 'notifications' | 'org' | 'user';

const activeDomain = ref<SettingDomainKey>('org');

const settingDomains = computed(() => [
  {
    count: orgSettings.value.length,
    description: hasActiveOrganization.value
      ? '影响当前租户内的共享行为，适合配置组织级默认值和限制。'
      : '需要先选择当前租户，才能查看和编辑租户级配置。',
    key: 'org' as const,
    label: '租户设置',
  },
  {
    count: userSettings.value.length,
    description: '只影响当前管理员自己的偏好，不会改变其他成员的后台体验。',
    key: 'user' as const,
    label: '个人设置',
  },
  {
    count: notificationPreferences.value.length,
    description: '控制通知分类进入站内提醒、邮件提醒或两者同时发送。',
    key: 'notifications' as const,
    label: '通知偏好',
  },
]);

const activeDomainMeta = computed(
  () => settingDomains.value.find((item) => item.key === activeDomain.value) ?? settingDomains.value[0],
);

function settingValueKind(raw: string) {
  const value = raw.trim();
  if (value === 'true' || value === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
  if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) return 'json';
  return 'text';
}

function settingImpactLabel(domain: SettingDomainKey) {
  if (domain === 'org') return '影响当前租户';
  if (domain === 'user') return '仅影响当前管理员';
  return '影响通知触达';
}
```

- [ ] **Step 3: Replace the statistics grid with a configuration-domain header**

Remove the current `settingStats` computed block if it is only used by the top grid. Replace it with a summary that supports a compact header:

```ts
const settingsSummary = computed(() => ({
  customizedOrgSettings: orgSettings.value.filter((item) => item.is_customized).length,
  hasActiveOrganization: hasActiveOrganization.value,
  notificationCategories: notificationPreferences.value.length,
  orgSettings: orgSettings.value.length,
  userSettings: userSettings.value.length,
}));
```

Replace the top statistics grid in the template with this header:

```vue
<Card :bordered="false" class="shadow-sm">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <div class="text-lg font-semibold text-zinc-950 dark:text-zinc-50">配置中心</div>
      <div class="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
        按配置域查看当前值、覆盖状态和影响范围。租户级设置会影响当前租户，个人设置只影响当前管理员。
      </div>
    </div>
    <Tag :color="settingsSummary.hasActiveOrganization ? 'blue' : 'default'">
      {{ settingsSummary.hasActiveOrganization ? '当前租户已加载' : '未选择租户' }}
    </Tag>
  </div>

  <div class="mt-5 grid gap-3 md:grid-cols-3">
    <button
      v-for="domain in settingDomains"
      :key="domain.key"
      class="rounded-lg border p-4 text-left transition hover:border-blue-400"
      :class="activeDomain === domain.key ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'"
      type="button"
      @click="activeDomain = domain.key"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="font-medium text-zinc-950 dark:text-zinc-50">{{ domain.label }}</span>
        <Tag>{{ domain.count }}</Tag>
      </div>
      <div class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{{ domain.description }}</div>
    </button>
  </div>
</Card>
```

- [ ] **Step 4: Convert org settings into the active configuration domain**

Wrap the org settings table so it appears only when `activeDomain === 'org'`.

Use this domain heading before the table:

```vue
<Card v-if="activeDomain === 'org'" :bordered="false" class="shadow-sm">
  <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
    <div>
      <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">租户设置</div>
      <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ activeDomainMeta.description }}
      </div>
    </div>
    <Tag :color="settingsSummary.customizedOrgSettings > 0 ? 'blue' : 'default'">
      已覆盖 {{ settingsSummary.customizedOrgSettings }} 项
    </Tag>
  </div>

  <Alert
    v-if="!hasActiveOrganization"
    class="mb-4"
    message="请先选择当前租户"
    description="租户设置依赖当前租户上下文。选择租户后，这里会显示该租户可覆盖的配置项。"
    type="info"
    show-icon
  />
```

In the org `Table`, adjust the columns to reflect business context:

```vue
:columns="[
  { dataIndex: 'key', title: '配置项', width: 200 },
  { dataIndex: 'value', title: '当前值', width: 260 },
  { dataIndex: 'is_customized', title: '来源', width: 120 },
  { dataIndex: 'impact', title: '影响范围', width: 140 },
  { dataIndex: 'description', title: '说明' },
  { dataIndex: 'actions', title: '操作', width: 220 },
]"
```

Add this `bodyCell` branch for `impact`:

```vue
<template v-else-if="column.dataIndex === 'impact'">
  <Tag color="blue">{{ settingImpactLabel('org') }}</Tag>
</template>
```

Use the existing save and reset functions. Keep the restore-default confirmation text.

- [ ] **Step 5: Convert user settings into the personal configuration domain**

Wrap the personal settings table so it appears only when `activeDomain === 'user'`.

Use this heading and table columns:

```vue
<Card v-if="activeDomain === 'user'" :bordered="false" class="shadow-sm">
  <div class="mb-4">
    <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">个人设置</div>
    <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
      {{ activeDomainMeta.description }}
    </div>
  </div>

  <Table
    :columns="[
      { dataIndex: 'key', title: '配置项', width: 200 },
      { dataIndex: 'value', title: '当前值', width: 280 },
      { dataIndex: 'impact', title: '影响范围', width: 160 },
      { dataIndex: 'actions', title: '操作', width: 120 },
    ]"
    :data-source="userSettings"
    :loading
    :pagination="{ pageSize: 8, showSizeChanger: false }"
    :scroll="{ x: 900 }"
    row-key="key"
  >
```

Add this `bodyCell` branch for `impact`:

```vue
<template v-else-if="column.dataIndex === 'impact'">
  <Tag>{{ settingImpactLabel('user') }}</Tag>
</template>
```

- [ ] **Step 6: Convert notification preferences into Vben-compatible notification settings**

Wrap notification preferences so they appear only when `activeDomain === 'notifications'`.

Use this heading and table:

```vue
<Card v-if="activeDomain === 'notifications'" :bordered="false" class="shadow-sm">
  <div class="mb-4">
    <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">通知偏好</div>
    <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
      配合 Vben 顶栏通知入口使用，决定分类消息是否进入站内提醒和邮件提醒。
    </div>
  </div>

  <Table
    :columns="[
      { dataIndex: 'label', title: '分类', width: 180 },
      { dataIndex: 'in_app', title: '站内通知', width: 140 },
      { dataIndex: 'email', title: '邮件通知', width: 140 },
      { dataIndex: 'impact', title: '影响范围', width: 150 },
      { dataIndex: 'description', title: '说明' },
    ]"
    :data-source="notificationPreferences"
    :loading
    :pagination="{ pageSize: 8, showSizeChanger: false }"
    :scroll="{ x: 960 }"
    row-key="key"
  >
```

Add this `bodyCell` branch for `impact`:

```vue
<template v-else-if="column.dataIndex === 'impact'">
  <Tag color="purple">{{ settingImpactLabel('notifications') }}</Tag>
</template>
```

- [ ] **Step 7: Replace plain setting value inputs with type-aware inputs**

For org values, replace the current plain `Input` branch with:

```vue
<template v-if="column.dataIndex === 'value'">
  <Textarea
    v-if="settingValueKind(settingDrafts[record.key] || '') === 'json'"
    v-model:value="settingDrafts[record.key]"
    :auto-size="{ minRows: 2, maxRows: 5 }"
  />
  <Select
    v-else-if="settingValueKind(settingDrafts[record.key] || '') === 'boolean'"
    v-model:value="settingDrafts[record.key]"
    :options="[
      { label: '开启', value: 'true' },
      { label: '关闭', value: 'false' },
    ]"
  />
  <InputNumber
    v-else-if="settingValueKind(settingDrafts[record.key] || '') === 'number'"
    class="w-full"
    :value="Number(settingDrafts[record.key])"
    @change="(value: number | null) => (settingDrafts[record.key] = value === null ? '' : String(value))"
  />
  <Input v-else v-model:value="settingDrafts[record.key]" />
</template>
```

For user values, apply the same pattern with `userDrafts`:

```vue
<template v-if="column.dataIndex === 'value'">
  <Textarea
    v-if="settingValueKind(userDrafts[record.key] || '') === 'json'"
    v-model:value="userDrafts[record.key]"
    :auto-size="{ minRows: 2, maxRows: 5 }"
  />
  <Select
    v-else-if="settingValueKind(userDrafts[record.key] || '') === 'boolean'"
    v-model:value="userDrafts[record.key]"
    :options="[
      { label: '开启', value: 'true' },
      { label: '关闭', value: 'false' },
    ]"
  />
  <InputNumber
    v-else-if="settingValueKind(userDrafts[record.key] || '') === 'number'"
    class="w-full"
    :value="Number(userDrafts[record.key])"
    @change="(value: number | null) => (userDrafts[record.key] = value === null ? '' : String(value))"
  />
  <Input v-else v-model:value="userDrafts[record.key]" />
</template>
```

- [ ] **Step 8: Run typecheck and fix compile issues**

Run:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next typecheck
```

Expected:

- PASS.

If `Textarea` is not exported from `antdv-next`, change the import to use `Input.TextArea` according to the local component API pattern, then rerun the same command.

- [ ] **Step 9: Commit the settings page refactor**

Run:

```bash
git status --short frontend_admin/apps/web-antdv-next/src/views/settings/admin.vue
git add frontend_admin/apps/web-antdv-next/src/views/settings/admin.vue
git commit -m "feat: 优化后台系统设置体验"
```

Expected:

- A commit is created.
- Only the settings page file is staged for this task.

---

### Task 2: Refactor Notification Center Into A Message Handling Page

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/notifications/index.vue`
- Test by command: `cd frontend_admin && pnpm --filter @vben/web-antdv-next typecheck`

- [ ] **Step 1: Inspect the current notification page and API functions**

Run:

```bash
sed -n '1,260p' frontend_admin/apps/web-antdv-next/src/views/notifications/index.vue
sed -n '284,308p' frontend_admin/apps/web-antdv-next/src/api/django/resources.ts
```

Expected:

- The page already supports list, mark read/unread, bulk actions, delete, and read status filtering.
- The refactor should preserve these behaviors.

- [ ] **Step 2: Add local state for detail inspection and task filters**

In `frontend_admin/apps/web-antdv-next/src/views/notifications/index.vue`, update the Ant Design Vue import to include `Drawer`, `List`, `Radio`, and `Typography` if available from `antdv-next`.

Use this import shape:

```ts
import { Badge, Button, Card, Drawer, Empty, List, message, Modal, Radio, Select, Space, Table, Tag, Typography } from 'antdv-next';
```

Add local state after existing refs:

```ts
type NotificationTaskFilter = 'all' | 'read' | 'unread';

const activeTaskFilter = ref<NotificationTaskFilter>('unread');
const detailVisible = ref(false);
const activeNotification = ref<null | NotificationRow>(null);
```

Replace the current `readFilter` usage with a derived API filter:

```ts
const apiReadFilter = computed(() => {
  if (activeTaskFilter.value === 'read') return 'true';
  if (activeTaskFilter.value === 'unread') return 'false';
  return undefined;
});
```

Update `loadData()` to use `apiReadFilter.value`:

```ts
notifications.value = await listNotificationsApi(apiReadFilter.value).catch(() => []);
```

- [ ] **Step 3: Replace decorative stats with task-focused summary**

Replace `notificationStats` with:

```ts
const notificationSummary = computed(() => {
  const total = notifications.value.length;
  const unread = notifications.value.filter((item) => !item.is_read).length;
  return {
    selected: selectedRowKeys.value.length,
    total,
    unread,
  };
});
```

Add this helper:

```ts
function openNotification(record: NotificationRow) {
  activeNotification.value = record;
  detailVisible.value = true;
}
```

Add this helper for filter changes:

```ts
async function changeTaskFilter(value: NotificationTaskFilter) {
  activeTaskFilter.value = value;
  selectedRowKeys.value = [];
  await loadData();
}
```

- [ ] **Step 4: Replace the top grid with a Vben-compatible task header**

Replace the current statistics grid and list card heading with:

```vue
<Card :bordered="false" class="shadow-sm">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <div class="text-lg font-semibold text-zinc-950 dark:text-zinc-50">通知处理</div>
      <div class="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
        配合 Vben 顶栏未读提醒使用。这里集中处理未读消息、历史通知和批量已读动作。
      </div>
    </div>
    <Space>
      <Badge :count="notificationSummary.unread" :number-style="{ backgroundColor: '#1677ff' }" />
      <Button @click="loadData">刷新</Button>
    </Space>
  </div>

  <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
    <Radio.Group
      :value="activeTaskFilter"
      button-style="solid"
      @change="(event: { target: { value: NotificationTaskFilter } }) => changeTaskFilter(event.target.value)"
    >
      <Radio.Button value="unread">未读优先</Radio.Button>
      <Radio.Button value="all">全部通知</Radio.Button>
      <Radio.Button value="read">已读历史</Radio.Button>
    </Radio.Group>
    <div class="text-sm text-zinc-500 dark:text-zinc-400">
      当前 {{ notificationSummary.total }} 条，已选 {{ notificationSummary.selected }} 条
    </div>
  </div>
</Card>
```

Remove the old `Select` for read status from the list heading.

- [ ] **Step 5: Move batch operations into a clear processing toolbar**

Replace the current batch action strip with:

```vue
<div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
  <div class="text-sm text-zinc-600 dark:text-zinc-300">
    {{ selectedRowKeys.length > 0 ? `已选择 ${selectedRowKeys.length} 条通知` : '选择通知后可批量处理。' }}
  </div>
  <Space wrap>
    <Button :disabled="selectedRowKeys.length === 0" size="small" @click="markSelected(true)">
      标记已读
    </Button>
    <Button :disabled="selectedRowKeys.length === 0" size="small" @click="markSelected(false)">
      标记未读
    </Button>
    <Button
      :disabled="selectedRowKeys.length === 0"
      danger
      size="small"
      @click="
        confirmAction({
          title: '确认批量删除通知',
          content: `这会删除当前选中的 ${selectedRowKeys.length} 条通知记录。`,
          okText: '确认删除',
          onOk: () => deleteSelected(),
        })
      "
    >
      删除选中
    </Button>
    <Button
      size="small"
      type="primary"
      @click="
        confirmAction({
          title: '确认全部设为已读',
          content: '这会把当前所有未读通知统一标记为已读，并同步影响顶部未读提醒。',
          okText: '确认标记',
          onOk: () => readAllUnread(),
        })
      "
    >
      全部未读设为已读
    </Button>
  </Space>
</div>
```

- [ ] **Step 6: Make the table support detail inspection**

In the table columns, rename action labels to business actions:

```vue
:columns="[
  { dataIndex: 'title', title: '通知', width: 260 },
  { dataIndex: 'body', title: '摘要' },
  { dataIndex: 'is_read', title: '状态', width: 120 },
  { dataIndex: 'created_at', title: '时间', width: 220 },
  { dataIndex: 'actions', title: '处理', width: 230 },
]"
```

Replace the title branch with a clickable title:

```vue
<template v-if="column.dataIndex === 'title'">
  <button class="text-left font-medium text-zinc-950 hover:text-blue-600 dark:text-zinc-50" type="button" @click="openNotification(record)">
    {{ record.title }}
  </button>
</template>
```

Replace the action branch with:

```vue
<template v-else-if="column.dataIndex === 'actions'">
  <Space>
    <Button size="small" @click="openNotification(record)">查看</Button>
    <Button size="small" @click="toggleRead(record)">
      {{ record.is_read ? '标未读' : '标已读' }}
    </Button>
    <Button
      danger
      size="small"
      @click="
        confirmAction({
          title: '确认删除通知',
          content: `删除后，通知「${record.title}」将不可恢复。`,
          okText: '确认删除',
          onOk: () => removeNotification(record),
        })
      "
    >
      删除
    </Button>
  </Space>
</template>
```

- [ ] **Step 7: Add a notification detail drawer**

Add this drawer after the table card:

```vue
<Drawer
  v-model:open="detailVisible"
  width="460"
  :title="activeNotification?.title || '通知详情'"
>
  <template v-if="activeNotification">
    <div class="space-y-5">
      <div class="flex items-center gap-2">
        <Tag v-if="activeNotification.is_read">已读</Tag>
        <Badge v-else status="processing" text="未读" />
        <span class="text-sm text-zinc-500">{{ activeNotification.created_at }}</span>
      </div>

      <div>
        <div class="mb-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">通知内容</div>
        <div class="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {{ activeNotification.body || '这条通知没有更多内容。' }}
        </div>
      </div>

      <div class="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        后续如果通知携带关联对象，可在这里提供跳转到租户、团队、用户或审核记录的入口。
      </div>
    </div>
  </template>

  <template #footer>
    <div class="flex justify-end gap-2">
      <Button @click="detailVisible = false">关闭</Button>
      <Button v-if="activeNotification" type="primary" @click="toggleRead(activeNotification)">
        {{ activeNotification.is_read ? '标记为未读' : '标记为已读' }}
      </Button>
    </div>
  </template>
</Drawer>
```

If the imported `Typography` or `List` is unused after implementation, remove those imports before running typecheck.

- [ ] **Step 8: Run typecheck and fix compile issues**

Run:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next typecheck
```

Expected:

- PASS.

If the `Radio.Group` event type does not match local `antdv-next`, replace the event handler with a small function:

```ts
async function onTaskFilterChange(event: { target: { value: NotificationTaskFilter } }) {
  await changeTaskFilter(event.target.value);
}
```

And use:

```vue
@change="onTaskFilterChange"
```

- [ ] **Step 9: Commit the notification page refactor**

Run:

```bash
git status --short frontend_admin/apps/web-antdv-next/src/views/notifications/index.vue
git add frontend_admin/apps/web-antdv-next/src/views/notifications/index.vue
git commit -m "feat: 优化后台通知中心体验"
```

Expected:

- A commit is created.
- Only the notification page file is staged for this task.

---

### Task 3: Build And Visual Verification

**Files:**
- Verify: `frontend_admin/apps/web-antdv-next/src/views/settings/admin.vue`
- Verify: `frontend_admin/apps/web-antdv-next/src/views/notifications/index.vue`
- Optional screenshots: do not commit generated local screenshots unless explicitly requested.

- [ ] **Step 1: Run typecheck for the admin app**

Run:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next typecheck
```

Expected:

- PASS with exit code 0.

- [ ] **Step 2: Run production build for the admin app**

Run:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next build
```

Expected:

- PASS with exit code 0.
- No TypeScript or Vue template compile errors.

- [ ] **Step 3: Start local admin dev server for visual QA**

Run:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next dev
```

Expected:

- Vite prints a local URL.
- Keep the command running while checking pages.

- [ ] **Step 4: Inspect System Settings visually**

Open `/settings/admin` in the in-app browser or a local browser.

Verify:

- Page still uses the Vben Admin shell.
- The top area reads as “配置中心”, not a generic statistic grid.
- Domain choices show 租户设置、个人设置、通知偏好.
- Switching domains hides unrelated tables.
- Boolean values use select-like choices or switches, numeric values use numeric input, JSON-like values use multi-line input.
- Restore default still shows a confirmation with business impact.
- Narrow viewport does not overlap text or buttons.

- [ ] **Step 5: Inspect Notification Center visually**

Open `/notifications` in the in-app browser or a local browser.

Verify:

- Page still uses the Vben Admin shell.
- Header explains that this page works with Vben top-bar unread reminders.
- The primary filters are 未读优先、全部通知、已读历史.
- Batch toolbar explains selected count and keeps actions together.
- Clicking a notification opens a detail drawer.
- Delete and mark-all-read actions still show business confirmation text.
- Narrow viewport does not overlap text or buttons.

- [ ] **Step 6: Final status check**

Run:

```bash
git status --short
```

Expected:

- Only intentional files from this implementation phase are modified or already committed.
- Existing unrelated user changes remain untouched.

- [ ] **Step 7: Commit verification-only fixes if needed**

If visual or build verification required small fixes, commit only those files:

```bash
git add frontend_admin/apps/web-antdv-next/src/views/settings/admin.vue frontend_admin/apps/web-antdv-next/src/views/notifications/index.vue
git commit -m "fix: 修正后台页面体验细节"
```

Expected:

- A commit is created only if there were fixes after visual verification.
- If no fixes were needed, skip this step.

---

## Self-Review

Spec coverage:

- Task-based configuration center is covered by Task 1.
- Vben-compatible notification handling is covered by Task 2.
- Compatibility with Vben Admin shell and Ant Design Vue components is checked in Task 3.
- Business operation wording, dangerous confirmations, and non-decorative summaries are covered in Tasks 1 and 2.
- Later page types from the spec are intentionally outside this first phase and should get separate plans.

Placeholder scan:

- This plan contains no placeholder sections, no empty implementation slots, and no instruction that requires inventing unspecified behavior.

Type consistency:

- `SettingDomainKey`, `NotificationTaskFilter`, `settingDrafts`, `userDrafts`, `activeDomain`, `activeTaskFilter`, `activeNotification`, and API function names match the planned files and existing imports.
