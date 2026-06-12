# 个人中心重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把后台个人中心重构为“`/profile` 资料长页 + 三个独立二级页”的结构，去掉工作台式导航和 query 驱动的伪多页交互。

**Architecture:** 保留现有后端接口与大部分资料/安全/通知业务实现，把前端入口改成真正的页面结构。`/profile` 只负责基础资料查看与编辑；`/profile/security`、`/profile/password`、`/profile/notifications` 分别承载专项流程；旧的 `?tab=` / `?section=` 入口只做兼容跳转。主页沿用单列资料页布局，子页用轻量 `Page` 包裹现有组件，逐步删除“嵌入式工作台”状态联动。

**Tech Stack:** Vue 3、Vue Router、TypeScript、Antdv Next、`@vben/common-ui`、Vitest、`vue-tsc`

---

## 文件结构与职责

- Modify: `frontend_admin/apps/web-antdv-next/src/router/routes/modules/vben.ts`
  负责注册 `/profile` 及新的二级页路由，并为旧 query 入口保留兼容重定向。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/index.vue`
  从“工作台 + tab/query 状态机”收口成真正的 `/profile` 主资料页容器。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/overview.vue`
  从“工作台总览卡”调整为主资料页底部的专项入口区块，按钮改为标准路由跳转语义。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue`
  保留单列长页资料编辑逻辑，删除对其它嵌入式 section 的协调职责，只保留自身查看态/编辑态。
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-page.vue`
  作为 `/profile/security` 的页面壳，包裹现有 `security-setting.vue`。
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/password-page.vue`
  作为 `/profile/password` 的页面壳，优先复用现有 `password-setting.vue`。
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/notifications-page.vue`
  作为 `/profile/notifications` 的页面壳，包裹现有 `notification-setting.vue`。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue`
  删除为嵌入工作台准备的 `activeEditSection`、`displayMode`、`requestedIntent` 一类 props 和联动逻辑，保留纯安全页行为。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/notification-setting.vue`
  删除为工作台嵌入准备的锁定/请求编辑逻辑，保留独立通知页行为。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/index.test.ts`
  从“单页标签切换”测试改为“资料长页 + 底部入口跳转”测试。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/base-setting.test.ts`
  去掉对父层 section 锁定的依赖，验证资料页本身查看态/编辑态与保存行为。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/security-setting.test.ts`
  改成验证独立安全页行为，不再依赖工作台 props。
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/route-pages.test.ts`
  覆盖 `/profile/security`、`/profile/password`、`/profile/notifications` 页面壳与兼容跳转行为。

## Task 1: 路由先收口到真正的页面结构

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/router/routes/modules/vben.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/index.test.ts`
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/route-pages.test.ts`

- [ ] **Step 1: 先写失败测试，定义新路由和旧 query 兼容行为**

```ts
import { describe, expect, it } from 'vitest';

import routes from '#/router/routes/modules/vben';

function findRoute(path: string) {
  return routes.find((route) => route.path === path);
}

describe('profile routes', () => {
  it('注册个人中心主页和三个二级页', () => {
    expect(findRoute('/profile')?.name).toBe('Profile');
    expect(findRoute('/profile/security')?.name).toBe('ProfileSecurity');
    expect(findRoute('/profile/password')?.name).toBe('ProfilePassword');
    expect(findRoute('/profile/notifications')?.name).toBe('ProfileNotifications');
  });

  it('把旧的 query 入口重定向到二级页', async () => {
    const redirect = findRoute('/profile-legacy')?.beforeEnter;
    const target = await redirect?.({ path: '/profile', query: { tab: 'security' } } as any);

    expect(target).toEqual({ path: '/profile/security', replace: true });
  });
});
```

- [ ] **Step 2: 跑测试确认当前实现失败**

Run: `bun x vitest run src/views/_core/profile/__tests__/route-pages.test.ts -t "profile routes"`

Expected: FAIL，报缺少 `ProfileSecurity` / `ProfilePassword` / `ProfileNotifications` 路由，且不存在旧 query 兼容钩子。

- [ ] **Step 3: 最小实现新路由和兼容重定向**

