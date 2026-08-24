import { MenuOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { history, useLocation } from '@umijs/max';
import { Alert, Button, Card, Drawer, Grid, message, Skeleton } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { drawerWidthSm } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import { appsOrganizationsWorkspaceApiGetNavigation } from '@/services/openapi/organizationWorkspace';
import { buildRoleManagementPath } from '@/utils/adminRouting';
import { AllMembersPanel } from './components/AllMembersPanel';
import { InvitationWorkspacePanel } from './components/InvitationWorkspacePanel';
import { InviteMemberModal } from './components/InviteMemberModal';
import {
  MemberWorkspacePanel,
  type MemberWorkspaceTab,
} from './components/MemberWorkspacePanel';
import { OrganizationOverviewPanel } from './components/OrganizationOverviewPanel';
import { OrganizationTreePanel } from './components/OrganizationTreePanel';
import type { OrganizationWorkspaceCardContext } from './components/OrganizationWorkspaceCard';
import {
  TeamFormModal,
  TeamWorkspacePanel,
  type TeamWorkspaceTab,
} from './components/TeamWorkspacePanel';
import {
  type UnsavedWorkspaceRegistration,
  useUnsavedWorkspaceGuard,
} from './hooks/useUnsavedWorkspaceGuard';
import {
  buildOrganizationLocation,
  memberIdFromNode,
  type OrganizationNode,
  type OrganizationRouteState,
  type OrganizationWorkspaceTab,
  parseOrganizationRoute,
  teamIdFromNode,
} from './model';
import { organizationQueryKeys } from './queryKeys';
import { useStyles } from './styles';

function defaultTabForNode(node: OrganizationNode) {
  if (node === 'all' || node === 'ungrouped') return 'members';
  if (node === 'organization') return 'overview';
  if (node.startsWith('team:')) return 'members';
  return 'profile';
}

const OrganizationWorkspacePage: React.FC = () => {
  const { styles } = useStyles();
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.md;
  const location = useLocation();
  const workspace = useTenantWorkspace();
  const routeState = useMemo(
    () => parseOrganizationRoute(location.search),
    [location.search],
  );
  const [treeDrawerOpen, setTreeDrawerOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const lastOrganizationTabRef = useRef<OrganizationWorkspaceTab>('overview');
  const contentPanelRef = useRef<HTMLElement>(null);
  const shouldFocusContentRef = useRef(false);
  const shouldFocusAfterDrawerCloseRef = useRef(false);
  const [unsavedRegistration, setUnsavedRegistration] =
    useState<UnsavedWorkspaceRegistration>({
      dirty: false,
      reset: () => undefined,
    });
  const unsavedGuard = useUnsavedWorkspaceGuard(unsavedRegistration);
  const navigationQuery = useQuery({
    queryKey: organizationQueryKeys.navigation(workspace.selectedOrgSlug),
    queryFn: () => appsOrganizationsWorkspaceApiGetNavigation(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const navigation = navigationQuery.data;
  const capabilities = navigation?.capabilities;

  const navigate = (
    patch: Partial<OrganizationRouteState>,
    replace = false,
  ) => {
    const target = buildOrganizationLocation(routeState, patch);
    const changesContext =
      (patch.node !== undefined && patch.node !== routeState.node) ||
      (patch.section !== undefined && patch.section !== routeState.section);
    void unsavedGuard.requestTransition(() => {
      if (changesContext) shouldFocusContentRef.current = true;
      if (replace) history.replace(target);
      else history.push(target);
    });
  };

  useEffect(() => {
    if (routeState.node === 'organization') {
      lastOrganizationTabRef.current =
        routeState.tab as OrganizationWorkspaceTab;
    }
  }, [routeState.node, routeState.section, routeState.tab]);

  useEffect(() => {
    if (
      !shouldFocusContentRef.current ||
      shouldFocusAfterDrawerCloseRef.current
    )
      return;
    shouldFocusContentRef.current = false;
    contentPanelRef.current?.focus();
  }, [routeState.node, routeState.section]);

  const selectNode = (node: OrganizationNode) => {
    if (treeDrawerOpen) shouldFocusAfterDrawerCloseRef.current = true;
    setTreeDrawerOpen(false);
    navigate({
      node,
      tab:
        node === 'organization'
          ? lastOrganizationTabRef.current
          : defaultTabForNode(node),
    });
  };

  const selectOrganizationTab = (tab: OrganizationWorkspaceTab) => {
    lastOrganizationTabRef.current = tab;
    navigate({
      section: 'members',
      node: 'organization',
      tab,
    });
  };

  const openMember = (
    memberId: number,
    tab: 'profile' | 'access' | 'responsibilities',
  ) => {
    navigate({
      section: 'members',
      node: `member:${memberId}`,
      tab,
    });
  };
  const openRoleManagement = (
    scope: 'organization' | 'team' = 'organization',
    teamId?: number,
  ) => {
    const target =
      scope === 'team' && teamId
        ? buildRoleManagementPath('team', teamId)
        : buildRoleManagementPath('space');
    void unsavedGuard.requestTransition(() => history.push(target));
  };

  const renderMembersContent = () => {
    if (!navigation)
      return (
        <Card>
          <Skeleton active />
        </Card>
      );

    const cardContext = (
      title: React.ReactNode,
    ): OrganizationWorkspaceCardContext => ({
      canManageInvites: Boolean(capabilities?.invite_manage),
      title,
    });

    if (routeState.node === 'all') {
      return (
        <AllMembersPanel
          canManageMembers={Boolean(capabilities?.member_manage)}
          onOpenMember={openMember}
          workspaceCard={cardContext('所有成员')}
        />
      );
    }

    if (routeState.node === 'organization') {
      if (routeState.tab === 'overview') {
        return (
          <OrganizationOverviewPanel
            canCreateTeam={Boolean(capabilities?.team_create)}
            navigation={navigation}
            workspaceCard={cardContext(navigation.organization.name)}
            onCreateTeam={() => setTeamModalOpen(true)}
            onDirtyStateChange={setUnsavedRegistration}
            onInvite={() => setInviteModalOpen(true)}
            onOpen={(target) => {
              if (target === 'invites') {
                selectOrganizationTab('invites');
                return;
              }
              if (target === 'ungrouped') {
                navigate({ node: 'ungrouped', tab: 'members' });
                return;
              }
              if (target === 'teams') {
                const firstTeam = navigation.teams[0];
                if (firstTeam) selectNode(`team:${firstTeam.id}`);
                else setTeamModalOpen(true);
                return;
              }
              selectNode('all');
            }}
          />
        );
      }
      if (routeState.tab === 'invites') {
        return (
          <InvitationWorkspacePanel
            canManage={Boolean(capabilities?.invite_manage)}
            canViewRoles={Boolean(capabilities?.role_view)}
            onInvite={() => setInviteModalOpen(true)}
            workspaceCard={cardContext('邀请记录')}
          />
        );
      }
    }
    if (routeState.node === 'ungrouped') {
      return (
        <AllMembersPanel
          mode="ungrouped"
          canManageMembers={Boolean(capabilities?.member_manage)}
          onOpenMember={openMember}
          workspaceCard={cardContext('未分组成员')}
        />
      );
    }
    const memberId = memberIdFromNode(routeState.node);
    if (memberId) {
      return (
        <MemberWorkspacePanel
          memberId={memberId}
          navigation={navigation}
          capabilities={navigation.capabilities}
          tab={routeState.tab as MemberWorkspaceTab}
          onDeleted={() => navigate({ node: 'all', tab: 'members' }, true)}
          onMissing={() => {
            message.warning('该成员已不存在或不再可见，已返回全部成员。');
            navigate({ node: 'all', tab: 'members' }, true);
          }}
          onDirtyStateChange={setUnsavedRegistration}
          onOpenRoleSettings={openRoleManagement}
          onTabChange={(tab) => navigate({ tab })}
        />
      );
    }
    const teamId = teamIdFromNode(routeState.node);
    if (teamId) {
      return (
        <TeamWorkspacePanel
          teamId={teamId}
          capabilities={navigation.capabilities}
          tab={routeState.tab as TeamWorkspaceTab}
          onDeleted={() => navigate({ node: 'all', tab: 'members' }, true)}
          onMissing={() => {
            message.warning('该团队已不存在或不再可见，已返回全部成员。');
            navigate({ node: 'all', tab: 'members' }, true);
          }}
          onDirtyStateChange={setUnsavedRegistration}
          onOpenMember={openMember}
          onOpenRoleSettings={(selectedTeamId) =>
            openRoleManagement('team', selectedTeamId)
          }
          onTabChange={(tab) => navigate({ tab })}
        />
      );
    }
    return null;
  };

  const activeTreeUtility =
    routeState.node === 'organization' && routeState.tab === 'overview'
      ? 'organization'
      : routeState.node === 'organization' && routeState.tab === 'invites'
        ? 'invites'
        : undefined;

  const tree = (
    <OrganizationTreePanel
      activeUtility={activeTreeUtility}
      navigation={navigation}
      loading={navigationQuery.isLoading}
      error={navigationQuery.error as Error | null}
      selectedNode={routeState.node}
      canCreateTeam={Boolean(capabilities?.team_create)}
      canInvite={Boolean(capabilities?.invite_manage)}
      canViewRoles={Boolean(capabilities?.role_view)}
      onCreateTeam={() => {
        setTreeDrawerOpen(false);
        setTeamModalOpen(true);
      }}
      onOpenOrganization={() => {
        setTreeDrawerOpen(false);
        selectOrganizationTab('overview');
      }}
      onOpenRoles={() => {
        setTreeDrawerOpen(false);
        openRoleManagement();
      }}
      onOpenInvites={() => {
        setTreeDrawerOpen(false);
        selectOrganizationTab('invites');
      }}
      onRetry={() => navigationQuery.refetch()}
      onSelect={selectNode}
    />
  );

  return (
    <TenantSelectionGuard title={false}>
      <div className={styles.page}>
        {isNarrow ? (
          <div>
            <Button
              icon={<MenuOutlined />}
              onClick={() => setTreeDrawerOpen(true)}
            >
              组织架构
            </Button>
          </div>
        ) : null}

        {navigationQuery.isError && !navigation ? (
          <Alert
            type="error"
            showIcon
            title="组织架构加载失败"
            description={(navigationQuery.error as Error).message}
            action={
              <Button onClick={() => navigationQuery.refetch()}>
                重新加载
              </Button>
            }
          />
        ) : (
          <div className={styles.workspace}>
            {!isNarrow ? tree : null}
            <main
              ref={contentPanelRef}
              className={styles.contentPanel}
              tabIndex={-1}
              aria-label="组织架构详情"
            >
              {renderMembersContent()}
            </main>
          </div>
        )}
      </div>

      <Drawer
        title="组织架构"
        open={treeDrawerOpen}
        onClose={() => setTreeDrawerOpen(false)}
        afterOpenChange={(open) => {
          if (open || !shouldFocusAfterDrawerCloseRef.current) return;
          shouldFocusAfterDrawerCloseRef.current = false;
          if (!shouldFocusContentRef.current) return;
          shouldFocusContentRef.current = false;
          window.setTimeout(() => contentPanelRef.current?.focus(), 0);
        }}
        size={drawerWidthSm}
      >
        {tree}
      </Drawer>
      <TeamFormModal
        open={teamModalOpen}
        onCancel={() => setTeamModalOpen(false)}
        onCreated={(team) => {
          setTeamModalOpen(false);
          navigate({ node: `team:${team.id}`, tab: 'profile' });
        }}
      />
      <InviteMemberModal
        open={inviteModalOpen}
        canViewRoles={Boolean(capabilities?.role_view)}
        onClose={() => setInviteModalOpen(false)}
      />
      {unsavedGuard.dialog}
    </TenantSelectionGuard>
  );
};

export default OrganizationWorkspacePage;
