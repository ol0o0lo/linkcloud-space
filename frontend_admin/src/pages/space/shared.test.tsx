import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantSelectionGuard } from './shared';

const mocks = vi.hoisted(() => ({
  createOrganization: vi.fn(),
  getNavigation: vi.fn(),
  getTeamOperations: vi.fn(),
  setInitialState: vi.fn(),
  switchList: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useModel: () => ({
    initialState: { organizations: [], selectedOrgSlug: undefined },
    setInitialState: mocks.setInitialState,
  }),
}));

vi.mock('@/components/PageContainer', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/services/openapi/appSystem', () => ({
  appsBaseApiAppContext: vi.fn(),
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiCreateOrganization: mocks.createOrganization,
  appsOrganizationsApiSelectOrg: vi.fn(),
  appsOrganizationsApiSignout: vi.fn(),
  appsOrganizationsApiSwitchList: mocks.switchList,
}));

vi.mock('@/services/manual/navigationAccess', () => ({
  getNavigationAccessCapabilities: mocks.getNavigation,
}));

vi.mock('@/services/manual/teamOperations', () => ({
  getTeamOperationsCapabilities: mocks.getTeamOperations,
}));

describe('TenantSelectionGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.switchList.mockResolvedValueOnce([]).mockResolvedValue([
      {
        id: 8,
        name: '链云深圳运营中心',
        slug: 'linkcloud-shenzhen',
        is_primary: true,
        is_current: true,
      },
    ]);
    mocks.createOrganization.mockResolvedValue({
      id: 8,
      name: '链云深圳运营中心',
      slug: 'linkcloud-shenzhen',
    });
    mocks.getNavigation.mockResolvedValue({ subscriptions: true });
    mocks.getTeamOperations.mockResolvedValue({});
  });

  it('无空间用户可创建空间并刷新当前空间状态', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <TenantSelectionGuard title="空间资料">
          <div>空间内容</div>
        </TenantSelectionGuard>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '创建空间' }));
    fireEvent.change(screen.getByPlaceholderText('例如：链云深圳运营中心'), {
      target: { value: '链云深圳运营中心' },
    });
    fireEvent.change(screen.getByPlaceholderText('例如：linkcloud-shenzhen'), {
      target: { value: 'LINKCLOUD-SHENZHEN' },
    });
    const submitButtons = screen.getAllByRole('button', {
      name: '创建空间',
    });
    fireEvent.click(submitButtons.at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(mocks.createOrganization).toHaveBeenCalledWith({
        name: '链云深圳运营中心',
        slug: 'linkcloud-shenzhen',
      });
      expect(mocks.setInitialState).toHaveBeenCalled();
    });
  });
});