```ts
function mapLegacyProfileQuery(query: Record<string, unknown>) {
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const section = Array.isArray(query.section) ? query.section[0] : query.section;
  const value = String(section || tab || '').toLowerCase();

  if (value === 'security') return '/profile/security';
  if (value === 'password') return '/profile/password';
  if (value === 'notification' || value === 'notifications' || value === 'notice') {
    return '/profile/notifications';
  }
  return '/profile';
}

const routes: RouteRecordRaw[] = [
  {
    name: 'Profile',
    path: '/profile',
    component: () => import('#/views/_core/profile/index.vue'),
    meta: {
      icon: 'lucide:user',
      hideInMenu: true,
      title: $t('page.auth.profile'),
    },
  },
  {
    name: 'ProfileSecurity',
    path: '/profile/security',
    component: () => import('#/views/_core/profile/security-page.vue'),
    meta: {
      hideInMenu: true,
      title: '安全设置',
    },
  },
  {
    name: 'ProfilePassword',
    path: '/profile/password',
    component: () => import('#/views/_core/profile/password-page.vue'),
    meta: {
      hideInMenu: true,
      title: '修改密码',
    },
  },
  {
    name: 'ProfileNotifications',
    path: '/profile/notifications',
    component: () => import('#/views/_core/profile/notifications-page.vue'),
    meta: {
      hideInMenu: true,
      title: '消息提醒',
    },
  },
  {
    name: 'ProfileLegacyRedirect',
    path: '/profile-legacy',
    beforeEnter: (to) => ({ path: mapLegacyProfileQuery(to.query as Record<string, unknown>), replace: true }),
  },
];
```

- [ ] **Step 4: 再跑路由测试确认通过**

Run: `bun x vitest run src/views/_core/profile/__tests__/route-pages.test.ts -t "profile routes"`

Expected: PASS

- [ ] **Step 5: 提交这一步**

```bash
git add frontend_admin/apps/web-antdv-next/src/router/routes/modules/vben.ts frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/route-pages.test.ts
git commit -m "重构个人中心路由结构"
```

## Task 2: 把 `/profile` 从工作台改成资料长页

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/index.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/overview.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/index.test.ts`

- [ ] **Step 1: 先写失败测试，要求主页按长页顺序渲染，而不是标签切换**

```ts
it('按长页顺序渲染总览、基础资料和账户入口', async () => {
  const container = document.createElement('div');

  createApp(ProfileIndex).mount(container);
  await flushPromises();

  expect(container.textContent).toContain('账户总览');
  expect(container.textContent).toContain('基础资料内容');
  expect(container.textContent).toContain('账户安全入口');
  expect(container.textContent).toContain('修改密码入口');
  expect(container.textContent).toContain('通知设置入口');
  expect(findButton(container, '基础资料')).toBeUndefined();
});
```

- [ ] **Step 2: 跑测试确认当前实现失败**

Run: `bun x vitest run src/views/_core/profile/__tests__/index.test.ts -t "长页顺序渲染"`

Expected: FAIL，当前实现仍然依赖 tab/query 状态和切换按钮。

- [ ] **Step 3: 最小实现主页面单列结构和底部入口**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import ProfileBase from './base-setting.vue';
import ProfileOverview from './overview.vue';

const router = useRouter();
const userStore = useUserStore();

function openSection(section: 'notifications' | 'password' | 'security') {
  router.push(`/profile/${section}`).catch(() => undefined);
}
</script>

<template>
  <Profile title="个人中心" :user-info="userStore.userInfo">
    <template #content>
      <div class="flex flex-col gap-6">
        <ProfileOverview :user-info="userStore.userInfo" @open-section="openSection" />
        <ProfileBase />
      </div>
    </template>
  </Profile>
</template>
```

```vue
<template>
  <div class="flex flex-col gap-6">
    <Card>...账户总览头部...</Card>
    <Card>
      <div class="text-lg font-semibold">账户相关</div>
      <div class="grid gap-4 md:grid-cols-3">
        <button @click="$emit('open-section', 'security')">账户安全入口</button>
        <button @click="$emit('open-section', 'password')">修改密码入口</button>
        <button @click="$emit('open-section', 'notifications')">通知设置入口</button>
      </div>
    </Card>
  </div>
</template>
```

- [ ] **Step 4: 跑主页测试确认通过**

Run: `bun x vitest run src/views/_core/profile/__tests__/index.test.ts`

Expected: PASS

- [ ] **Step 5: 提交这一步**

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/profile/index.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/overview.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/index.test.ts
git commit -m "重做个人中心主页为资料长页"
```

## Task 3: 收口基础资料页，只保留自身查看态/编辑态

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/base-setting.test.ts`

- [ ] **Step 1: 写失败测试，去掉外部 section 协调依赖**

```ts
it('默认查看态进入，点击编辑后才出现保存区', async () => {
  const view = mountBaseSetting();

  await flushPromises();

  expect(view.container.textContent).not.toContain('保存资料');
  findButton(view.container, '编辑资料')?.click();
  await nextTick();

  expect(view.container.textContent).toContain('保存资料');
});

it('不再依赖 activeEditSection 锁定资料编辑入口', async () => {
  const view = mountBaseSetting({ activeEditSection: 'security' });

  await flushPromises();

  const editButton = findButton(view.container, '编辑资料');
  expect(editButton?.getAttribute('disabled')).toBeNull();
});
```

