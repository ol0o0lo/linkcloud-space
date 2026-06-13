# frontend_admin 安全设置页实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `frontend_admin` 的“安全设置”页从模板占位切换为真实可用的账户安全页，完成密码修改、手机号变更、邮箱管理和 MFA 管理闭环。

**Architecture:** 后端最大化复用 `django-allauth` 的 browser API，直接使用 `/api/allauth/browser/v1/account/password/change`、`/account/email`、`/account/phone` 和 `/auth/phone/verify`，仅为“当前登录用户自助解绑 MFA 认证器”补最小接口。前端保持现有设置页结构，但把 `security.tsx` 改造成“状态列表 + 独立弹窗”模式，把接口解析、脱敏文案和错误映射收敛到安全模块内部。

**Tech Stack:** Django 5, django-ninja, django-allauth headless, pytest, React, Ant Design Pro, Vitest, React Testing Library, @tanstack/react-query, Ant Design

---

## 文件结构

### 后端

- Create: `tests/accounts/test_manage_phone_change_flow.py`
  - 为已登录用户手机号变更补 allauth 回归测试。
- Modify: `apps/accounts/api.py`
  - 在 `users_router` 下新增“当前用户自助删除 MFA 认证器”接口。
- Create: `tests/accounts/test_self_service_mfa_api.py`
  - 覆盖当前用户自助删除 TOTP 认证器与错误路径。

### 前端

- Modify: `frontend_admin/src/pages/account/settings/data.d.ts`
  - 扩展设置页 `CurrentUser` 字段，补足邮箱、手机号和头像相关信息。
- Modify: `frontend_admin/src/pages/account/settings/service.ts`
  - 新增密码修改、手机号变更、邮箱管理、MFA 查询/删除/TOTP 绑定的 service 封装。
- Create: `frontend_admin/src/pages/account/settings/service.test.ts`
  - 覆盖 service 请求路径、HTTP 方法和 payload。
- Create: `frontend_admin/src/pages/account/settings/components/security.types.ts`
  - 收口安全页内部状态和动作类型。
- Create: `frontend_admin/src/pages/account/settings/components/security.utils.ts`
  - 收口手机号/邮箱脱敏与 MFA 摘要生成函数。
- Create: `frontend_admin/src/pages/account/settings/components/security.modals.tsx`
  - 放置 `PasswordChangeModal`、`PhoneChangeModal`、`EmailChangeModal`、`MfaManageModal`。
- Modify: `frontend_admin/src/pages/account/settings/components/security.tsx`
  - 从静态列表改造为真实数据驱动视图。
- Create: `frontend_admin/src/pages/account/settings/components/security.test.tsx`
  - 覆盖安全页渲染与四类弹窗交互。

## 实施原则

- 先锁定 allauth 现有后端流的回归测试，再补最小自助接口，再接前端。
- 所有新增逻辑先写失败测试，再写最小实现。
- 每个任务结束只跑当前任务必须通过的测试，避免反馈面过宽。
- 每个任务单独提交，提交信息使用中文。

### Task 1: allauth 手机号变更流回归测试

**Files:**
- Create: `tests/accounts/test_manage_phone_change_flow.py`

- [ ] **Step 1: 写已登录手机号变更流的失败测试**

```python
from unittest.mock import patch

import pytest
from allauth.account.models import EmailAddress

from apps.accounts.models import User


@pytest.fixture(autouse=True)
def _settings(settings):
    settings.AUTHENTICATION_BACKENDS = ["allauth.account.auth_backends.AuthenticationBackend"]
    settings.ACCOUNT_PHONE_VERIFICATION_ENABLED = True
    settings.ACCOUNT_PHONE_VERIFICATION_SUPPORTS_RESEND = True


@pytest.fixture()
def signed_in_client(client):
    user = User.objects.create(email="member@example.com", username="member@example.com")
    user.set_password("testpw123!")
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    client.force_login(user)
    return client, user


@pytest.mark.django_db
def test_manage_phone_starts_verification_stage(signed_in_client):
    client, _user = signed_in_client

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms") as mock_send:
        response = client.post(
            "/api/allauth/browser/v1/account/phone",
            data={"phone": "+8613800138001"},
            content_type="application/json",
        )

    assert response.status_code == 202, response.content
    body = response.json()
    assert body["data"] == [{"phone": "+8613800138001", "verified": False}]
    mock_send.assert_called_once()
    assert mock_send.call_args.kwargs["phone"] == "+8613800138001"


@pytest.mark.django_db
def test_verify_phone_change_rejects_wrong_code(signed_in_client):
    client, _user = signed_in_client

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms"):
        client.post(
            "/api/allauth/browser/v1/account/phone",
            data={"phone": "+8613800138001"},
            content_type="application/json",
        )

    response = client.post(
        "/api/allauth/browser/v1/auth/phone/verify",
        data={"code": "000000"},
        content_type="application/json",
    )

    assert response.status_code == 400, response.content
```

