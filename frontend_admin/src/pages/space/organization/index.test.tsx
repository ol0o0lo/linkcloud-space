import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationWorkspacePage from './index';

const { mockHistoryPush, mockHistoryReplace, mockLocation } = vi.hoisted(
  () => ({
    mockHistoryPush: vi.fn(),
    mockHistoryReplace: vi.fn(),
    mockLocation: {
      search: '?section=members&node=all&tab=members',
    },
  }),
);

const requestTransition = vi.fn(
  async (transition: () => void | Promise<void>) => transition(),
);

vi.mock('@umijs/max', () => ({
  history: { push: mockHistoryPush, replace: mockHistoryReplace },
  useLocation: () => mockLocation,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      organization: { name: '测试空间' },
      member_count: 1,
      owner_count: 1,
      pending_invite_count: 0,
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
        team_update_ids: [3],
        team_delete_ids: [3],
        team_member_manage_ids: [3],
        team_role_view_ids: [3],
        team_role_manage_ids: [3],
      },
    },
    error: null,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) =>
    children,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'test', queryClient: {} }),
}));

vi.mock('./hooks/useUnsavedWorkspaceGuard', () => ({
  useUnsavedWorkspaceGuard: () => ({ dialog: null, requestTransition }),
}));

vi.mock('./components/AllMembersPanel', () => ({
  AllMembersPanel: () => <div>全部成员内容</div>,
}));
vi.mock('./components/InviteMemberModal', () => ({
  InviteMemberModal: () => null,
}));
vi.mock('./components/InvitationWorkspacePanel', () => ({
  InvitationWorkspacePanel: () => null,
}));
vi.mock('./components/MemberWorkspacePanel', () => ({
  MemberWorkspacePanel: ({
    onOpenRoleSettings,
  }: {
    onOpenRoleSettings?: (
      scope: 'organization' | 'team',
      teamId?: number,
    ) => void;
  }) => (
    <button type="button" onClick={() => onOpenRoleSettings?.('team', 3)}>
      打开成员角色设置
    </button>
  ),
}));
vi.mock('./components/OrganizationOverviewPanel', () => ({
  OrganizationOverviewPanel: () => null,
}));
vi.mock('./components/OrganizationTreePanel', () => ({
  OrganizationTreePanel: () => <div>组织树</div>,
}));
vi.mock('./components/TeamWorkspacePanel', () => ({
  TeamFormModal: () => null,
  TeamWorkspacePanel: () => <div>团队工作区</div>,
}));
vi.mock('@/pages/access', () => ({
  RoleManagementPage: ({
    embeddedScope,
  }: {
    embeddedScope: { kind: 'space' | 'team' };
  }) => <div>嵌入角色管理：{embeddedScope.kind}</div>,
}));

describe('OrganizationWorkspacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '?section=members&node=all&tab=members';
  });

  it('空间角色在组织架构内直接显示', () => {
    mockLocation.search = '?section=members&node=organization&tab=roles';

    render(<OrganizationWorkspacePage />);

    expect(screen.getByText('嵌入角色管理：space')).toBeInTheDocument();
    expect(mockHistoryPush).not.toHaveBeenCalled();
  });

  it('成员角色设置切换到组织架构内的团队角色页', () => {
    mockLocation.search = '?section=members&node=member%3A8&tab=access';

    render(<OrganizationWorkspacePage />);
    fireEvent.click(screen.getByRole('button', { name: '打开成员角色设置' }));

    expect(mockHistoryPush).toHaveBeenCalledWith(
      '/space/organization?section=members&node=team%3A3&tab=roles',
    );
  });
});
