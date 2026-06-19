# Frontend Admin 个人中心整合实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `frontend_admin` 的个人用户设置能力整合进个人中心，形成“个人资料 / 账号安全 / 偏好设置 / 通知设置”四分组，同时保持租户设置与团队设置继续留在原有设置管理入口。

**Architecture:** 复用现有 `account/settings` 中已接好的账户、安全、实名、绑定能力，将其抽离为共享的个人中心页面壳，并让 `/account/center` 成为主入口。个人偏好继续基于 `/api/settings/user/`，通知偏好继续基于 `/api/notifications/preferences/`，个人业务页移除重复的个人设置编辑能力，仅保留摘要跳转。

**Tech Stack:** React、Umi Max、Ant Design Pro、Ant Design、TanStack Query、Vitest、OpenAPI generated services

---

### Task 1: 锁定当前个人中心与设置页的目标结构

**Files:**
- Modify: `frontend_admin/config/routes.ts`
- Modify: `frontend_admin/src/locales/zh-CN/menu.ts`
- Test: `frontend_admin/src/routes.test.ts`

- [ ] **Step 1: 先补一条失败的路由测试，约束“个人中心是主入口，个人设置不再显示为菜单项”**

```ts
it('keeps account center as the visible personal entry and leaves account settings as a compatibility route', () => {
  const accountGroup = routes.find((route) => route.path === '/account');
  const namedChildren = accountGroup?.routes?.filter((route) => route.name) ?? [];

  expect(namedChildren.map((route) => route.path)).toEqual([
    '/account/center',
  ]);

  expect(accountGroup?.routes?.some((route) => route.path === '/account/settings')).toBe(true);
});
```

- [ ] **Step 2: 运行这条测试并确认先失败**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/routes.test.ts
```

Expected: FAIL，提示 `/account/settings` 仍然是带 `name` 的可见菜单路由，或者断言的命名子路由数量不匹配。

- [ ] **Step 3: 调整路由配置，保留 `/account/settings` 兼容访问但从菜单移除**

```ts
{
  name: 'account',
  icon: 'user',
  path: '/account',
  routes: [
    {
      path: '/account',
      redirect: '/account/center',
    },
    {
      name: 'center',
      icon: 'user',
      path: '/account/center',
      component: './account/center',
    },
    {
      path: '/account/settings',
      component: './account/settings',
    },
  ],
}
```

- [ ] **Step 4: 更新中文菜单文案，确保“设置管理”突出空间级含义**

```ts
'menu.account.center': '个人中心',
'menu.settings-management': '空间设置',
'menu.settings-management.organization-settings': '空间设置',
'menu.settings-management.team-settings': '团队设置',
```

- [ ] **Step 5: 重新运行路由测试确认通过**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/routes.test.ts
```

Expected: PASS，且不会再把 `/account/settings` 识别为菜单入口。

- [ ] **Step 6: 提交本任务**

```bash
git add frontend_admin/config/routes.ts frontend_admin/src/locales/zh-CN/menu.ts frontend_admin/src/routes.test.ts
git commit -m "梳理个人中心与空间设置入口"
```

### Task 2: 抽出共享的个人中心页面壳，统一四个分组入口

**Files:**
- Create: `frontend_admin/src/pages/account/components/personal-center-page.tsx`
- Create: `frontend_admin/src/pages/account/components/personal-center-page.test.tsx`
- Modify: `frontend_admin/src/pages/account/center/index.tsx`
- Modify: `frontend_admin/src/pages/account/settings/index.tsx`
- Modify: `frontend_admin/src/pages/account/settings/style.style.ts`
- Test: `frontend_admin/src/pages/account/settings/index.test.tsx`

- [ ] **Step 1: 先补失败测试，约束新页面只有四个一级分组**

```tsx
it('renders four personal center sections', async () => {
  render(<PersonalCenterPage />);

  expect(screen.getByRole('menuitem', { name: '个人资料' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '账号安全' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '偏好设置' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '通知设置' })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/index.test.tsx
```

Expected: FAIL，当前页面仍然渲染“基本设置 / 安全设置 / 实名认证 / 账号绑定 / 新消息通知”五项结构。

- [ ] **Step 3: 新建共享页面壳组件，统一维护 tab 参数和分组渲染**