- [ ] **Step 2: 跑测试确认当前没有这条回归覆盖**

Run: `docker compose exec web pytest tests/accounts/test_manage_phone_change_flow.py -v`

Expected: 至少一个断言失败，说明“已登录用户手机号变更”还没有被明确锁住。

- [ ] **Step 3: 补成功确认用例，锚定 allauth 真实行为**

```python
@pytest.mark.django_db
def test_manage_phone_verify_updates_current_user(signed_in_client):
    client, user = signed_in_client
    captured = {}

    def capture_sms(_user, _phone, code, **_kwargs):
        captured["code"] = code

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms", side_effect=capture_sms):
        start = client.post(
            "/api/allauth/browser/v1/account/phone",
            data={"phone": "+8613800138001"},
            content_type="application/json",
        )

    assert start.status_code == 202, start.content

    response = client.post(
        "/api/allauth/browser/v1/auth/phone/verify",
        data={"code": captured["code"]},
        content_type="application/json",
    )

    assert response.status_code == 200, response.content
    user.refresh_from_db()
    assert user.phone_country_code == "+86"
    assert user.phone_national_number == "13800138001"
    assert user.phone_verified is True
```

- [ ] **Step 4: 回跑手机号变更测试**

Run: `docker compose exec web pytest tests/accounts/test_manage_phone_change_flow.py -v`

Expected: `3 passed`

- [ ] **Step 5: 提交手机号变更回归覆盖**

```bash
git add tests/accounts/test_manage_phone_change_flow.py
git commit -m "补充手机号变更流程回归测试"
```

### Task 2: 当前用户自助解绑 MFA 认证器

**Files:**
- Modify: `apps/accounts/api.py`
- Create: `tests/accounts/test_self_service_mfa_api.py`

- [ ] **Step 1: 写自助删除 MFA 的失败测试**

```python
import pytest
from allauth.account.models import EmailAddress
from allauth.mfa.models import Authenticator
from allauth.mfa.totp.internal.auth import TOTP, generate_totp_secret

from apps.accounts.models import User


@pytest.mark.django_db
def test_delete_current_user_totp_authenticator(client):
    user = User.objects.create(email="totp@example.com", username="totp@example.com")
    user.set_password("testpw123!")
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    TOTP.activate(user, generate_totp_secret())
    client.force_login(user)

    response = client.delete("/api/users/me/mfa/authenticators/totp/")

    assert response.status_code == 204, response.content
    assert Authenticator.objects.filter(user=user, type=Authenticator.Type.TOTP).exists() is False
```

- [ ] **Step 2: 跑测试确认 404**

Run: `docker compose exec web pytest tests/accounts/test_self_service_mfa_api.py -v`

Expected: `404`，说明当前用户自助解绑端点还不存在。

- [ ] **Step 3: 在 `users_router` 下实现最小删除接口**

```python
# apps/accounts/api.py
@users_router.delete("/me/mfa/authenticators/{authenticator_type}/", response={204: None}, summary="删除当前用户的 MFA 认证器")
def delete_my_authenticator(request, authenticator_type: str):
    require_authenticated(request)
    deleted, _ = Authenticator.objects.filter(user=request.user, type=authenticator_type).delete()
    if deleted == 0:
        raise HttpError(404, "Authenticator not found.")
    return Status(204, None)
```

- [ ] **Step 4: 增加不存在认证器的错误用例并回跑**

```python
@pytest.mark.django_db
def test_delete_missing_authenticator_returns_404(client):
    user = User.objects.create(email="plain@example.com", username="plain@example.com")
    user.set_password("testpw123!")
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    client.force_login(user)

    response = client.delete("/api/users/me/mfa/authenticators/totp/")

    assert response.status_code == 404
    assert b"Authenticator not found" in response.content
```

