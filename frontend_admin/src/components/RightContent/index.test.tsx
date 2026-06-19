import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetInitialState = vi.fn();
const mockSelectOrg = vi.fn();
const mockSignout = vi.fn();
const mockSwitchList = vi.fn();
const mockSetSelectedOrgSlug = vi.fn((value) => value);
const mockFetchQuery = vi.fn();
const mockInvalidateQueries = vi.fn();

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
  history: { push: vi.fn() },
  setLocale: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: mockFetchQuery,
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('antd', () => ({
  Select: ({ 'aria-label': ariaLabel, options, placeholder, prefix, suffixIcon, value, onChange }: any) => (
    <div aria-label={ariaLabel} data-suffix-icon={suffixIcon === null ? 'none' : 'default'} role="combobox">
      {prefix}
      <span>{placeholder}</span>
      <div data-testid="org-value">{value ?? ''}</div>
      {options.map((option: any) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
      <button type="button" onClick={() => onChange(undefined)}>
        清空
      </button>
    </div>
  ),
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Tooltip: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiSelectOrg: mockSelectOrg,
  appsOrganizationsApiSignout: mockSignout,
  appsOrganizationsApiSwitchList: mockSwitchList,
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
    mockSignout.mockResolvedValue({ success: true });
    mockSwitchList.mockResolvedValue([
      { id: 1, name: 'Acme', slug: 'acme', is_current: false, is_primary: false },
      { id: 2, name: 'Beta', slug: 'beta', is_current: true, is_primary: false },
    ]);
    mockFetchQuery.mockImplementation(async ({ queryFn }: any) => queryFn());
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  it('selects an organization through the backend and refreshes tenant caches', async () => {
    const { OrgSwitcher } = await import('./index');

    render(<OrgSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));

    await waitFor(() => {
      expect(mockSelectOrg).toHaveBeenCalledWith({ slug: 'beta' }, { skipErrorHandler: true });
    });
    await waitFor(() => {
      expect(mockSwitchList).toHaveBeenCalledWith({ skipErrorHandler: true });
      expect(mockFetchQuery).toHaveBeenCalled();
      expect(mockSetSelectedOrgSlug).toHaveBeenCalledWith('beta');
      expect(mockSetInitialState).toHaveBeenCalled();
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });

  it('labels the organization selector as the current space', async () => {
    const { OrgSwitcher } = await import('./index');

    render(<OrgSwitcher />);

    expect(screen.getByRole('combobox', { name: '当前空间' })).toBeInTheDocument();
    expect(screen.getByText('当前空间')).toBeInTheDocument();
    expect(screen.getByText('选择空间')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '当前空间' })).toHaveAttribute('data-suffix-icon', 'none');
  });

  it('signs out the organization context when cleared and refreshes tenant caches', async () => {
    const { OrgSwitcher } = await import('./index');

    render(<OrgSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: '清空' }));

    await waitFor(() => {
      expect(mockSignout).toHaveBeenCalledWith({ skipErrorHandler: true });
    });
    await waitFor(() => {
      expect(mockSwitchList).toHaveBeenCalledWith({ skipErrorHandler: true });
      expect(mockSetSelectedOrgSlug).toHaveBeenCalledWith(undefined);
      expect(mockSetInitialState).toHaveBeenCalled();
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });
});
