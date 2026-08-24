import {
  DownOutlined,
  RightOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Empty,
  Input,
  Skeleton,
  Tooltip,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { TreeSectionHeader } from '@/components/TreeSectionHeader';
import { formatPersonLabel, useTenantWorkspace } from '@/pages/space/shared';
import {
  appsOrganizationsWorkspaceApiListWorkspaceMembers,
  appsOrganizationsWorkspaceApiSearchWorkspace,
} from '@/services/openapi/organizationWorkspace';
import { type OrganizationNode, teamIdFromNode } from '../model';
import { organizationQueryKeys } from '../queryKeys';
import { useStyles } from '../styles';

type MemberPage = {
  items: API.WorkspaceMemberOut[];
  page: number;
  total: number;
};

export type OrganizationTreeUtility = 'organization' | 'invites';

export const OrganizationTreePanel: React.FC<{
  activeUtility?: OrganizationTreeUtility;
  navigation?: API.OrganizationNavigationOut;
  loading?: boolean;
  error?: Error | null;
  selectedNode: OrganizationNode;
  canCreateTeam?: boolean;
  canInvite?: boolean;
  canViewRoles?: boolean;
  onCreateTeam?: () => void;
  onOpenInvites?: () => void;
  onOpenOrganization?: () => void;
  onOpenRoles?: () => void;
  onRetry: () => void;
  onSelect: (node: OrganizationNode) => void;
}> = ({
  activeUtility,
  canCreateTeam,
  canInvite,
  canViewRoles,
  error,
  loading,
  navigation,
  onCreateTeam,
  onOpenInvites,
  onOpenOrganization,
  onOpenRoles,
  onRetry,
  onSelect,
  selectedNode,
}) => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [teamMembers, setTeamMembers] = useState<Record<number, MemberPage>>(
    {},
  );
  const [teamMemberErrors, setTeamMemberErrors] = useState<
    Record<number, string | undefined>
  >({});
  const [loadingTeamIds, setLoadingTeamIds] = useState<
    Record<number, boolean | undefined>
  >({});
  const [expandedTeamIds, setExpandedTeamIds] = useState<number[]>([]);
  const [ungroupedExpanded, setUngroupedExpanded] = useState(false);
  const [ungroupedMembers, setUngroupedMembers] = useState<MemberPage>();
  const [ungroupedError, setUngroupedError] = useState<string>();
  const [ungroupedLoading, setUngroupedLoading] = useState(false);
  const selectedTeamId = teamIdFromNode(selectedNode);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const searchQuery = useQuery({
    queryKey: organizationQueryKeys.search(
      workspace.selectedOrgSlug,
      debouncedSearch,
    ),
    queryFn: () =>
      appsOrganizationsWorkspaceApiSearchWorkspace({
        keyword: debouncedSearch,
      }),
    enabled: Boolean(workspace.selectedOrgSlug && debouncedSearch),
  });
  const loadTeamPage = useCallback(
    async (teamId: number, page = 1) => {
      setLoadingTeamIds((current) => ({ ...current, [teamId]: true }));
      setTeamMemberErrors((current) => ({
        ...current,
        [teamId]: undefined,
      }));
      try {
        const data = await queryClient.fetchQuery({
          queryKey: organizationQueryKeys.members(workspace.selectedOrgSlug, {
            page,
            teamId,
          }),
          queryFn: () =>
            appsOrganizationsWorkspaceApiListWorkspaceMembers({
              page,
              page_size: 50,
              team_id: teamId,
            }),
        });
        setTeamMembers((current) => {
          const previous = current[teamId];
          const merged = new Map<number, API.WorkspaceMemberOut>();
          for (const item of [...(previous?.items || []), ...data.items])
            merged.set(item.member_id, item);
          return {
            ...current,
            [teamId]: { items: [...merged.values()], page, total: data.total },
          };
        });
      } catch (error) {
        setTeamMemberErrors((current) => ({
          ...current,
          [teamId]: error instanceof Error ? error.message : '团队成员加载失败',
        }));
      } finally {
        setLoadingTeamIds((current) => ({ ...current, [teamId]: false }));
      }
    },
    [queryClient, workspace.selectedOrgSlug],
  );

  const loadUngroupedPage = useCallback(
    async (page = 1) => {
      setUngroupedLoading(true);
      setUngroupedError(undefined);
      try {
        const data = await queryClient.fetchQuery({
          queryKey: organizationQueryKeys.members(workspace.selectedOrgSlug, {
            page,
            ungrouped: true,
          }),
          queryFn: () =>
            appsOrganizationsWorkspaceApiListWorkspaceMembers({
              page,
              page_size: 50,
              ungrouped: true,
            }),
        });
        setUngroupedMembers((previous) => {
          const merged = new Map<number, API.WorkspaceMemberOut>();
          for (const item of [...(previous?.items || []), ...data.items])
            merged.set(item.member_id, item);
          return { items: [...merged.values()], page, total: data.total };
        });
      } catch (error) {
        setUngroupedError(
          error instanceof Error ? error.message : '未分组成员加载失败',
        );
      } finally {
        setUngroupedLoading(false);
      }
    },
    [queryClient, workspace.selectedOrgSlug],
  );

  useEffect(() => {
    if (!selectedTeamId) return;
    setExpandedTeamIds([selectedTeamId]);
    void loadTeamPage(selectedTeamId);
  }, [loadTeamPage, selectedTeamId]);

  useEffect(() => {
    if (selectedNode !== 'ungrouped') return;
    setUngroupedExpanded(true);
    if (!ungroupedMembers) void loadUngroupedPage();
  }, [loadUngroupedPage, selectedNode, ungroupedMembers]);

  const toggleTeam = async (teamId: number) => {
    const expanded = expandedTeamIds.includes(teamId);
    setExpandedTeamIds(expanded ? [] : [teamId]);
    if (!expanded && !teamMembers[teamId]) await loadTeamPage(teamId);
  };

  const selectTeam = async (teamId: number) => {
    onSelect(`team:${teamId}`);
    if (!expandedTeamIds.includes(teamId)) {
      setExpandedTeamIds([teamId]);
      if (!teamMembers[teamId]) await loadTeamPage(teamId);
    }
  };

  const toggleUngrouped = async () => {
    const nextExpanded = !ungroupedExpanded;
    setUngroupedExpanded(nextExpanded);
    if (nextExpanded && !ungroupedMembers) await loadUngroupedPage();
  };

  const selectUngrouped = () => {
    onSelect('ungrouped');
    if (!ungroupedExpanded) setUngroupedExpanded(true);
  };

  const clearSearch = () => setSearch('');

  const renderLeafRow = ({
    count,
    icon,
    label,
    nested = false,
    node,
  }: {
    count?: number | string;
    icon: React.ReactNode;
    label: string;
    nested?: boolean;
    node: OrganizationNode;
  }) => (
    <div
      className={`${styles.treeRow} ${nested ? styles.treeChildRow : ''}`}
      data-active={selectedNode === node}
      key={node}
    >
      {icon}
      <Button
        type="text"
        className={styles.treeLabelButton}
        aria-current={selectedNode === node ? 'page' : undefined}
        onClick={() => onSelect(node)}
      >
        {label}
      </Button>
      {count !== undefined ? (
        <span className={`${styles.treeCount} organization-row-count`}>
          {count}
        </span>
      ) : null}
    </div>
  );

  return (
    <aside className={styles.treePanel} aria-label="组织架构导航">
      <div className={styles.treeHeader}>
        <div className={styles.treeHeading}>
          <span className={styles.treeHeadingLabel}>
            <span className={styles.treeHeadingIcon} aria-hidden="true">
              <AppIcon name="organization" />
            </span>
            <Typography.Text strong>组织架构</Typography.Text>
          </span>
          {canInvite && onOpenInvites ? (
            <Tooltip title="邀请记录">
              <Button
                type="text"
                size="small"
                className={styles.treeHeadingAction}
                data-active={activeUtility === 'invites'}
                aria-label="邀请记录"
                icon={<UserAddOutlined />}
                onClick={onOpenInvites}
              />
            </Tooltip>
          ) : null}
        </div>
        <Input.Search
          allowClear
          className={styles.treeSearch}
          aria-label="搜索团队或成员"
          placeholder="搜索团队 / 成员"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className={styles.treeBody}>
        {error ? (
          <Alert
            type="error"
            showIcon
            title="组织架构加载失败"
            description={error.message}
            action={<Button onClick={onRetry}>重新加载</Button>}
          />
        ) : debouncedSearch ? (
          searchQuery.isError ? (
            <Alert
              type="error"
              showIcon
              title="搜索失败"
              action={
                <Button onClick={() => searchQuery.refetch()}>重试</Button>
              }
            />
          ) : searchQuery.isLoading ? (
            <Typography.Text type="secondary">正在搜索…</Typography.Text>
          ) : searchQuery.data &&
            (searchQuery.data.teams.length ||
              searchQuery.data.members.length) ? (
            <div>
              {searchQuery.data.teams.length ? (
                <div>
                  <span className={styles.treeSectionLabel}>团队</span>
                  {searchQuery.data.teams.map((team) => (
                    <div
                      className={styles.treeRow}
                      data-active={selectedNode === `team:${team.id}`}
                      key={team.id}
                    >
                      <AppIcon name="team" />
                      <Button
                        type="text"
                        className={styles.treeLabelButton}
                        onClick={() => {
                          clearSearch();
                          void selectTeam(team.id);
                        }}
                      >
                        {team.name}
                      </Button>
                      <span
                        className={`${styles.treeCount} organization-row-count`}
                      >
                        {team.member_count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {searchQuery.data.members.length ? (
                <div>
                  <span className={styles.treeSectionLabel}>员工</span>
                  {searchQuery.data.members.map((member) => (
                    <div
                      className={styles.treeRow}
                      data-active={
                        selectedNode === `member:${member.member_id}`
                      }
                      key={member.member_id}
                    >
                      <AppIcon name="member" />
                      <Button
                        type="text"
                        className={styles.treeLabelButton}
                        onClick={() => {
                          clearSearch();
                          onSelect(`member:${member.member_id}`);
                        }}
                      >
                        {formatPersonLabel(member.user)}
                      </Button>
                      <span
                        className={`${styles.treeCount} organization-row-count`}
                      >
                        {member.teams.length
                          ? `${member.teams.length} 个团队`
                          : '未分组'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="没有找到匹配的团队或成员"
            >
              <Button onClick={() => setSearch('')}>清空搜索</Button>
            </Empty>
          )
        ) : loading ? (
          <Skeleton
            active
            className={styles.treeLoadingSkeleton}
            paragraph={{ rows: 8 }}
            title={false}
          />
        ) : navigation ? (
          <>
            <div className={styles.treePrimaryLinks}>
              {renderLeafRow({
                node: 'all',
                icon: <AppIcon name="contact" />,
                label: '所有成员',
                count: navigation.member_count,
              })}
            </div>
            <TreeSectionHeader
              title="团队"
              createAction={
                canCreateTeam && onCreateTeam
                  ? { label: '新建团队', onClick: onCreateTeam }
                  : undefined
              }
            />

            {navigation.teams.map((team) => {
              const expanded = expandedTeamIds.includes(team.id);
              const loaded = teamMembers[team.id];
              const loadError = teamMemberErrors[team.id];
              const loadingMembers = Boolean(loadingTeamIds[team.id]);
              return (
                <div key={team.id}>
                  <div
                    className={styles.treeRow}
                    data-active={selectedNode === `team:${team.id}`}
                  >
                    <Button
                      type="text"
                      size="small"
                      className={styles.treeExpandButton}
                      aria-label={`${expanded ? '收起' : '展开'}${team.name}`}
                      icon={expanded ? <DownOutlined /> : <RightOutlined />}
                      onClick={() => void toggleTeam(team.id)}
                    />
                    <AppIcon name="team" />
                    <Button
                      type="text"
                      className={styles.treeLabelButton}
                      aria-current={
                        selectedNode === `team:${team.id}` ? 'page' : undefined
                      }
                      onClick={() => void selectTeam(team.id)}
                    >
                      {team.name}
                    </Button>
                    <span
                      className={`${styles.treeCount} organization-row-count`}
                    >
                      {team.member_count}
                    </span>
                  </div>
                  <div
                    aria-hidden={!expanded}
                    className={styles.treeChildMotion}
                    data-expanded={expanded}
                  >
                    <div className={styles.treeChildMotionInner}>
                      <div
                        className={styles.treeChildList}
                        data-show-line={Boolean(loaded?.items.length)}
                      >
                        {expanded && loadingMembers && !loaded ? (
                          <Skeleton
                            active
                            className={styles.treeLoadingSkeleton}
                            paragraph={{ rows: 1 }}
                            title={false}
                          />
                        ) : null}
                        {expanded && loadError ? (
                          <div className={styles.treeLoadError}>
                            <Typography.Text type="danger" ellipsis>
                              {loadError}
                            </Typography.Text>
                            <Button
                              type="link"
                              size="small"
                              loading={loadingMembers}
                              onClick={() => void loadTeamPage(team.id)}
                            >
                              重试
                            </Button>
                          </div>
                        ) : null}
                        {loaded?.items.map((member) =>
                          renderLeafRow({
                            node: `member:${member.member_id}`,
                            icon: <AppIcon name="member" />,
                            label: formatPersonLabel(member.user),
                            nested: true,
                          }),
                        )}
                        {loaded && loaded.items.length === 0 ? (
                          <div className={styles.treeEmptyRow}>
                            <AppIcon name="member" />
                            暂无成员
                          </div>
                        ) : null}
                        {loaded && loaded.items.length < loaded.total ? (
                          <Button
                            type="link"
                            block
                            loading={loadingMembers}
                            onClick={() =>
                              loadTeamPage(team.id, loaded.page + 1)
                            }
                          >
                            加载更多成员
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {navigation.teams.length === 0 ? (
              <div className={styles.treeEmptyRow}>
                <AppIcon name="team" />
                暂无团队
              </div>
            ) : null}

            <div className={styles.treeDivider} />
            <TreeSectionHeader title="未分组" />
            <div
              className={styles.treeRow}
              data-active={selectedNode === 'ungrouped'}
            >
              <Button
                type="text"
                size="small"
                className={styles.treeExpandButton}
                aria-label={`${ungroupedExpanded ? '收起' : '展开'}未分组成员`}
                icon={ungroupedExpanded ? <DownOutlined /> : <RightOutlined />}
                onClick={() => void toggleUngrouped()}
              />
              <AppIcon name="member" />
              <Button
                type="text"
                className={styles.treeLabelButton}
                aria-current={selectedNode === 'ungrouped' ? 'page' : undefined}
                onClick={selectUngrouped}
              >
                未分组成员
              </Button>
              <span className={`${styles.treeCount} organization-row-count`}>
                {navigation.ungrouped_member_count}
              </span>
            </div>
            <div
              aria-hidden={!ungroupedExpanded}
              className={styles.treeChildMotion}
              data-expanded={ungroupedExpanded}
            >
              <div className={styles.treeChildMotionInner}>
                <div
                  className={styles.treeChildList}
                  data-show-line={Boolean(ungroupedMembers?.items.length)}
                >
                  {ungroupedExpanded &&
                  ungroupedLoading &&
                  !ungroupedMembers ? (
                    <Skeleton
                      active
                      className={styles.treeLoadingSkeleton}
                      paragraph={{ rows: 1 }}
                      title={false}
                    />
                  ) : null}
                  {ungroupedExpanded && ungroupedError ? (
                    <div className={styles.treeLoadError}>
                      <Typography.Text type="danger" ellipsis>
                        {ungroupedError}
                      </Typography.Text>
                      <Button
                        type="link"
                        size="small"
                        loading={ungroupedLoading}
                        onClick={() => void loadUngroupedPage()}
                      >
                        重试
                      </Button>
                    </div>
                  ) : null}
                  {ungroupedMembers?.items.map((member) =>
                    renderLeafRow({
                      node: `member:${member.member_id}`,
                      icon: <AppIcon name="member" />,
                      label: formatPersonLabel(member.user),
                      nested: true,
                    }),
                  )}
                  {ungroupedMembers && ungroupedMembers.items.length === 0 ? (
                    <div className={styles.treeEmptyRow}>
                      <AppIcon name="member" />
                      暂无成员
                    </div>
                  ) : null}
                  {ungroupedMembers &&
                  ungroupedMembers.items.length < ungroupedMembers.total ? (
                    <Button
                      type="link"
                      block
                      loading={ungroupedLoading}
                      onClick={() =>
                        loadUngroupedPage(ungroupedMembers.page + 1)
                      }
                    >
                      加载更多成员
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
      <nav className={styles.treeFooter} aria-label="组织管理工具">
        <Button
          type="text"
          className={styles.treeFooterButton}
          data-active={activeUtility === 'organization'}
          aria-label="组织资料"
          icon={<AppIcon name="organization" />}
          onClick={onOpenOrganization}
        >
          组织资料
        </Button>
        {canViewRoles ? (
          <Button
            type="text"
            className={styles.treeFooterButton}
            aria-label="角色管理"
            icon={<AppIcon name="key" />}
            onClick={onOpenRoles}
          >
            角色管理
          </Button>
        ) : null}
        <Button
          type="text"
          className={styles.treeFooterButton}
          data-active={activeUtility === 'invites'}
          aria-label="邀请记录"
          icon={<AppIcon name="organization-invite" />}
          onClick={onOpenInvites}
        >
          邀请记录
        </Button>
      </nav>
    </aside>
  );
};
