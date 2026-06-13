# Frontend Admin 账号绑定闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `frontend_admin` 的 `/account/settings` 账号绑定页基于真实后端状态展示 `GitHub` 与 `微信` 两项，并能通过 allauth 浏览器端 redirect 流程完成绑定后回到绑定页刷新状态。

**Architecture:** 后端在 `apps.accounts` 下新增一个最小的当前用户社交绑定状态接口，只暴露 `github` 与 `weixin` 两项布尔状态。前端管理端在现有 settings service 中追加查询与发起绑定 helper，绑定页组件通过真实接口渲染状态，设置页通过 `?tab=binding` 保持回跳后仍停留在账号绑定视图。

**Tech Stack:** Django 5, django-ninja, django-allauth headless browser client, allauth `SocialAccount`, React 19, Umi Max, Ant Design 6, TanStack Query, Vitest, pytest

---

## File Structure

- Modify: `apps/accounts/schemas.py`
  责任：新增账号绑定页所需的最小响应 schema，保持 `users/me` 路由返回结构清晰。
- Modify: `apps/accounts/api.py`
  责任：新增 `GET /api/users/me/social-bindings/`，基于当前用户 `SocialAccount` 计算 `github` 与 `weixin` 绑定状态。
- Create: `tests/accounts/test_social_bindings_api.py`
  责任：覆盖未登录、未绑定、GitHub 已绑定、微信已绑定、仅小程序已绑定五类关键后端行为。
- Modify: `frontend_admin/src/pages/account/settings/data.d.ts`
  责任：补充账号绑定页使用的前端类型定义。
- Modify: `frontend_admin/src/pages/account/settings/service.ts`
  责任：新增绑定状态查询与 provider redirect 表单提交 helper，复用已有 CSRF 获取逻辑。
- Create: `frontend_admin/src/pages/account/settings/service.test.ts`
  责任：验证状态接口请求与 redirect 表单提交逻辑。
- Modify: `frontend_admin/src/pages/account/settings/components/binding.tsx`
  责任：将静态淘宝/支付宝/钉钉占位替换为真实 GitHub/微信绑定列表、加载态、错误态与点击绑定逻辑。
- Create: `frontend_admin/src/pages/account/settings/components/binding.test.tsx`
  责任：验证页面渲染、文案切换、失败提示与点击绑定行为。
- Modify: `frontend_admin/src/pages/account/settings/index.tsx`
  责任：从 `?tab=` 读取初始选项，并在切换菜单时同步 URL，确保回跳后仍停留在绑定页。
- Create: `frontend_admin/src/pages/account/settings/index.test.tsx`
  责任：验证 `?tab=binding` 会打开账号绑定页，点击菜单后会回写 URL。

### Task 1: 后端社交绑定状态接口

**Files:**
- Modify: `apps/accounts/schemas.py`
- Modify: `apps/accounts/api.py`
- Test: `tests/accounts/test_social_bindings_api.py`

- [ ] **Step 1: 写出后端失败测试，锁定 GitHub / 微信口径**

```python
import pytest

from allauth.socialaccount.models import SocialAccount

from apps.accounts.models import User


@pytest.mark.django_db
def test_social_bindings_requires_login(client):
    response = client.get("/api/users/me/social-bindings/")

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


@pytest.mark.django_db
def test_social_bindings_returns_all_false_when_user_has_no_accounts(client):
    user = User.objects.create_user(username="plain", email="plain@example.com", password="secret123")  # noqa: S106
    client.force_login(user)

    response = client.get("/api/users/me/social-bindings/")

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {"provider": "github", "label": "GitHub", "connected": False},
            {"provider": "weixin", "label": "微信", "connected": False},
        ]
    }


@pytest.mark.django_db
def test_social_bindings_marks_github_when_social_account_exists(client):
    user = User.objects.create_user(username="gh", email="gh@example.com", password="secret123")  # noqa: S106
    SocialAccount.objects.create(user=user, provider="github", uid="gh-001")
    client.force_login(user)

    payload = client.get("/api/users/me/social-bindings/").json()

    assert payload["items"][0] == {"provider": "github", "label": "GitHub", "connected": True}
    assert payload["items"][1] == {"provider": "weixin", "label": "微信", "connected": False}


@pytest.mark.django_db
def test_social_bindings_marks_weixin_when_social_account_exists(client):
    user = User.objects.create_user(username="wx", email="wx@example.com", password="secret123")  # noqa: S106
    SocialAccount.objects.create(user=user, provider="weixin", uid="wx-001")
    client.force_login(user)

    payload = client.get("/api/users/me/social-bindings/").json()

    assert payload["items"][0]["connected"] is False
    assert payload["items"][1] == {"provider": "weixin", "label": "微信", "connected": True}


@pytest.mark.django_db
def test_social_bindings_does_not_treat_wechat_miniprogram_as_weixin(client):
    user = User.objects.create_user(username="mini", email="mini@example.com", password="secret123")  # noqa: S106
    SocialAccount.objects.create(user=user, provider="wechat_miniprogram", uid="mini-001")
    client.force_login(user)

    assert client.get("/api/users/me/social-bindings/").json() == {
        "items": [
            {"provider": "github", "label": "GitHub", "connected": False},
            {"provider": "weixin", "label": "微信", "connected": False},
        ]
    }
```