Run: `docker compose exec web pytest tests/accounts/test_self_service_mfa_api.py -v`

Expected: `2 passed`

- [ ] **Step 5: 提交自助 MFA 删除能力**

```bash
git add apps/accounts/api.py tests/accounts/test_self_service_mfa_api.py
git commit -m "补充当前用户自助管理MFA接口"
```

### Task 3: 安全设置 service 与类型层

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/data.d.ts`
- Modify: `frontend_admin/src/pages/account/settings/service.ts`
- Create: `frontend_admin/src/pages/account/settings/service.test.ts`
- Create: `frontend_admin/src/pages/account/settings/components/security.types.ts`
- Create: `frontend_admin/src/pages/account/settings/components/security.utils.ts`

- [ ] **Step 1: 写 service 层失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addAccountEmail,
  confirmPhoneChange,
  deleteAuthenticator,
  listAuthenticators,
  requestPhoneChangeCode,
  updatePassword,
} from './service';

const mockRequest = vi.fn();

vi.mock('@umijs/max', () => ({
  request: (...args: any[]) => mockRequest(...args),
}));

describe('account settings service', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=test-token';
    mockRequest.mockReset();
  });

  it('posts password change to allauth browser endpoint', async () => {
    mockRequest.mockResolvedValue({ meta: { is_authenticated: true } });

    await updatePassword('oldpw123!', 'newpw123!');

    expect(mockRequest).toHaveBeenCalledWith('/api/allauth/browser/v1/account/password/change', expect.objectContaining({
      method: 'POST',
      data: { current_password: 'oldpw123!', new_password: 'newpw123!' },
    }));
  });

  it('uses allauth phone change endpoints', async () => {
    mockRequest.mockResolvedValue({ data: [{ phone: '+8613800138001', verified: false }] });

    await requestPhoneChangeCode('+8613800138001');
    await confirmPhoneChange('123456');

    expect(mockRequest).toHaveBeenCalledWith('/api/allauth/browser/v1/account/phone', expect.objectContaining({ method: 'POST' }));
    expect(mockRequest).toHaveBeenCalledWith('/api/allauth/browser/v1/auth/phone/verify', expect.objectContaining({
      method: 'POST',
      data: { code: '123456' },
    }));
  });

  it('uses patch to set primary email', async () => {
    mockRequest.mockResolvedValue({ data: [] });

    await addAccountEmail('next@example.com');

    expect(mockRequest).toHaveBeenCalledWith('/api/allauth/browser/v1/account/email', expect.objectContaining({ method: 'POST' }));
  });
});
```

- [ ] **Step 2: 跑前端 service 测试，确认方法缺失**

Run: `cd frontend_admin && pnpm vitest run src/pages/account/settings/service.test.ts`

Expected: 导入失败或 `is not a function`，说明安全设置 service 还没补齐。

- [ ] **Step 3: 扩展类型与 service 封装**

```ts
// frontend_admin/src/pages/account/settings/components/security.types.ts
export type SecurityAction = 'password' | 'phone' | 'email' | 'mfa';

export type SecurityItem = {
  key: SecurityAction;
  title: string;
  description: string;
  actionText: string;
};

export type AuthenticatorSummary = {
  type: string;
};
```

```ts
// frontend_admin/src/pages/account/settings/components/security.utils.ts
export function maskPhone(countryCode?: string, nationalNumber?: string) {
  if (!nationalNumber) {
    return '未绑定手机号';
  }
  return `${countryCode || ''}${nationalNumber.slice(0, 3)}****${nationalNumber.slice(-4)}`;
}

export function maskEmail(email?: string) {
  if (!email) {
    return '未绑定邮箱';
  }
  const [name, domain = ''] = email.split('@');
  return `${name.slice(0, 3)}***@${domain}`;
}

export function buildMfaDescription(authenticators: AuthenticatorSummary[]) {
  const types = new Set(authenticators.map((item) => item.type));
  if (types.has('totp') && types.has('recovery_codes')) {
    return '已启用 TOTP 和恢复码';
  }
  if (types.has('totp')) {
    return '已启用 TOTP';
  }
  return '未启用';
}
```

