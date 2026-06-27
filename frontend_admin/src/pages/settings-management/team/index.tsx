import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Descriptions, Drawer, Form, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { drawerWidthMd, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsAccessApiListTeamBindingsView } from '@/services/openapi/accessTeamBindings';
import { appsAccessApiListTeamRoles } from '@/services/openapi/accessTeamRoles';
import {
  normalizeHousePublishRules,
  summarizeHousePublishRules,
} from '@/pages/property-rental/publish-rules';
import {
  appsSettingsApiDeleteTeamSettingView,
  appsSettingsApiGetTeamSettingView,
  appsSettingsApiListTeamSettings,
  appsSettingsApiPutTeamSetting,
} from '@/services/openapi/teamSettings';
import { appsSettingsApiListOrgSettings } from '@/services/openapi/organizationSettings';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import {
  SettingEditModal,
  SettingValue,
  SettingsTableCard,
  SettingsToolbarCard,
  parseSettingValue,
  settingFormValue,
  settingsManagementQueryKeys,
} from '../shared';

const defaultBuildingSettingKey = 'property_rental.default_building_id';
const publishRulesSettingKey = 'property_rental.publish_rules';
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

function findSetting(settings: API.SettingOut[] | undefined, key: string) {
  return (settings || []).find((item) => item.key === key);
}

function formatBuildingSettingText(value: unknown) {
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(id) || id <= 0) {
    return '未指定默认楼栋';
  }
  return `楼栋 ID ${id}`;
}

function publishRulesDetailText(value: unknown) {
  const summary = summarizeHousePublishRules(normalizeHousePublishRules(value));
  return [
    summary.blocking.length ? `阻断发布：${summary.blocking.join('、')}` : '阻断发布：无',
    summary.warning.length ? `仅提醒：${summary.warning.join('、')}` : '仅提醒：无',
    summary.ignored.length ? `不校验：${summary.ignored.join('、')}` : '不校验：无',
  ].join('；');
}

const TeamSettingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [editingSetting, setEditingSetting] = useState<API.SettingOut | null>(null);
  const [detailKey, setDetailKey] = useState<string>();
  const [form] = Form.useForm<{ value: unknown }>();

  const teamsQuery = useQuery({
    queryKey: settingsManagementQueryKeys.teams(workspace.selectedOrgSlug),
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  React.useEffect(() => {
    const firstTeamId = teamsQuery.data?.items?.[0]?.id;
    if (!selectedTeamId && firstTeamId) {
      setSelectedTeamId(firstTeamId);
    }
  }, [selectedTeamId, teamsQuery.data]);

  const settingsQuery = useQuery({
    queryKey: settingsManagementQueryKeys.team(workspace.selectedOrgSlug, selectedTeamId),
    queryFn: () => appsSettingsApiListTeamSettings({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });
  const orgSettingsQuery = useQuery({
    queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug),
    queryFn: () => appsSettingsApiListOrgSettings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const rolesQuery = useQuery({
    queryKey: ['settings-management', 'team-roles', workspace.selectedOrgSlug, selectedTeamId],
    queryFn: () => appsAccessApiListTeamRoles({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });
  const bindingsQuery = useQuery({
    queryKey: ['settings-management', 'team-bindings', workspace.selectedOrgSlug, selectedTeamId],
    queryFn: () => appsAccessApiListTeamBindingsView({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });

  const detailQuery = useQuery({
    queryKey: ['settings-management', 'team-detail', workspace.selectedOrgSlug, selectedTeamId, detailKey],
    queryFn: () => appsSettingsApiGetTeamSettingView({ team_id: selectedTeamId!, key: detailKey! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId && detailKey),
  });

  const updateMutation = useMutation({
    mutationFn: ({ setting, value }: { setting: API.SettingOut; value: unknown }) =>
      appsSettingsApiPutTeamSetting({ team_id: selectedTeamId!, key: setting.key }, { value: parseSettingValue(value, setting.value_type) }),
    onSuccess: async () => {
      setEditingSetting(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.team(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (setting: API.SettingOut) => appsSettingsApiDeleteTeamSettingView({ team_id: selectedTeamId!, key: setting.key }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.team(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });

  const selectedTeam = useMemo(
    () => (teamsQuery.data?.items || []).find((team) => team.id === selectedTeamId),
    [selectedTeamId, teamsQuery.data],
  );
  const teamSettings = settingsQuery.data || [];
  const orgSettings = orgSettingsQuery.data || [];
  const defaultBuildingSetting = findSetting(teamSettings, defaultBuildingSettingKey);
  const orgDefaultBuildingSetting = findSetting(orgSettings, defaultBuildingSettingKey);
  const publishRulesSetting = findSetting(teamSettings, publishRulesSettingKey);
  const orgPublishRulesSetting = findSetting(orgSettings, publishRulesSettingKey);
  const customizedSettings = teamSettings.filter((setting) => setting.is_customized);
  const customizedSettingCount = customizedSettings.length;
  const extraCustomizedSettings = customizedSettings.filter((setting) => ![defaultBuildingSettingKey, publishRulesSettingKey].includes(setting.key));
  const memberCount = selectedTeam?.member_details?.length || selectedTeam?.members?.length || 0;
  const customRoleCount = (rolesQuery.data || []).filter((role) => !role.is_system).length;
  const bindingCount = (bindingsQuery.data || []).length;
  const publishRulesSummary = summarizeHousePublishRules(normalizeHousePublishRules(publishRulesSetting?.value));
  const orgPublishRulesSummary = summarizeHousePublishRules(normalizeHousePublishRules(orgPublishRulesSetting?.value));

  return (
    <TenantSelectionGuard title="团队设置" subtitle="管理当前空间下指定团队的策略继承、局部覆盖和执行分工。">
      <SettingsToolbarCard>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Select
            aria-label="团队"
            loading={teamsQuery.isLoading}
            options={(teamsQuery.data?.items || []).map((team) => ({ label: team.name, value: team.id }))}
            placeholder="选择团队"
            value={selectedTeamId}
            onChange={(value) => {
              setSelectedTeamId(value);
              setDetailKey(undefined);
            }}
            style={{ width: 320, maxWidth: '100%' }}
          />
        </Space>
      </SettingsToolbarCard>
      <Card loading={settingsQuery.isLoading || orgSettingsQuery.isLoading}>
        <div style={sectionStyle}>
          <Typography.Text strong>策略概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="团队成员" value={memberCount} />
                <Typography.Text type="secondary">{selectedTeam ? `${selectedTeam.name} 当前可承接策略执行的成员数。` : '请先选择一个团队。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="覆盖项" value={customizedSettingCount} />
                <Typography.Text type="secondary">{customizedSettingCount ? `${customizedSettingCount} 项团队级设置已脱离空间默认。` : '当前没有局部覆盖，全部继承空间策略。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="自定义角色" value={customRoleCount} />
                <Typography.Text type="secondary">{customRoleCount ? '已拆出团队级角色，适合区分运营、审核和管理职责。' : '当前仅依赖系统角色，建议按团队分工补角色。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="已授权成员" value={bindingCount} />
                <Typography.Text type="secondary">{bindingCount ? `${bindingCount} 名成员已经被明确授权。` : '尚未形成团队级授权闭环。'}</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>策略继承与覆盖</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            团队设置默认跟随空间设置，只在团队确实有不同的承接楼栋、发布 SOP 或审核节奏时再做局部覆盖。
          </Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>默认楼栋</Typography.Text>
                    <Tag color={defaultBuildingSetting?.is_customized ? 'gold' : 'blue'}>{defaultBuildingSetting?.is_customized ? '团队已覆盖' : '继承空间默认'}</Tag>
                  </Space>
                  <Typography.Text>{formatBuildingSettingText(defaultBuildingSetting?.value)}</Typography.Text>
                  <Typography.Text type="secondary">
                    {defaultBuildingSetting?.is_customized
                      ? `空间默认为 ${formatBuildingSettingText(orgDefaultBuildingSetting?.value)}，当前团队单独指定了承接楼栋。`
                      : `当前直接沿用空间默认楼栋：${formatBuildingSettingText(orgDefaultBuildingSetting?.value)}。`}
                  </Typography.Text>
                  <a href="/dashboard/settings-management/organization#setting-property_rental-default_building_id">查看空间默认楼栋</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>房源发布规则</Typography.Text>
                    <Tag color={publishRulesSetting?.is_customized ? 'gold' : 'blue'}>{publishRulesSetting?.is_customized ? '团队已覆盖' : '继承空间默认'}</Tag>
                  </Space>
                  <Space wrap size={[8, 8]}>
                    <Tag color="red">阻断 {publishRulesSummary.blocking.length}</Tag>
                    <Tag color="gold">提醒 {publishRulesSummary.warning.length}</Tag>
                    <Tag>关闭 {publishRulesSummary.ignored.length}</Tag>
                  </Space>
                  <Typography.Text type="secondary" style={wrapTextStyle}>{publishRulesDetailText(publishRulesSetting?.value)}</Typography.Text>
                  <Typography.Text type="secondary" style={wrapTextStyle}>
                    空间口径：阻断 {orgPublishRulesSummary.blocking.length} 项 / 提醒 {orgPublishRulesSummary.warning.length} 项 / 关闭 {orgPublishRulesSummary.ignored.length} 项
                  </Typography.Text>
                  <a href="/dashboard/settings-management/organization#setting-property_rental-publish_rules">查看空间发布规则</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>其他团队策略</Typography.Text>
                    <Tag color={extraCustomizedSettings.length ? 'gold' : 'default'}>{extraCustomizedSettings.length ? `${extraCustomizedSettings.length} 项例外` : '无额外例外'}</Tag>
                  </Space>
                  <Typography.Text>{extraCustomizedSettings.length ? '当前团队存在额外局部策略。' : '除了核心发布策略外，没有新增团队级局部规则。'}</Typography.Text>
                  <Typography.Text type="secondary" style={wrapTextStyle}>
                    {extraCustomizedSettings.length
                      ? extraCustomizedSettings.map((setting) => setting.label || setting.key).join('、')
                      : '建议把共性规则保留在空间级，只把短期试点或团队特例下沉到团队级。'}
                  </Typography.Text>
                  <a href="/dashboard/property-rental/workbench">回到房源工作台核对执行效果</a>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          title="团队设置默认继承空间策略，常用字段优先在空间设置统一维护"
          description="像房东、租金、图片、视频这类发布口径建议先在空间级统一，团队级只保留确实需要差异化 SOP 的局部覆盖，并同步补齐团队角色和授权。"
        />
      </Card>
      <SettingsTableCard
        title="团队覆盖设置项"
        hint="先在上面确认团队是继承还是覆盖，再在这里做具体设置改动。覆盖值只作用于当前所选团队。"
        loading={settingsQuery.isLoading}
        data={settingsQuery.data}
        onEdit={(setting) => {
          setEditingSetting(setting);
          form.setFieldsValue({ value: settingFormValue(setting) });
        }}
        onView={(setting) => setDetailKey(setting.key)}
        onRestore={(setting) => void restoreMutation.mutateAsync(setting)}
      />
      <SettingEditModal
        open={Boolean(editingSetting)}
        setting={editingSetting}
        loading={updateMutation.isPending}
        form={form}
        onCancel={() => setEditingSetting(null)}
        onOk={async () => {
          const values = await form.validateFields();
          if (editingSetting) {
            await updateMutation.mutateAsync({ setting: editingSetting, value: values.value });
          }
        }}
      />
      <Drawer title="团队设置详情" open={Boolean(detailKey)} onClose={() => setDetailKey(undefined)} width={drawerWidthMd}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Key">{detailQuery.data?.key || '-'}</Descriptions.Item>
          <Descriptions.Item label="类型">{detailQuery.data?.value_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="说明"><span style={wrapTextStyle}>{detailQuery.data?.description || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="状态">{detailQuery.data?.is_customized ? '已覆盖' : '默认值'}</Descriptions.Item>
          <Descriptions.Item label="当前值">{detailQuery.data ? <SettingValue value={detailQuery.data.value} /> : '-'}</Descriptions.Item>
        </Descriptions>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default TeamSettingsPage;
