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
  MemberWorkspacePanel: () => null,
}));
vi.mock('./components/OrganizationOverviewPanel', () => ({
  OrganizationOverviewPanel: () => null,
}));
vi.mock('./components/OrganizationTreePanel', () => ({
  OrganizationTreePanel: () => <div>组织树</div>,
}));
vi.mock('./components/TeamWorkspacePanel', () => ({
  TeamFormModal: () => null,
  TeamWorkspacePanel: ({
    onOpenRoleSettings,
  }: {
    onOpenRoleSettings?: (teamId: number) => void;
  }) => (
    <button type="button" onClick={() => onOpenRoleSettings?.(3)}>
      管理角色定义
    </button>
  ),
}));

describe('OrganizationWorkspacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '?section=members&node=all&tab=members';
  });

  it('移除重复页面标题并展示统一成员工作区', () => {
    render(<OrganizationWorkspacePage />);

    expect(
      screen.queryByRole('tab', { name: '角色权限' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('全部成员内容')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '组织架构' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /邀请成员/ }),
    ).not.toBeInTheDocument();
  });

  it('从团队角色授权页打开对应团队的角色定义', () => {
    mockLocation.search = '?section=members&node=team%3A3&tab=roles';

    render(<OrganizationWorkspacePage />);
    fireEvent.click(screen.getByRole('button', { name: '管理角色定义' }));

    expect(mockHistoryPush).toHaveBeenCalledWith(
      '/space/access?scope=team&team=3',
    );
  });
});