```ts
// frontend_admin/src/pages/account/settings/service.ts
export async function updatePassword(currentPassword: string, newPassword: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`${ALLAUTH_BROWSER_BASE}/account/password/change`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: {
      current_password: currentPassword,
      new_password: newPassword,
    },
  } as any);
}

export async function requestPhoneChangeCode(phone: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`${ALLAUTH_BROWSER_BASE}/account/phone`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: { phone },
  } as any);
}

export async function confirmPhoneChange(code: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`${ALLAUTH_BROWSER_BASE}/auth/phone/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: { code },
  } as any);
}

export async function listAuthenticators() {
  return request(`${ALLAUTH_BROWSER_BASE}/account/authenticators`, {
    method: 'GET',
    credentials: 'include',
  } as any);
}

export async function deleteAuthenticator(type: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`/api/users/me/mfa/authenticators/${type}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'X-CSRFToken': csrfToken,
    },
  } as any);
}
```

- [ ] **Step 4: 回跑前端 service 测试并补脱敏断言**

```ts
import { buildMfaDescription, maskEmail, maskPhone } from './components/security.utils';

it('masks phone and email for display', () => {
  expect(maskPhone('+86', '13800138001')).toBe('+86138****8001');
  expect(maskEmail('next@example.com')).toBe('nex***@example.com');
  expect(buildMfaDescription([{ type: 'totp' }, { type: 'recovery_codes' }])).toBe('已启用 TOTP 和恢复码');
});
```

Run: `cd frontend_admin && pnpm vitest run src/pages/account/settings/service.test.ts`

Expected: `PASS`

- [ ] **Step 5: 提交安全设置 service 层**

```bash
git add frontend_admin/src/pages/account/settings/data.d.ts frontend_admin/src/pages/account/settings/service.ts frontend_admin/src/pages/account/settings/service.test.ts frontend_admin/src/pages/account/settings/components/security.types.ts frontend_admin/src/pages/account/settings/components/security.utils.ts
git commit -m "补充管理端安全设置服务层"
```

### Task 4: 安全设置列表真实化

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/components/security.tsx`
- Create: `frontend_admin/src/pages/account/settings/components/security.test.tsx`

- [ ] **Step 1: 写页面渲染失败测试**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SecurityView from './security';

const mockQueryCurrent = vi.fn();
const mockListAuthenticators = vi.fn();

vi.mock('../service', () => ({
  queryCurrent: mockQueryCurrent,
  listAuthenticators: mockListAuthenticators,
}));

describe('SecurityView', () => {
  beforeEach(() => {
    mockQueryCurrent.mockResolvedValue({
      data: {
        id: 7,
        email: 'member@example.com',
        phoneCountryCode: '+86',
        phoneNationalNumber: '13800138001',
      },
    });
    mockListAuthenticators.mockResolvedValue({ data: [{ type: 'totp' }, { type: 'recovery_codes' }] });
  });

  it('renders four real security items and removes security question row', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SecurityView />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('账户密码')).toBeInTheDocument();
    });

    expect(screen.getByText('密保手机')).toBeInTheDocument();
    expect(screen.getByText('邮箱地址')).toBeInTheDocument();
    expect(screen.getByText('MFA 设备')).toBeInTheDocument();
    expect(screen.queryByText('密保问题')).not.toBeInTheDocument();
    expect(screen.getByText('已启用 TOTP 和恢复码')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑组件测试，确认静态实现不满足预期**

Run: `cd frontend_admin && pnpm vitest run src/pages/account/settings/components/security.test.tsx`

Expected: 断言失败，因为当前组件仍显示“密保问题”和模板假文案。

- [ ] **Step 3: 将 `security.tsx` 改造成真实状态列表**

```tsx
const SecurityView: React.FC = () => {
  const [activeModal, setActiveModal] = useState<SecurityAction | null>(null);
  const { data: current } = useQuery({ queryKey: ['current-user'], queryFn: queryCurrent });
  const { data: authenticators } = useQuery({ queryKey: ['security-authenticators'], queryFn: listAuthenticators });

  const items: SecurityItem[] = [
    {
      key: 'password',
      title: '账户密码',
      description: '已设置登录密码',
      actionText: '修改',
    },
    {
      key: 'phone',
      title: '密保手机',
      description: maskPhone(current?.data?.phoneCountryCode, current?.data?.phoneNationalNumber),
      actionText: current?.data?.phoneNationalNumber ? '修改' : '绑定',
    },
    {
      key: 'email',
      title: '邮箱地址',
      description: maskEmail(current?.data?.email),
      actionText: current?.data?.email ? '修改' : '绑定',
    },
    {
      key: 'mfa',
      title: 'MFA 设备',
      description: buildMfaDescription(authenticators?.data || []),
      actionText: (authenticators?.data || []).length ? '管理' : '绑定',
    },
  ];

  return (
    <>
      <List
        itemLayout="horizontal"
        dataSource={items}
        renderItem={(item) => (
          <List.Item actions={[<a key={item.key} onClick={() => setActiveModal(item.key)}>{item.actionText}</a>]}> 
            <List.Item.Meta title={item.title} description={item.description} />
          </List.Item>
        )}
      />
      <SecurityModals activeModal={activeModal} onClose={() => setActiveModal(null)} />
    </>
  );
};
```

- [ ] **Step 4: 回跑组件测试并补空数据断言**

```tsx
it('shows unbound copy for empty phone and email', async () => {
  mockQueryCurrent.mockResolvedValue({ data: { id: 7, email: '', phoneCountryCode: '', phoneNationalNumber: '' } });
  mockListAuthenticators.mockResolvedValue({ data: [] });
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <SecurityView />
    </QueryClientProvider>,
  );

  expect(await screen.findByText('未绑定手机号')).toBeInTheDocument();
  expect(screen.getByText('未绑定邮箱')).toBeInTheDocument();
  expect(screen.getByText('未启用')).toBeInTheDocument();
});
```

Run: `cd frontend_admin && pnpm vitest run src/pages/account/settings/components/security.test.tsx`

Expected: `PASS`

- [ ] **Step 5: 提交安全设置主视图改造**

```bash
git add frontend_admin/src/pages/account/settings/components/security.tsx frontend_admin/src/pages/account/settings/components/security.test.tsx
git commit -m "改造管理端安全设置列表展示"
```

### Task 5: 密码、手机号、邮箱弹窗流程

**Files:**
- Create: `frontend_admin/src/pages/account/settings/components/security.modals.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/security.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/security.test.tsx`

- [ ] **Step 1: 为三个弹窗流程写失败测试**

```tsx
it('submits phone change flow through allauth phone endpoints', async () => {
  mockRequestPhoneChangeCode.mockResolvedValue({ data: [{ phone: '+8613800138009', verified: false }] });
  mockConfirmPhoneChange.mockResolvedValue({ meta: { is_authenticated: true } });

  renderSecurityView();

  await screen.findByText('密保手机');
  fireEvent.click(screen.getByRole('link', { name: '修改' }));
  fireEvent.change(screen.getByLabelText('新手机号'), { target: { value: '+8613800138009' } });
  fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
  fireEvent.change(screen.getByLabelText('验证码'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: '确认修改手机号' }));

  await waitFor(() => {
    expect(mockConfirmPhoneChange).toHaveBeenCalledWith('123456');
  });
});

