# Profile Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `http://localhost:5999/profile` 从纵向堆叠的设置页重构为“身份优先的状态驾驶舱”，同时保留现有资料、安全、密码、通知能力。

**Architecture:** 保持现有 Django / allauth / 通知接口不变，在 `frontend_admin/apps/web-antdv-next/src/views/_core/profile/` 内重组页面壳层与模块边界。页面顶层新增一层轻量 dashboard view-model 来派生身份主舞台和状态摘要；各业务模块沿用现有 API，但统一接入“单模块编辑”和“状态变更后刷新摘要”的事件协议。

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Vben Admin `Page`, Ant Design Vue via `antdv-next`, Vitest, Tailwind utilities, existing Django API wrappers in `#/api/django/auth`, `#/api/django/context`, `#/api/django/resources`.

---

## Scope

本计划只覆盖 `/profile` 页面改版：

- 身份主舞台
- 四张状态摘要卡
- 轻锚点导航
- 资料、安全、密码、通知四个同页下沉模块
- 单模块编辑协调
- 资料 / 安全 / 通知摘要派生逻辑测试

本计划不覆盖：

- 后端 API 或模型变更
- `/accounts/*` 旧页面回退逻辑
- `@vben/common-ui` 包内部通用 `Profile` 组件清理
- 其他 admin 页面联动改版

## File Structure

- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/profile-dashboard.ts`
  - Responsibility: 集中定义个人中心 dashboard 的派生类型、完成度计算、安全摘要、通知摘要和 section key。
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/profile-dashboard.test.ts`
  - Responsibility: 校验资料完整度、安全摘要、通知摘要派生逻辑。
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-hero.vue`
  - Responsibility: 渲染身份主舞台与顶部高频动作。
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-status-cards.vue`
  - Responsibility: 渲染四张状态摘要卡并发出 section 跳转事件。
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-anchor-nav.vue`
  - Responsibility: 渲染轻锚点导航。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/overview.vue`
  - Responsibility: 组合 hero、状态卡和 anchor，取代现有“账户总览”卡片。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/index.vue`
  - Responsibility: 页面顶层数据加载、摘要刷新、单模块编辑协调、section 滚动。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue`
  - Responsibility: 将资料区改为身份信息模块，支持查看态 / 编辑态和头像动作，并向父层回报 profile 变化。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue`
  - Responsibility: 将安全区改为分组管理模块，支持详情展开、危险动作确认和摘要刷新通知。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/password-setting.vue`
  - Responsibility: 将密码区改为摘要 + 局部编辑的轻量模块。
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/notification-setting.vue`
  - Responsibility: 将通知区改为摘要 + 编辑模式模块，并向父层回报摘要变化。
- Read only: `frontend_admin/apps/web-antdv-next/src/api/django/context.ts`
  - Responsibility: 当前用户与组织上下文映射，提供身份主舞台需要的 org 描述来源。
- Read only: `frontend_admin/apps/web-antdv-next/src/api/django/auth.ts`
  - Responsibility: allauth 安全能力接口，包含验证器、恢复码、Passkey、第三方绑定。
- Read only: `frontend_admin/apps/web-antdv-next/src/api/django/resources.ts`
  - Responsibility: 当前用户资料、通知偏好等页面数据源。
- Read only: `docs/superpowers/specs/2026-06-07-profile-dashboard-redesign-design.md`
  - Responsibility: 已确认的设计目标与边界。

## Verification Commands

从仓库根目录执行，前端命令在 `frontend_admin` 下运行。

```bash
cd frontend_admin
pnpm exec vitest run apps/web-antdv-next/src/views/_core/profile/__tests__/profile-dashboard.test.ts --config vitest.config.ts --dom
pnpm --filter @vben/web-antdv-next typecheck
pnpm --filter @vben/web-antdv-next build
```

Expected result:

- Vitest 通过，至少覆盖资料完整度、安全摘要、通知摘要三个断言场景。
- Typecheck exits with code 0.
- Build exits with code 0.

如需视觉校验：

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next dev
```

