import { useMutation, useQuery } from '@tanstack/react-query';
import { Descriptions, Drawer, Form } from 'antd';
import React, { useState } from 'react';
import { drawerWidthMd, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsSettingsApiDeleteOrgSettingView,
  appsSettingsApiGetOrgSettingView,
  appsSettingsApiListOrgSettings,
  appsSettingsApiPutOrgSetting,
} from '@/services/openapi/organizationSettings';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import {
  SettingEditModal,
  SettingValue,
  SettingsTableCard,
  parseSettingValue,
  settingsManagementQueryKeys,
  stringifySettingValue,
} from '../shared';

const OrganizationSettingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [editingSetting, setEditingSetting] = useState<API.SettingOut | null>(null);
  const [detailKey, setDetailKey] = useState<string>();
  const [form] = Form.useForm<{ value: string }>();

  const settingsQuery = useQuery({
    queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug),
    queryFn: () => appsSettingsApiListOrgSettings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const detailQuery = useQuery({
    queryKey: ['settings-management', 'organization-detail', workspace.selectedOrgSlug, detailKey],
    queryFn: () => appsSettingsApiGetOrgSettingView({ key: detailKey! }),
    enabled: Boolean(workspace.selectedOrgSlug && detailKey),
  });

  const updateMutation = useMutation({
    mutationFn: ({ setting, value }: { setting: API.SettingOut; value: string }) =>
      appsSettingsApiPutOrgSetting({ key: setting.key }, { value: parseSettingValue(value, setting.value_type) }),
    onSuccess: async () => {
      setEditingSetting(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug) });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (setting: API.SettingOut) => appsSettingsApiDeleteOrgSettingView({ key: setting.key }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug) });
    },
  });

  return (
    <TenantSelectionGuard title="租户设置" subtitle="管理当前租户的动态设置覆盖值。">
      <SettingsTableCard
        title="租户设置项"
        hint="这里承接后端 settings/org 接口，只管理当前租户维度的设置覆盖，不占用原有个人设置 tab。"
        loading={settingsQuery.isLoading}
        data={settingsQuery.data}
        onEdit={(setting) => {
          setEditingSetting(setting);
          form.setFieldsValue({ value: stringifySettingValue(setting.value) });
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
      <Drawer title="租户设置详情" open={Boolean(detailKey)} onClose={() => setDetailKey(undefined)} width={drawerWidthMd}>
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

export default OrganizationSettingsPage;