- [ ] **Step 2: 跑测试确认当前实现失败**

Run: `bun x vitest run src/views/_core/profile/__tests__/base-setting.test.ts`

Expected: FAIL，当前组件还会消费 `activeEditSection` / `requestedEditKey` 之类的父层状态。

- [ ] **Step 3: 最小实现基础资料页自身闭环**

```ts
const isEditing = ref(false);

function startEditing() {
  isEditing.value = true;
}

function cancelEditing() {
  if (profile.value) {
    syncProfile(profile.value);
  }
  isEditing.value = false;
}

async function saveProfile() {
  if (!profile.value) return;
  const data = await updateCurrentUserApi(profile.value.id, {
    first_name: form.value.first_name.trim(),
    last_name: form.value.last_name.trim(),
    timezone: form.value.timezone,
  });
  syncProfile(data);
  await authStore.fetchUserInfo();
  isEditing.value = false;
  message.success('个人资料已更新');
}
```

```vue
<template>
  <Card>
    <div class="flex items-center justify-between">
      <div>
        <div class="text-xl font-semibold">基础资料</div>
        <div class="text-sm text-zinc-500">从上到下整理公开资料、联系信息和系统偏好。</div>
      </div>
      <Button v-if="!isEditing" type="primary" @click="startEditing">编辑资料</Button>
    </div>

    <div class="mt-6 space-y-8">
      <section>...公开资料...</section>
      <section>...联系与身份信息（只读）...</section>
      <section>...系统偏好...</section>
    </div>

    <div v-if="isEditing" class="mt-6 flex justify-end gap-3">
      <Button @click="cancelEditing">取消</Button>
      <Button type="primary" @click="saveProfile">保存资料</Button>
    </div>
  </Card>
</template>
```

- [ ] **Step 4: 跑资料页测试确认通过**

Run: `bun x vitest run src/views/_core/profile/__tests__/base-setting.test.ts`

Expected: PASS

- [ ] **Step 5: 提交这一步**

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/base-setting.test.ts
git commit -m "收口个人资料页编辑流程"
```

## Task 4: 把安全、密码、通知改成真正的独立页面

**Files:**
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-page.vue`
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/password-page.vue`
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/notifications-page.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/notification-setting.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/security-setting.test.ts`

- [ ] **Step 1: 写失败测试，定义独立页面壳和纯组件行为**

```ts
it('安全设置页不再要求 activeEditSection 才能展开密码编辑', async () => {
  const view = mountSecuritySetting({ displayMode: 'full' });

  await flushPromises();
  findButton(view.container, '修改密码')?.click();
  await nextTick();

  expect(view.container.textContent).toContain('确认新密码');
});

it('通知设置页在独立页面模式下直接管理自己的编辑状态', async () => {
  const view = mountNotificationSetting();

  await flushPromises();
  findButton(view.container, '编辑通知')?.click();
  await nextTick();

  expect(view.container.textContent).toContain('收件箱提醒');
});
```

- [ ] **Step 2: 跑安全与通知测试确认失败**

Run: `bun x vitest run src/views/_core/profile/__tests__/security-setting.test.ts src/views/_core/profile/__tests__/notification-setting.test.ts`

Expected: FAIL，当前组件仍依赖工作台 props 或嵌入式 display mode。

- [ ] **Step 3: 最小实现三个页面壳和组件去工作台化**

```vue
<!-- security-page.vue -->
<script setup lang="ts">
import { Page } from '@vben/common-ui';

import SecuritySetting from './security-setting.vue';
</script>

<template>
  <Page auto-content-height content-class="p-4 sm:p-6" title="安全设置">
    <SecuritySetting />
  </Page>
</template>
```

```vue
<!-- password-page.vue -->
<script setup lang="ts">
import { Page } from '@vben/common-ui';

import PasswordSetting from './password-setting.vue';
</script>

<template>
  <Page auto-content-height content-class="p-4 sm:p-6" title="修改密码">
    <PasswordSetting />
  </Page>
</template>
```

```vue
<!-- notifications-page.vue -->
<script setup lang="ts">
import { Page } from '@vben/common-ui';

import NotificationSetting from './notification-setting.vue';
</script>

<template>
  <Page auto-content-height content-class="p-4 sm:p-6" title="新消息提醒">
    <NotificationSetting />
  </Page>
</template>
```

```ts
// security-setting.vue
const props = withDefaults(defineProps<{
  displayMode?: 'full' | 'password';
}>(), {
  displayMode: 'full',
});

function startPasswordEdit() {
  passwordErrors.value = {};
  passwordEditing.value = true;
}
```

