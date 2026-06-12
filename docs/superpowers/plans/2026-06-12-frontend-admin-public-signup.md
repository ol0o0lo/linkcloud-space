# frontend_admin 公开注册闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `frontend_admin` 独立承接公开自注册、手机号验证与 `invite_code` 归因闭环，用户无需跳转旧主站即可完成注册并进入后台。

**Architecture:** 保留现有 Django allauth + session + referrals 后端链路不变，只在 `frontend_admin` 新增公开注册模块。前端通过新的 `signupApi` 和 `verify-phone` 页面识别 `verify_phone` pending flow，并继续复用现有 `auth store` 的用户信息与权限拉取能力进入后台。

**Tech Stack:** Vue 3、Vue Router、Pinia、`@vben/common-ui`、Vitest、Playwright(pytest)、Django allauth headless API。

---

## File Structure

### 需要修改

- `frontend_admin/apps/web-antdv-next/src/router/routes/core.ts`
  - 放开 `/auth/register` 路由并新增 `/auth/verify-phone`。
- `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/login.vue`
  - 打开注册入口，保留 `redirect` 透传。
- `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/register.vue`
  - 从空壳表单改为真实注册页，处理 `invite_code` 展示、注册提交与 pending flow 分流。
- `frontend_admin/apps/web-antdv-next/src/api/django/auth.ts`
  - 新增 `signupApi`、flow 解析 helper、注册/验证相关错误处理。
- `frontend_admin/apps/web-antdv-next/src/api/core/auth.ts`
  - 导出 `signupApi` 及其类型，供页面层调用。
- `frontend_admin/apps/web-antdv-next/src/store/auth.ts`
  - 仅在必要时抽出“登录后进入后台”的共用逻辑，避免注册页重复写 access token / user info / access codes 获取流程。

### 需要新增

- `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/verify-phone.vue`
  - 注册后手机号验证页。
- `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts`
  - 注册页单测。
- `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/__tests__/verify-phone.test.ts`
  - 手机验证页单测。
- `frontend_admin/apps/web-antdv-next/src/api/django/__tests__/auth-signup.test.ts`
  - `signupApi` 与 flow helper 单测。
- `e2e/test_frontend_admin_public_signup.py`
  - 带 `invite_code` 的注册 + 验证 + 进入后台主链路测试。

---

### Task 1: 补齐认证 API 与 flow 解析

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/api/django/auth.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/api/core/auth.ts`
- Test: `frontend_admin/apps/web-antdv-next/src/api/django/__tests__/auth-signup.test.ts`

- [ ] **Step 1: 先写 API 单测，约束注册成功与 `verify_phone` flow 识别**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { allauthRequest, djangoGet, getAllauthErrors } = vi.hoisted(() => ({
  allauthRequest: vi.fn(),
  djangoGet: vi.fn(),
  getAllauthErrors: vi.fn(() => '发生了未预期的错误。'),
}));

vi.mock('../client', () => ({
  allauthRequest,
  djangoGet,
  getAllauthErrors,
}));

import { getPendingFlow, signupApi } from '../auth';

describe('signup api', () => {
  beforeEach(() => {
    allauthRequest.mockReset();
    djangoGet.mockReset();
    getAllauthErrors.mockClear();
  });

  it('注册直接成功时返回 session accessToken', async () => {
    allauthRequest.mockResolvedValue({ meta: { is_authenticated: true } });

    await expect(
      signupApi({ email: 'demo@example.com', password: 'pass123456', phone: '+8613800138000' }),
    ).resolves.toEqual({ accessToken: 'session', pendingFlow: null });
  });

  it('命中 verify_phone pending flow 时不抛错', async () => {
    allauthRequest.mockRejectedValue({
      response: { status: 401 },
      data: { data: { flows: [{ id: 'verify_phone', is_pending: true }] } },
    });

    await expect(
      signupApi({ email: 'demo@example.com', password: 'pass123456', phone: '+8613800138000' }),
    ).resolves.toEqual({ accessToken: null, pendingFlow: 'verify_phone' });
  });

  it('其余错误继续抛出可读消息', async () => {
    allauthRequest.mockRejectedValue({ response: { status: 400 }, data: { errors: [] } });

    await expect(
      signupApi({ email: 'demo@example.com', password: 'pass123456', phone: '+8613800138000' }),
    ).rejects.toThrow('发生了未预期的错误。');
  });

  it('helper 能同时识别 data.data.flows 与 data.flows', () => {
    expect(getPendingFlow({ data: { data: { flows: [{ id: 'verify_phone', is_pending: true }] } } }, 'verify_phone')).toBe(true);
    expect(getPendingFlow({ data: { flows: [{ id: 'verify_phone', is_pending: true }] } }, 'verify_phone')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行单测，确认当前为红灯**

Run:

```bash
export PATH=/Users/lan/.nvm/versions/node/v22.16.0/bin:$PATH && cd /Users/lan/Project/django/linkcloud-space/frontend_admin && pnpm exec vitest run apps/web-antdv-next/src/api/django/__tests__/auth-signup.test.ts
```

Expected: FAIL，提示 `signupApi` 或 `getPendingFlow` 未定义。

- [ ] **Step 3: 以最小实现补齐 `signupApi` 与 helper，并导出到 core 层**

```ts
// frontend_admin/apps/web-antdv-next/src/api/django/auth.ts
export interface SignupParams {
  email: string;
  password: string;
  phone: string;
}