然后在浏览器检查：

- `/profile`
- 桌面宽度与窄屏宽度下的身份主舞台、摘要卡、锚点导航和单模块编辑行为

---

### Task 1: 抽离个人中心 Dashboard 派生逻辑

**Files:**
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/profile-dashboard.ts`
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/profile-dashboard.test.ts`
- Read only: `frontend_admin/apps/web-antdv-next/src/api/django/context.ts`
- Read only: `frontend_admin/apps/web-antdv-next/src/api/django/auth.ts`
- Read only: `frontend_admin/apps/web-antdv-next/src/api/django/resources.ts`

- [ ] **Step 1: 确认当前用户、安全、通知字段名**

Run:

```bash
sed -n '1,120p' frontend_admin/apps/web-antdv-next/src/api/django/context.ts
sed -n '1,140p' frontend_admin/apps/web-antdv-next/src/api/django/resources.ts
sed -n '1,120p' frontend_admin/apps/web-antdv-next/src/api/django/auth.ts
```

Expected:

- `context.ts` 提供 `desc` / `org` 这类组织上下文来源。
- `resources.ts` 中 `UserRow` 包含 `avatar_url`, `first_name`, `last_name`, `email`, `phone`, `phone_verified`, `timezone`。
- `auth.ts` 中 `AuthenticatorRow`, `SocialAccountRow`, `RecoveryCodesRow` 可用于安全摘要。

- [ ] **Step 2: 新建 dashboard 派生 helper 与类型**

在 `frontend_admin/apps/web-antdv-next/src/views/_core/profile/profile-dashboard.ts` 新建以下结构：

```ts
import type { BasicUserInfo } from '@vben/types';

import type { AuthenticatorRow, SocialAccountRow } from '#/api/django/auth';
import type { NotificationPreferenceRow, UserRow } from '#/api/django/resources';

export type ProfileSectionKey = 'basic' | 'notification' | 'password' | 'security';

export interface ProfileHeroModel {
  completionText: string;
  currentOrgLabel: string;
  displayName: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  timezone: string;
  username: string;
}

export interface ProfileStatusCard {
  actionLabel: string;
  description: string;
  key: ProfileSectionKey;
  summary: string;
  tags: string[];
  tone: 'default' | 'positive' | 'warning';
  title: string;
}

export function buildProfileHero(user: UserRow | null, userInfo: BasicUserInfo | null, currentOrgLabel: string): ProfileHeroModel {
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || userInfo?.realName || user?.email || user?.username || '当前用户';
  const completedFields = [user?.avatar_url, displayName, user?.email, user?.phone, user?.timezone].filter(Boolean).length;
  return {
    completionText: `资料完整度 ${completedFields}/5`,
    currentOrgLabel: currentOrgLabel || '当前暂无组织上下文',
    displayName,
    email: user?.email || '未设置邮箱',
    phone: user?.phone || '未绑定手机号',
    phoneVerified: Boolean(user?.phone_verified),
    timezone: user?.timezone || 'Asia/Shanghai',
    username: user?.username || userInfo?.username || 'account',
  };
}

export function buildProfileStatusCards(input: {
  authenticators: AuthenticatorRow[];
  notificationPreferences: NotificationPreferenceRow[];
  socialAccounts: SocialAccountRow[];
  user: UserRow | null;
}) {
  const passkeyCount = input.authenticators.filter((item) => item.type === 'webauthn').length;
  const hasTotp = input.authenticators.some((item) => item.type === 'totp');
  const inAppEnabled = input.notificationPreferences.filter((item) => item.in_app).length;
  const emailEnabled = input.notificationPreferences.filter((item) => item.email).length;

  return [
    {
      actionLabel: '完善资料',
      description: '补齐头像、姓名、手机号和时区，让身份信息更完整。',
      key: 'basic' as const,
      summary: input.user?.avatar_url ? '资料已基本完善' : '还可补充头像与资料细节',
      tags: [input.user?.email || '未设置邮箱', input.user?.phone || '未绑定手机号'],
      tone: input.user?.avatar_url ? 'positive' : 'warning',
      title: '资料完整度',
    },
    {
      actionLabel: '提升安全',
      description: '集中处理验证器、恢复码、Passkey 与第三方绑定。',
      key: 'security' as const,
      summary: hasTotp
        ? passkeyCount > 0
          ? `已开启验证器，已添加 ${passkeyCount} 个 Passkey`
          : '已开启验证器，尚未添加 Passkey'
        : '尚未开启验证器',
      tags: [hasTotp ? '验证器已开启' : '验证器未开启', `${passkeyCount} 个 Passkey`, `${input.socialAccounts.length} 个第三方绑定`],
      tone: hasTotp ? (passkeyCount > 0 ? 'positive' : 'warning') : 'warning',
      title: '账户安全',
    },
    {
      actionLabel: '修改密码',
      description: '登录密码保持独立流程处理，修改后继续保留当前会话。',
      key: 'password' as const,
      summary: '登录密码已设置，可按需更新',
      tags: ['保持当前设备登录'],
      tone: 'default' as const,
      title: '密码状态',
    },
    {
      actionLabel: '管理提醒',
      description: '按分类控制站内信和邮件提醒触达方式。',
      key: 'notification' as const,
      summary: `站内信开启 ${inAppEnabled} 项，邮件开启 ${emailEnabled} 项`,
      tags: [`${input.notificationPreferences.length} 个分类`, `${inAppEnabled} 项站内信`, `${emailEnabled} 项邮件`],
      tone: emailEnabled + inAppEnabled > 0 ? 'positive' : 'warning',
      title: '消息提醒',
    },
  ];
}
```