it('submits password and email flows through service layer', async () => {
  mockUpdatePassword.mockResolvedValue({ meta: { is_authenticated: true } });
  mockAddAccountEmail.mockResolvedValue({ data: [] });
  mockSetPrimaryAccountEmail.mockResolvedValue({ data: [] });

  renderSecurityView();

  await screen.findByText('账户密码');
  fireEvent.click(screen.getByText('账户密码').closest('li')!.querySelector('a')!);
  fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'testpw123!' } });
  fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'nextpw123!' } });
  fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'nextpw123!' } });
  fireEvent.click(screen.getByRole('button', { name: '确认修改密码' }));

  await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalled());
});
```

- [ ] **Step 2: 跑组件测试，确认弹窗组件尚未存在**

Run: `cd frontend_admin && pnpm vitest run src/pages/account/settings/components/security.test.tsx`

Expected: 因找不到弹窗字段或按钮而失败。

- [ ] **Step 3: 实现三个弹窗的最小表单流程**

```tsx
export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ open, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Modal open={open} title="修改密码" onCancel={onClose} footer={null} destroyOnClose>
      <Form
        layout="vertical"
        onFinish={async (values) => {
          setSubmitting(true);
          try {
            await updatePassword(values.currentPassword, values.newPassword);
            message.success('密码已更新');
            onClose();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item label="当前密码" name="currentPassword" rules={[{ required: true }]}><Input.Password /></Form.Item>
        <Form.Item label="新密码" name="newPassword" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
        <Form.Item label="确认新密码" name="confirmPassword" dependencies={['newPassword']} rules={[{ required: true }]}><Input.Password /></Form.Item>
        <Button htmlType="submit" type="primary" loading={submitting}>确认修改密码</Button>
      </Form>
    </Modal>
  );
};
```

```tsx
export const PhoneChangeModal: React.FC<PhoneChangeModalProps> = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [cooldown, setCooldown] = useState(0);

  return (
    <Modal open={open} title="修改手机号" onCancel={onClose} footer={null} destroyOnClose>
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          await confirmPhoneChange(values.code);
          message.success('手机号已更新');
          onSuccess();
          onClose();
        }}
      >
        <Form.Item label="新手机号" name="phone" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item label="验证码" name="code" rules={[{ required: true }]}><Input /></Form.Item>
        <Space>
          <Button
            onClick={async () => {
              const phone = form.getFieldValue('phone');
              await requestPhoneChangeCode(phone);
              setCooldown(60);
            }}
            disabled={cooldown > 0}
          >
            发送验证码
          </Button>
          <Button htmlType="submit" type="primary">确认修改手机号</Button>
        </Space>
      </Form>
    </Modal>
  );
};
```

```tsx
export const EmailChangeModal: React.FC<EmailChangeModalProps> = ({ open, onClose, currentEmail, onSuccess }) => {
  return (
    <Modal open={open} title="修改邮箱" onCancel={onClose} footer={null} destroyOnClose>
      <Alert type="info" showIcon message={`当前主邮箱：${currentEmail || '未绑定邮箱'}`} />
      <Form
        layout="vertical"
        onFinish={async (values) => {
          await addAccountEmail(values.email);
          await setPrimaryAccountEmail(values.email);
          message.success('邮箱已更新');
          onSuccess();
          onClose();
        }}
      >
        <Form.Item label="新邮箱" name="email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
        <Button htmlType="submit" type="primary">确认修改邮箱</Button>
      </Form>
    </Modal>
  );
};
```

- [ ] **Step 4: 回跑组件测试并补手机号错误提示用例**

```tsx
it('keeps phone modal open when verify code is invalid', async () => {
  mockConfirmPhoneChange.mockRejectedValue({ response: { data: { message: 'Invalid verification code.' } } });

  renderSecurityView();
  await screen.findByText('密保手机');
  fireEvent.click(screen.getByRole('link', { name: '修改' }));
  fireEvent.change(screen.getByLabelText('新手机号'), { target: { value: '+8613800138009' } });
  fireEvent.change(screen.getByLabelText('验证码'), { target: { value: '000000' } });
  fireEvent.click(screen.getByRole('button', { name: '确认修改手机号' }));

  await waitFor(() => expect(screen.getByText('Invalid verification code.')).toBeInTheDocument());
});
```

Run: `cd frontend_admin && pnpm vitest run src/pages/account/settings/components/security.test.tsx`

Expected: `PASS`

- [ ] **Step 5: 提交密码/手机号/邮箱弹窗流程**

```bash
git add frontend_admin/src/pages/account/settings/components/security.modals.tsx frontend_admin/src/pages/account/settings/components/security.tsx frontend_admin/src/pages/account/settings/components/security.test.tsx
git commit -m "接入管理端安全设置基础操作弹窗"
```

### Task 6: MFA 管理弹窗与联调验证

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/components/security.modals.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/security.test.tsx`
- Modify: `frontend_admin/src/pages/account/settings/service.ts`