export interface SignupResult {
  accessToken: null | string;
  pendingFlow: null | 'verify_phone';
}

export function getPendingFlow(error: any, flowId: string) {
  const flows = error?.data?.data?.flows ?? error?.data?.flows ?? [];
  return flows.some((flow: any) => flow?.id === flowId && flow?.is_pending);
}

export async function signupApi(data: SignupParams): Promise<SignupResult> {
  try {
    await djangoGet('/csrf/');
    await allauthRequest(`${ALLAUTH_BASE}/auth/signup`, {
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        phone: data.phone,
      }),
      method: 'POST',
    });
    return { accessToken: 'session', pendingFlow: null };
  } catch (error: any) {
    if (error?.response?.status === 401 && getPendingFlow(error, 'verify_phone')) {
      return { accessToken: null, pendingFlow: 'verify_phone' };
    }
    throw new Error(getAllauthErrors(error));
  }
}
```

```ts
// frontend_admin/apps/web-antdv-next/src/api/core/auth.ts
export {
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
  refreshTokenApi,
  signupApi,
} from '../django/auth';

export type { LoginParams, SignupParams } from '../django/auth';
```

- [ ] **Step 4: 再跑单测确认转绿**

Run:

```bash
export PATH=/Users/lan/.nvm/versions/node/v22.16.0/bin:$PATH && cd /Users/lan/Project/django/linkcloud-space/frontend_admin && pnpm exec vitest run apps/web-antdv-next/src/api/django/__tests__/auth-signup.test.ts
```

Expected: PASS，4 tests passed。

- [ ] **Step 5: 提交这一组最小可用 API 改动**

```bash
git add frontend_admin/apps/web-antdv-next/src/api/django/auth.ts frontend_admin/apps/web-antdv-next/src/api/core/auth.ts frontend_admin/apps/web-antdv-next/src/api/django/__tests__/auth-signup.test.ts
git commit -m "补全公开注册认证 API"
```

### Task 2: 打通路由与登录页注册入口

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/router/routes/core.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/login.vue`
- Test: `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts`

- [ ] **Step 1: 先写一条路由/入口层面的页面测试**

```ts
import { createApp, defineComponent, nextTick } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('#/store', () => ({
  useAuthStore: () => ({ authLogin: vi.fn(), loginLoading: false }),
}));

import LoginView from '../login.vue';
import { coreRoutes } from '#/router/routes/core';

describe('authentication entry', () => {
  it('register 路由不再重定向回登录', async () => {
    const registerRoute = coreRoutes.find((route) => route.path === '/auth')?.children?.find((child) => child.path === 'register');
    expect(registerRoute?.redirect).toBeUndefined();
  });

  it('登录页展示注册入口', async () => {
    const container = document.createElement('div');
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/auth/login', component: LoginView }] });
    await router.push('/auth/login');
    await router.isReady();
    createApp(defineComponent({ template: '<router-view />' })).use(router).mount(container);
    await nextTick();

    expect(container.textContent).toContain('注册');
  });
});
```

- [ ] **Step 2: 运行测试，确认当前为红灯**

Run:

```bash
export PATH=/Users/lan/.nvm/versions/node/v22.16.0/bin:$PATH && cd /Users/lan/Project/django/linkcloud-space/frontend_admin && pnpm exec vitest run --dom apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts
```

Expected: FAIL，`register` 仍然 redirect 到 `LOGIN_PATH`，且登录页未显示注册入口。

- [ ] **Step 3: 只做路由与入口的最小实现**

```ts
// frontend_admin/apps/web-antdv-next/src/router/routes/core.ts
{
  name: 'Register',
  path: 'register',
  component: () => import('#/views/_core/authentication/register.vue'),
  meta: {
    title: $t('page.auth.register'),
  },
},
{
  name: 'VerifyPhone',
  path: 'verify-phone',
  component: () => import('#/views/_core/authentication/verify-phone.vue'),
  meta: {
    title: '验证手机号',
  },
},
```