- [ ] **Step 3: 为派生逻辑补充 Vitest 用例**

在 `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/profile-dashboard.test.ts` 添加：

```ts
import { describe, expect, it } from 'vitest';

import { buildProfileHero, buildProfileStatusCards } from '../profile-dashboard';

describe('profile-dashboard', () => {
  it('根据用户资料生成身份主舞台信息', () => {
    const hero = buildProfileHero(
      {
        avatar_url: 'https://example.com/avatar.png',
        email: 'lan@example.com',
        first_name: 'Lan',
        id: 1,
        last_name: 'Kong',
        phone: '13800000000',
        phone_verified: true,
        timezone: 'Asia/Shanghai',
        username: 'lan',
      },
      { realName: 'Lan Kong', username: 'lan' } as any,
      'LinkCloud Space',
    );

    expect(hero.displayName).toBe('Lan Kong');
    expect(hero.currentOrgLabel).toBe('LinkCloud Space');
    expect(hero.completionText).toContain('资料完整度');
  });

  it('在未添加 passkey 时给出安全警告摘要', () => {
    const cards = buildProfileStatusCards({
      authenticators: [{ type: 'totp' }],
      notificationPreferences: [],
      socialAccounts: [],
      user: { email: 'lan@example.com', id: 1, username: 'lan' },
    });

    const security = cards.find((item) => item.key === 'security');
    expect(security?.tone).toBe('warning');
    expect(security?.summary).toContain('尚未添加 Passkey');
  });

  it('正确汇总通知渠道开启数量', () => {
    const cards = buildProfileStatusCards({
      authenticators: [],
      notificationPreferences: [
        { description: '', email: true, in_app: false, key: 'invite', label: '邀请' },
        { description: '', email: true, in_app: true, key: 'system', label: '系统' },
      ],
      socialAccounts: [],
      user: { email: 'lan@example.com', id: 1, username: 'lan' },
    });

    const notification = cards.find((item) => item.key === 'notification');
    expect(notification?.summary).toBe('站内信开启 1 项，邮件开启 2 项');
  });
});
```

- [ ] **Step 4: 运行 dashboard 派生逻辑测试**

Run:

```bash
cd frontend_admin
pnpm exec vitest run apps/web-antdv-next/src/views/_core/profile/__tests__/profile-dashboard.test.ts --config vitest.config.ts --dom
```

Expected:

- PASS.

- [ ] **Step 5: 提交派生逻辑与测试**

Run:

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/profile/profile-dashboard.ts frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/profile-dashboard.test.ts
git commit -m "feat: 抽离个人中心状态派生逻辑"
```

Expected:

- 只包含 helper 和测试的独立提交。

---

### Task 2: 重做资料模块为身份信息区

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue`
- Read only: `frontend_admin/apps/web-antdv-next/src/api/django/resources.ts`
- Test by command: `cd frontend_admin && pnpm --filter @vben/web-antdv-next typecheck`

- [ ] **Step 1: 检查当前资料模块的数据加载与头像动作**

Run:

```bash
sed -n '1,220p' frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue
sed -n '224,240p' frontend_admin/apps/web-antdv-next/src/api/django/resources.ts
```

Expected:

- 当前文件已包含 `getCurrentUserApi`, `updateCurrentUserApi`, `uploadCurrentUserAvatarApi`, `deleteCurrentUserAvatarApi`。
- 现有 `isEditing`、`saveProfile`、`handleAvatarChange`、`removeAvatar` 可以复用，但展示形态需要重做。

- [ ] **Step 2: 加入单模块编辑协议与父层刷新事件**

在 `base-setting.vue` 中追加 props / emits，并让开始编辑、取消编辑、保存、头像变更都能通知父层：

```ts
import type { ProfileSectionKey } from './profile-dashboard';

const props = withDefaults(defineProps<{
  activeEditSection?: null | ProfileSectionKey;
}>(), {
  activeEditSection: null,
});

const emit = defineEmits<{
  editChange: [editing: boolean];
  profileUpdated: [];
}>();

const sectionKey: ProfileSectionKey = 'basic';
const isLockedByOtherSection = computed(
  () => props.activeEditSection !== null && props.activeEditSection !== sectionKey,
);

function startEditing() {
  if (isLockedByOtherSection.value) return;
  isEditing.value = true;
  emit('editChange', true);
}

function cancelEditing() {
  if (profile.value) syncProfile(profile.value);
  isEditing.value = false;
  emit('editChange', false);
}
```

在 `saveProfile`, `handleAvatarChange`, `removeAvatar` 成功分支末尾加入：

```ts
emit('profileUpdated');
```

- [ ] **Step 3: 把查看态从假输入框改成身份信息块**

将当前“基本资料”查看态区域替换成信息块布局，保留编辑态表单。查看态结构使用类似：

```vue
<Card class="shadow-sm" variant="borderless">
  <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">个人资料</div>
      <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        先确认当前身份信息，需要调整时再进入编辑。
      </div>
    </div>

    <Button v-if="!isEditing" :disabled="isLockedByOtherSection" class="w-full sm:w-auto" type="primary" @click="startEditing">
      编辑资料
    </Button>
  </div>

  <div v-if="!isEditing" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">姓名</div>
      <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ fullName || '-' }}</div>
    </div>
    <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">邮箱</div>
      <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ profile?.email || '-' }}</div>
    </div>
    <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">手机号</div>
      <div class="mt-2 flex items-center gap-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">
        <span>{{ profile?.phone || '未绑定' }}</span>
        <Tag :color="profile?.phone_verified ? 'green' : 'gold'">{{ phoneStatus }}</Tag>
      </div>
    </div>
  </div>
```

保留原有编辑态表单，但把“账号信息”展示改成紧凑说明块，而不是整页输入框风格。

- [ ] **Step 4: 运行资料模块类型检查**

Run:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next typecheck
```

Expected:

- PASS.

- [ ] **Step 5: 提交资料模块重构**

Run:

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue
git commit -m "feat: 重构个人中心资料模块"
```

Expected:

- 资料模块作为独立提交完成。

---