```tsx
type PersonalCenterTab = 'profile' | 'security' | 'preferences' | 'notifications';

const menuMap: Record<PersonalCenterTab, string> = {
  profile: '个人资料',
  security: '账号安全',
  preferences: '偏好设置',
  notifications: '通知设置',
};

export const PersonalCenterPage: React.FC = () => {
  const [state, setState] = useState({
    mode: 'inline' as const,
    selectKey: getInitialSelectKey(),
  });

  return (
    <GridContent>
      <div className={styles.main} ref={domRef}>
        <div className={styles.leftMenu}>
          <Menu
            mode={state.mode}
            selectedKeys={[state.selectKey]}
            onClick={({ key }) => setState((prev) => ({ ...prev, selectKey: key as PersonalCenterTab }))}
            items={Object.entries(menuMap).map(([key, label]) => ({ key, label }))}
          />
        </div>
        <div className={styles.right}>
          <div className={styles.title}>{menuMap[state.selectKey]}</div>
          <PersonalCenterContent selectKey={state.selectKey} />
        </div>
      </div>
    </GridContent>
  );
};
```

- [ ] **Step 4: 让 `/account/center` 与 `/account/settings` 都复用同一个页面壳**

```tsx
// frontend_admin/src/pages/account/center/index.tsx
import { PersonalCenterPage } from '../components/personal-center-page';

export default PersonalCenterPage;
```

```tsx
// frontend_admin/src/pages/account/settings/index.tsx
import { PersonalCenterPage } from '../components/personal-center-page';

export default PersonalCenterPage;
```

- [ ] **Step 5: 重新运行页面测试确认结构切换成功**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/index.test.tsx src/pages/account/components/personal-center-page.test.tsx
```

Expected: PASS，四个一级分组生效，兼容路由仍能渲染相同页面。

- [ ] **Step 6: 提交本任务**

```bash
git add frontend_admin/src/pages/account/components/personal-center-page.tsx frontend_admin/src/pages/account/components/personal-center-page.test.tsx frontend_admin/src/pages/account/center/index.tsx frontend_admin/src/pages/account/settings/index.tsx frontend_admin/src/pages/account/settings/style.style.ts frontend_admin/src/pages/account/settings/index.test.tsx
git commit -m "重构个人中心页面壳"
```

### Task 3: 将“个人资料”收口成资料分组，并保留安全入口提示

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/components/base.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/base.test.tsx`
- Modify: `frontend_admin/src/pages/account/settings/service.ts`

- [ ] **Step 1: 先写失败测试，约束资料分组展示头像、昵称、邮箱、手机号、时区**

```tsx
it('shows profile fields and keeps phone email edits under security actions', async () => {
  render(<BaseView />);

  expect(await screen.findByText('昵称')).toBeInTheDocument();
  expect(screen.getByText('邮箱')).toBeInTheDocument();
  expect(screen.getByText('手机号')).toBeInTheDocument();
  expect(screen.getByText('时区')).toBeInTheDocument();
  expect(screen.getByText('前往账号安全修改')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/components/base.test.tsx
```

Expected: FAIL，当前 `BaseView` 只展示昵称和头像上传，没有资料摘要区。

- [ ] **Step 3: 在资料分组中增加基础资料展示，手机号与邮箱保持只读并引导去安全设置修改**

```tsx
<Descriptions column={1} size="small" bordered>
  <Descriptions.Item label="邮箱">
    {currentUser?.email || '-'} <Typography.Link onClick={goToSecurity}>前往账号安全修改</Typography.Link>
  </Descriptions.Item>
  <Descriptions.Item label="手机号">
    {formatPhone(currentUser)} <Typography.Link onClick={goToSecurity}>前往账号安全修改</Typography.Link>
  </Descriptions.Item>
  <Descriptions.Item label="时区">{currentUser?.timezone || '-'}</Descriptions.Item>
</Descriptions>
```

