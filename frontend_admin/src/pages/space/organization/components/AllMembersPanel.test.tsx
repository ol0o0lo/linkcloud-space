import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AllMembersPanel } from './AllMembersPanel';

const { proTable } = vi.hoisted(() => ({ proTable: vi.fn() }));

vi.mock('@ant-design/pro-components', () => ({
  ProTable: (props: Record<string, unknown>) => {
    proTable(props);
    return <div />;
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useQuery: () => ({
    data: { items: [], total: 0 },
    error: null,
    isError: false,
    isLoading: false,
  }),
}));

vi.mock('@/pages/_shared/adminLayout', () => ({
  AdminToolbar: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  adminTableScroll: { x: 'max-content' },
}));

vi.mock('@/pages/space/shared', () => ({
  formatPersonLabel: () => '测试成员',
  useTenantWorkspace: () => ({ selectedOrgSlug: 'lan', queryClient: {} }),
}));

vi.mock('@/services/openapi/organizationMembers', () => ({
  appsOrganizationsApiCreateMember: vi.fn(),
  appsOrganizationsApiSearchMembers: vi.fn(),
}));

vi.mock('@/services/openapi/organizationWorkspace', () => ({
  appsOrganizationsWorkspaceApiListWorkspaceMembers: vi.fn(),
}));

vi.mock('./OrganizationWorkspaceCard', () => ({
  OrganizationWorkspaceCard: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
}));

describe('AllMembersPanel', () => {
  it('在受限工作区中让成员表格使用纵向滚动', () => {
    render(
      <AllMembersPanel
        canManageMembers={false}
        workspaceCard={{ canManageInvites: false, title: '所有成员' }}
        onOpenMember={vi.fn()}
      />,
    );

    expect(proTable).toHaveBeenCalledWith(
      expect.objectContaining({
        scroll: expect.objectContaining({
          x: 'max-content',
          y: 'max(240px, calc(100dvh - 320px))',
        }),
      }),
    );
  });
});
