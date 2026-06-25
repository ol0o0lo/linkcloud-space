import { PageContainer } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, Col, Descriptions, Form, Input, Modal, Progress, Row, Space, Statistic, Tag, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, fullWidthStyle, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsOrganizationsApiCreateOrganization, appsOrganizationsApiGetOrganizationUsage, appsOrganizationsApiSetPrimary } from '@/services/openapi/organizations';
import { TenantSectionHint, requireTenantSlug, useTenantWorkspace } from '../shared';

type OverviewSignal = {
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

function formatLimitLabel(used: number, limit?: number | null) {
  if (!limit) return `${used} / 不限`;
  return `${used} / ${limit}`;
}

function usagePercent(used: number, limit?: number | null) {
  if (!limit || limit <= 0) return 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

function usageTone(used: number, limit?: number | null) {
  if (!limit || limit <= 0) return 'default' as const;
  const ratio = used / limit;
  if (ratio >= 0.9) return 'red' as const;
  if (ratio >= 0.7) return 'gold' as const;
  return 'green' as const;
}

const OverviewPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<API.OrganizationCreateIn>();

  const usageQuery = useQuery({
    queryKey: ['tenant', 'usage', workspace.selectedOrgSlug],
    queryFn: () => appsOrganizationsApiGetOrganizationUsage({ slug: requireTenantSlug(workspace.selectedOrgSlug) }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.OrganizationCreateIn) => appsOrganizationsApiCreateOrganization(payload),
    onSuccess: async (created) => {
      setCreateOpen(false);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'organizations'] });
      await workspace.selectOrg(created.slug);
    },
  });

  const primaryMutation = useMutation({
    mutationFn: (slug: string) => appsOrganizationsApiSetPrimary({ slug }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'organizations'] });
    },
  });

  const organizations = workspace.organizations || [];
  const currentOrg = workspace.selectedOrganization;
  const primaryOrg = organizations.find((item) => item.is_primary) || null;
  const switchableCount = organizations.length;
  const additionalSpaceCount = Math.max(switchableCount - 1, 0);
  const memberCount = usageQuery.data?.member_count || 0;
  const teamCount = usageQuery.data?.team_count || 0;
  const memberLimit = usageQuery.data?.member_limit ?? null;
  const teamLimit = usageQuery.data?.team_limit ?? null;
  const memberPercent = usagePercent(memberCount, memberLimit);
  const teamPercent = usagePercent(teamCount, teamLimit);
  const memberPressure = Boolean(memberLimit && memberCount >= memberLimit);
  const teamPressure = Boolean(teamLimit && teamCount >= teamLimit);

  const closureSignals = useMemo<OverviewSignal[]>(
    () => [
      {
        key: 'primary',
        title: '主空间治理',
        emphasis: currentOrg?.is_primary ? '当前空间即主空间' : primaryOrg ? `主空间：${primaryOrg.name}` : '待确认主空间',
        summary: currentOrg?.is_primary
          ? '当前空间就是默认承接空间，适合继续集中治理设置、授权和成员扩张。'
          : primaryOrg
            ? `当前主空间仍然是 ${primaryOrg.name}，切换默认承接空间前需要确认授权、设置和 owner 链路是否跟得上。`
            : '当前还没有明确的主空间，后续组织切换和默认承接关系会不稳定。',
        description: '主空间不是展示标签，它决定默认进入哪个空间、谁来承接跨团队治理、哪些策略被视作主口径。',
        actionLabel: '查看空间授权',
        actionHref: '/dashboard/access/organization-bindings',
      },
      {
        key: 'capacity',
        title: '容量水位',
        emphasis: memberPressure || teamPressure ? '存在扩张压力' : '容量健康',
        summary: `成员 ${formatLimitLabel(memberCount, memberLimit)} / 团队 ${formatLimitLabel(teamCount, teamLimit)}`,
        description: '如果成员或团队接近上限，邀请、编组和授权动作都会被连锁影响，这里应该直接给 owner 看见。',
        actionLabel: '进入空间设置',
        actionHref: '/dashboard/tenant/settings',
      },
      {
        key: 'topology',
        title: '空间编组',
        emphasis: additionalSpaceCount > 0 ? `${switchableCount} 个空间协同` : '单空间运行',
        summary: additionalSpaceCount > 0
          ? `当前账号可切换 ${switchableCount} 个空间，后续需要特别关注主空间、执行空间和测试空间是否混用。`
          : '当前仍是单空间运行，更适合先把成员、团队和空间设置治理打稳。',
        description: '空间数量一多，切换成本、默认承接和测试/正式环境边界都会变成实际管理问题。',
        actionLabel: '进入团队管理',
        actionHref: '/dashboard/tenant/teams',
      },
      {
        key: 'execution',
        title: '当前空间',
        emphasis: currentOrg ? currentOrg.name : '尚未选择',
        summary: currentOrg ? `${currentOrg.slug}${currentOrg.is_primary ? ' · 主空间' : ''}` : '先选择一个空间，再继续进行成员、团队和设置治理。',
        description: '空间工作台的第一职责不是展示字段，而是让人确认此刻自己到底在操作哪个空间。',
        actionLabel: '进入成员管理',
        actionHref: '/dashboard/tenant/members',
      },
    ],
    [additionalSpaceCount, currentOrg, memberCount, memberLimit, memberPressure, primaryOrg, switchableCount, teamCount, teamLimit, teamPressure],
  );

  const organizationCards = useMemo(
    () =>
      organizations.map((item) => (
        <Col xs={24} md={12} xl={8} key={item.slug}>
          <div style={overviewTileStyle}>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap size={[8, 8]}>
                <Typography.Text strong style={wrapTextStyle}>{item.name}</Typography.Text>
                {item.is_current ? <Tag color="blue">当前空间</Tag> : null}
                {item.is_primary ? <Tag color="gold">主空间</Tag> : null}
              </Space>
              <Typography.Text type="secondary" style={wrapTextStyle}>{item.slug}</Typography.Text>
              <Typography.Text type="secondary">
                {item.is_current ? '当前已在这个空间里执行成员、团队和设置治理。' : '可以切到这个空间继续治理或排查。'}
              </Typography.Text>
              <Space wrap size={[8, 8]}>
                <a onClick={() => void workspace.selectOrg(item.slug)}>设为当前租户</a>
                {!item.is_primary ? <a onClick={() => void primaryMutation.mutateAsync(item.slug)}>设为主租户</a> : null}
              </Space>
            </Space>
          </div>
        </Col>
      )),
    [organizations, primaryMutation, workspace],
  );

  return (
    <PageContainer title="空间工作台" subTitle="先确认当前空间、主空间和容量水位，再继续进入成员、团队和空间设置治理。">
      <div style={sectionStyle}>
        <Typography.Text strong>空间治理概览</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="当前空间" value={currentOrg?.name || '未选择'} styles={{ content: { fontSize: 20 } }} />
              <Typography.Text type="secondary">{currentOrg ? currentOrg.slug : '先选择一个空间再继续治理。'}</Typography.Text>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="可切换空间" value={switchableCount} />
              <Typography.Text type="secondary">{additionalSpaceCount > 0 ? `另有 ${additionalSpaceCount} 个空间可切换` : '当前只有 1 个空间'}</Typography.Text>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="成员容量" value={memberCount} suffix={memberLimit ? `/ ${memberLimit}` : ' / 不限'} />
              <Typography.Text type="secondary">成员数量决定邀请和执行人扩张还能不能继续推进。</Typography.Text>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="团队容量" value={teamCount} suffix={teamLimit ? `/ ${teamLimit}` : ' / 不限'} />
              <Typography.Text type="secondary">团队数量决定组织拆分和职责承接的细度。</Typography.Text>
            </div>
          </Col>
        </Row>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <Typography.Text strong>当前执行面</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} xl={10}>
            <div style={overviewTileStyle}>
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Space wrap size={[8, 8]}>
                  <Typography.Text strong>当前租户</Typography.Text>
                  {currentOrg?.is_primary ? <Tag color="gold">主空间</Tag> : null}
                  {currentOrg ? <Tag color="blue">已选择</Tag> : <Tag color="orange">未选择</Tag>}
                </Space>
                {currentOrg ? (
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="名称"><span style={wrapTextStyle}>{currentOrg.name}</span></Descriptions.Item>
                    <Descriptions.Item label="Slug"><span style={wrapTextStyle}>{currentOrg.slug}</span></Descriptions.Item>
                    <Descriptions.Item label="当前职责">
                      <span style={wrapTextStyle}>{currentOrg.is_primary ? '主空间承接治理、默认进入和跨团队统筹。' : '当前是执行空间，适合继续处理成员、团队和业务设置。'}</span>
                    </Descriptions.Item>
                  </Descriptions>
                ) : (
                  <Typography.Text type="secondary">当前还没有已选择空间，先从下方台账选择一个空间继续治理。</Typography.Text>
                )}
                <Space wrap size={[8, 8]}>
                  <a href="/dashboard/tenant/members">进入成员管理</a>
                  <a href="/dashboard/tenant/teams">进入团队管理</a>
                  <a href="/dashboard/tenant/settings">进入空间设置</a>
                </Space>
                {currentOrg ? (
                  <Space wrap size={[8, 8]}>
                    <a onClick={() => void workspace.signoutOrg()}>退出当前租户</a>
                  </Space>
                ) : null}
              </Space>
            </div>
          </Col>
          <Col xs={24} xl={14}>
            <div style={overviewTileStyle}>
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Space wrap size={[8, 8]}>
                  <Typography.Text strong>容量水位</Typography.Text>
                  <Tag color={usageTone(memberCount, memberLimit)}>{`成员 ${formatLimitLabel(memberCount, memberLimit)}`}</Tag>
                  <Tag color={usageTone(teamCount, teamLimit)}>{`团队 ${formatLimitLabel(teamCount, teamLimit)}`}</Tag>
                </Space>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                      <Typography.Text strong>成员容量</Typography.Text>
                      <Progress percent={memberLimit ? memberPercent : 0} status={memberLimit && memberPercent >= 100 ? 'exception' : undefined} showInfo={Boolean(memberLimit)} />
                      <Typography.Text type="secondary">成员上限接近打满时，邀请和 owner/执行人扩张都会受影响。</Typography.Text>
                    </Space>
                  </Col>
                  <Col xs={24} md={12}>
                    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                      <Typography.Text strong>团队容量</Typography.Text>
                      <Progress percent={teamLimit ? teamPercent : 0} status={teamLimit && teamPercent >= 100 ? 'exception' : undefined} showInfo={Boolean(teamLimit)} />
                      <Typography.Text type="secondary">团队上限接近打满时，职责拆分和新业务承接会变得困难。</Typography.Text>
                    </Space>
                  </Col>
                </Row>
                <TenantSectionHint text="空间工作台不只是切换器，它应该让 owner 一眼看到当前空间是谁、有没有主空间、容量是不是快顶满。" />
              </Space>
            </div>
          </Col>
        </Row>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <Typography.Text strong>闭环信号</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {closureSignals.map((signal) => (
            <Col xs={24} sm={12} xl={6} key={signal.key}>
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

      <Card
        title="我的空间台账"
        style={{ marginTop: 16 }}
        extra={(
          <AdminToolbar>
            <a onClick={() => setCreateOpen(true)}>创建租户</a>
          </AdminToolbar>
        )}
      >
        <TenantSectionHint text="这里不只是列空间列表，还要把“当前空间 / 主空间 / 可切换空间”的治理身份说清楚，避免在多空间下操作错对象。" />
        <Row gutter={[16, 16]}>{organizationCards}</Row>
      </Card>

      <Modal
        title="创建租户"
        open={createOpen}
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await createMutation.mutateAsync(values);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="租户名称" name="name" rules={[{ required: true, message: '请输入租户名称' }]}>
            <Input placeholder="例如：Acme Studio" style={fullWidthStyle} />
          </Form.Item>
          <Form.Item
            label="租户 Slug"
            name="slug"
            rules={[
              { required: true, message: '请输入 slug' },
              { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字和连字符' },
            ]}
          >
            <Input placeholder="例如：acme-studio" style={fullWidthStyle} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default OverviewPage;