### Task 3: 重做安全模块为分组管理区

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue`
- Read only: `frontend_admin/apps/web-antdv-next/src/api/django/auth.ts`
- Test by command: `cd frontend_admin && pnpm --filter @vben/web-antdv-next typecheck`

- [ ] **Step 1: 先确认当前安全模块已有能力边界**

Run:

```bash
sed -n '1,260p' frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue
sed -n '260,520p' frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue
```

Expected:

- 当前文件已经覆盖验证器启停、恢复码、Passkey、GitHub 绑定、reauthenticate。
- 主要问题在于展示结构过长、默认信息密度过高，而不是 API 缺失。

- [ ] **Step 2: 接入单模块编辑协议与摘要刷新事件**

在 `security-setting.vue` 顶部增加：

```ts
import type { ProfileSectionKey } from './profile-dashboard';

const props = withDefaults(defineProps<{
  activeEditSection?: null | ProfileSectionKey;
}>(), {
  activeEditSection: null,
});

const emit = defineEmits<{
  editChange: [editing: boolean];
  statusChange: [];
}>();

const sectionKey: ProfileSectionKey = 'security';
const detailsOpen = ref(false);
const isLockedByOtherSection = computed(
  () => props.activeEditSection !== null && props.activeEditSection !== sectionKey,
);

function toggleDetails(open: boolean) {
  if (open && isLockedByOtherSection.value) return;
  detailsOpen.value = open;
  emit('editChange', open);
}
```

在所有成功修改安全状态的方法末尾追加：

```ts
emit('statusChange');
```

最少覆盖：`enableTotp`, `disableTotp`, `regenerateRecoveryCodes`, `addPasskey`, `renamePasskey`, `removePasskey`, `disconnectSocial`。

- [ ] **Step 3: 把默认长页面改成“摘要头 + 三组子卡”**

将最外层模板替换为：

```vue
<Card class="shadow-sm" variant="borderless">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">安全与登录</div>
      <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        管理验证器、恢复码、Passkey 和第三方账号绑定。
      </div>
    </div>

    <Button
      class="w-full sm:w-auto"
      :disabled="isLockedByOtherSection"
      type="primary"
      @click="toggleDetails(!detailsOpen)"
    >
      {{ detailsOpen ? '完成' : '管理安全方式' }}
    </Button>
  </div>

  <div class="mt-6 grid gap-4 lg:grid-cols-3">
    <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">验证器</div>
      <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ totp ? '已开启' : '未开启' }}</div>
    </div>
    <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Passkey</div>
      <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">已添加 {{ passkeys.length }} 个</div>
    </div>
    <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">第三方账号</div>
      <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">已绑定 {{ socialAccountCount }} 个</div>
    </div>
  </div>

  <div v-if="detailsOpen" class="mt-8 grid gap-6">
    <Card class="shadow-none ring-1 ring-zinc-200/80 dark:ring-zinc-800" variant="borderless">...</Card>
    <Card class="shadow-none ring-1 ring-zinc-200/80 dark:ring-zinc-800" variant="borderless">...</Card>
    <Card class="shadow-none ring-1 ring-zinc-200/80 dark:ring-zinc-800" variant="borderless">...</Card>
  </div>
</Card>
```

三组子卡分别承载：

- 验证器与恢复码
- Passkey
- 第三方账号绑定

危险操作确认文案保留，但整体层次收拢到组内。

- [ ] **Step 4: 运行安全模块类型检查**

Run:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next typecheck
```

Expected:

- PASS.

- [ ] **Step 5: 提交安全模块重构**

Run:

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue
git commit -m "feat: 重构个人中心安全模块"
```

Expected:

- 安全模块单独成提交，便于回滚与 review。

---

### Task 4: 重做密码与通知模块为摘要 + 局部编辑

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/password-setting.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/notification-setting.vue`
- Test by command: `cd frontend_admin && pnpm --filter @vben/web-antdv-next typecheck`

- [ ] **Step 1: 调整密码模块为折叠编辑模式**

在 `password-setting.vue` 引入单模块编辑协议：

