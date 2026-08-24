import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setSelectedOrgSlug } from './utils/orgSelection';

// Mock all heavy dependencies before importing app
const mockReplace = vi.fn();
const mockHistory = {
  location: {
    pathname: '/welcome',
    search: '',
    hash: '',
  },
  replace: mockReplace,
};

const mockQueryCurrentUser = vi.fn();
const mockGetOrganizationSwitchList = vi.fn();
const mockGetTeamOperationsCapabilities = vi.fn();

vi.mock('@umijs/max', () => ({
  history: mockHistory,
  Link: ({ children }: any) => children,
}));

vi.mock('@/services/openapi/userAccount', () => ({
  appsAccountsApiGetMe: mockQueryCurrentUser,
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiSwitchList: mockGetOrganizationSwitchList,
}));

vi.mock('@/services/manual/teamOperations', () => ({
  getTeamOperationsCapabilities: mockGetTeamOperationsCapabilities,
}));

vi.mock('@/components', () => ({
  AvatarDropdown: () => null,
  DocLink: () => null,
  ErrorBoundary: ({ children }: any) => children,
  LangDropdown: () => null,
  OfflineBanner: () => null,
  OrgSwitcher: () => null,
  VersionDropdown: () => null,
}));

vi.mock('@ant-design/pro-components', () => ({
  SettingDrawer: () => null,
}));

vi.mock('antd', () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Tooltip: ({ children }: any) => <>{children}</>,
}));

vi.mock('@ant-design/icons', () => ({
  BgColorsOutlined: () => null,
  LinkOutlined: () => null,
}));

vi.mock('./requestErrorConfig', () => ({
  errorConfig: {},
}));

vi.mock('../config/defaultSettings', () => ({
  default: { navTheme: 'light' },
}));