- [ ] **Step 2: 运行后端测试，确认接口尚未实现时失败**

Run: `docker compose exec web pytest tests/accounts/test_social_bindings_api.py -v`
Expected: FAIL，报 `404` 或 `ImportError`，说明测试已经准确锁住缺失能力。

- [ ] **Step 3: 在 schema 与 API 中补最小实现**

```python
# apps/accounts/schemas.py


class SocialBindingItemOut(Schema):
    provider: str
    label: str
    connected: bool


class SocialBindingsOut(Schema):
    items: list[SocialBindingItemOut]
```

```python
# apps/accounts/api.py
from apps.accounts.schemas import SocialBindingItemOut, SocialBindingsOut


@users_router.get("/me/social-bindings/", response=SocialBindingsOut, summary="获取当前用户社交账号绑定状态")
def get_social_bindings(request):
    """返回当前登录用户在管理端账号绑定页需要展示的社交账号状态。"""
    require_authenticated(request)
    from allauth.socialaccount.models import SocialAccount

    connected_providers = set(
        SocialAccount.objects.filter(user=request.user, provider__in=["github", "weixin"]).values_list("provider", flat=True)
    )
    return {
        "items": [
            {
                "provider": "github",
                "label": "GitHub",
                "connected": "github" in connected_providers,
            },
            {
                "provider": "weixin",
                "label": "微信",
                "connected": "weixin" in connected_providers,
            },
        ]
    }
```

- [ ] **Step 4: 重新运行后端测试，确认接口行为正确**

Run: `docker compose exec web pytest tests/accounts/test_social_bindings_api.py -v`
Expected: `5 passed`

- [ ] **Step 5: 提交后端接口改动**

```bash
git add apps/accounts/schemas.py apps/accounts/api.py tests/accounts/test_social_bindings_api.py
git commit -m "补充账号绑定状态查询接口"
```

### Task 2: 管理端 settings service 增加绑定查询与 redirect helper

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/data.d.ts`
- Modify: `frontend_admin/src/pages/account/settings/service.ts`
- Test: `frontend_admin/src/pages/account/settings/service.test.ts`

- [ ] **Step 1: 先写 service 失败测试，锁定接口请求与表单提交行为**

```ts
import { request } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { querySocialBindings, startSocialBinding } from './service';

vi.mock('@umijs/max', () => ({
  request: vi.fn(),
}));

const mockRequest = vi.mocked(request);

describe('account settings service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: 'csrftoken=test-csrf-token',
    });
    document.body.innerHTML = '';
  });

  it('queries current social binding states from the dedicated api', async () => {
    mockRequest.mockResolvedValueOnce({
      items: [
        { provider: 'github', label: 'GitHub', connected: false },
        { provider: 'weixin', label: '微信', connected: true },
      ],
    });

    const result = await querySocialBindings();

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/users/me/social-bindings/',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(result.items[1]).toEqual({ provider: 'weixin', label: '微信', connected: true });
  });

  it('submits a top-level form post to the allauth provider redirect endpoint', async () => {
    const submit = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'form') {
        Object.defineProperty(element, 'submit', { value: submit });
      }
      return element;
    }) as typeof document.createElement);

    await startSocialBinding('github');

    const form = document.body.querySelector('form');
    expect(form?.getAttribute('action')).toBe('/api/allauth/browser/v1/auth/provider/redirect');
    expect(form?.getAttribute('method')).toBe('POST');
    expect(form?.querySelector('input[name="provider"]')?.getAttribute('value')).toBe('github');
    expect(form?.querySelector('input[name="process"]')?.getAttribute('value')).toBe('login');
    expect(form?.querySelector('input[name="csrfmiddlewaretoken"]')?.getAttribute('value')).toBe('test-csrf-token');
    expect(form?.querySelector('input[name="callback_url"]')?.getAttribute('value')).toBe('http://localhost/account/settings?tab=binding');
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行前端 service 测试，确认 helper 还不存在时失败**