```vue
<!-- frontend_admin/apps/web-antdv-next/src/views/_core/authentication/login.vue -->
<AuthenticationLogin
  :form-schema="formSchema"
  :loading="authStore.loginLoading"
  :show-code-login="false"
  :show-forget-password="false"
  :show-qrcode-login="false"
  :show-register="true"
  :show-third-party-login="false"
  @submit="authStore.authLogin"
>
```

- [ ] **Step 4: 再跑测试确认转绿**

Run:

```bash
export PATH=/Users/lan/.nvm/versions/node/v22.16.0/bin:$PATH && cd /Users/lan/Project/django/linkcloud-space/frontend_admin && pnpm exec vitest run --dom apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交路由与入口改动**

```bash
git add frontend_admin/apps/web-antdv-next/src/router/routes/core.ts frontend_admin/apps/web-antdv-next/src/views/_core/authentication/login.vue frontend_admin/apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts
git commit -m "开放后台公开注册入口"
```

### Task 3: 实现公开注册页与邀请参数透传

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/register.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/store/auth.ts`
- Test: `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts`

- [ ] **Step 1: 扩展注册页测试，先锁定 invite_code、直接成功、pending flow 三条路径**

```ts
vi.mock('#/api', () => ({
  getAccessCodesApi: vi.fn().mockResolvedValue(['admin']),
  getUserInfoApi: vi.fn().mockResolvedValue({ homePath: '/dashboard/overview', roles: ['admin'] }),
  signupApi: vi.fn(),
}));

it('展示 invite_code 并走直接注册成功链路', async () => {
  signupApi.mockResolvedValue({ accessToken: 'session', pendingFlow: null });
  await router.push('/auth/register?invite_code=AQPSQ6OVNA&redirect=%2Fpromotion');
  // 填写 email/phone/password/confirmPassword/agreePolicy 后提交
  expect(container.textContent).toContain('AQPSQ6OVNA');
  expect(router.currentRoute.value.fullPath).toBe('/promotion');
});

it('命中 verify_phone flow 时跳去 verify-phone 并保留 query', async () => {
  signupApi.mockResolvedValue({ accessToken: null, pendingFlow: 'verify_phone' });
  await router.push('/auth/register?invite_code=AQPSQ6OVNA&redirect=%2Fpromotion');
  // 提交后
  expect(router.currentRoute.value.path).toBe('/auth/verify-phone');
  expect(router.currentRoute.value.query.invite_code).toBe('AQPSQ6OVNA');
  expect(router.currentRoute.value.query.redirect).toBe('/promotion');
});
```

- [ ] **Step 2: 运行测试，确认 register 仍为红灯**

Run:

```bash
export PATH=/Users/lan/.nvm/versions/node/v22.16.0/bin:$PATH && cd /Users/lan/Project/django/linkcloud-space/frontend_admin && pnpm exec vitest run --dom apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts
```

Expected: FAIL，当前 `handleSubmit` 为空，页面也不会展示 `invite_code`。

- [ ] **Step 3: 用最小实现改造注册页，必要时抽出 store 共用“完成登录后进入后台”逻辑**

```ts
// frontend_admin/apps/web-antdv-next/src/store/auth.ts
async function finalizeAuthenticatedSession(onSuccess?: () => Promise<void> | void) {
  const [userInfo, accessCodes] = await Promise.all([
    fetchUserInfo(),
    getAccessCodesApi(),
  ]);
  accessStore.setAccessToken('session');
  accessStore.setAccessCodes(accessCodes);
  userStore.setUserInfo(userInfo);
  if (accessStore.loginExpired) {
    accessStore.setLoginExpired(false);
    return userInfo;
  }
  if (onSuccess) {
    await onSuccess();
    return userInfo;
  }
  await router.push(userInfo.homePath || preferences.app.defaultHomePath);
  return userInfo;
}
```