```ts
import type { ProfileSectionKey } from './profile-dashboard';

const props = withDefaults(defineProps<{
  activeEditSection?: null | ProfileSectionKey;
}>(), {
  activeEditSection: null,
});

const emit = defineEmits<{
  editChange: [editing: boolean];
  statusChange: [];
}>();

const sectionKey: ProfileSectionKey = 'password';
const isLockedByOtherSection = computed(
  () => props.activeEditSection !== null && props.activeEditSection !== sectionKey,
);

watch(
  () => props.activeEditSection,
  (section) => {
    if (section !== sectionKey) {
      isEditing.value = false;
      resetForm();
      errors.value = {};
    }
  },
);
```

开始编辑时 `emit('editChange', true)`，取消或保存成功后 `emit('editChange', false)`；保存成功后追加 `emit('statusChange')`。

查看态保留两块摘要信息，编辑态保持当前密码表单，只把顶部说明改成驾驶舱语气。

- [ ] **Step 2: 调整通知模块为摘要 + 编辑模式**

在 `notification-setting.vue` 增加：

```ts
import { computed, onMounted, ref, watch } from 'vue';

import type { ProfileSectionKey } from './profile-dashboard';

const props = withDefaults(defineProps<{
  activeEditSection?: null | ProfileSectionKey;
}>(), {
  activeEditSection: null,
});

const emit = defineEmits<{
  editChange: [editing: boolean];
  statusChange: [];
}>();

const sectionKey: ProfileSectionKey = 'notification';
const summary = computed(() => ({
  emailEnabled: categories.value.filter((item) => item.email).length,
  inAppEnabled: categories.value.filter((item) => item.in_app).length,
  total: categories.value.length,
}));

watch(
  () => props.activeEditSection,
  (section) => {
    if (section !== sectionKey) {
      isEditing.value = false;
    }
  },
);
```

顶部改成“摘要说明 + 编辑按钮”，查看态先展示 2 到 3 个摘要块：

```vue
<div v-if="!isEditing" class="mt-6 grid gap-4 md:grid-cols-3">
  <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
    <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">通知分类</div>
    <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ summary.total }} 个分类</div>
  </div>
  <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
    <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">站内信</div>
    <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">开启 {{ summary.inAppEnabled }} 项</div>
  </div>
  <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
    <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">邮件</div>
    <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">开启 {{ summary.emailEnabled }} 项</div>
  </div>
</div>
```

在 `togglePreference` 成功后追加：

```ts
emit('statusChange');
```

点击“编辑提醒方式”时 `emit('editChange', true)`，点击“完成”时 `emit('editChange', false)`。

- [ ] **Step 3: 对密码与通知模块运行类型检查**

Run:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next typecheck
```

Expected:

- PASS.

- [ ] **Step 4: 提交密码与通知模块重构**

Run:

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/profile/password-setting.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/notification-setting.vue
git commit -m "feat: 优化个人中心密码与通知模块"
```

Expected:

- 这一提交只包含密码与通知两个模块。

---

### Task 5: 组装新的驾驶舱首页壳层并联调

**Files:**
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-hero.vue`
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-status-cards.vue`
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-anchor-nav.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/overview.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/index.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/password-setting.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/notification-setting.vue`
- Test by command: `cd frontend_admin && pnpm --filter @vben/web-antdv-next typecheck && pnpm --filter @vben/web-antdv-next build`

- [ ] **Step 1: 新建 hero、状态卡、锚点导航三个局部组件**

在 `components/profile-hero.vue` 使用 `ProfileHeroModel` props：

```vue
<script setup lang="ts">
import type { ProfileHeroModel, ProfileSectionKey } from '../profile-dashboard';

const props = defineProps<{
  model: ProfileHeroModel;
}>();

const emit = defineEmits<{
  openSection: [section: ProfileSectionKey];
}>();
</script>