Run: `pnpm --dir frontend_admin test -- src/pages/account/settings/service.test.ts`
Expected: FAIL，提示 `querySocialBindings` / `startSocialBinding` 未导出或行为不匹配。

- [ ] **Step 3: 在类型与 service 中加入最小实现**

```ts
// frontend_admin/src/pages/account/settings/data.d.ts
export type SocialBindingProvider = 'github' | 'weixin';

export type SocialBindingItem = {
  provider: SocialBindingProvider;
  label: string;
  connected: boolean;
};
```

```ts
// frontend_admin/src/pages/account/settings/service.ts
export async function querySocialBindings(): Promise<{ items: SocialBindingItem[] }> {
  return request('/api/users/me/social-bindings/', {
    credentials: 'include',
    method: 'GET',
  });
}

export async function startSocialBinding(provider: SocialBindingProvider) {
  const csrfToken = await ensureCsrfToken();
  const callbackUrl = `${window.location.origin}/account/settings?tab=binding`;
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${ALLAUTH_BROWSER_BASE}/auth/provider/redirect`;
  form.style.display = 'none';

  [
    ['csrfmiddlewaretoken', csrfToken],
    ['provider', provider],
    ['callback_url', callbackUrl],
    ['process', 'login'],
  ].forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
```

- [ ] **Step 4: 重新运行前端 service 测试，确认请求与 redirect 表单正确**

Run: `pnpm --dir frontend_admin test -- src/pages/account/settings/service.test.ts`
Expected: `2 passed`

- [ ] **Step 5: 提交 service 层改动**

```bash
git add frontend_admin/src/pages/account/settings/data.d.ts frontend_admin/src/pages/account/settings/service.ts frontend_admin/src/pages/account/settings/service.test.ts
git commit -m "补充管理端账号绑定 service"
```

### Task 3: 账号绑定组件切到真实数据与点击绑定逻辑

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/components/binding.tsx`
- Test: `frontend_admin/src/pages/account/settings/components/binding.test.tsx`

- [ ] **Step 1: 写组件失败测试，覆盖渲染、错误态和点击绑定**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BindingView from './binding';

const { mockQuerySocialBindings, mockStartSocialBinding, mockMessageError } = vi.hoisted(() => ({
  mockQuerySocialBindings: vi.fn(),
  mockStartSocialBinding: vi.fn(),
  mockMessageError: vi.fn(),
}));

vi.mock('../service', () => ({
  querySocialBindings: mockQuerySocialBindings,
  startSocialBinding: mockStartSocialBinding,
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      error: mockMessageError,
    },
  };
});

