import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { appsAccessApiListOrganizationBindings } from '@/services/openapi/accessOrganizationBindings';
import { appsAccessApiListTeamBindingsView } from '@/services/openapi/accessTeamBindings';
import { appsOrganizationsApiCreateMember, appsOrganizationsApiDeleteMember, appsOrganizationsApiGetMember, appsOrganizationsApiListMembers, appsOrganizationsApiPatchMember, appsOrganizationsApiSearchMembers } from '@/services/openapi/organizationMembers';
import { AdminToolbar, adminTableScroll, drawerWidthSm, ResponsiveActions, toolbarControlStyle, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import { TenantSectionHint, TenantSelectionGuard, formatPersonLabel, useTenantWorkspace } from '../shared';

type MemberGovernanceSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

type MemberStage = {
  color: 'blue' | 'cyan' | 'default' | 'gold' | 'green' | 'purple';
  label: string;
  summary: string;
};

const pageSize = 10;
const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};
const overviewTileStyle: React.CSSProperties = {
  height: '100%',
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--ant-color-border-secondary)',
  background: 'var(--ant-color-bg-container)',
};

function roleNames(bindings: Array<API.OrganizationBindingOut | API.TeamBindingOut>) {
  return bindings.map((item) => item.role.name);
}

function uniqueRoleNames(bindings: Array<API.OrganizationBindingOut | API.TeamBindingOut>) {
  return Array.from(new Set(roleNames(bindings)));
}

function getMemberStage(member: API.MemberOut | undefined, teamCount: number, orgBindingCount: number, teamBindingCount: number): MemberStage {
  if (!member) {
    return {
      color: 'default',
      label: '未选择成员',
      summary: '请先选择一个成员，再查看他的组织归属、权限承接和执行落点。',
    };
  }

  if (teamCount === 0) {
    return {
      color: 'gold',
      label: '待编组',
      summary: '当前还没有进入任何团队，后续团队授权、团队角色和执行分工都无从落地。',
    };
  }

  if (member.is_owner && orgBindingCount === 0) {
    return {
      color: 'purple',
      label: 'Owner 待补授权',
      summary: '已经是空间 owner，但还没有通过空间级授权明确全局治理职责，容易回到口头 owner 的状态。',
    };
  }

  if (!member.is_owner && orgBindingCount === 0 && teamBindingCount === 0) {
    return {
      color: 'gold',
      label: '待分工',
      summary: '已经在空间和团队里，但还没有拿到任何空间级或团队级职责，属于典型的“人在系统里，工作没落到人”状态。',
    };
  }

  if (orgBindingCount > 0 && teamBindingCount > 0) {
    return {
      color: 'green',
      label: '多层承接',
      summary: '同时承担空间级和团队级职责，已经进入多层治理与执行链路。',
    };
  }

  if (teamBindingCount > 0) {
    return {
      color: 'blue',
      label: '执行承接',
      summary: '已经拿到团队级职责，主要承担发房、补资料、审核或异常处理等执行工作。',
    };
  }

  return {
    color: 'cyan',
    label: '空间治理',
    summary: '已经承担空间级职责，更多负责 owner、管理员、跨团队统筹这类全局治理动作。',
  };
}

const TenantMembersPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailMemberId, setDetailMemberId] = useState<number>();
  const [selectedMemberId, setSelectedMemberId] = useState<number>();
  const [form] = Form.useForm<API.MemberIn>();

  const membersQuery = useQuery({
    queryKey: ['tenant', 'members', workspace.selectedOrgSlug, 'governance'],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const teamsQuery = useQuery({
    queryKey: ['tenant', 'member-teams', workspace.selectedOrgSlug],
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const orgBindingsQuery = useQuery({
    queryKey: ['tenant', 'member-org-bindings', workspace.selectedOrgSlug],
    queryFn: () => appsAccessApiListOrganizationBindings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const members = membersQuery.data?.items || [];
  React.useEffect(() => {
    const firstMemberId = members[0]?.pk;
    if (!selectedMemberId && firstMemberId) {
      setSelectedMemberId(firstMemberId);
    }
  }, [members, selectedMemberId]);

  const teams = teamsQuery.data?.items || [];
  const teamBindingQueries = useQueries({
    queries: teams.map((team) => ({
      queryKey: ['tenant', 'member-team-bindings', workspace.selectedOrgSlug, team.id],
      queryFn: () => appsAccessApiListTeamBindingsView({ team_id: team.id }),
      enabled: Boolean(workspace.selectedOrgSlug),
    })),
  });

  const candidateQuery = useQuery({
    queryKey: ['tenant', 'member-candidates', workspace.selectedOrgSlug, searchKeyword],
    queryFn: () => appsOrganizationsApiSearchMembers({ q: searchKeyword }),
    enabled: createOpen && searchKeyword.trim().length > 2,
  });
  const detailQuery = useQuery({
    queryKey: ['tenant', 'member-detail', workspace.selectedOrgSlug, detailMemberId],
    queryFn: () => appsOrganizationsApiGetMember({ member_id: detailMemberId! }),
    enabled: Boolean(workspace.selectedOrgSlug && detailMemberId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.MemberIn) => appsOrganizationsApiCreateMember(payload),
    onSuccess: async () => {
      setCreateOpen(false);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'teams'] });
    },
  });
  const ownerMutation = useMutation({
    mutationFn: ({ memberId, isOwner }: { memberId: number; isOwner: boolean }) => appsOrganizationsApiPatchMember({ member_id: memberId }, { is_owner: isOwner }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (memberId: number) => appsOrganizationsApiDeleteMember({ member_id: memberId }),
    onSuccess: async (_result, memberId) => {
      if (selectedMemberId === memberId) {
        setSelectedMemberId(undefined);
      }
      if (detailMemberId === memberId) {
        setDetailMemberId(undefined);
      }
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'teams'] });
    },
  });

  const memberOptions = useMemo(
    () =>
      members.map((item) => ({
        label: `${formatPersonLabel(item.user)} (${item.user.username})`,
        value: item.pk,
      })),
    [members],
  );

  const teamMapByUserId = useMemo(() => {
    const next = new Map<number, API.TeamOut[]>();
    teams.forEach((team) => {
      (team.members || []).forEach((userId) => {
        const items = next.get(userId) || [];
        items.push(team);
        next.set(userId, items);
      });
    });
    return next;
  }, [teams]);

  const orgBindingsByUserId = useMemo(() => {
    const next = new Map<number, API.OrganizationBindingOut[]>();
    (orgBindingsQuery.data || []).forEach((binding) => {
      const items = next.get(binding.user.id) || [];
      items.push(binding);
      next.set(binding.user.id, items);
    });
    return next;
  }, [orgBindingsQuery.data]);

  const teamBindings = useMemo(
    () =>
      teamBindingQueries.flatMap((query) => {
        const data = query.data || [];
        return data;
      }),
    [teamBindingQueries],
  );
  const teamBindingsByUserId = useMemo(() => {
    const next = new Map<number, API.TeamBindingOut[]>();
    teamBindings.forEach((binding) => {
      const items = next.get(binding.user.id) || [];
      items.push(binding);
      next.set(binding.user.id, items);
    });
    return next;
  }, [teamBindings]);

  const selectedMember = useMemo(() => members.find((item) => item.pk === selectedMemberId), [members, selectedMemberId]);
  const selectedMemberTeams = selectedMember ? teamMapByUserId.get(selectedMember.user.id) || [] : [];
  const selectedMemberOrgBindings = selectedMember ? orgBindingsByUserId.get(selectedMember.user.id) || [] : [];
  const selectedMemberTeamBindings = selectedMember ? teamBindingsByUserId.get(selectedMember.user.id) || [] : [];
  const selectedMemberStage = getMemberStage(selectedMember, selectedMemberTeams.length, selectedMemberOrgBindings.length, selectedMemberTeamBindings.length);

  const ownerCount = members.filter((item) => item.is_owner).length;
  const unassignedMembers = members.filter((item) => (teamMapByUserId.get(item.user.id) || []).length === 0);
  const membersWithoutBindings = members.filter((item) => {
    const orgCount = (orgBindingsByUserId.get(item.user.id) || []).length;
    const teamCount = (teamBindingsByUserId.get(item.user.id) || []).length;
    return orgCount === 0 && teamCount === 0;
  });
  const ownersWithoutOrgBindings = members.filter((item) => item.is_owner && (orgBindingsByUserId.get(item.user.id) || []).length === 0);

  const closureSignals = useMemo<MemberGovernanceSignal[]>(
    () => [
      {
        key: 'org-placement',
        title: '组织编组',
        emphasis: unassignedMembers.length ? `${unassignedMembers.length} 人未纳入团队` : '成员已完成编组',
        summary: unassignedMembers.length
          ? `当前仍有 ${unassignedMembers.length} 名成员没有进入任何团队，后续发房、补资料和异常处理很难落到稳定责任单元。`
          : '当前空间成员都已经进入至少一个团队，组织编组基础相对完整。',
        description: '成员先进入团队，后面才谈得上团队授权、团队角色和团队级策略例外。',
        actionLabel: '查看团队管理',
        actionHref: '/dashboard/tenant/teams',
      },
      {
        key: 'owner-governance',
        title: 'Owner 治理',
        emphasis: ownersWithoutOrgBindings.length ? `${ownersWithoutOrgBindings.length} 人待补空间职责` : 'Owner 已承接空间职责',
        summary: ownersWithoutOrgBindings.length
          ? `当前有 ${ownersWithoutOrgBindings.length} 名 owner 还没有落到空间级授权上，容易形成“名义 owner”和“实际治理人”分离。`
          : '当前 owner 与空间级治理职责已经基本对齐。',
        description: 'owner 不应该只停留在布尔字段，还要映射到空间级治理和全局异常收口职责。',
        actionLabel: '进入空间授权',
        actionHref: '/dashboard/access/organization-bindings',
      },
      {
        key: 'responsibility',
        title: '职责承接',
        emphasis: membersWithoutBindings.length ? `${membersWithoutBindings.length} 人待补职责` : '成员已有职责落点',
        summary: membersWithoutBindings.length
          ? `还有 ${membersWithoutBindings.length} 名成员没有拿到空间级或团队级职责，成员治理仍然停在通讯录层。`
          : '当前成员都已经具备明确的空间级或团队级职责承接。',
        description: '租房中后台里，成员要么承担全局治理，要么承担团队执行，不能长期处于“系统里有这个人，但没人知道他负责什么”的状态。',
        actionLabel: '进入团队授权',
        actionHref: '/dashboard/access/team-bindings',
      },
      {
        key: 'selected-member',
        title: '当前成员执行面',
        emphasis: selectedMember ? `${selectedMemberStage.label} / ${selectedMemberTeams.length} 个团队` : '请先选择成员',
        summary: selectedMember
          ? `${formatPersonLabel(selectedMember.user)} 当前${selectedMemberStage.summary}`
          : '先选一个成员，才能看清楚他在团队、角色和职责上的落点。',
        description: '这一层把成员从“用户记录”变成“组织执行单元”，才能继续管理 owner、角色、团队和局部策略。',
        actionLabel: '查看团队设置',
        actionHref: '/dashboard/settings-management/team',
      },
    ],
    [membersWithoutBindings.length, ownersWithoutOrgBindings.length, selectedMember, selectedMemberStage.label, selectedMemberStage.summary, selectedMemberTeams.length, unassignedMembers.length],
  );

  const filteredMembers = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) {
      return members;
    }
    return members.filter((item) => {
      const haystack = [formatPersonLabel(item.user), item.user.username, item.user.email || ''].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [members, q]);
  const pagedMembers = filteredMembers.slice((page - 1) * pageSize, page * pageSize);

  const teamBindingsLoading = teamBindingQueries.some((query) => query.isLoading);
  const columns: ColumnsType<API.MemberOut> = useMemo(
    () => [
      {
        title: '成员',
        dataIndex: 'user',
        width: 240,
        render: (_value, record) => (
          <Space orientation="vertical" size={4}>
            <Space wrap size={[8, 8]}>
              <Typography.Text strong>{formatPersonLabel(record.user)}</Typography.Text>
              {selectedMemberId === record.pk ? <Tag color="blue">当前治理焦点</Tag> : null}
            </Space>
            <a href={`mailto:${record.user.email || ''}`}>{record.user.email || '无邮箱'}</a>
          </Space>
        ),
      },
      {
        title: '组织身份',
        dataIndex: 'is_owner',
        width: 260,
        render: (value, record) => {
          const bindings = orgBindingsByUserId.get(record.user.id) || [];
          return (
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Space wrap size={[8, 8]}>
                <Tag color={value ? 'purple' : 'default'}>{value ? 'Owner' : '普通成员'}</Tag>
                {uniqueRoleNames(bindings).map((name) => (
                  <Tag key={name} color="cyan">
                    {name}
                  </Tag>
                ))}
              </Space>
              <Switch checked={value} loading={ownerMutation.isPending} onChange={(checked) => void ownerMutation.mutateAsync({ memberId: record.pk, isOwner: checked })} />
            </Space>
          );
        },
      },
      {
        title: '团队归属',
        dataIndex: 'teams',
        width: 260,
        render: (_value, record) => {
          const memberTeams = teamMapByUserId.get(record.user.id) || [];
          return (
            <Space orientation="vertical" size={4}>
              <Space wrap size={[8, 8]}>
                {memberTeams.length ? (
                  memberTeams.map((team) => (
                    <Tag key={team.id} color="blue">
                      {team.name}
                    </Tag>
                  ))
                ) : (
                  <Tag color="gold">未入团队</Tag>
                )}
              </Space>
              <Typography.Text type="secondary">{memberTeams.length ? `已进入 ${memberTeams.length} 个团队。` : '建议先纳入稳定执行团队。'}</Typography.Text>
            </Space>
          );
        },
      },
      {
        title: '职责承接',
        dataIndex: 'bindings',
        width: 300,
        render: (_value, record) => {
          const orgBindings = orgBindingsByUserId.get(record.user.id) || [];
          const teamBindingsForUser = teamBindingsByUserId.get(record.user.id) || [];
          const roleTexts = [...uniqueRoleNames(orgBindings), ...uniqueRoleNames(teamBindingsForUser)];
          return (
            <Space orientation="vertical" size={4}>
              <Typography.Text>{roleTexts.length ? roleTexts.join('、') : '暂无明确职责'}</Typography.Text>
              <Typography.Text type="secondary">
                {roleTexts.length ? `空间级 ${orgBindings.length} 条，团队级 ${teamBindingsForUser.length} 条。` : '当前还没有空间级或团队级职责承接。'}
              </Typography.Text>
            </Space>
          );
        },
      },
      {
        title: '治理状态',
        dataIndex: 'status',
        width: 280,
        render: (_value, record) => {
          const memberTeams = teamMapByUserId.get(record.user.id) || [];
          const orgBindings = orgBindingsByUserId.get(record.user.id) || [];
          const teamBindingsForUser = teamBindingsByUserId.get(record.user.id) || [];
          const stage = getMemberStage(record, memberTeams.length, orgBindings.length, teamBindingsForUser.length);
          return (
            <Space orientation="vertical" size={4}>
              <Tag color={stage.color}>{stage.label}</Tag>
              <Typography.Text type="secondary">{stage.summary}</Typography.Text>
            </Space>
          );
        },
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 160,
        render: (_value, record) => (
          <ResponsiveActions>
            <a onClick={() => setSelectedMemberId(record.pk)}>聚焦</a>
            <a onClick={() => setDetailMemberId(record.pk)}>详情</a>
            <Popconfirm title="确认移除该成员？" onConfirm={() => void deleteMutation.mutateAsync(record.pk)}>
              <a>移除</a>
            </Popconfirm>
          </ResponsiveActions>
        ),
      },
    ],
    [deleteMutation, orgBindingsByUserId, ownerMutation, selectedMemberId, teamBindingsByUserId, teamMapByUserId],
  );

  const detailMember = members.find((item) => item.pk === detailMemberId);
  const detailUserId = detailQuery.data?.user.id || detailMember?.user.id;
  const detailTeams = detailUserId ? teamMapByUserId.get(detailUserId) || [] : [];
  const detailOrgBindings = detailUserId ? orgBindingsByUserId.get(detailUserId) || [] : [];
  const detailTeamBindings = detailUserId ? teamBindingsByUserId.get(detailUserId) || [] : [];
  const detailStage = getMemberStage(detailQuery.data, detailTeams.length, detailOrgBindings.length, detailTeamBindings.length);

  return (
    <TenantSelectionGuard title="成员管理" subtitle="把成员从租户通讯录升级成团队归属、权限承接和执行职责的治理对象。">
      <Card>
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Typography.Text strong>成员治理焦点</Typography.Text>
            <TenantSectionHint text="先看成员是否进入团队，再判断他是否承担 owner、空间级治理或团队级执行职责。" />
          </div>
          <AdminToolbar>
            <Select
              aria-label="治理焦点成员"
              loading={membersQuery.isLoading}
              options={memberOptions}
              placeholder="选择治理焦点成员"
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              style={{ width: 320, maxWidth: '100%' }}
            />
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              添加成员
            </Button>
          </AdminToolbar>
          {selectedMember ? (
            <Alert type="info" showIcon title={`${formatPersonLabel(selectedMember.user)}：${selectedMemberStage.label}`} description={selectedMemberStage.summary} />
          ) : (
            <Alert type="warning" showIcon title="当前还没有治理焦点成员" description="如果空间还没有成员，先添加成员；如果已有成员，先选择一个成员查看归属和职责落点。" />
          )}
        </Space>
      </Card>

      <Card loading={membersQuery.isLoading || teamsQuery.isLoading || orgBindingsQuery.isLoading || teamBindingsLoading} style={{ marginTop: 16 }}>
        <div style={sectionStyle}>
          <Typography.Text strong>成员治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="空间成员" value={members.length} />
                <Typography.Text type="secondary">当前空间内纳入组织治理的成员总数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="Owner 数" value={ownerCount} />
                <Typography.Text type="secondary">{ownerCount ? '这些成员承担空间级 owner 身份。' : '当前还没有 owner。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="未纳入团队成员" value={unassignedMembers.length} />
                <Typography.Text type="secondary">{unassignedMembers.length ? '这些成员还没有进入任何执行团队。' : '当前成员都已进入团队。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="待补职责成员" value={membersWithoutBindings.length} />
                <Typography.Text type="secondary">{membersWithoutBindings.length ? '这些成员还没有拿到空间级或团队级职责。' : '当前成员都已有职责承接。'}</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>当前成员执行面</Typography.Text>
          {selectedMember ? (
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="归属团队" value={selectedMemberTeams.length} />
                  <Typography.Text type="secondary">{selectedMemberTeams.length ? `${formatPersonLabel(selectedMember.user)} 已进入 ${selectedMemberTeams.length} 个团队。` : '当前还没有团队归属。'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="空间级职责" value={selectedMemberOrgBindings.length} />
                  <Typography.Text type="secondary">{selectedMemberOrgBindings.length ? `当前已有 ${selectedMemberOrgBindings.length} 条空间级职责。` : '当前还没有空间级职责承接。'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="团队级职责" value={selectedMemberTeamBindings.length} />
                  <Typography.Text type="secondary">{selectedMemberTeamBindings.length ? `当前已有 ${selectedMemberTeamBindings.length} 条团队级职责。` : '当前还没有团队级职责承接。'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="Owner 身份" value={selectedMember.is_owner ? '是' : '否'} />
                  <Typography.Text type="secondary">{selectedMember.is_owner ? '当前具备空间 owner 身份。' : '当前不是空间 owner。'}</Typography.Text>
                </div>
              </Col>
            </Row>
          ) : (
            <Empty description="请选择一个治理焦点成员后，再查看当前成员执行面。" style={{ marginTop: 16 }} />
          )}
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {closureSignals.map((signal) => (
              <Col key={signal.key} xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap size={[8, 8]}>
                      <Typography.Text strong>{signal.title}</Typography.Text>
                      <Tag color="blue">{signal.emphasis}</Tag>
                    </Space>
                    <Typography.Text>{signal.summary}</Typography.Text>
                    <Typography.Text type="secondary">{signal.description}</Typography.Text>
                    <a href={signal.actionHref}>{signal.actionLabel}</a>
                  </Space>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </Card>

      <Card
        title="成员治理台账"
        style={{ marginTop: 16 }}
        extra={
          <AdminToolbar>
            <Input.Search
              allowClear
              placeholder="搜索姓名/邮箱"
              style={toolbarControlStyle}
              onSearch={(value) => {
                setPage(1);
                setQ(value);
              }}
            />
          </AdminToolbar>
        }
      >
        <TenantSectionHint text="这里仍然保留 owner 切换、成员详情和移除动作，但成员不再只是名册记录，而是团队归属和权限承接的治理对象台账。" />
        <Table
          rowKey="pk"
          loading={membersQuery.isLoading || teamsQuery.isLoading || orgBindingsQuery.isLoading || teamBindingsLoading}
          columns={columns}
          dataSource={pagedMembers}
          locale={{
            emptyText: (
              <Empty
                description={members.length ? '没有匹配的成员，请调整搜索条件。' : '当前还没有成员，先添加一个可以承接房源治理动作的成员。'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          scroll={adminTableScroll}
          pagination={{
            current: page,
            pageSize,
            total: filteredMembers.length,
            onChange: setPage,
          }}
        />
      </Card>

      <Modal
        title="添加成员"
        open={createOpen}
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await createMutation.mutateAsync(values);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="搜索候选用户" extra="输入 3 个以上字符后会调用后端搜索可添加成员接口。">
            <Input.Search allowClear onSearch={setSearchKeyword} placeholder="姓名、用户名或邮箱" />
          </Form.Item>
          <Form.Item label="选择成员" name="user" rules={[{ required: true, message: '请选择要添加的用户' }]}>
            <Select
              showSearch
              filterOption={false}
              options={(candidateQuery.data || []).map((item) => ({
                label: `${formatPersonLabel(item)} (${item.email || item.username})`,
                value: item.pk,
              }))}
              onSearch={setSearchKeyword}
            />
          </Form.Item>
          <Form.Item label="加入后设为 Owner" name="is_owner" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="成员详情" open={Boolean(detailMemberId)} onClose={() => setDetailMemberId(undefined)} width={drawerWidthSm}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="成员">{detailQuery.data ? formatPersonLabel(detailQuery.data.user) : '-'}</Descriptions.Item>
          <Descriptions.Item label="治理状态">
            <Tag color={detailStage.color}>{detailStage.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="治理建议">
            <span style={wrapTextStyle}>{detailStage.summary}</span>
          </Descriptions.Item>
          <Descriptions.Item label="用户名">{detailQuery.data?.user.username || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">
            <span style={wrapTextStyle}>{detailQuery.data?.user.email || '-'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Owner">{detailQuery.data?.is_owner ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="归属团队">
            <span style={wrapTextStyle}>{detailTeams.length ? detailTeams.map((team) => team.name).join('、') : '暂无团队归属'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="空间级职责">
            <span style={wrapTextStyle}>{detailOrgBindings.length ? uniqueRoleNames(detailOrgBindings).join('、') : '暂无空间级职责'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="团队级职责">
            <span style={wrapTextStyle}>{detailTeamBindings.length ? uniqueRoleNames(detailTeamBindings).join('、') : '暂无团队级职责'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="加入时间">{detailQuery.data?.created_at ? dayjs(detailQuery.data.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{detailQuery.data?.updated_at ? dayjs(detailQuery.data.updated_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        </Descriptions>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default TenantMembersPage;
