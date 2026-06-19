import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantSelectionGuard } from './shared';

const { mockSwitchList, mockUseModel } = vi.hoisted(() => ({
  mockSwitchList: vi.fn(),
  mockUseModel: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useModel: mockUseModel,
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

vi.mock('@/services/openapi/appSystem', () => ({
  appsBaseApiAppContext: vi.fn(),
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiSelectOrg: vi.fn(),
  appsOrganizationsApiSignout: vi.fn(),
  appsOrganizationsApiSwitchList: mockSwitchList,
}));

describe('TenantSelectionGuard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseModel.mockReturnValue({
      initialState: {
        selectedOrgSlug: undefined,
      },
      setInitialState: vi.fn(),
    });

    mockSwitchList.mockResolvedValue([{ id: 1, name: 'Acme', slug: 'acme', is_current: false, is_primary: true }]);
  });

  it('shows a single-line warning when no tenant is selected', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantSelectionGuard title="成员管理">
          <div>content</div>
        </TenantSelectionGuard>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('尚未选择空间，请在右上角空间切换器中选择。')).toBeInTheDocument();
    });

    expect(screen.queryByText('尚未选择租户，请在右上角租户切换器中选择租户。')).not.toBeInTheDocument();
    expect(screen.queryByText('请先在右上角租户切换器中选择租户，或到租户概览页设置当前租户。')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '进入 Acme' })).not.toBeInTheDocument();
  });
});
