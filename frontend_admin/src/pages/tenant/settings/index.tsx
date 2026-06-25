import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Progress, Row, Select, Space, Statistic, Switch, Tag, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { fullWidthStyle } from '@/pages/_shared/adminLayout';
import {
  HOUSE_PUBLISH_RULE_PRESETS,
  normalizeHousePublishRules,
  resolveHousePublishRulesPreset,
  summarizeHousePublishRules,
} from '@/pages/property-rental/publish-rules';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import { appsOrganizationsApiGetSettings, appsOrganizationsApiUpdateSettings } from '@/services/openapi/organizationProfile';
import { appsSettingsApiListOrgSettings } from '@/services/openapi/organizationSettings';
import { appsAccessApiListOrganizationBindings } from '@/services/openapi/accessOrganizationBindings';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import { appsOrganizationsApiGetOrganization, appsOrganizationsApiGetOrganizationUsage, appsOrganizationsApiPatchOrganization, appsOrganizationsApiPatchOrganizationStatus, appsOrganizationsApiTransferOwner } from '@/services/openapi/organizations';
import { TenantSectionHint, TenantSelectionGuard, formatPersonLabel, requireTenantSlug, tenantQueryKeys, useTenantWorkspace } from '../shared';
import { setSelectedOrgSlug } from '@/utils/orgSelection';