<template>
  <div class="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-linear-to-br from-white via-sky-50/80 to-emerald-50/70 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-sky-950/20 dark:to-emerald-950/10 sm:p-7">
    <!-- 头像、姓名、组织、邮箱、手机号、时区、资料完整度、顶部快捷动作 -->
  </div>
</template>
```

在 `components/profile-status-cards.vue` 使用 `ProfileStatusCard[]` props 并把点击动作统一映射为 `openSection`：

```vue
<script setup lang="ts">
import type { ProfileStatusCard, ProfileSectionKey } from '../profile-dashboard';

const props = defineProps<{
  cards: ProfileStatusCard[];
}>();

const emit = defineEmits<{
  openSection: [section: ProfileSectionKey];
}>();
</script>
```

在 `components/profile-anchor-nav.vue` 提供固定四项：

```ts
const items = [
  { key: 'basic', label: '资料' },
  { key: 'security', label: '安全' },
  { key: 'password', label: '密码' },
  { key: 'notification', label: '通知' },
] as const;
```

- [ ] **Step 2: 将 overview.vue 改成驾驶舱头部组合层**

把 `overview.vue` 从旧“账户总览 + 四张说明卡”改成：

```vue
<script setup lang="ts">
import type { ProfileHeroModel, ProfileSectionKey, ProfileStatusCard } from './profile-dashboard';

import ProfileAnchorNav from './components/profile-anchor-nav.vue';
import ProfileHero from './components/profile-hero.vue';
import ProfileStatusCards from './components/profile-status-cards.vue';

defineProps<{
  cards: ProfileStatusCard[];
  hero: ProfileHeroModel;
  loading?: boolean;
}>();

const emit = defineEmits<{
  openSection: [section: ProfileSectionKey];
}>();
</script>

<template>
  <div class="flex flex-col gap-6">
    <ProfileHero :model="hero" @open-section="(section) => emit('openSection', section)" />
    <ProfileStatusCards :cards="cards" @open-section="(section) => emit('openSection', section)" />
    <ProfileAnchorNav @open-section="(section) => emit('openSection', section)" />
  </div>
</template>
```

- [ ] **Step 3: 在 index.vue 顶层加载 dashboard 摘要数据并接管单模块编辑状态**

把 `index.vue` 里的 `Profile` 包装层移除，改为直接使用 `Page`。新增顶层摘要加载与 section 协调：

```ts
import { Page } from '@vben/common-ui';
import { computed, nextTick, onMounted, ref } from 'vue';

import {
  getSocialAccountsApi,
  listAuthenticatorsApi,
} from '#/api/django/auth';
import {
  getCurrentUserApi,
  listNotificationPreferencesApi,
  type NotificationPreferenceRow,
  type UserRow,
} from '#/api/django/resources';

import { buildProfileHero, buildProfileStatusCards, type ProfileSectionKey } from './profile-dashboard';

const activeEditSection = ref<null | ProfileSectionKey>(null);
const summaryLoading = ref(false);
const summaryError = ref('');
const profile = ref<null | UserRow>(null);
const authenticators = ref<any[]>([]);
const socialAccounts = ref<any[]>([]);
const notificationPreferences = ref<NotificationPreferenceRow[]>([]);

function unwrapAllauthData<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

async function loadDashboardSummary() {
  summaryLoading.value = true;
  summaryError.value = '';
  try {
    const [profileData, authenticatorsResponse, socialResponse, notificationData] = await Promise.all([
      getCurrentUserApi(),
      listAuthenticatorsApi().catch(() => ({ data: [] })),
      getSocialAccountsApi().catch(() => ({ data: [] })),
      listNotificationPreferencesApi().catch(() => []),
    ]);

    profile.value = profileData;
    authenticators.value = unwrapAllauthData<any[]>(authenticatorsResponse) || [];
    socialAccounts.value = unwrapAllauthData<any[]>(socialResponse) || [];
    notificationPreferences.value = notificationData;
  } catch {
    summaryError.value = '个人中心摘要加载失败，请稍后重试。';
  } finally {
    summaryLoading.value = false;
  }
}