```ts
// notification-setting.vue
const isEditing = ref(false);

function toggleEditing(open: boolean) {
  isEditing.value = open;
}
```

- [ ] **Step 4: 跑专项页面测试与类型检查**

Run: `bun x vitest run src/views/_core/profile/__tests__/security-setting.test.ts src/views/_core/profile/__tests__/notification-setting.test.ts src/views/_core/profile/__tests__/route-pages.test.ts`

Expected: PASS

Run: `bun x vue-tsc --noEmit`

Expected: PASS

- [ ] **Step 5: 提交这一步**

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-page.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/password-page.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/notifications-page.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/notification-setting.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/security-setting.test.ts frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/route-pages.test.ts
git commit -m "拆分个人中心专项设置页面"
```

## Task 5: 清理旧工作台残留并补 E2E 回归

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/profile-dashboard.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-hero.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/overview.test.ts`
- Create: `e2e/test_frontend_admin_profile.py`

- [ ] **Step 1: 写失败测试，禁止旧工作台入口继续主导交互**

```ts
it('总览入口只保留跳转到专项页面的动作', async () => {
  const sections: string[] = [];

  createApp(ProfileOverview, {
    userInfo: {
      avatar: '',
      desc: 'LinkCloud Space',
      email: 'lan@example.com',
      phone: '13800000000',
      realName: 'Lan Kong',
      username: 'lan',
    },
    onOpenSection: (section: string) => sections.push(section),
  }).mount(document.createElement('div'));

  await nextTick();
  expect(sections).toEqual([]);
});
```

- [ ] **Step 2: 跑测试确认当前残留逻辑失败**

Run: `bun x vitest run src/views/_core/profile/__tests__/overview.test.ts`

Expected: FAIL，如果旧的 hero / dashboard 仍然暴露工作台式的编辑调度接口。

- [ ] **Step 3: 最小实现残留清理和 E2E 用例**

```ts
// profile-dashboard.ts
export type ProfileEntryKey = 'notifications' | 'password' | 'security';

export interface ProfileEntryCard {
  description: string;
  key: ProfileEntryKey;
  title: string;
}
```

```python
def test_profile_page_edits_basic_info_and_links_to_password(page, live_server, admin_user):
    page.goto(f"{live_server.url}/auth/login")
    page.get_by_placeholder("请输入邮箱").fill(admin_user.email)
    page.get_by_placeholder("密码").fill("password123")
    page.get_by_role("button", name="登录").click()

    page.goto(f"{live_server.url}/profile")
    page.get_by_role("button", name="编辑资料").click()
    page.get_by_placeholder("请输入姓氏").fill("Lan")
    page.get_by_role("button", name="保存资料").click()

    expect(page.get_by_text("Lan")).to_be_visible()
    page.get_by_role("button", name="前往修改密码").click()
    expect(page).to_have_url(re.compile(r"/profile/password$"))
```

- [ ] **Step 4: 跑最终回归**

Run: `bun x vitest run src/views/_core/profile/__tests__/index.test.ts src/views/_core/profile/__tests__/overview.test.ts src/views/_core/profile/__tests__/base-setting.test.ts src/views/_core/profile/__tests__/security-setting.test.ts`

Expected: PASS

Run: `bun x vue-tsc --noEmit`

Expected: PASS

Run: `pytest e2e/test_frontend_admin_profile.py -v --ds=config.settings.e2e`

Expected: PASS，完成资料编辑并跳转到密码页。

- [ ] **Step 5: 提交这一步**

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/profile/profile-dashboard.ts frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-hero.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/overview.test.ts e2e/test_frontend_admin_profile.py
git commit -m "完成个人中心重设计回归"
```

## 自检

### Spec coverage

- `个人资料主页是单列长页`：Task 2、Task 3 覆盖。
- `安全设置 / 修改密码 / 新消息提醒保留独立二级页`：Task 1、Task 4 覆盖。
- `旧 query 入口仅保留兼容`：Task 1 覆盖。
- `查看态 / 编辑态 / 整页保存`：Task 3 覆盖。
- `二级页专项职责清晰`：Task 4 覆盖。
- `E2E 回归主路径`：Task 5 覆盖。

### Placeholder scan

已检查：无 `TODO`、`TBD`、`后续补`、`类似 Task N` 之类占位描述。每个代码步骤都给了实际代码片段和运行命令。

### Type consistency

- 路由名称统一使用 `Profile` / `ProfileSecurity` / `ProfilePassword` / `ProfileNotifications`。
- 专项入口统一使用 `security` / `password` / `notifications`。
- 主资料页只保留 `ProfileBase`，不再混入安全和通知编辑状态。
