import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd';
import React, { useMemo } from 'react';
import { appsAccessApiListOrganizationBindings } from '@/services/openapi/accessOrganizationBindings';
import { appsAccessApiListOrgRoles } from '@/services/openapi/accessOrganizationRoles';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { accessQueryKeys } from './shared';

type AccessSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

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

const AccessOverviewPage: React.FC = () => {
  const workspace = useTenantWorkspace();

  const orgRolesQuery = useQuery({
    queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const orgBindingsQuery = useQuery({
    queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrganizationBindings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const teamsQuery = useQuery({
    queryKey: accessQueryKeys.teams(workspace.selectedOrgSlug),
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const membersQuery = useQuery({
    queryKey: ['access', 'overview-members', workspace.selectedOrgSlug],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const orgRoles = orgRolesQuery.data || [];
  const orgBindings = orgBindingsQuery.data || [];
  const teams = teamsQuery.data?.items || [];
  const members = membersQuery.data?.items || [];

  const customOrgRoles = orgRoles.filter((role) => !role.is_system);
  const unusedOrgRoles = orgRoles.filter((role) => !orgBindings.some((binding) => binding.role.id === role.id));
  const membersWithoutOrgBindings = members.filter((member) => !orgBindings.some((binding) => binding.user.id === member.user.id));

  const signals = useMemo<AccessSignal[]>(
    () => [
      {
        key: 'global',
        title: '全局规则',
        emphasis: orgBindings.length ? `${orgBindings.length} 条空间授权` : '待建立空间承接',
        summary: orgBindings.length
          ? '空间级角色和授权已经开始承接 owner、管理员、跨团队运营等全局职责。'
          : '空间级角色还没有真正落到成员身上，空间规则缺少明确责任人。',
        description: '谁能改空间设置、谁能统筹团队治理，必须先在空间级授权里落下来。',
        actionLabel: '进入空间授权',
        actionHref: '/dashboard/access/organization-bindings',
      },
      {
        key: 'team',
        title: '团队落地',
        emphasis: teams.length ? `${teams.length} 个团队待治理` : '暂无团队',
        summary: teams.length
          ? '团队级角色和授权负责把空间规则继续下沉到实际执行层。'
          : '当前还没有团队维度治理对象，可以先把空间级职责梳理清楚。',
        description: '空间级解决“谁统筹”，团队级解决“谁执行”，两层都要完整才算闭环。',
        actionLabel: '进入团队授权',
        actionHref: '/dashboard/access/team-bindings',
      },
      {
        key: 'roles',
        title: '角色治理',
        emphasis: unusedOrgRoles.length ? `${unusedOrgRoles.length} 个空间角色闲置` : '角色都在使用',
        summary: unusedOrgRoles.length
          ? '当前仍有空间角色没有实际承接，角色设计和授权落地之间存在缝隙。'
          : '空间角色都已进入使用，角色体系和职责承接相对一致。',
        description: '角色不是越多越好，长期闲置的空间或团队角色要及时清理或重新定义场景。',
        actionLabel: '进入空间角色',
        actionHref: '/dashboard/access/organization-roles',
      },
      {
        key: 'coverage',
        title: '异常收口',
        emphasis: membersWithoutOrgBindings.length ? `${membersWithoutOrgBindings.length} 人未纳入空间级分工` : '空间级已覆盖',
        summary: membersWithoutOrgBindings.length
          ? '部分成员还没有明确的空间级职责归属，容易在跨团队协同时出现权限灰区。'
          : '当前空间成员的全局职责分工相对完整。',
        description: '空间级没分清的人，往往会在团队治理、规则修改和异常收口时变成责任真空。',
        actionLabel: '查看空间设置',
        actionHref: '/dashboard/settings-management/organization',
      },
    ],
    [membersWithoutOrgBindings.length, orgBindings.length, teams.length, unusedOrgRoles.length],
  );

  return (
    <TenantSelectionGuard title="权限管理" subtitle="统一查看空间级与团队级权限治理的设计、承接和落地情况。">
      <Card loading={orgRolesQuery.isLoading || orgBindingsQuery.isLoading || teamsQuery.isLoading || membersQuery.isLoading}>
        <div style={sectionStyle}>
          <Typography.Text strong>权限治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="空间成员" value={members.length} />
                <Typography.Text type="secondary">当前空间内需要被纳入治理分工的成员数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="空间角色" value={orgRoles.length} />
                <Typography.Text type="secondary">{customOrgRoles.length ? `${customOrgRoles.length} 个自定义角色，补充全局差异化职责。` : '当前主要依赖系统底座角色。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="空间授权" value={orgBindings.length} />
                <Typography.Text type="secondary">{orgBindings.length ? '空间级职责已经开始被成员承接。' : '当前还没有任何空间级职责承接。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="团队数" value={teams.length} />
                <Typography.Text type="secondary">{teams.length ? '这些团队决定了团队级角色和授权的治理范围。' : '暂无团队治理对象。'}</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>空间级治理</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>空间角色</Typography.Text>
                    <Tag color="blue">{`${orgRoles.length} 个角色`}</Tag>
                  </Space>
                  <Typography.Text>空间角色负责定义谁有资格承担全局职责，以及这些职责如何映射到权限点。</Typography.Text>
                  <Typography.Text type="secondary">先管角色底座，再谈规则修改权、跨团队统筹权和全局异常收口权。</Typography.Text>
                  <a href="/dashboard/access/organization-roles">进入空间角色</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>空间授权</Typography.Text>
                    <Tag color={orgBindings.length ? 'green' : 'gold'}>{orgBindings.length ? `${orgBindings.length} 条授权` : '待补授权'}</Tag>
                  </Space>
                  <Typography.Text>空间授权负责把全局职责真正分配给具体成员，而不是停留在角色配置层。</Typography.Text>
                  <Typography.Text type="secondary">owner、管理员、跨团队运营、财务等职责都应该在这里明确承接人。</Typography.Text>
                  <a href="/dashboard/access/organization-bindings">进入空间授权</a>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>团队级治理</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>团队角色</Typography.Text>
                    <Tag color="purple">{`${teams.length} 个团队需对齐`}</Tag>
                  </Space>
                  <Typography.Text>团队角色负责把空间规则进一步翻译成团队运营、审核、补资料等执行岗位。</Typography.Text>
                  <Typography.Text type="secondary">角色要围绕真实工作流，不要只是把权限点换个名字堆在一起。</Typography.Text>
                  <a href="/dashboard/access/team-roles">进入团队角色</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>团队授权</Typography.Text>
                    <Tag color={teams.length ? 'blue' : 'default'}>{teams.length ? '逐团队承接' : '暂无团队'}</Tag>
                  </Space>
                  <Typography.Text>团队授权负责把团队角色真正分配给成员，决定谁来执行发布、审核和异常收口。</Typography.Text>
                  <Typography.Text type="secondary">空间级和团队级如果只做了一层，就会出现“规则有人定，执行没人接”的断层。</Typography.Text>
                  <a href="/dashboard/access/team-bindings">进入团队授权</a>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {signals.map((signal) => (
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

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          title="权限管理不是四个列表页，而是一条从规则设计到职责承接的治理链"
          description="空间设置定义规则口径，空间级角色和授权负责全局统筹，团队级角色和授权负责执行落地。任何一层缺失，最后都会变成规则和责任脱节。"
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default AccessOverviewPage;