- [ ] **Step 1: 写 MFA 弹窗的失败测试**

```tsx
it('binds totp and deletes authenticator from mfa modal', async () => {
  mockListAuthenticators.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [{ type: 'totp' }, { type: 'recovery_codes' }] });
  mockGetTotpSetup.mockResolvedValue({ meta: { secret: 'secret', totp_url: 'otpauth://totp/demo' } });
  mockActivateTotp.mockResolvedValue({});
  mockDeleteAuthenticator.mockResolvedValue({});

  renderSecurityView();

  await screen.findByText('MFA 设备');
  fireEvent.click(screen.getByRole('link', { name: '绑定' }));
  fireEvent.click(screen.getByRole('button', { name: '开始绑定 TOTP' }));
  fireEvent.change(screen.getByLabelText('6 位验证码'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: '确认绑定 TOTP' }));

  await waitFor(() => expect(mockActivateTotp).toHaveBeenCalledWith('123456'));
});
```

- [ ] **Step 2: 跑测试确认 MFA 弹窗能力缺失**

Run: `cd frontend_admin && pnpm vitest run src/pages/account/settings/components/security.test.tsx`

Expected: 断言失败，因为当前没有 TOTP 绑定和删除流程。

- [ ] **Step 3: 实现 MFA 管理弹窗**