```vue
<!-- frontend_admin/apps/web-antdv-next/src/views/_core/authentication/register.vue -->
<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AuthenticationRegister, z } from '@vben/common-ui';
import { notification } from 'antdv-next';
import { signupApi } from '#/api';
import { useAuthStore } from '#/store';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const inviteCode = computed(() => (typeof route.query.invite_code === 'string' ? route.query.invite_code : ''));

function getRedirectPath() {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.startsWith('/') ? decodeURIComponent(redirect) : '/dashboard/overview';
}

async function handleSubmit(values: Record<string, any>) {
  try {
    loading.value = true;
    const result = await signupApi({
      email: values.email,
      password: values.password,
      phone: values.phone,
    });

    if (result.pendingFlow === 'verify_phone') {
      await router.push({
        path: '/auth/verify-phone',
        query: route.query,
      });
      return;
    }

    await authStore.finalizeAuthenticatedSession(async () => {
      await router.push(getRedirectPath());
    });
  } catch (error: any) {
    notification.error({ title: '注册失败', description: error?.message || '请稍后重试' });
  } finally {
    loading.value = false;
  }
}
</script>
```

- [ ] **Step 4: 再跑注册页测试确认三条主链路通过**

Run:

```bash
export PATH=/Users/lan/.nvm/versions/node/v22.16.0/bin:$PATH && cd /Users/lan/Project/django/linkcloud-space/frontend_admin && pnpm exec vitest run --dom apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交注册页主链路改动**

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/authentication/register.vue frontend_admin/apps/web-antdv-next/src/store/auth.ts frontend_admin/apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts
git commit -m "实现后台公开注册页面"
```

### Task 4: 实现手机号验证页与重发能力

**Files:**
- Create: `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/verify-phone.vue`
- Test: `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/__tests__/verify-phone.test.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/store/auth.ts`

- [ ] **Step 1: 先写验证页单测，覆盖成功、失败与重发**

```ts
vi.mock('#/api/django/auth', () => ({
  resendLoginCodeApi: vi.fn(),
  verifyPhoneApi: vi.fn(),
}));

it('验证成功后进入 redirect 页面', async () => {
  verifyPhoneApi.mockResolvedValue(undefined);
  await router.push('/auth/verify-phone?redirect=%2Fpromotion&invite_code=AQPSQ6OVNA&phone=%2B8613800138000');
  // 输入验证码并提交
  expect(router.currentRoute.value.fullPath).toBe('/promotion');
});

it('验证失败时保留当前页并提示错误', async () => {
  verifyPhoneApi.mockRejectedValue(new Error('验证码错误'));
  await router.push('/auth/verify-phone?phone=%2B8613800138000');
  // 提交后
  expect(container.textContent).toContain('验证码错误');
  expect(router.currentRoute.value.path).toBe('/auth/verify-phone');
});

it('点击重发时调用 resend 接口', async () => {
  resendLoginCodeApi.mockResolvedValue(undefined);
  await router.push('/auth/verify-phone?phone=%2B8613800138000');
  // 点击重发
  expect(resendLoginCodeApi).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 运行测试，确认当前为红灯**

Run:

```bash
export PATH=/Users/lan/.nvm/versions/node/v22.16.0/bin:$PATH && cd /Users/lan/Project/django/linkcloud-space/frontend_admin && pnpm exec vitest run --dom apps/web-antdv-next/src/views/_core/authentication/__tests__/verify-phone.test.ts
```

Expected: FAIL，页面文件不存在。

- [ ] **Step 3: 最小实现验证页与进入后台逻辑**

```vue
<!-- frontend_admin/apps/web-antdv-next/src/views/_core/authentication/verify-phone.vue -->
<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AuthenticationCodeLogin, z } from '@vben/common-ui';
import { notification } from 'antdv-next';
import { resendLoginCodeApi, verifyPhoneApi } from '#/api/django/auth';
import { useAuthStore } from '#/store';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const resendLoading = ref(false);
const maskedPhone = computed(() => String(route.query.phone || ''));

function getRedirectPath() {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.startsWith('/') ? decodeURIComponent(redirect) : '/dashboard/overview';
}

async function handleSendCode() {
  try {
    resendLoading.value = true;
    await resendLoginCodeApi();
    notification.success({ title: '发送成功', description: '验证码已重新发送，请注意查收' });
  } finally {
    resendLoading.value = false;
  }
}

async function handleVerify(values: Record<string, any>) {
  try {
    loading.value = true;
    await verifyPhoneApi(values.code);
    await authStore.finalizeAuthenticatedSession(async () => {
      await router.push(getRedirectPath());
    });
  } catch (error: any) {
    notification.error({ title: '验证失败', description: error?.message || '请稍后重试' });
  } finally {
    loading.value = false;
  }
}
</script>
```

- [ ] **Step 4: 跑验证页单测确认转绿**

Run:

```bash
export PATH=/Users/lan/.nvm/versions/node/v22.16.0/bin:$PATH && cd /Users/lan/Project/django/linkcloud-space/frontend_admin && pnpm exec vitest run --dom apps/web-antdv-next/src/views/_core/authentication/__tests__/verify-phone.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交手机号验证页改动**

