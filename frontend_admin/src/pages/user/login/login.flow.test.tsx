import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogin = vi.fn();
const mockConfirmLoginCode = vi.fn();
const mockRequestPhoneLoginCode = vi.fn();
const mockAuthenticateMfaWithWebauthn = vi.fn();
const mockTwoFactorAuthenticate = vi.fn();
const mockTwoFactorTrust = vi.fn();
const mockFetchUserInfo = vi.fn();
const mockSwitchList = vi.fn();
const mockGetNavigation = vi.fn();
const mockGetTeamOperations = vi.fn();
const mockSetInitialState = vi.fn();
const mockHistoryPush = vi.fn();
const mockHistoryReplace = vi.fn();
const mockSuccess = vi.fn();
const mockError = vi.fn();
const originalWindowLocation = window.location;
const mockFormattedMessage = ({ defaultMessage }: { defaultMessage: string }) =>
  defaultMessage;
const authenticatedUser = {
  id: 1,
  username: 'admin',
};

vi.mock('@umijs/max', () => ({
  FormattedMessage: mockFormattedMessage,
  Helmet: ({ children }: any) => <>{children}</>,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  SelectLang: () => null,
  history: {
    push: mockHistoryPush,
    replace: mockHistoryReplace,
  },
  useIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage: string }) =>
      defaultMessage,
  }),
  useModel: () => ({
    initialState: {
      fetchUserInfo: mockFetchUserInfo,
    },
    setInitialState: mockSetInitialState,
  }),
}));