const hero = computed(() => buildProfileHero(profile.value, userStore.userInfo, String(userStore.userInfo?.desc || '')));
const cards = computed(() => buildProfileStatusCards({
  authenticators: authenticators.value,
  notificationPreferences: notificationPreferences.value,
  socialAccounts: socialAccounts.value,
  user: profile.value,
}));

function handleSectionEdit(section: ProfileSectionKey, editing: boolean) {
  activeEditSection.value = editing ? section : activeEditSection.value === section ? null : activeEditSection.value;
}

onMounted(loadDashboardSummary);
```

模板改成：

```vue
<Page auto-content-height content-class="overflow-x-hidden">
  <div class="flex flex-col gap-6">
    <section id="profile-section-overview">
      <ProfileOverview :cards="cards" :hero="hero" :loading="summaryLoading" @open-section="openSection" />
    </section>

    <Alert v-if="summaryError" :message="summaryError" show-icon type="warning" />

    <section id="profile-section-basic">
      <ProfileBase
        :active-edit-section="activeEditSection"
        @edit-change="(editing) => handleSectionEdit('basic', editing)"
        @profile-updated="loadDashboardSummary"
      />
    </section>

    <section id="profile-section-security">
      <ProfileSecuritySetting
        :active-edit-section="activeEditSection"
        @edit-change="(editing) => handleSectionEdit('security', editing)"
        @status-change="loadDashboardSummary"
      />
    </section>

    <section id="profile-section-password">
      <ProfilePasswordSetting
        :active-edit-section="activeEditSection"
        @edit-change="(editing) => handleSectionEdit('password', editing)"
        @status-change="loadDashboardSummary"
      />
    </section>

    <section id="profile-section-notification">
      <ProfileNotificationSetting
        :active-edit-section="activeEditSection"
        @edit-change="(editing) => handleSectionEdit('notification', editing)"
        @status-change="loadDashboardSummary"
      />
    </section>
  </div>
</Page>
```

同时把旧的 `profile-section-notice` 全部改名为 `profile-section-notification`，保持锚点 key 一致。

- [ ] **Step 4: 运行测试、类型检查与构建**

Run:

```bash
cd frontend_admin
pnpm exec vitest run apps/web-antdv-next/src/views/_core/profile/__tests__/profile-dashboard.test.ts --config vitest.config.ts --dom
pnpm --filter @vben/web-antdv-next typecheck
pnpm --filter @vben/web-antdv-next build
```

Expected:

- Vitest PASS.
- Typecheck PASS.
- Build PASS.

- [ ] **Step 5: 做视觉与交互验收**

Run:

```bash
cd frontend_admin
pnpm --filter @vben/web-antdv-next dev
```

手动检查：

- `/profile` 首屏先看到身份主舞台，再看到四张状态卡。
- 点击状态卡与锚点导航能滚动到对应模块。
- 任一模块进入编辑态后，其余模块的编辑入口被锁定或收拢。
- 资料、Passkey、通知开关变更后，顶部摘要卡会刷新。
- 窄屏下身份主舞台不会溢出，摘要卡仍可读。

- [ ] **Step 6: 提交整页驾驶舱壳层联调结果**

Run:

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/profile/index.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/overview.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-hero.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-status-cards.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-anchor-nav.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/password-setting.vue frontend_admin/apps/web-antdv-next/src/views/_core/profile/notification-setting.vue
git commit -m "feat: 重构个人中心为状态驾驶舱"
```

Expected:

- 最终页面壳层与四个模块联调结果形成可交付提交。

---

## Self-Review Checklist

- 设计要求的 `身份主舞台 / 状态摘要带 / 轻锚点导航 / 同页下沉模块 / 单模块编辑` 都有对应任务。
- 资料完整度、安全摘要、通知摘要派生逻辑都有明确测试文件。
- 没有依赖新的后端接口；所有数据都来自现有 `context.ts`, `auth.ts`, `resources.ts`。
- 每个任务都能独立提交，回滚边界清晰。