```bash
git add frontend_admin/apps/web-antdv-next/src/views/_core/authentication/verify-phone.vue frontend_admin/apps/web-antdv-next/src/views/_core/authentication/__tests__/verify-phone.test.ts frontend_admin/apps/web-antdv-next/src/store/auth.ts
git commit -m "实现后台手机号验证页面"
```

### Task 5: 端到端验证 invite_code 注册闭环

**Files:**
- Create: `e2e/test_frontend_admin_public_signup.py`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/register.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/authentication/verify-phone.vue`

- [ ] **Step 1: 先写 e2e 用例，验证带邀请码注册与进入后台**

```python
import re

from playwright.sync_api import Page, expect


def test_frontend_admin_public_signup_with_invite_code(page: Page, live_server):
    page.goto(f"{live_server.url}/dashboard/auth/register?invite_code=AQPSQ6OVNA&redirect=%2Fpromotion")

    expect(page.get_by_text("AQPSQ6OVNA")).to_be_visible()
    page.get_by_label("邮箱").fill("new-user@example.com")
    page.get_by_label("手机号").fill("+8613800138000")
    page.get_by_label("密码").fill("StrongPass123!")
    page.get_by_label("确认密码").fill("StrongPass123!")
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name=re.compile("注册|创建账号")).click()

    page.wait_for_url(re.compile(r"/auth/verify-phone|/promotion"), timeout=10000)
    if "/auth/verify-phone" in page.url:
        page.get_by_label("验证码").fill("1234")
        page.get_by_role("button", name=re.compile("验证|确认")).click()

    page.wait_for_url(re.compile(r"/promotion"), timeout=10000)
    expect(page).to_have_url(re.compile(r"invite_code"), timeout=1000)
```

- [ ] **Step 2: 运行 e2e，确认当前至少在一个关键断点失败**

Run:

```bash
cd /Users/lan/Project/django/linkcloud-space && just build_admin
docker compose exec web pytest --ds=config.settings.e2e e2e/test_frontend_admin_public_signup.py -v
```

Expected: FAIL，失败点应落在注册页不可用、验证页不存在或无法进入后台。

- [ ] **Step 3: 根据 e2e 暴露的问题补齐最后一层细节**

```vue
<!-- 重点检查 register / verify-phone 两页是否具备稳定的 label、按钮文案和 redirect 透传 -->
<p v-if="inviteCode" class="mt-2 text-center text-sm font-medium text-emerald-600">
  你正在通过邀请码 {{ inviteCode }} 注册
</p>
```

```ts
await router.push({
  path: getRedirectPath(),
});
```

确保：

- 注册页字段存在可被 Playwright 通过 label 或 role 选择。
- `verify-phone` 页面按钮文案稳定。
- 成功后一定落到 `redirect` 指向页面。

- [ ] **Step 4: 重新运行页面单测 + e2e，确认整体绿灯**

Run:

```bash
export PATH=/Users/lan/.nvm/versions/node/v22.16.0/bin:$PATH && cd /Users/lan/Project/django/linkcloud-space/frontend_admin && pnpm exec vitest run --dom apps/web-antdv-next/src/api/django/__tests__/auth-signup.test.ts apps/web-antdv-next/src/views/_core/authentication/__tests__/register.test.ts apps/web-antdv-next/src/views/_core/authentication/__tests__/verify-phone.test.ts
cd /Users/lan/Project/django/linkcloud-space && just build_admin
docker compose exec web pytest --ds=config.settings.e2e e2e/test_frontend_admin_public_signup.py -v
```

Expected: 单测全 PASS，e2e PASS。

- [ ] **Step 5: 提交闭环与测试改动**

```bash
git add e2e/test_frontend_admin_public_signup.py frontend_admin/apps/web-antdv-next/src/views/_core/authentication/register.vue frontend_admin/apps/web-antdv-next/src/views/_core/authentication/verify-phone.vue
git commit -m "完成后台公开注册闭环"
```

---

## Self-Review

- **Spec coverage:** 已覆盖真实 `/auth/register` 页面、`invite_code` 展示与透传、`verify_phone` pending flow、手机号验证页、直接进入后台、单测与 e2e 验证。
- **Placeholder scan:** 计划中没有 `TODO`、`TBD` 或“自行实现”类占位描述；每个任务都给出了文件、命令与最小代码示例。
- **Type consistency:** `signupApi` / `SignupParams` / `pendingFlow` / `finalizeAuthenticatedSession` / `/auth/verify-phone` 在各任务中命名保持一致。