vi.mock('antd', () => {
  return {
    Alert: ({ title }: any) => <div>{title}</div>,
    App: {
      useApp: () => ({
        message: {
          success: mockSuccess,
          error: mockError,
        },
      }),
    },
    Button: ({ children, disabled, htmlType, onClick }: any) => (
      <button disabled={disabled} type={htmlType || 'button'} onClick={onClick}>
        {children}
      </button>
    ),
    Tabs: ({ activeKey, items, onChange }: any) => (
      <div role="tablist">
        {items.map((item: { key: string; label: string }) => (
          <button
            aria-selected={item.key === activeKey}
            key={item.key}
            role="tab"
            type="button"
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    ),
    Spin: ({ description }: any) => <div>{description}</div>,
  };
});

vi.mock('@ant-design/icons', () => ({
  LockOutlined: () => null,
  PhoneOutlined: () => null,
  SafetyCertificateOutlined: () => null,
  UserOutlined: () => null,
}));

vi.mock('./wechat-official-login-modal', () => ({
  default: ({ embedded, open }: any) => {
    if (!open) return null;
    return embedded ? (
      <div data-testid="wechat-embedded">打开微信扫一扫</div>
    ) : (
      <div role="dialog">微信扫码登录</div>
    );
  },
}));

vi.mock('@ant-design/pro-components', () => {
  const FormContext = React.createContext<{
    values: Record<string, string | boolean>;
    setValue: (name: string, value: string | boolean) => void;
  }>({
    values: {},
    setValue: () => {},
  });

  const LoginForm = ({ children, initialValues, onFinish, submitter }: any) => {
    const [values, setValues] = React.useState<
      Record<string, string | boolean>
    >(initialValues || {});
    const setValue = (name: string, value: string | boolean) =>
      setValues((current) => ({ ...current, [name]: value }));

    return (
      <FormContext.Provider value={{ values, setValue }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onFinish?.(values);
          }}
        >
          {children}
          {submitter !== false && <button type="submit">提交</button>}
        </form>
      </FormContext.Provider>
    );
  };

  const ProFormText = ({ fieldProps, name, placeholder }: any) => {
    const { values, setValue } = React.useContext(FormContext);
    return (
      <div>
        <input
          aria-label={name}
          placeholder={placeholder}
          value={String(values[name] || '')}
          onChange={(event) => {
            setValue(name, event.target.value);
            fieldProps?.onChange?.(event);
          }}
        />
        {fieldProps?.suffix}
      </div>
    );
  };

  ProFormText.Password = ({ name, placeholder }: any) => {
    const { values, setValue } = React.useContext(FormContext);
    return (
      <input
        aria-label={name}
        placeholder={placeholder}
        type="password"
        value={String(values[name] || '')}
        onChange={(event) => setValue(name, event.target.value)}
      />
    );
  };

  const ProFormCheckbox = ({ name, children }: any) => {
    const { values, setValue } = React.useContext(FormContext);
    return (
      <label>
        <input
          aria-label={name}
          checked={Boolean(values[name])}
          type="checkbox"
          onChange={(event) => setValue(name, event.target.checked)}
        />
        {children}
      </label>
    );
  };

  return { LoginForm, ProFormCheckbox, ProFormText };
});

vi.mock('@/components', () => ({
  Footer: () => null,
}));

vi.mock('@/services/allauth/authAccount', () => ({
  postBrowserV1AuthLogin: mockLogin,
}));

vi.mock('@/services/allauth/authTwoFactor', () => ({
  postBrowserV1AuthTwofaAuthenticate: mockTwoFactorAuthenticate,
  postBrowserV1AuthTwofaTrust: mockTwoFactorTrust,
}));

vi.mock('@/services/manual/publicAuth', () => ({
  confirmPublicLoginCode: mockConfirmLoginCode,
  getPublicAuthErrorMessage: (_error: unknown, fallback: string) => fallback,
  requestPublicPhoneLoginCode: mockRequestPhoneLoginCode,
}));

vi.mock('@/services/manual/webauthn', () => ({
  authenticateMfaWithWebauthn: mockAuthenticateMfaWithWebauthn,
}));

vi.mock('@/services/manual/navigationAccess', () => ({
  getNavigationAccessCapabilities: mockGetNavigation,
}));

vi.mock('@/services/manual/teamOperations', () => ({
  getTeamOperationsCapabilities: mockGetTeamOperations,
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiSwitchList: mockSwitchList,
}));

vi.mock('../../../../config/defaultSettings', () => ({
  default: { title: 'LinkCloud Admin' },
}));

vi.mock('../../../../public/logo.svg', () => ({
  default: '/logo.svg',
}));

describe('admin 登录 MFA 流程', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetchUserInfo.mockResolvedValue(undefined);
    mockSwitchList.mockResolvedValue([
      {
        id: 1,
        name: 'LAN',
        slug: 'lan',
        is_primary: true,
        is_current: true,
      },
    ]);
    mockGetNavigation.mockResolvedValue({ subscriptions: true });
    mockGetTeamOperations.mockResolvedValue({ enabled: true });
    window.history.replaceState({}, '', '/user/login');
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalWindowLocation,
    });
  });

  it('已有会话进入登录页时应恢复状态并直接跳转', async () => {
    mockFetchUserInfo.mockResolvedValueOnce(authenticatedUser);
    window.history.replaceState(
      {},
      '',
      '/user/login?redirect=%2Fspace%2Fsettings%2Forganization',
    );

    const { default: Login } = await import('./index');
    render(<Login />);

    await waitFor(() => {
      expect(mockFetchUserInfo).toHaveBeenCalledTimes(1);
    });
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockSwitchList).toHaveBeenCalledWith({ skipErrorHandler: true });
    expect(mockHistoryReplace).toHaveBeenCalledWith(
      '/space/settings/organization',
    );
  });

  it('在认证页面之间透传安全的登录后目标地址', async () => {
    window.history.replaceState(
      {},
      '',
      '/user/login?redirect=%2Fdashboard%2Fspace%2Finvitations%3Fsource%3Dmail%23accept',
    );

    const { default: Login } = await import('./index');
    render(<Login />);

    expect(
      await screen.findByRole('link', { name: '忘记密码' }),
    ).toHaveAttribute(
      'href',
      '/user/password/reset?redirect=%2Fspace%2Finvitations%3Fsource%3Dmail%23accept',
    );
    expect(screen.getByRole('link', { name: '注册账号' })).toHaveAttribute(
      'href',
      '/user/register?redirect=%2Fspace%2Finvitations%3Fsource%3Dmail%23accept',
    );
  });

  it('请求并确认手机号登录验证码', async () => {
    mockFetchUserInfo
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(authenticatedUser);
    mockRequestPhoneLoginCode.mockResolvedValueOnce(undefined);
    mockConfirmLoginCode.mockResolvedValueOnce({});

    const { default: Login } = await import('./index');
    render(<Login />);

    fireEvent.click(await screen.findByRole('tab', { name: '手机号登录' }));
    fireEvent.change(screen.getByPlaceholderText('请输入手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));

    await waitFor(() =>
      expect(mockRequestPhoneLoginCode).toHaveBeenCalledWith('13800138000'),
    );
    fireEvent.change(screen.getByPlaceholderText('请输入短信验证码'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() =>
      expect(mockConfirmLoginCode).toHaveBeenCalledWith('123456'),
    );
    expect(mockSuccess).toHaveBeenCalledWith('登录成功！');
    expect(mockHistoryReplace).toHaveBeenCalledWith(
      '/rental/workbench/overview',
    );
  });

  it('只展示微信、手机号和邮箱登录入口', async () => {
    const { default: Login } = await import('./index');
    render(<Login />);

    expect(
      await screen.findByRole('tab', { name: '账号登录' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '手机号登录' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '扫码登录' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '使用 GitHub 登录' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '使用通行密钥登录' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '扫码登录' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('wechat-embedded')).toHaveTextContent(
      '打开微信扫一扫',
    );
    expect(
      screen.queryByRole('button', { name: '提交' }),
    ).not.toBeInTheDocument();
  });

  it('重复登录返回 409 时应按已有会话恢复并跳转', async () => {
    mockFetchUserInfo
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(authenticatedUser);
    mockLogin.mockRejectedValueOnce({
      response: {
        status: 409,
      },
    });

    const { default: Login } = await import('./index');
    render(<Login />);

    fireEvent.change(await screen.findByPlaceholderText('邮箱 / 手机号'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(mockHistoryReplace).toHaveBeenCalledWith(
        '/rental/workbench/overview',
      );
    });
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('邮箱登录返回 mfa_authenticate 时应进入二次验证码校验', async () => {
    mockFetchUserInfo
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(authenticatedUser);
    mockLogin.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          flows: [
            { id: 'login' },
            {
              id: 'mfa_authenticate',
              is_pending: true,
              types: ['totp', 'recovery_codes'],
            },
          ],
        },
      },
    });
    mockTwoFactorAuthenticate.mockResolvedValueOnce({});

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        href: '/user/login',
      },
    });

    const { default: Login } = await import('./index');
    render(<Login />);

    fireEvent.change(await screen.findByPlaceholderText('邮箱 / 手机号'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    expect(
      await screen.findByPlaceholderText('6 位验证码或恢复码'),
    ).toBeInTheDocument();
    expect(mockError).not.toHaveBeenCalled();
    expect(mockLogin).toHaveBeenCalledWith(
      { client: 'browser' },
      { email: 'admin@example.com', password: 'secret123' },
      { skipErrorHandler: true },
    );

    fireEvent.change(screen.getByPlaceholderText('6 位验证码或恢复码'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(mockTwoFactorAuthenticate).toHaveBeenCalledWith(
        { client: 'browser' },
        { code: '123456' },
        { skipErrorHandler: true },
      );
    });
    expect(mockSuccess).toHaveBeenCalledWith('登录成功！');
    expect(mockFetchUserInfo).toHaveBeenCalled();
    expect(mockHistoryReplace).toHaveBeenCalledWith(
      '/rental/workbench/overview',
    );
  });

  it('遇到未知 allauth flow 时应提示具体 flow id', async () => {
    mockLogin.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          flows: [
            { id: 'login' },
            { id: 'custom_identity_step', is_pending: true },
          ],
        },
      },
    });

    const { default: Login } = await import('./index');
    render(<Login />);

    fireEvent.change(await screen.findByPlaceholderText('邮箱 / 手机号'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        '当前登录流程包含暂未支持的认证步骤：custom_identity_step，请联系开发处理。',
      );
    });
  });

  it('MFA 支持 WebAuthn 安全密钥验证', async () => {
    mockFetchUserInfo
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(authenticatedUser);
    mockLogin.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          flows: [
            { id: 'login' },
            {
              id: 'mfa_authenticate',
              is_pending: true,
              types: ['webauthn'],
            },
          ],
        },
      },
    });
    mockAuthenticateMfaWithWebauthn.mockResolvedValueOnce({});

    const { default: Login } = await import('./index');
    render(<Login />);

    fireEvent.change(await screen.findByPlaceholderText('邮箱 / 手机号'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    fireEvent.click(
      await screen.findByRole('button', { name: '使用安全密钥验证' }),
    );
    await waitFor(() =>
      expect(mockAuthenticateMfaWithWebauthn).toHaveBeenCalled(),
    );
    expect(mockSuccess).toHaveBeenCalledWith('登录成功！');
  });

  it('登录遇到待验证手机号时可恢复到验证页面', async () => {
    window.history.replaceState(
      {},
      '',
      '/user/login?redirect=%2Fspace%2Forganization',
    );
    mockLogin.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          flows: [{ id: 'login' }, { id: 'verify_phone', is_pending: true }],
        },
      },
    });

    const { default: Login } = await import('./index');
    render(<Login />);

    fireEvent.change(await screen.findByPlaceholderText('邮箱 / 手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(mockHistoryPush).toHaveBeenCalledWith(
        '/user/verify-phone?redirect=%2Fspace%2Forganization',
      );
    });
  });

  it('邮箱中的全角句号应在提交前规范化', async () => {
    mockFetchUserInfo
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(authenticatedUser);
    mockLogin.mockResolvedValueOnce({});

    const { default: Login } = await import('./index');
    render(<Login />);

    fireEvent.change(await screen.findByPlaceholderText('邮箱 / 手机号'), {
      target: { value: 'admin@example。com' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        { client: 'browser' },
        { email: 'admin@example.com', password: 'secret123' },
        { skipErrorHandler: true },
      );
    });
    expect(mockHistoryReplace).toHaveBeenCalledWith(
      '/rental/workbench/overview',
    );
  });

  it('登录成功后应同步当前空间到 initialState', async () => {
    mockFetchUserInfo
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(authenticatedUser);
    mockLogin.mockResolvedValueOnce({});

    const { default: Login } = await import('./index');
    render(<Login />);

    fireEvent.change(await screen.findByPlaceholderText('邮箱 / 手机号'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(mockSwitchList).toHaveBeenCalledWith({ skipErrorHandler: true });
    });

    const stateUpdater = mockSetInitialState.mock.calls.at(-1)?.[0];
    expect(stateUpdater).toBeTypeOf('function');

    const nextState = stateUpdater({
      fetchUserInfo: mockFetchUserInfo,
    });
    expect(nextState.currentUser).toEqual({
      id: 1,
      username: 'admin',
    });
    expect(nextState.organizations).toEqual([
      {
        id: 1,
        name: 'LAN',
        slug: 'lan',
        is_primary: true,
        is_current: true,
      },
    ]);
    expect(nextState.selectedOrgSlug).toBe('lan');
    expect(nextState.teamOperationsCapabilities).toEqual({ enabled: true });
    expect(nextState.navigationCapabilities).toEqual({ subscriptions: true });
  });

  it('二步验证后返回 mfa_trust 时应继续完成登录', async () => {
    mockFetchUserInfo
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(authenticatedUser);
    mockLogin.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          flows: [
            { id: 'login' },
            { id: 'mfa_authenticate', is_pending: true, types: ['totp'] },
          ],
        },
      },
    });
    mockTwoFactorAuthenticate.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          flows: [{ id: 'mfa_trust', is_pending: true }],
        },
      },
    });
    mockTwoFactorTrust.mockResolvedValueOnce({});

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        href: '/user/login',
      },
    });

    const { default: Login } = await import('./index');
    render(<Login />);

    fireEvent.change(await screen.findByPlaceholderText('邮箱 / 手机号'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    expect(
      await screen.findByPlaceholderText('6 位验证码或恢复码'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('6 位验证码或恢复码'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(mockTwoFactorTrust).toHaveBeenCalledWith(
        { client: 'browser' },
        { trust: false },
        { skipErrorHandler: true },
      );
    });
    expect(mockSuccess).toHaveBeenCalledWith('登录成功！');
    expect(mockFetchUserInfo).toHaveBeenCalled();
    expect(mockHistoryReplace).toHaveBeenCalledWith(
      '/rental/workbench/overview',
    );
  });
});