describe('BindingView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  it('renders GitHub and 微信 using the api result', async () => {
    mockQuerySocialBindings.mockResolvedValue({
      items: [
        { provider: 'github', label: 'GitHub', connected: false },
        { provider: 'weixin', label: '微信', connected: true },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BindingView />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('当前未绑定 GitHub 账号')).toBeInTheDocument();
      expect(screen.getByText('当前已绑定微信账号')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '绑定 GitHub' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '绑定 微信' })).not.toBeInTheDocument();
  });

  it('starts provider binding when the bind action is clicked', async () => {
    mockQuerySocialBindings.mockResolvedValue({
      items: [
        { provider: 'github', label: 'GitHub', connected: false },
        { provider: 'weixin', label: '微信', connected: false },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BindingView />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '绑定 GitHub' }));

    await waitFor(() => {
      expect(mockStartSocialBinding).toHaveBeenCalledWith('github');
    });
  });

  it('shows an error message when the bindings query fails', async () => {
    mockQuerySocialBindings.mockRejectedValue(new Error('boom'));

    render(
      <QueryClientProvider client={queryClient}>
        <BindingView />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('账号绑定状态加载失败，请刷新重试')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: 运行组件测试，确认静态实现不满足需求**

Run: `pnpm --dir frontend_admin test -- src/pages/account/settings/components/binding.test.tsx`
Expected: FAIL，因页面仍渲染淘宝/支付宝/钉钉且没有真实点击逻辑。

- [ ] **Step 3: 将 binding 组件改成真实查询与触发绑定**

```tsx
import { GithubOutlined, WechatOutlined } from '@ant-design/icons';
import { Alert, Button, List, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { querySocialBindings, startSocialBinding } from '../service';

const iconMap = {
  github: <GithubOutlined />,
  weixin: <WechatOutlined />,
};

const BindingView: React.FC = () => {
  const { data, error, isLoading } = useQuery({
    queryKey: ['social-bindings'],
    queryFn: querySocialBindings,
  });

  if (isLoading) {
    return <Spin />;
  }

  if (error) {
    return <Alert type="error" message="账号绑定状态加载失败，请刷新重试" showIcon />;
  }

  return (
    <List
      itemLayout="horizontal"
      dataSource={data?.items || []}
      renderItem={(item) => {
        const description = item.connected ? `当前已绑定${item.label}账号` : `当前未绑定 ${item.label} 账号`;
        return (
          <List.Item
            actions={
              item.connected
                ? [<span key={`${item.provider}-connected`}>已绑定</span>]
                : [
                    <Button key={`${item.provider}-bind`} type="link" onClick={() => startSocialBinding(item.provider)}>
                      {`绑定 ${item.label}`}
                    </Button>,
                  ]
            }
          >
            <List.Item.Meta avatar={iconMap[item.provider]} title={item.label} description={description} />
          </List.Item>
        );
      }}
    />
  );
};
```

- [ ] **Step 4: 重新运行组件测试，确认绑定页只展示真实 provider**

Run: `pnpm --dir frontend_admin test -- src/pages/account/settings/components/binding.test.tsx`
Expected: `3 passed`

- [ ] **Step 5: 提交绑定页组件改动**

```bash
git add frontend_admin/src/pages/account/settings/components/binding.tsx frontend_admin/src/pages/account/settings/components/binding.test.tsx
git commit -m "改造管理端账号绑定展示与点击逻辑"
```

### Task 4: settings 页同步 `?tab=binding`，保证回跳后仍落在账号绑定页

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/index.tsx`
- Test: `frontend_admin/src/pages/account/settings/index.test.tsx`

- [ ] **Step 1: 先写 URL 同步失败测试，锁定回跳场景**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from './index';

vi.mock('./components/base', () => ({ default: () => <div>基本设置内容</div> }));
vi.mock('./components/security', () => ({ default: () => <div>安全设置内容</div> }));
vi.mock('./components/binding', () => ({ default: () => <div>账号绑定内容</div> }));
vi.mock('./components/notification', () => ({ default: () => <div>消息通知内容</div> }));
vi.mock('./style.style', () => ({
  default: () => ({
    styles: { main: 'main', leftMenu: 'leftMenu', right: 'right', title: 'title' },
  }),
}));

describe('Settings page tab sync', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/account/settings?tab=binding');
  });

  it('opens binding view when the url tab param is binding', () => {
    render(<Settings />);

    expect(screen.getByText('账号绑定内容')).toBeInTheDocument();
    expect(screen.getByText('账号绑定')).toBeInTheDocument();
  });

  it('writes the selected tab back to the url', () => {
    window.history.replaceState({}, '', '/account/settings');
    render(<Settings />);

    fireEvent.click(screen.getByText('账号绑定'));

    expect(window.location.search).toContain('tab=binding');
  });
});
```

- [ ] **Step 2: 运行 settings 页测试，确认当前实现不会读取 query 参数**

Run: `pnpm --dir frontend_admin test -- src/pages/account/settings/index.test.tsx`
Expected: FAIL，因默认仍停留在 `base`，且点击菜单不会写回 `tab`。

- [ ] **Step 3: 在 settings 页加入 tab 读写逻辑**

```tsx
type SettingsStateKeys = 'base' | 'security' | 'binding' | 'notification';

const isSettingsTab = (value: string | null): value is SettingsStateKeys => {
  return value === 'base' || value === 'security' || value === 'binding' || value === 'notification';
};

const getInitialSelectKey = (): SettingsStateKeys => {
  const tab = new URLSearchParams(window.location.search).get('tab');
  return isSettingsTab(tab) ? tab : 'base';
};

const Settings: React.FC = () => {
  const [initConfig, setInitConfig] = useState<SettingsState>({
    mode: 'inline',
    selectKey: getInitialSelectKey(),
  });

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', initConfig.selectKey);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', nextUrl);
  }, [initConfig.selectKey]);

  // 其余逻辑保持不变
};
```

- [ ] **Step 4: 运行 settings 页测试和绑定页相关测试，确认回跳落点稳定**

Run: `pnpm --dir frontend_admin test -- src/pages/account/settings/index.test.tsx src/pages/account/settings/components/binding.test.tsx src/pages/account/settings/service.test.ts`
Expected: 所有测试 PASS，且 `index.test.tsx` 验证 `tab=binding` 场景可用。

- [ ] **Step 5: 提交 URL 同步改动**

```bash
git add frontend_admin/src/pages/account/settings/index.tsx frontend_admin/src/pages/account/settings/index.test.tsx
git commit -m "补充账号绑定页回跳 tab 同步"
```

### Task 5: 全量验证与收尾

**Files:**
- Modify: 无新增代码，聚焦验证
- Test: `tests/accounts/test_social_bindings_api.py`
- Test: `frontend_admin/src/pages/account/settings/service.test.ts`
- Test: `frontend_admin/src/pages/account/settings/components/binding.test.tsx`
- Test: `frontend_admin/src/pages/account/settings/index.test.tsx`

- [ ] **Step 1: 运行后端定向验证**

Run: `docker compose exec web pytest tests/accounts/test_social_bindings_api.py tests/base/test_ant_design_pro_auth_api.py -v`
Expected: PASS，确认新增接口未破坏现有 `/api/users/me/` 和 allauth browser mount。

- [ ] **Step 2: 运行前端定向验证**

Run: `pnpm --dir frontend_admin test -- src/pages/account/settings/service.test.ts src/pages/account/settings/components/binding.test.tsx src/pages/account/settings/index.test.tsx src/pages/account/settings/components/base.test.tsx`
Expected: PASS，确认 settings 页已有基本资料测试未被账号绑定改造破坏。

- [ ] **Step 3: 做一次管理端构建验证**

Run: `pnpm --dir frontend_admin build`
Expected: BUILD SUCCESS，无 TypeScript / route / import 错误。

- [ ] **Step 4: 检查工作区并整理最终提交**

```bash
git status --short
```

Expected: 只剩本计划范围内文件变更；若出现无关脏文件，不回滚他人修改，只核对本次改动文件集。

- [ ] **Step 5: 提交最终验证修正**

```bash
git add apps/accounts/schemas.py apps/accounts/api.py tests/accounts/test_social_bindings_api.py frontend_admin/src/pages/account/settings/data.d.ts frontend_admin/src/pages/account/settings/service.ts frontend_admin/src/pages/account/settings/service.test.ts frontend_admin/src/pages/account/settings/components/binding.tsx frontend_admin/src/pages/account/settings/components/binding.test.tsx frontend_admin/src/pages/account/settings/index.tsx frontend_admin/src/pages/account/settings/index.test.tsx
git commit -m "完成管理端账号绑定页闭环"
```

## Self-Review

- **Spec coverage:**
  - “只展示 GitHub 和微信两项” 由 Task 1 的接口返回固定 provider 列表和 Task 3 的绑定页渲染共同覆盖。
  - “微信严格指 `weixin`” 由 Task 1 的 `wechat_miniprogram` 回归测试覆盖。
  - “点击绑定复用 allauth 浏览器端 redirect 流程” 由 Task 2 的 `startSocialBinding()` 表单 POST 覆盖。
  - “回跳后仍留在绑定页并刷新状态” 由 Task 4 的 `?tab=binding` 同步与 Task 3 的查询渲染覆盖。
  - “不做解绑” 在全部任务中都没有新增解绑入口或接口。
- **Placeholder scan:** 已避免空泛占位描述；每个任务都给了明确文件、命令和代码草稿。
- **Type consistency:** `provider` 口径始终只有 `github | weixin`；后端接口 `items[].connected`、前端 `SocialBindingItem`、组件渲染与测试断言保持一致。
