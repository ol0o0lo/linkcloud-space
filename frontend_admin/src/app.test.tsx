import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/components', () => ({
  AvatarDropdown: () => null,
  DocLink: () => null,
  ErrorBoundary: ({ children }: any) => children,
  Footer: () => null,
  LangDropdown: () => null,
  OfflineBanner: () => null,
  OrgSwitcher: () => null,
  VersionDropdown: () => null,
}));

vi.mock('@ant-design/pro-components', () => ({
  SettingDrawer: () => null,
}));

vi.mock('@ant-design/icons', () => ({
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
    mockGetOrganizationSwitchList.mockResolvedValue([]);
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
});
