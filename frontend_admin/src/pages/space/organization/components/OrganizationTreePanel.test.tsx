import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationTreePanel } from './OrganizationTreePanel';

const { fetchQuery } = vi.hoisted(() => ({ fetchQuery: vi.fn() }));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: undefined,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ fetchQuery }),
}));

vi.mock('@/pages/space/shared', () => ({
  formatPersonLabel: () => '测试成员',
  useTenantWorkspace: () => ({ selectedOrgSlug: 'lan' }),
}));

describe('OrganizationTreePanel', () => {
  beforeEach(() => {
    fetchQuery.mockReset();
    fetchQuery.mockResolvedValue({ items: [], page: 1, total: 0 });
  });

  it('触发组织导航动作并按需加载未分组成员', () => {
    const onCreateTeam = vi.fn();
    const onOpenOrganization = vi.fn();
    const onOpenRoles = vi.fn();
    const onOpenInvites = vi.fn();

    render(
      <OrganizationTreePanel
        activeUtility="roles"
        canCreateTeam
        canInvite
        canViewRoles
        navigation={{
          organization: { id: 1, name: 'LAN', slug: 'lan' },
          member_count: 1,
          owner_count: 1,
          pending_invite_count: 1,
          team_count: 1,
          teams: [{ id: 3, name: '运营组', member_count: 1 }],
          unassigned_responsibility_count: 0,
          ungrouped_member_count: 0,
          capabilities: {
            member_manage: true,
            invite_manage: true,
            role_view: true,
            role_manage: true,
            team_create: true,
            responsibility_manage: true,
            team_update_ids: [],
            team_delete_ids: [],
            team_member_manage_ids: [],
            team_role_view_ids: [],
            team_role_manage_ids: [],
          },
        }}
        selectedNode="all"
        onCreateTeam={onCreateTeam}
        onOpenInvites={onOpenInvites}
        onOpenOrganization={onOpenOrganization}
        onOpenRoles={onOpenRoles}
        onRetry={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const inviteRecordButtons = screen.getAllByRole('button', {
      name: '邀请记录',
    });
    fireEvent.click(inviteRecordButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: '新建团队' }));
    fireEvent.click(screen.getByRole('button', { name: '组织资料' }));
    const roleManagementButton = screen.getByRole('button', {
      name: '角色管理',
    });
    fireEvent.click(roleManagementButton);
    fireEvent.click(inviteRecordButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: '展开未分组成员' }));

    expect(onCreateTeam).toHaveBeenCalledOnce();
    expect(onOpenOrganization).toHaveBeenCalledOnce();
    expect(onOpenRoles).toHaveBeenCalledOnce();
    expect(onOpenInvites).toHaveBeenCalledTimes(2);
    expect(fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining([
          'members',
          expect.objectContaining({ ungrouped: true }),
        ]),
      }),
    );
  });
});