```tsx
export const MfaManageModal: React.FC<MfaManageModalProps> = ({ open, onClose, onSuccess }) => {
  const [authenticators, setAuthenticators] = useState<Array<{ type: string }>>([]);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; totp_url: string } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    listAuthenticators().then((result) => setAuthenticators(result.data || []));
  }, [open]);

  return (
    <Modal open={open} title="MFA 设备" onCancel={onClose} footer={null} destroyOnClose>
      {authenticators.length === 0 ? (
        <Button onClick={async () => setTotpSetup(await getTotpSetup())}>开始绑定 TOTP</Button>
      ) : null}
      {totpSetup ? (
        <Form onFinish={async (values) => {
          await activateTotp(values.code);
          message.success('TOTP 已启用');
          onSuccess();
        }}>
          <Typography.Paragraph copyable>{totpSetup.secret}</Typography.Paragraph>
          <Form.Item label="6 位验证码" name="code" rules={[{ required: true }]}><Input /></Form.Item>
          <Button htmlType="submit" type="primary">确认绑定 TOTP</Button>
        </Form>
      ) : null}
      {authenticators.map((item) => (
        <Space key={item.type} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{item.type}</span>
          <Button danger onClick={async () => {
            await deleteAuthenticator(item.type);
            message.success('MFA 设备已移除');
            onSuccess();
          }}>移除</Button>
        </Space>
      ))}
    </Modal>
  );
};
```

- [ ] **Step 4: 回跑前端测试并执行最小联调**

Run: `cd frontend_admin && pnpm vitest run src/pages/account/settings/components/security.test.tsx`

Expected: `PASS`

Run: `docker compose exec web pytest tests/accounts/test_manage_phone_change_flow.py tests/accounts/test_self_service_mfa_api.py tests/accounts/test_mfa_flows.py tests/accounts/test_email_verification_flow.py -v`

Expected: 全部通过，确认新增代码没有破坏既有 allauth 流程。

- [ ] **Step 5: 提交 MFA 管理与联调结果**

```bash
git add frontend_admin/src/pages/account/settings/components/security.modals.tsx frontend_admin/src/pages/account/settings/components/security.test.tsx frontend_admin/src/pages/account/settings/service.ts
git commit -m "完成管理端安全设置MFA管理流程"
```

## 最终验证清单

- [ ] `docker compose exec web pytest tests/accounts/test_manage_phone_change_flow.py tests/accounts/test_self_service_mfa_api.py tests/accounts/test_mfa_flows.py tests/accounts/test_email_verification_flow.py -v`
- [ ] `cd frontend_admin && pnpm vitest run src/pages/account/settings/service.test.ts src/pages/account/settings/components/security.test.tsx`
- [ ] 手动打开管理端“安全设置”，确认不再出现“密保问题”。
- [ ] 手动验证四个列表项展示真实状态，而不是模板占位文案。

## Spec 覆盖自查

- 已覆盖密码修改：Task 3, Task 5
- 已覆盖手机号验证码变更：Task 1, Task 3, Task 5
- 已覆盖邮箱管理与设主邮箱：Task 3, Task 5
- 已覆盖 MFA 状态、TOTP 绑定与解绑：Task 2, Task 3, Task 6
- 已覆盖去掉“密保问题”：Task 4
- 未把 `账号绑定`、`新消息通知` 纳入本计划，符合 spec 非目标
