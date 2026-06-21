import { useMutation, useQuery } from '@tanstack/react-query';
import { Descriptions, Drawer, Form, Select, Space } from 'antd';
import React, { useState } from 'react';
import { drawerWidthMd, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsSettingsApiDeleteTeamSettingView,
  appsSettingsApiGetTeamSettingView,
  appsSettingsApiListTeamSettings,
  appsSettingsApiPutTeamSetting,
} from '@/services/openapi/teamSettings';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import { TenantSectionHint, TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import {
  SettingEditModal,
  SettingValue,
  SettingsTableCard,
  SettingsToolbarCard,
  parseSettingValue,
  settingFormValue,
  settingsManagementQueryKeys,
} from '../shared';

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

  return (
    <TenantSelectionGuard title="团队设置" subtitle="管理当前租户下指定团队的动态设置覆盖值。">
      <SettingsToolbarCard>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <TenantSectionHint text="先选择团队，再编辑该团队范围内的设置覆盖。" />
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
      <SettingsTableCard
        title="团队设置项"
        hint="这里承接后端 settings/teams 接口，设置值只作用于所选团队。"
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
