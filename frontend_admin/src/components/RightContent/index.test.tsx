import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetInitialState = vi.fn();
const mockSelectOrg = vi.fn();
const mockSwitchList = vi.fn();
const mockSetSelectedOrgSlug = vi.fn((value) => value);
const mockFetchQuery = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockGetTeamOperationsCapabilities = vi.fn();
const mockGetNavigationAccessCapabilities = vi.fn();
const mockHistoryReplace = vi.fn();
const mockMessageError = vi.fn();
const mockMessageWarning = vi.fn();

vi.mock('@umijs/max', () => ({
  useModel: () => ({
    initialState: {
      organizations: [
        { id: 1, name: 'Acme', slug: 'acme' },
        { id: 2, name: 'Beta', slug: 'beta' },
      ],
      selectedOrgSlug: 'acme',
    },
    setInitialState: mockSetInitialState,
  }),
  getAllLocales: () => [],
  getLocale: () => 'zh-CN',
  history: {
    location: { pathname: '/rental/workbench/overview' },
    push: vi.fn(),
    replace: mockHistoryReplace,
  },
  setLocale: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: mockFetchQuery,
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('antd', () => ({
  Select: ({
    allowClear,
    'aria-label': ariaLabel,
    options,
    placeholder,
    prefix,
    loading,
    suffixIcon,
    value,
    onChange,
  }: any) => (
    <div
      aria-expanded={false}
      aria-label={ariaLabel}
      data-loading={loading ? 'true' : 'false'}
      data-suffix-icon={suffixIcon === null ? 'none' : 'default'}
      role="combobox"
      tabIndex={0}
    >
      {prefix}
      <span>{placeholder}</span>
      <div data-testid="org-value">{value ?? ''}</div>
      {options.map((option: any) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
      {allowClear ? (
        <button type="button" onClick={() => onChange(undefined)}>
          清空
        </button>
      ) : null}
    </div>
  ),
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Tooltip: ({ children }: any) => <>{children}</>,
  message: {
    error: mockMessageError,
    warning: mockMessageWarning,
  },
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiSelectOrg: mockSelectOrg,
  appsOrganizationsApiSwitchList: mockSwitchList,
}));

vi.mock('@/services/manual/teamOperations', () => ({
  getTeamOperationsCapabilities: mockGetTeamOperationsCapabilities,
}));

vi.mock('@/services/manual/navigationAccess', () => ({
  getNavigationAccessCapabilities: mockGetNavigationAccessCapabilities,
}));

vi.mock('@/utils/orgSelection', () => ({
  setSelectedOrgSlug: mockSetSelectedOrgSlug,
}));

vi.mock('../HeaderDropdown', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

describe('OrgSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectOrg.mockResolvedValue({ success: true });
    mockSwitchList.mockResolvedValue([
      {
        id: 1,
        name: 'Acme',
        slug: 'acme',
        is_current: false,
        is_primary: false,
      },
      {
        id: 2,
        name: 'Beta',
        slug: 'beta',
        is_current: true,
        is_primary: false,
      },
    ]);
    mockFetchQuery.mockImplementation(async ({ queryFn }: any) => queryFn());
    mockInvalidateQueries.mockResolvedValue(undefined);
    mockGetTeamOperationsCapabilities.mockResolvedValue({
      announcement_organization_manage: true,
      announcement_team_ids: [],
      task_organization_manage: true,
      task_team_ids: [],
    });
    mockGetNavigationAccessCapabilities.mockResolvedValue({
      role_management: true,
      organization_settings: true,
      team_settings: true,
      subscriptions: true,
      analytics: true,
      allocation: true,
      notification_dispatches: true,
    });
  });

  it('selects an organization through the backend and refreshes tenant caches', async () => {
    const { OrgSwitcher } = await import('./index');

    render(<OrgSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));

    await waitFor(() => {
      expect(mockSelectOrg).toHaveBeenCalledWith(
        { slug: 'beta' },
        { skipErrorHandler: true },
      );
    });
    await waitFor(() => {
      expect(mockSwitchList).toHaveBeenCalledWith({ skipErrorHandler: true });
      expect(mockFetchQuery).toHaveBeenCalled();
      expect(mockSetSelectedOrgSlug).toHaveBeenCalledWith('beta');
      expect(mockSetInitialState).toHaveBeenCalled();
      expect(mockGetTeamOperationsCapabilities).toHaveBeenCalled();
      expect(mockGetNavigationAccessCapabilities).toHaveBeenCalled();
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
    const updateState = mockSetInitialState.mock.calls[0][0];
    expect(updateState({ existing: true })).toMatchObject({
      existing: true,
      selectedOrgSlug: 'beta',
      navigationCapabilities: {
        subscriptions: true,
        role_management: true,
      },
    });
  });

  it('切换接口失败时保留原空间并显示错误', async () => {
    mockSelectOrg.mockRejectedValueOnce(new Error('network'));
    const { OrgSwitcher } = await import('./index');

    render(<OrgSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith(
        '空间切换失败，请稍后重试。',
      );
    });
    expect(mockSetSelectedOrgSlug).not.toHaveBeenCalled();
    expect(mockSetInitialState).not.toHaveBeenCalled();
  });

  it('权限刷新失败时安全清空对应权限并提示刷新', async () => {
    mockGetNavigationAccessCapabilities.mockRejectedValueOnce(
      new Error('network'),
    );
    const { OrgSwitcher } = await import('./index');

    render(<OrgSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith(
        '空间已切换，但部分权限或数据刷新失败，请刷新页面重试。',
      );
    });
    const updateState = mockSetInitialState.mock.calls[0][0];
    expect(
      updateState({ navigationCapabilities: { subscriptions: true } }),
    ).toMatchObject({ navigationCapabilities: undefined });
  });
});
