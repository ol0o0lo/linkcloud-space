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
const mockHistoryReplace = vi.fn();

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
    suffixIcon,
    value,
    onChange,
  }: any) => (
    <div
      aria-expanded={false}
      aria-label={ariaLabel}
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
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiSelectOrg: mockSelectOrg,
  appsOrganizationsApiSwitchList: mockSwitchList,
}));

vi.mock('@/services/manual/teamOperations', () => ({
  getTeamOperationsCapabilities: mockGetTeamOperationsCapabilities,
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
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });

  it('labels the organization selector as the current space', async () => {
    const { OrgSwitcher } = await import('./index');

    render(<OrgSwitcher />);

    expect(
      screen.getByRole('combobox', { name: '当前空间' }),
    ).toBeInTheDocument();
    expect(screen.getByText('当前空间')).toBeInTheDocument();
    expect(screen.getByText('选择空间')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '当前空间' })).toHaveAttribute(
      'data-suffix-icon',
      'none',
    );
  });

  it('does not expose a clear action for the current space selector', async () => {
    const { OrgSwitcher } = await import('./index');

    render(<OrgSwitcher />);

    expect(
      screen.queryByRole('button', { name: '清空' }),
    ).not.toBeInTheDocument();
  });
});