describe('app getInitialState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setSelectedOrgSlug(undefined);
    mockGetOrganizationSwitchList.mockResolvedValue([]);
    mockGetTeamOperationsCapabilities.mockResolvedValue({
      announcement_organization_manage: false,
      announcement_team_ids: [],
      task_organization_manage: false,
      task_team_ids: [],
    });
    mockHistory.location = {
      pathname: '/welcome',
      search: '',
      hash: '',
    };
  });

  it('should fetch currentUser when not on login page', async () => {
    const { getInitialState } = await import('./app');
    mockQueryCurrentUser.mockResolvedValue({
      first_name: 'Test',
      last_name: 'User',
      username: 'test-user',
      email: 'test@example.com',
      avatar_url: null,
      timezone: 'Asia/Shanghai',
      phone_verified: true,
      real_name_status: 'unverified',
      is_staff: true,
      is_superuser: false,
    });

    const state = await getInitialState();

    expect(mockQueryCurrentUser).toHaveBeenCalled();
    expect(state.currentUser).toEqual(
      expect.objectContaining({
        first_name: 'Test',
        is_staff: true,
      }),
    );
    expect(state.organizations).toEqual([]);
    expect(state.selectedOrgSlug).toBeUndefined();
    expect(state.settingDrawerOpen).toBe(false);
    expect(state.fetchUserInfo).toBeDefined();
  });

  it('should default select the first organization when only one is available', async () => {
    const { getInitialState } = await import('./app');
    mockQueryCurrentUser.mockResolvedValue({
      first_name: 'Tenant',
      last_name: 'User',
      username: 'tenant-user',
      email: 'tenant@example.com',
      avatar_url: null,
      timezone: 'Asia/Shanghai',
      phone_verified: true,
      real_name_status: 'unverified',
      is_staff: true,
      is_superuser: false,
    });
    mockGetOrganizationSwitchList.mockResolvedValue([
      {
        id: 1,
        name: 'Acme',
        slug: 'acme',
        is_current: false,
        is_primary: true,
      },
    ]);

    const state = await getInitialState();

    expect(mockGetOrganizationSwitchList).toHaveBeenCalledWith({
      skipErrorHandler: true,
    });
    expect(state.organizations).toEqual([
      expect.objectContaining({ slug: 'acme' }),
    ]);
    expect(state.selectedOrgSlug).toBe('acme');
    expect(mockGetTeamOperationsCapabilities).toHaveBeenCalled();
  });

  it('should prefer the backend current organization when multiple orgs are available', async () => {
    const { getInitialState } = await import('./app');
    mockQueryCurrentUser.mockResolvedValue({
      first_name: 'Tenant',
      last_name: 'User',
      username: 'tenant-user',
      email: 'tenant@example.com',
      avatar_url: null,
      timezone: 'Asia/Shanghai',
      phone_verified: true,
      real_name_status: 'unverified',
      is_staff: true,
      is_superuser: false,
    });
    mockGetOrganizationSwitchList.mockResolvedValue([
      {
        id: 1,
        name: 'Acme',
        slug: 'acme',
        is_current: false,
        is_primary: true,
      },
      {
        id: 2,
        name: 'Beta',
        slug: 'beta',
        is_current: true,
        is_primary: false,
      },
    ]);

    const state = await getInitialState();

    expect(state.selectedOrgSlug).toBe('beta');
  });

  it('should redirect to login when currentUser fetch fails (401)', async () => {
    const { getInitialState } = await import('./app');
    mockQueryCurrentUser.mockRejectedValue(new Error('401 Unauthorized'));

    const state = await getInitialState();

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('/user/login?redirect='),
    );
    expect(state.currentUser).toBeUndefined();
  });

  it('should not fetch currentUser on login page', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = {
      pathname: '/user/login',
      search: '',
      hash: '',
    };

    const state = await getInitialState();

    expect(mockQueryCurrentUser).not.toHaveBeenCalled();
    expect(state.currentUser).toBeUndefined();
    expect(state.fetchUserInfo).toBeDefined();
  });

  it('should not fetch currentUser on dashboard login page', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = {
      pathname: '/dashboard/user/login',
      search: '',
      hash: '',
    };

    const state = await getInitialState();

    expect(mockQueryCurrentUser).not.toHaveBeenCalled();
    expect(state.currentUser).toBeUndefined();
  });

  it('should encode redirect path correctly on 401', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = {
      pathname: '/admin/users',
      search: '?page=2',
      hash: '#section',
    };
    mockQueryCurrentUser.mockRejectedValue(new Error('401'));

    await getInitialState();

    expect(mockReplace).toHaveBeenCalledWith(
      `/user/login?redirect=${encodeURIComponent('/admin/users?page=2#section')}`,
    );
  });

  it('should include default settings in initial state', async () => {
    const { getInitialState } = await import('./app');
    mockQueryCurrentUser.mockResolvedValue({
      first_name: 'User',
      last_name: '',
      username: 'user',
      email: 'user@example.com',
      avatar_url: null,
      timezone: 'Asia/Shanghai',
      phone_verified: true,
      real_name_status: 'unverified',
      is_staff: false,
      is_superuser: false,
    });

    const state = await getInitialState();

    expect(state.settings).toEqual({ navTheme: 'light' });
  });

  it('fetchUserInfo should return user data on success', async () => {
    const { getInitialState } = await import('./app');
    mockQueryCurrentUser.mockResolvedValue({
      first_name: 'Fetched',
      last_name: 'User',
      username: 'fetched-user',
      email: 'fetched@example.com',
      avatar_url: null,
      timezone: 'Asia/Shanghai',
      phone_verified: true,
      real_name_status: 'unverified',
      is_staff: false,
      is_superuser: false,
    });

    const state = await getInitialState();

    const user = await state.fetchUserInfo?.();
    expect(user).toEqual(
      expect.objectContaining({ username: 'fetched-user', is_staff: false }),
    );
  });

  it('layout actions should expose a header button to open theme settings', async () => {
    const setInitialState = vi.fn();
    const { layout } = await import('./app');

    const config = layout({
      initialState: {
        settings: { navTheme: 'light' },
      },
      setInitialState,
    } as any);

    const actionsRender = config.actionsRender as
      | (() => React.ReactNode[])
      | undefined;

    render(<>{actionsRender?.().filter(Boolean)}</>);

    fireEvent.click(screen.getByRole('button', { name: '界面设置' }));

    expect(setInitialState).toHaveBeenCalled();
  });

  it('should hide the footer in the authenticated layout', async () => {
    const { layout } = await import('./app');

    const config = layout({
      initialState: {
        settings: { navTheme: 'light' },
      },
      setInitialState: vi.fn(),
    } as any);

    expect(config.footerRender).toBe(false);
  });

  it('should render icons for nested menu items', async () => {
    const { layout } = await import('./app');
    const config = layout({
      initialState: { settings: { navTheme: 'light' } },
      setInitialState: vi.fn(),
    } as any);
    const menuItem = {
      path: '/space/organization',
      pro_layout_parentKeys: ['/space'],
      icon: <span data-testid="nested-menu-icon" />,
    };
    const defaultDom = (
      <div>
        <span style={{ display: 'none' }} />
        <span>组织架构</span>
      </div>
    );
    const menuItemRender = config.menuItemRender as (item: any, dom: React.ReactNode) => React.ReactNode;
    const subMenuItemRender = config.subMenuItemRender as (item: any, dom: React.ReactNode) => React.ReactNode;

    render(
      <>
        {menuItemRender(menuItem, defaultDom)}
        {subMenuItemRender(menuItem, defaultDom)}
      </>,
    );

    expect(screen.getAllByTestId('nested-menu-icon')).toHaveLength(2);
  });
});
