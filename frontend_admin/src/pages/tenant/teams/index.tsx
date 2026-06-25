import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { appsAccessApiListTeamBindingsView } from '@/services/openapi/accessTeamBindings';
import { appsAccessApiListTeamRoles } from '@/services/openapi/accessTeamRoles';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import { appsSettingsApiListTeamSettings } from '@/services/openapi/teamSettings';
import { AdminToolbar, adminTableScroll, drawerWidthMd, ResponsiveActions, toolbarControlStyle, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsTeamsApiCreateTeam, appsTeamsApiDeleteTeam, appsTeamsApiGetTeam, appsTeamsApiListTeams, appsTeamsApiPatchTeam } from '@/services/openapi/teams';
import { TenantSectionHint, TenantSelectionGuard, formatPersonLabel, useTenantWorkspace } from '../shared';

type TeamGovernanceSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};
type TeamLike = Pick<API.TeamOut, 'members' | 'member_details'> &
  Partial<Pick<API.TeamOut, 'id' | 'name' | 'created_at' | 'updated_at'>>;

const publishRulesSettingKey = 'property_rental.publish_rules';
const defaultBuildingSettingKey = 'property_rental.default_building_id';
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

function memberCountOfTeam(team?: TeamLike | null) {
  return team?.member_details?.length || team?.members?.length || 0;
}

function teamStage(team?: TeamLike | null) {
  const memberCount = memberCountOfTeam(team);
  if (!memberCount) {
    return {
      color: 'gold' as const,
      label: '空团队',
      summary: '还没有形成可执行的团队单元，建议先补成员，再去做授权和局部策略。',
    };
  }

  if (memberCount === 1) {
    return {
      color: 'blue' as const,
      label: '单人承接',
      summary: '当前主要依赖单人承接，适合早期试点，但要尽快补第二责任人和复核角色。',
    };
  }

  return {
    color: 'green' as const,
    label: '多人协同',
    summary: '已经具备多人协同基础，适合继续补齐角色分工、授权边界和团队级例外策略。',
  };
}

function renderMemberPreview(team?: TeamLike | null) {
  const preview = (team?.member_details || []).slice(0, 3).map((item: API.MemberDetailOut) => formatPersonLabel(item));
  if (!preview.length) {
    return '暂无成员';
  }
  return preview.join('、');
}

const TenantTeamsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editingTeam, setEditingTeam] = useState<API.TeamOut | null>(null);
  const [detailTeamId, setDetailTeamId] = useState<number>();
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<API.TeamPatchIn & API.TeamIn>();

  const teamsQuery = useQuery({
    queryKey: ['tenant', 'teams', workspace.selectedOrgSlug, 'governance'],
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const membersQuery = useQuery({
    queryKey: ['tenant', 'members', workspace.selectedOrgSlug, 'governance'],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const teams = teamsQuery.data?.items || [];
  React.useEffect(() => {
    const firstTeamId = teams[0]?.id;
    if (!selectedTeamId && firstTeamId) {
      setSelectedTeamId(firstTeamId);
    }
  }, [selectedTeamId, teams]);

  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId), [selectedTeamId, teams]);
  const selectedTeamRolesQuery = useQuery({
    queryKey: ['tenant', 'team-roles', workspace.selectedOrgSlug, selectedTeamId],
    queryFn: () => appsAccessApiListTeamRoles({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });
  const selectedTeamBindingsQuery = useQuery({
    queryKey: ['tenant', 'team-bindings', workspace.selectedOrgSlug, selectedTeamId],
    queryFn: () => appsAccessApiListTeamBindingsView({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });
  const selectedTeamSettingsQuery = useQuery({
    queryKey: ['tenant', 'team-settings', workspace.selectedOrgSlug, selectedTeamId],
    queryFn: () => appsSettingsApiListTeamSettings({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });

  const detailQuery = useQuery({
    queryKey: ['tenant', 'team-detail', workspace.selectedOrgSlug, detailTeamId],
    queryFn: () => appsTeamsApiGetTeam({ team_id: detailTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && detailTeamId),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: API.TeamPatchIn & API.TeamIn) => {
      if (editingTeam) {
        return appsTeamsApiPatchTeam({ team_id: editingTeam.id }, payload);
      }
      return appsTeamsApiCreateTeam(payload);
    },
    onSuccess: async (nextTeam) => {
      setOpen(false);
      setEditingTeam(null);
      form.resetFields();
      if (nextTeam?.id) {
        setSelectedTeamId(nextTeam.id);
      }
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'teams'] });
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'usage'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (teamId: number) => appsTeamsApiDeleteTeam({ team_id: teamId }),
    onSuccess: async (_result, teamId) => {
      if (selectedTeamId === teamId) {
        setSelectedTeamId(undefined);
      }
      if (detailTeamId === teamId) {
        setDetailTeamId(undefined);
      }
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'teams'] });
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'usage'] });
    },
  });

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.items || []).map((item) => ({
        label: `${formatPersonLabel(item.user)} (${item.user.username})`,
        value: item.user.id,
      })),
    [membersQuery.data],
  );

  const totalMembers = membersQuery.data?.items?.length || 0;
  const emptyTeamCount = teams.filter((team) => memberCountOfTeam(team) === 0).length;
  const singleMemberTeamCount = teams.filter((team) => memberCountOfTeam(team) === 1).length;
  const multiMemberTeamCount = teams.filter((team) => memberCountOfTeam(team) > 1).length;
  const teamMemberIds = new Set(teams.flatMap((team) => team.members || []));
  const unassignedMembers = (membersQuery.data?.items || []).filter((item) => !teamMemberIds.has(item.user.id));

  const selectedTeamRoles = selectedTeamRolesQuery.data || [];
  const selectedTeamBindings = selectedTeamBindingsQuery.data || [];
  const selectedTeamSettings = selectedTeamSettingsQuery.data || [];
  const activeRoleCount = selectedTeamRoles.filter((item) => item.is_active).length;
  const customRoleCount = selectedTeamRoles.filter((item) => !item.is_system).length;
  const customizedSettings = selectedTeamSettings.filter((item) => item.is_customized);
  const selectedTeamStage = teamStage(selectedTeam);
  const selectedTeamMemberCount = memberCountOfTeam(selectedTeam);
  const bindingPreview = selectedTeamBindings.slice(0, 3).map((item) => formatPersonLabel(item.user));
  const customPublishRules = selectedTeamSettings.find((item) => item.key === publishRulesSettingKey && item.is_customized);
  const customDefaultBuilding = selectedTeamSettings.find((item) => item.key === defaultBuildingSettingKey && item.is_customized);

  const closureSignals = useMemo<TeamGovernanceSignal[]>(
    () => [
      {
        key: 'org-coverage',
        title: '组织编组',
        emphasis: unassignedMembers.length ? `${unassignedMembers.length} 人未纳入团队` : '成员已完成编组',
        summary: unassignedMembers.length
          ? `当前还有 ${unassignedMembers.length} 名空间成员没有进入任何团队，后续很难明确谁来执行发房、补资料和异常处理。`
          : '当前空间成员都已经进入明确团队，组织分工基础相对完整。',
        description: '成员不进团队，就无法继续承接团队角色、团队授权和团队级局部策略。',
        actionLabel: '查看成员管理',
        actionHref: '/dashboard/tenant/members',
      },
      {
        key: 'team-carry',
        title: '执行承接',
        emphasis: selectedTeam ? `${selectedTeamStage.label} / ${selectedTeamMemberCount} 人` : '请先选择团队',
        summary: selectedTeam
          ? `${selectedTeam.name} 当前${selectedTeamStage.summary}`
          : '先选一个团队，才能判断它是否具备真实的执行承接能力。',
        description: '团队不是通讯录分组，而是策略、授权和房源执行动作真正落地的责任单元。',
        actionLabel: '查看团队成员',
        actionHref: '/dashboard/tenant/teams',
      },
      {
        key: 'permission-link',
        title: '权限联动',
        emphasis: selectedTeamBindings.length ? `${selectedTeamBindings.length} 条授权` : '待补团队授权',
        summary: selectedTeamBindings.length
          ? `当前聚焦团队已有 ${selectedTeamBindings.length} 条团队级授权，开始形成角色到成员的承接闭环。`
          : '当前聚焦团队还没有团队级授权，团队再多人也很难形成清晰分工。',
        description: '团队治理到这一步，应该继续把发房、审核、补资料、清阻断分配给具体人。',
        actionLabel: '进入团队授权',
        actionHref: '/dashboard/access/team-bindings',
      },
      {
        key: 'policy-link',
        title: '策略例外',
        emphasis: customizedSettings.length ? `${customizedSettings.length} 项团队例外` : '全部继承空间口径',
        summary: customizedSettings.length
          ? `当前聚焦团队已有 ${customizedSettings.length} 项团队级局部覆盖${customPublishRules ? '，其中包含发布规则' : ''}${customDefaultBuilding ? '和默认楼栋' : ''}。`
          : '当前聚焦团队没有局部例外，策略口径完全跟随空间设置。',
        description: '策略例外应该是少量且可解释的，否则团队执行口径会慢慢偏离空间级标准。',
        actionLabel: '进入团队设置',
        actionHref: '/dashboard/settings-management/team',
      },
    ],
    [
      customDefaultBuilding,
      customPublishRules,
      customizedSettings.length,
      selectedTeam,
      selectedTeamBindings.length,
      selectedTeamMemberCount,
      selectedTeamStage.label,
      selectedTeamStage.summary,
      unassignedMembers.length,
    ],
  );

  const filteredTeams = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) {
      return teams;
    }
    return teams.filter((team) => team.name.toLowerCase().includes(keyword));
  }, [q, teams]);
  const pagedTeams = filteredTeams.slice((page - 1) * pageSize, page * pageSize);

  const columns: ColumnsType<API.TeamOut> = useMemo(
    () => [
      {
        title: '团队',
        dataIndex: 'name',
        width: 220,
        render: (_value, record) => (
          <Space orientation="vertical" size={4}>
            <Space wrap size={[8, 8]}>
              <Typography.Text strong>{record.name}</Typography.Text>
              {selectedTeamId === record.id ? <Tag color="blue">当前治理焦点</Tag> : null}
            </Space>
            <Typography.Text type="secondary">创建于 {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</Typography.Text>
          </Space>
        ),
      },
      {
        title: '成员结构',
        dataIndex: 'member_details',
        width: 300,
        render: (_value, record) => (
          <Space orientation="vertical" size={4}>
            <Space wrap size={[8, 8]}>
              <Tag color={memberCountOfTeam(record) ? 'green' : 'gold'}>{memberCountOfTeam(record)} 人</Tag>
              <Typography.Text>{renderMemberPreview(record)}</Typography.Text>
            </Space>
            <Typography.Text type="secondary">{memberCountOfTeam(record) ? '可继续补角色、授权和策略例外。' : '建议先补成员，再做任何团队级治理动作。'}</Typography.Text>
          </Space>
        ),
      },
      {
        title: '治理状态',
        dataIndex: 'governance',
        width: 160,
        render: (_value, record) => {
          const stage = teamStage(record);
          return <Tag color={stage.color}>{stage.label}</Tag>;
        },
      },
      {
        title: '执行说明',
        dataIndex: 'execution',
        width: 360,
        render: (_value, record) => {
          const stage = teamStage(record);
          return <Typography.Text type="secondary">{stage.summary}</Typography.Text>;
        },
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 180,
        render: (_value, record) => (
          <ResponsiveActions>
            <a onClick={() => setSelectedTeamId(record.id)}>聚焦</a>
            <a onClick={() => setDetailTeamId(record.id)}>详情</a>
            <a
              onClick={() => {
                setEditingTeam(record);
                setOpen(true);
                form.setFieldsValue({ name: record.name, members: record.members });
              }}
            >
              编辑
            </a>
            <Popconfirm title="确认删除该团队？" onConfirm={() => void deleteMutation.mutateAsync(record.id)}>
              <a>删除</a>
            </Popconfirm>
          </ResponsiveActions>
        ),
      },
    ],
    [deleteMutation, form, selectedTeamId],
  );

  return (
    <TenantSelectionGuard title="团队管理" subtitle="把团队从基础编组对象升级成房源经营、策略执行和权限承接的治理单元。">
      <Card>
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Typography.Text strong>团队治理焦点</Typography.Text>
            <TenantSectionHint text="先看空间成员是否完成编组，再聚焦一个团队去判断它有没有接住成员、权限和局部策略。" />
          </div>
          <AdminToolbar>
            <Select
              aria-label="治理焦点团队"
              loading={teamsQuery.isLoading}
              options={teams.map((team) => ({ label: team.name, value: team.id }))}
              placeholder="选择治理焦点团队"
              value={selectedTeamId}
              onChange={setSelectedTeamId}
              style={{ width: 320, maxWidth: '100%' }}
            />
            <Button
              type="primary"
              onClick={() => {
                setEditingTeam(null);
                form.resetFields();
                setOpen(true);
              }}
            >
              新建团队
            </Button>
          </AdminToolbar>
          {selectedTeam ? (
            <Alert
              type="info"
              showIcon
              title={`${selectedTeam.name}：${selectedTeamStage.label}`}
              description={selectedTeamStage.summary}
            />
          ) : (
            <Alert type="warning" showIcon title="当前还没有治理焦点团队" description="如果空间里还没有团队，请先创建一个可承接房源执行动作的团队。" />
          )}
        </Space>
      </Card>

      <Card loading={teamsQuery.isLoading || membersQuery.isLoading} style={{ marginTop: 16 }}>
        <div style={sectionStyle}>
          <Typography.Text strong>团队治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="空间成员" value={totalMembers} />
                <Typography.Text type="secondary">当前空间内需要被纳入团队和执行分工的成员总数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="团队数" value={teams.length} />
                <Typography.Text type="secondary">{teams.length ? '这些团队共同承接租房业务里的分工、授权和策略例外。' : '当前还没有任何团队。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="未纳入团队成员" value={unassignedMembers.length} />
                <Typography.Text type="secondary">{unassignedMembers.length ? '这些成员还没有进入任何团队，后续职责分配会断层。' : '当前空间成员都已进入团队。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="空团队" value={emptyTeamCount} />
                <Typography.Text type="secondary">{emptyTeamCount ? `${emptyTeamCount} 个团队还没有任何成员。` : '当前没有空团队。'}</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>当前团队执行面</Typography.Text>
          {selectedTeam ? (
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="团队成员" value={selectedTeamMemberCount} />
                  <Typography.Text type="secondary">{selectedTeam.name} 当前可被纳入执行链路的成员数。</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="团队授权" value={selectedTeamBindings.length} />
                  <Typography.Text type="secondary">{selectedTeamBindings.length ? `${selectedTeamBindings.length} 条团队级授权已经落到成员。` : '当前还没有团队级授权。'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="可用角色" value={activeRoleCount} />
                  <Typography.Text type="secondary">{customRoleCount ? `${customRoleCount} 个自定义角色正在支撑团队差异化分工。` : '当前主要依赖系统角色。'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="团队例外" value={customizedSettings.length} />
                  <Typography.Text type="secondary">{customizedSettings.length ? '当前团队已经有局部策略覆盖，需要跟执行口径一起维护。' : '当前团队完全继承空间策略。'}</Typography.Text>
                </div>
              </Col>
            </Row>
          ) : (
            <Empty description="请选择一个治理焦点团队后，再查看团队执行面。" style={{ marginTop: 16 }} />
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

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>组织形态</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>待补成员</Typography.Text>
                    <Tag color={unassignedMembers.length ? 'gold' : 'green'}>{unassignedMembers.length ? `${unassignedMembers.length} 人` : '已收口'}</Tag>
                  </Space>
                  <Typography.Text>{unassignedMembers.length ? '这些成员还在空间里，但没有明确归属到任何执行团队。' : '空间成员都已有团队归属。'}</Typography.Text>
                  <Typography.Text type="secondary">{unassignedMembers.slice(0, 3).map((item) => formatPersonLabel(item.user)).join('、') || '当前没有待补成员。'}</Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>单人团队</Typography.Text>
                    <Tag color={singleMemberTeamCount ? 'blue' : 'default'}>{singleMemberTeamCount ? `${singleMemberTeamCount} 个` : '无'}</Tag>
                  </Space>
                  <Typography.Text>{singleMemberTeamCount ? '这些团队已经开工，但当前主要依赖单人承接。' : '当前没有单人团队。'}</Typography.Text>
                  <Typography.Text type="secondary">单人团队适合早期试点，不适合长期承担审核、补资料和异常复核。</Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>多人协同团队</Typography.Text>
                    <Tag color={multiMemberTeamCount ? 'green' : 'default'}>{multiMemberTeamCount ? `${multiMemberTeamCount} 个` : '无'}</Tag>
                  </Space>
                  <Typography.Text>{multiMemberTeamCount ? '这些团队更适合继续细化角色分工和团队级局部策略。' : '当前还没有形成多人协同团队。'}</Typography.Text>
                  <Typography.Text type="secondary">这是最接近企业级运营单元的形态，可以继续往权限治理和策略治理串联。</Typography.Text>
                </Space>
              </div>
            </Col>
          </Row>
        </div>
      </Card>

      <Card
        title="团队治理台账"
        style={{ marginTop: 16 }}
        extra={
          <AdminToolbar>
            <Input.Search
              allowClear
              placeholder="搜索团队名"
              style={toolbarControlStyle}
              onSearch={(value) => {
                setPage(1);
                setQ(value);
              }}
            />
          </AdminToolbar>
        }
      >
        <TenantSectionHint text="这里保留团队的基础维护动作，但入口语义已经改成治理台账：先判断团队是否成型，再决定是否继续补成员、补授权和补团队级策略。" />
        <Table
          rowKey="id"
          loading={teamsQuery.isLoading}
          columns={columns}
          dataSource={pagedTeams}
          locale={{
            emptyText: (
              <Empty
                description={teams.length ? '没有匹配的团队，请调整搜索条件。' : '当前还没有团队，先创建一个可以承接房源执行动作的团队。'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          scroll={adminTableScroll}
          pagination={{
            current: page,
            pageSize,
            total: filteredTeams.length,
            onChange: setPage,
          }}
        />
      </Card>

      <Modal
        title={editingTeam ? '编辑团队' : '新建团队'}
        open={open}
        confirmLoading={saveMutation.isPending}
        onCancel={() => {
          setOpen(false);
          setEditingTeam(null);
        }}
        onOk={async () => {
          const values = await form.validateFields();
          await saveMutation.mutateAsync(values);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="团队名称" name="name" rules={[{ required: true, message: '请输入团队名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="成员" name="members" extra="团队成员是后续团队授权、团队角色和团队设置的承接主体。">
            <Select mode="multiple" allowClear options={memberOptions} placeholder="选择团队成员" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="团队详情" open={Boolean(detailTeamId)} onClose={() => setDetailTeamId(undefined)} width={drawerWidthMd}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="团队名称">{detailQuery.data?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="治理状态">
            <Tag color={teamStage(detailQuery.data).color}>{teamStage(detailQuery.data).label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="治理建议">
            <span style={wrapTextStyle}>{teamStage(detailQuery.data).summary}</span>
          </Descriptions.Item>
          <Descriptions.Item label="团队成员">
            <span style={wrapTextStyle}>{(detailQuery.data?.member_details || []).map((item) => formatPersonLabel(item)).join('、') || '暂无成员'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="成员 ID">{(detailQuery.data?.members || []).join('、') || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{detailQuery.data?.created_at ? dayjs(detailQuery.data.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{detailQuery.data?.updated_at ? dayjs(detailQuery.data.updated_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        </Descriptions>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default TenantTeamsPage;