type GovernanceSignal = {
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
const publishRulesSettingKey = 'property_rental.publish_rules';

function formatLimitLabel(used: number, limit?: number | null) {
  if (!limit) {
    return `${used} / 不限`;
  }
  return `${used} / ${limit}`;
}

function usagePercent(used: number, limit?: number | null) {
  if (!limit || limit <= 0) {
    return 0;
  }
  return Math.min(Math.round((used / limit) * 100), 100);
}

function usageTone(used: number, limit?: number | null) {
  if (!limit || limit <= 0) {
    return 'default' as const;
  }
  const ratio = used / limit;
  if (ratio >= 0.9) {
    return 'red' as const;
  }
  if (ratio >= 0.7) {
    return 'gold' as const;
  }
  return 'green' as const;
}

const TenantSettingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [form] = Form.useForm();
  const [statusValue, setStatusValue] = useState(true);
  const [transferUserId, setTransferUserId] = useState<number>();

  const detailQuery = useQuery({
    queryKey: tenantQueryKeys.organizationDetail(workspace.selectedOrgSlug),
    queryFn: () => appsOrganizationsApiGetOrganization({ slug: requireTenantSlug(workspace.selectedOrgSlug) }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const profileQuery = useQuery({
    queryKey: tenantQueryKeys.organizationProfile(workspace.selectedOrgSlug),
    queryFn: () => appsOrganizationsApiGetSettings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const settingsQuery = useQuery({
    queryKey: ['tenant', 'settings-summary', workspace.selectedOrgSlug],
    queryFn: () => appsSettingsApiListOrgSettings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const usageQuery = useQuery({
    queryKey: tenantQueryKeys.usage(workspace.selectedOrgSlug),
    queryFn: () => appsOrganizationsApiGetOrganizationUsage({ slug: requireTenantSlug(workspace.selectedOrgSlug) }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const membersQuery = useQuery({
    queryKey: ['tenant', 'members', 'owner-transfer', workspace.selectedOrgSlug],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const bindingsQuery = useQuery({
    queryKey: ['tenant', 'settings-org-bindings', workspace.selectedOrgSlug],
    queryFn: () => appsAccessApiListOrganizationBindings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const teamsQuery = useQuery({
    queryKey: ['tenant', 'settings-teams', workspace.selectedOrgSlug],
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    form.setFieldsValue({
      name: detailQuery.data.name,
      slug: detailQuery.data.slug,
      billing_email: profileQuery.data?.billing_email ?? detailQuery.data.billing_email ?? '',
      member_limit: detailQuery.data.member_limit ?? undefined,
      team_limit: detailQuery.data.team_limit ?? undefined,
    });
    setStatusValue(detailQuery.data.is_active);
  }, [detailQuery.data, form, profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: API.OrganizationPatchIn) => {
      const updated = await appsOrganizationsApiPatchOrganization({ slug: requireTenantSlug(workspace.selectedOrgSlug) }, payload);
      await appsOrganizationsApiUpdateSettings({ billing_email: payload.billing_email ?? null });
      return updated;
    },
    onSuccess: async (updated) => {
      const nextSlug = setSelectedOrgSlug(updated.slug);
      workspace.setInitialState((state: any) => ({
        ...state,
        selectedOrgSlug: nextSlug,
        organizations: (state?.organizations || []).map((item: API.SwitchListItemOut) =>
          item.slug === workspace.selectedOrgSlug ? { ...item, name: updated.name, slug: updated.slug } : item,
        ),
      }));
      await workspace.queryClient.invalidateQueries({ queryKey: tenantQueryKeys.appContext(nextSlug) });
      await workspace.queryClient.invalidateQueries({ queryKey: tenantQueryKeys.organizationDetail(nextSlug) });
      await workspace.queryClient.invalidateQueries({ queryKey: tenantQueryKeys.organizationProfile(nextSlug) });
      await workspace.queryClient.invalidateQueries({ queryKey: tenantQueryKeys.organizations });
      await workspace.queryClient.invalidateQueries({ queryKey: tenantQueryKeys.usage(nextSlug) });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => appsOrganizationsApiPatchOrganizationStatus({ slug: requireTenantSlug(workspace.selectedOrgSlug) }, { is_active: isActive }),
    onSuccess: async (_updated, isActive) => {
      setStatusValue(isActive);
      await workspace.queryClient.invalidateQueries({ queryKey: tenantQueryKeys.organizationDetail(workspace.selectedOrgSlug) });
    },
  });

  const transferMutation = useMutation({
    mutationFn: (userId: number) => appsOrganizationsApiTransferOwner({ slug: requireTenantSlug(workspace.selectedOrgSlug) }, { user: userId }),
    onSuccess: async () => {
      setTransferUserId(undefined);
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
      await workspace.queryClient.invalidateQueries({ queryKey: tenantQueryKeys.appContext(workspace.selectedOrgSlug) });
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'settings-org-bindings'] });
    },
  });

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.items || []).map((item) => ({
        label: formatPersonLabel(item.user),
        value: item.user.id,
      })),
    [membersQuery.data],
  );

  const usage = usageQuery.data;
  const memberCount = usage?.member_count || 0;
  const teamCount = usage?.team_count || 0;
  const memberLimit = usage?.member_limit ?? detailQuery.data?.member_limit ?? null;
  const teamLimit = usage?.team_limit ?? detailQuery.data?.team_limit ?? null;
  const memberPercent = usagePercent(memberCount, memberLimit);
  const teamPercent = usagePercent(teamCount, teamLimit);
  const orgBindings = bindingsQuery.data || [];
  const owners = (membersQuery.data?.items || []).filter((item) => item.is_owner);
  const ownersWithoutBindings = owners.filter((owner) => !orgBindings.some((binding) => binding.user.id === owner.user.id));
  const ownerBindingPreview = orgBindings.slice(0, 3).map((binding) => formatPersonLabel(binding.user));
  const archived = detailQuery.data ? !detailQuery.data.is_active : false;
  const closeToMemberLimit = Boolean(memberLimit && memberCount >= memberLimit);
  const closeToTeamLimit = Boolean(teamLimit && teamCount >= teamLimit);
  const teams = teamsQuery.data?.items || [];
  const publishRulesSetting = settingsQuery.data?.find((setting) => setting.key === publishRulesSettingKey);
  const publishRules = normalizeHousePublishRules(publishRulesSetting?.value);
  const publishRuleSummary = summarizeHousePublishRules(publishRules);
  const publishRulePreset = resolveHousePublishRulesPreset(publishRules);
  const publishRulePresetText =
    publishRulePreset === 'custom' ? '自定义策略' : HOUSE_PUBLISH_RULE_PRESETS[publishRulePreset].title;
  const publishRuleSummaryText = `阻断 ${publishRuleSummary.blocking.join('、') || '无'} / 提醒 ${publishRuleSummary.warning.join('、') || '无'} / 不校验 ${publishRuleSummary.ignored.join('、') || '无'}`;

  const closureSignals = useMemo<GovernanceSignal[]>(
    () => [
      {
        key: 'capacity',
        title: '容量水位',
        emphasis: closeToMemberLimit || closeToTeamLimit ? '存在容量压力' : '容量健康',
        summary: closeToMemberLimit || closeToTeamLimit
          ? '成员上限或团队上限已经接近或达到当前配置值，再继续扩容前应先调整限制或清理低效对象。'
          : '当前成员和团队容量仍有余量，空间扩张节奏相对健康。',
        description: '容量设置不是静态配置，它直接决定邀请、成员入场和团队扩张还能不能继续推进。',
        actionLabel: '查看邀请管理',
        actionHref: '/dashboard/tenant/invites',
      },
      {
        key: 'owner',
        title: 'Owner 承接',
        emphasis: ownersWithoutBindings.length ? `${ownersWithoutBindings.length} 人待补空间职责` : 'Owner 已进入空间治理',
        summary: ownersWithoutBindings.length
          ? `当前有 ${ownersWithoutBindings.length} 名 owner 还没有映射到空间级授权，owner 身份和实际治理职责存在脱节。`
          : '当前 owner 与空间级治理职责已经基本对齐。',
        description: 'owner 转移不应只是换一个字段，而要确保新 owner 真正进入空间级治理链路。',
        actionLabel: '进入空间授权',
        actionHref: '/dashboard/access/organization-bindings',
      },
      {
        key: 'organization',
        title: '组织形态',
        emphasis: `${memberCount} 名成员 / ${teamCount} 个团队`,
        summary: teams.length
          ? '当前空间的成员和团队结构已经形成，可继续围绕团队承接、角色配置和策略覆盖进行治理。'
          : '当前空间还没有团队结构，建议先从团队治理页建立执行单元。',
        description: '空间资料页不只是资料页，它应该解释当前空间治理对象的规模和结构。',
        actionLabel: '查看团队管理',
        actionHref: '/dashboard/tenant/teams',
      },
      {
        key: 'status',
        title: '启停状态',
        emphasis: archived ? '当前已归档' : '当前启用中',
        summary: archived
          ? '空间当前处于归档状态，邀请、成员协作和业务推进都应视为受限状态。'
          : '空间当前可正常运转，但归档操作仍然是高风险入口，需要结合容量和 owner 状态一起判断。',
        description: '启停状态会影响整个空间的业务可用性，不能和普通资料编辑混为一谈。',
        actionLabel: '查看成员管理',
        actionHref: '/dashboard/tenant/members',
      },
      {
        key: 'publish-rules',
        title: '发布策略',
        emphasis: publishRulePresetText,
        summary: publishRuleSummaryText,
        description: '房东、租金以及图片、户型图、视频是否阻断发布，应该由空间级策略统一治理，而不是让执行同学口头记规则。',
        actionLabel: '进入空间设置',
        actionHref: '/dashboard/settings-management/organization#setting-property_rental-publish_rules',
      },
    ],
    [archived, closeToMemberLimit, closeToTeamLimit, memberCount, ownersWithoutBindings.length, publishRulePresetText, publishRuleSummaryText, teamCount, teams.length],
  );

  return (
    <TenantSelectionGuard title="租户资料" subtitle="把空间资料、容量限制、owner 交接和启停状态统一纳入治理视角。">
      <Card loading={detailQuery.isLoading || profileQuery.isLoading || settingsQuery.isLoading || usageQuery.isLoading || membersQuery.isLoading}>
        <div style={sectionStyle}>
          <Typography.Text strong>空间治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="当前成员" value={memberCount} />
                <Typography.Text type="secondary">已进入当前空间治理范围的成员总数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="当前团队" value={teamCount} />
                <Typography.Text type="secondary">当前空间里已建立的执行团队数量。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="Owner 数" value={owners.length} />
                <Typography.Text type="secondary">{owners.length ? '这些成员具备 owner 身份。' : '当前还没有 owner。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="空间状态" value={statusValue ? '启用' : '归档'} />
                <Typography.Text type="secondary">{statusValue ? '当前空间正常可用。' : '当前空间已被归档。'}</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>容量与水位</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>成员容量</Typography.Text>
                    <Tag color={usageTone(memberCount, memberLimit)}>{`成员上限 ${memberLimit ?? '不限'}`}</Tag>
                  </Space>
                  <Typography.Text>{formatLimitLabel(memberCount, memberLimit)}</Typography.Text>
                  <Progress percent={memberLimit ? memberPercent : 0} status={memberLimit && memberPercent >= 100 ? 'exception' : undefined} showInfo={Boolean(memberLimit)} />
                  <Typography.Text type="secondary">成员上限会直接影响邀请入场还能不能继续推进。</Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>团队容量</Typography.Text>
                    <Tag color={usageTone(teamCount, teamLimit)}>{`团队上限 ${teamLimit ?? '不限'}`}</Tag>
                  </Space>
                  <Typography.Text>{formatLimitLabel(teamCount, teamLimit)}</Typography.Text>
                  <Progress percent={teamLimit ? teamPercent : 0} status={teamLimit && teamPercent >= 100 ? 'exception' : undefined} showInfo={Boolean(teamLimit)} />
                  <Typography.Text type="secondary">团队上限会限制执行单元的扩张和职责拆分能力。</Typography.Text>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>Owner 治理</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>当前承接者</Typography.Text>
                    <Tag color={ownersWithoutBindings.length ? 'gold' : 'green'}>
                      {ownersWithoutBindings.length ? `${ownersWithoutBindings.length} 人待补治理职责` : '已进入治理链'}
                    </Tag>
                  </Space>
                  <Typography.Text>{ownerBindingPreview.length ? ownerBindingPreview.join('、') : '当前还没有空间级授权承接人。'}</Typography.Text>
                  <Typography.Text type="secondary">owner 应该和空间级授权、跨团队统筹、规则修改权一起看，而不只是一个布尔字段。</Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  <Typography.Text strong>Owner 转移</Typography.Text>
                  <Row gutter={[8, 8]}>
                    <Col xs={24} md={16}>
                      <Select
                        allowClear
                        placeholder="选择新 owner"
                        style={fullWidthStyle}
                        value={transferUserId}
                        options={memberOptions}
                        onChange={(value) => setTransferUserId(value)}
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <Button block type="primary" loading={transferMutation.isPending} disabled={!transferUserId} onClick={() => transferUserId && void transferMutation.mutateAsync(transferUserId)}>
                        转移 Owner
                      </Button>
                    </Col>
                  </Row>
                  <Typography.Text type="secondary">转移前应确认新 owner 是否已经进入空间级治理链路，并能接住空间设置、授权和异常收口。</Typography.Text>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>业务策略</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>房源发布规则</Typography.Text>
                    <Tag color={publishRulePreset === 'strict' ? 'red' : publishRulePreset === 'relaxed' ? 'green' : publishRulePreset === 'standard' ? 'blue' : 'gold'}>
                      {publishRulePresetText}
                    </Tag>
                  </Space>
                  <Typography.Text>{publishRuleSummaryText}</Typography.Text>
                  <Typography.Text type="secondary">允许空间按项目阶段决定哪些字段阻断发布，哪些只提醒持续补齐，尤其适合图片、户型图、视频这类展示资料。</Typography.Text>
                  <a href="/dashboard/settings-management/organization#setting-property_rental-publish_rules">去空间设置调整发布规则</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>执行与配置分工</Typography.Text>
                    <Tag color="purple">空间定策略</Tag>
                    <Tag color="blue">工作台看执行</Tag>
                  </Space>
                  <Typography.Text>空间设置负责定义发布口径，房源工作台负责把阻断项和提醒项拆成执行队列。</Typography.Text>
                  <Typography.Text type="secondary">这样 owner 看策略，运营看执行，入口不会散，治理责任也不会混在一起。</Typography.Text>
                  <Space wrap size={[8, 8]}>
                    <a href="/dashboard/settings-management/organization#setting-property_rental-publish_rules">查看空间策略</a>
                    <a href="/dashboard/property-rental/workbench">查看房源工作台</a>
                  </Space>
                </Space>
              </div>
            </Col>
          </Row>
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

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={14}>
          <Card title="基础资料">
            <TenantSectionHint text="这里仍然维护租户名称、Slug、账单邮箱和容量上限，但这些字段现在被放回到空间治理上下文里理解。" />
            <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
              <Form.Item label="租户名称" name="name" rules={[{ required: true, message: '请输入租户名称' }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Slug" name="slug" rules={[{ required: true, message: '请输入 slug' }]}>
                <Input />
              </Form.Item>
              <Form.Item label="账单邮箱" name="billing_email">
                <Input />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="成员上限" name="member_limit" extra={`当前水位：成员上限 ${memberLimit ?? '不限'}`}>
                    <InputNumber min={1} style={fullWidthStyle} placeholder="留空表示不限" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="团队上限" name="team_limit" extra={`当前水位：团队上限 ${teamLimit ?? '不限'}`}>
                    <InputNumber min={1} style={fullWidthStyle} placeholder="留空表示不限" />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
                保存租户资料
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="风险操作">
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <Alert type="warning" showIcon title="以下操作会直接影响当前空间的可用性、owner 承接关系和后续业务推进。" />
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Text strong>租户启用状态</Typography.Text>
                <Space align="center">
                  <Switch
                    checked={statusValue}
                    checkedChildren="启用"
                    unCheckedChildren="归档"
                    loading={statusMutation.isPending}
                    onChange={(checked) => void statusMutation.mutateAsync(checked)}
                  />
                  <Typography.Text type="secondary">{statusValue ? '当前空间正常对外运转。' : '当前空间已归档，业务应视为停用。'}</Typography.Text>
                </Space>
              </Space>
              <Typography.Text type="secondary">归档会影响当前空间的整体可用性，建议先确认邀请、成员和团队治理动作是否已经完成收口。</Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </TenantSelectionGuard>
  );
};

export default TenantSettingsPage;