- [ ] **Step 4: 运行组件测试确认通过**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/components/base.test.tsx
```

Expected: PASS，资料分组既能编辑昵称头像，也能展示其余个人资料。

- [ ] **Step 5: 提交本任务**

```bash
git add frontend_admin/src/pages/account/settings/components/base.tsx frontend_admin/src/pages/account/settings/components/base.test.tsx frontend_admin/src/pages/account/settings/service.ts
git commit -m "完善个人资料分组展示"
```

### Task 4: 将安全、绑定、实名整合为一个“账号安全”分组

**Files:**
- Create: `frontend_admin/src/pages/account/settings/components/security-overview.tsx`
- Create: `frontend_admin/src/pages/account/settings/components/security-overview.test.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/security.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/binding.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/real-name.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/security.test.tsx`

- [ ] **Step 1: 先写失败测试，约束账号安全组内同时出现“登录与验证 / 第三方绑定 / 身份认证”三个 section**

```tsx
it('renders security overview sections for credentials, bindings, and real-name verification', async () => {
  render(<SecurityOverview />);

  expect(await screen.findByText('登录与验证')).toBeInTheDocument();
  expect(screen.getByText('第三方绑定')).toBeInTheDocument();
  expect(screen.getByText('身份认证')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/components/security-overview.test.tsx
```

Expected: FAIL，因为 `SecurityOverview` 组件尚不存在。

- [ ] **Step 3: 新建安全总览组件，组合现有三个能力组件**

```tsx
const SecurityOverview: React.FC = () => (
  <Space direction="vertical" size={24} style={{ width: '100%' }}>
    <Card title="登录与验证" bordered={false}>
      <SecurityView />
    </Card>
    <Card title="第三方绑定" bordered={false}>
      <BindingView />
    </Card>
    <Card title="身份认证" bordered={false}>
      <RealNameView />
    </Card>
  </Space>
);
```

- [ ] **Step 4: 将原来的 `security / binding / real-name` 一级切换入口收口到新总览组件**

```tsx
const PersonalCenterContent: React.FC<{ selectKey: PersonalCenterTab }> = ({ selectKey }) => {
  switch (selectKey) {
    case 'profile':
      return <BaseView />;
    case 'security':
      return <SecurityOverview />;
    case 'preferences':
      return <PreferencesView />;
    case 'notifications':
      return <NotificationPreferencesView />;
    default:
      return null;
  }
};
```

- [ ] **Step 5: 运行关联测试确认通过**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/components/security.test.tsx src/pages/account/settings/components/security-overview.test.tsx
```

Expected: PASS，原有安全能力仍可用，但入口已被整合为一个分组。

- [ ] **Step 6: 提交本任务**

```bash
git add frontend_admin/src/pages/account/settings/components/security-overview.tsx frontend_admin/src/pages/account/settings/components/security-overview.test.tsx frontend_admin/src/pages/account/settings/components/security.tsx frontend_admin/src/pages/account/settings/components/binding.tsx frontend_admin/src/pages/account/settings/components/real-name.tsx frontend_admin/src/pages/account/settings/components/security.test.tsx
git commit -m "整合个人中心账号安全分组"
```

### Task 5: 新增“偏好设置”分组并接入 `/api/settings/user/`

**Files:**
- Create: `frontend_admin/src/pages/account/settings/components/preferences.tsx`
- Create: `frontend_admin/src/pages/account/settings/components/preferences.test.tsx`
- Create: `frontend_admin/src/pages/account/center/service.ts`
- Modify: `frontend_admin/src/services/openapi/userSettings.ts`
- Modify: `frontend_admin/src/pages/personal-business/overview/index.test.tsx`

- [ ] **Step 1: 先写失败测试，约束偏好设置会读取 `userSettings` 并至少渲染一个已知偏好项**

```tsx
it('loads personal preferences from user settings and renders known settings with dedicated controls', async () => {
  vi.mocked(appsSettingsApiListUserSettings).mockResolvedValue([
    { key: 'navTheme', value: 'light' },
  ] as API.UserSettingOut[]);

  render(<PreferencesView />);

  expect(await screen.findByText('界面主题')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '浅色' })).toBeChecked();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/components/preferences.test.tsx
```

Expected: FAIL，因为 `PreferencesView` 组件尚不存在。

- [ ] **Step 3: 新建个人中心服务适配层，把 `settings/user` 列表映射成页面配置**

```ts
export type PreferenceField =
  | { key: 'navTheme'; label: '界面主题'; type: 'radio'; value: 'light' | 'realDark' }
  | { key: string; label: string; type: 'raw'; value: unknown };

export async function listPreferenceFields(): Promise<PreferenceField[]> {
  const settings = await appsSettingsApiListUserSettings();

  return settings.map((item) => {
    if (item.key === 'navTheme') {
      return {
        key: 'navTheme',
        label: '界面主题',
        type: 'radio',
        value: item.value === 'realDark' ? 'realDark' : 'light',
      };
    }

    return {
      key: item.key,
      label: item.key,
      type: 'raw',
      value: item.value,
    };
  });
}
```

- [ ] **Step 4: 实现偏好设置页面，已知项用明确控件，未知项回退为通用列表**

```tsx
{field.type === 'radio' ? (
  <Radio.Group
    value={field.value}
    onChange={(event) => updatePreference(field.key, event.target.value)}
    options={[
      { label: '浅色', value: 'light' },
      { label: '深色', value: 'realDark' },
    ]}
  />
) : (
  <Descriptions column={1} bordered size="small">
    <Descriptions.Item label={field.label}>{JSON.stringify(field.value)}</Descriptions.Item>
  </Descriptions>
)}
```

- [ ] **Step 5: 运行测试确认偏好设置分组可用**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/components/preferences.test.tsx
```

Expected: PASS，且 `navTheme` 这类已知设置不再以原始 key/value 表格形式裸露给用户。

- [ ] **Step 6: 提交本任务**

```bash
git add frontend_admin/src/pages/account/settings/components/preferences.tsx frontend_admin/src/pages/account/settings/components/preferences.test.tsx frontend_admin/src/pages/account/center/service.ts frontend_admin/src/services/openapi/userSettings.ts frontend_admin/src/pages/personal-business/overview/index.test.tsx
git commit -m "接入个人中心偏好设置"
```

### Task 6: 用真实通知偏好接口替换假通知设置

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/components/notification.tsx`
- Create: `frontend_admin/src/pages/account/settings/components/notification.test.tsx`
- Modify: `frontend_admin/src/services/openapi/notifications.ts`

- [ ] **Step 1: 先写失败测试，约束通知设置读取 `/api/notifications/preferences/` 而不是静态数组**

```tsx
it('loads notification preferences from api and toggles in-app or email channels', async () => {
  vi.mocked(appsNotificationsApiListPreferences).mockResolvedValue([
    { category: 'comments', label: '评论通知', in_app: true, email: false },
  ] as API.NotificationPreferenceOut[]);

  render(<NotificationView />);

  expect(await screen.findByText('评论通知')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: '站内通知' })).toBeChecked();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/components/notification.test.tsx
```

Expected: FAIL，当前组件只渲染假数据，且没有 API 调用。

- [ ] **Step 3: 将通知设置组件改为真实查询和更新通知偏好**

```tsx
const preferencesQuery = useQuery({
  queryKey: ['personal-center', 'notification-preferences'],
  queryFn: () => appsNotificationsApiListPreferences(),
});

const patchMutation = useMutation({
  mutationFn: ({ category, payload }: { category: string; payload: API.NotificationPreferencePatchIn }) =>
    appsNotificationsApiPatchPreference({ category }, payload),
  onSuccess: () => preferencesQuery.refetch(),
});
```

- [ ] **Step 4: 用双开关列表渲染每个通知类别**

```tsx
<List
  dataSource={preferencesQuery.data || []}
  renderItem={(item) => (
    <List.Item
      actions={[
        <Switch
          key="in-app"
          aria-label="站内通知"
          checked={item.in_app}
          onChange={(checked) => patchMutation.mutate({ category: item.category, payload: { in_app: checked } })}
        />,
        <Switch
          key="email"
          aria-label="邮件通知"
          checked={item.email}
          onChange={(checked) => patchMutation.mutate({ category: item.category, payload: { email: checked } })}
        />,
      ]}
    >
      <List.Item.Meta title={item.label || item.category} description={item.category} />
    </List.Item>
  )}
/>
```

- [ ] **Step 5: 运行测试确认通知设置已基于真实接口工作**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/components/notification.test.tsx
```

Expected: PASS，通知设置不再是静态展示。

- [ ] **Step 6: 提交本任务**

```bash
git add frontend_admin/src/pages/account/settings/components/notification.tsx frontend_admin/src/pages/account/settings/components/notification.test.tsx frontend_admin/src/services/openapi/notifications.ts
git commit -m "接入个人中心通知设置"
```

### Task 7: 从个人业务页移除重复的个人设置编辑能力

**Files:**
- Modify: `frontend_admin/src/pages/personal-business/overview/index.tsx`
- Modify: `frontend_admin/src/pages/personal-business/overview/index.test.tsx`

- [ ] **Step 1: 先写失败测试，约束个人业务页不再渲染“个人设置”编辑卡片**

```tsx
it('keeps real-name summary but removes editable personal settings from personal business overview', async () => {
  render(<PersonalBusinessPage />);

  expect(await screen.findByText('我的实名')).toBeInTheDocument();
  expect(screen.queryByText('保存个人设置')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '去个人中心处理' })).toHaveAttribute('href', '/account/center?tab=security');
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/personal-business/overview/index.test.tsx
```

Expected: FAIL，当前页面仍然包含“个人设置”编辑卡片，并跳转到 `/account/settings?tab=real-name`。

- [ ] **Step 3: 删除个人设置卡片，仅保留实名摘要并更新跳转到个人中心**

```tsx
<Button type="link" href="/account/center?tab=security" style={{ paddingInline: 0 }}>
  去个人中心处理
</Button>
```

- [ ] **Step 4: 移除个人业务页中对 `appsSettingsApiListUserSettings`、`appsSettingsApiPutUserSetting`、`appsSettingsApiDeleteUserSettingView` 的依赖**

```tsx
// 删除 userSettingsQuery / settingDetailQuery / putSettingMutation / deleteSettingMutation
// 删除“个人设置”Card 与“个人设置详情”Drawer
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/personal-business/overview/index.test.tsx
```

Expected: PASS，个人业务页只保留业务资产与实名摘要，不再承担个人设置入口。

- [ ] **Step 6: 提交本任务**

```bash
git add frontend_admin/src/pages/personal-business/overview/index.tsx frontend_admin/src/pages/personal-business/overview/index.test.tsx
git commit -m "收口个人业务页的个人设置入口"
```

### Task 8: 端到端整理个人中心回归测试

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/index.test.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/base.test.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/security.test.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/notification.test.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/real-name.test.tsx`

- [ ] **Step 1: 汇总新增回归断言，确保四分组与关键交互都被覆盖**

```tsx
it('navigates across personal center tabs and persists tab in query string', async () => {
  render(<PersonalCenterPage />);

  await user.click(screen.getByRole('menuitem', { name: '通知设置' }));

  expect(window.location.search).toContain('tab=notifications');
});
```

- [ ] **Step 2: 运行个人中心相关测试并确认先暴露剩余回归问题**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/index.test.tsx src/pages/account/settings/components/base.test.tsx src/pages/account/settings/components/security.test.tsx src/pages/account/settings/components/notification.test.tsx src/pages/account/settings/components/real-name.test.tsx
```

Expected: 若仍有旧的五分组断言或旧链接断言，会继续 FAIL。

- [ ] **Step 3: 统一更新测试夹具、mock 与断言命名**

```tsx
window.history.replaceState({}, '', '/account/center?tab=security');
expect(screen.getByText('账号安全')).toBeInTheDocument();
```

- [ ] **Step 4: 重新运行个人中心测试，确认全部通过**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/index.test.tsx src/pages/account/settings/components/*.test.tsx
```

Expected: PASS，个人中心分组、通知偏好、实名、安全设置与资料展示都能稳定回归。

- [ ] **Step 5: 提交本任务**

```bash
git add frontend_admin/src/pages/account/settings/index.test.tsx frontend_admin/src/pages/account/settings/components/base.test.tsx frontend_admin/src/pages/account/settings/components/security.test.tsx frontend_admin/src/pages/account/settings/components/notification.test.tsx frontend_admin/src/pages/account/settings/components/real-name.test.tsx
git commit -m "补齐个人中心回归测试"
```

### Task 9: 做一次整体验证并确认不影响空间设置入口

**Files:**
- Modify: `frontend_admin/src/routes.test.ts`
- Test: `frontend_admin/src/pages/settings-management/organization/index.test.tsx`
- Test: `frontend_admin/src/pages/settings-management/team/index.test.tsx`

- [ ] **Step 1: 运行全量路由与受影响页面测试**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm vitest run src/routes.test.ts src/pages/account/settings/**/*.test.tsx src/pages/personal-business/overview/index.test.tsx src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx
```

Expected: 全部 PASS；若空间设置、团队设置测试受菜单或路由文案影响，需要一起修正。

- [ ] **Step 2: 执行一次前端 lint，确保没有遗留未使用导入和类型问题**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm lint
```

Expected: PASS，无新的 lint 错误。

- [ ] **Step 3: 若 `frontend_admin` 有独立单测入口，再跑一遍相关测试集**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin && nvm use 22 && pnpm test -- --runInBand
```

Expected: PASS；如果仓库实际使用 `vitest run` 而非该命令，按项目现有脚本替换并记录最终命令。

- [ ] **Step 4: 提交本任务**

```bash
git add frontend_admin/src/routes.test.ts
git commit -m "验证个人中心整合不影响空间设置"
```
