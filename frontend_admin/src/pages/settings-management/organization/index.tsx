import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Form, Input, Modal, Select, Space, message } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { drawerWidthMd, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { houseApi } from '@/services/manual/house';
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
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number>();
  const [createdBuildings, setCreatedBuildings] = useState<{ id: number; name: string; estate_id: number }[]>([]);
  const [form] = Form.useForm<{ value: string }>();
  const [buildingForm] = Form.useForm();

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
  const estatesQuery = useQuery({
    queryKey: ['settings-management', 'organization', 'house-estates', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listEstates({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const buildingsQuery = useQuery({
    queryKey: ['settings-management', 'organization', 'house-buildings', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const defaultBuildingQuery = useQuery({
    queryKey: ['settings-management', 'organization', 'default-building', workspace.selectedOrgSlug],
    queryFn: () => houseApi.getDefaultBuilding(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const buildingItems = useMemo(() => [...createdBuildings, ...(buildingsQuery.data?.items || [])], [buildingsQuery.data, createdBuildings]);

  const updateMutation = useMutation({
    mutationFn: ({ setting, value }: { setting: API.SettingOut; value: string }) =>
      appsSettingsApiPutOrgSetting({ key: setting.key }, { value: parseSettingValue(value, setting.value_type) }),
    onSuccess: async () => {
      setEditingSetting(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug) });
    },
  });
  const setDefaultBuildingMutation = useMutation({
    mutationFn: (buildingId: number) => houseApi.setDefaultBuilding(buildingId),
    onSuccess: async () => {
      message.success('默认楼栋已保存');
      await workspace.queryClient.invalidateQueries({ queryKey: ['settings-management', 'organization', 'default-building', workspace.selectedOrgSlug] });
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug) });
    },
  });
  const createBuildingMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createBuilding(values),
    onSuccess: async (building) => {
      setCreatedBuildings((items) => [building, ...items]);
      setSelectedBuildingId(building.id);
      await houseApi.setDefaultBuilding(building.id);
      setBuildingOpen(false);
      buildingForm.resetFields();
      message.success('楼栋已创建并设为默认');
    },
  });

  useEffect(() => {
    if (defaultBuildingQuery.data?.id) {
      setSelectedBuildingId(defaultBuildingQuery.data.id);
    }
  }, [defaultBuildingQuery.data]);

  const restoreMutation = useMutation({
    mutationFn: (setting: API.SettingOut) => appsSettingsApiDeleteOrgSettingView({ key: setting.key }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug) });
    },
  });

  return (
    <TenantSelectionGuard title="租户设置" subtitle="管理当前租户的动态设置覆盖值。">
      <Card title="房源租赁设置" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            loading={buildingsQuery.isLoading || defaultBuildingQuery.isLoading}
            value={selectedBuildingId}
            onChange={setSelectedBuildingId}
            options={buildingItems.map((item) => ({ value: item.id, label: item.name }))}
            style={{ width: 240 }}
          />
          <Button type="primary" disabled={!selectedBuildingId} loading={setDefaultBuildingMutation.isPending} onClick={() => selectedBuildingId && setDefaultBuildingMutation.mutate(selectedBuildingId)}>
            保存默认楼栋
          </Button>
          <Button onClick={() => setBuildingOpen(true)}>新建楼栋</Button>
        </Space>
      </Card>
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
      <Modal title="新建楼栋" open={buildingOpen} onCancel={() => setBuildingOpen(false)} footer={null} destroyOnHidden>
        <Form
          form={buildingForm}
          layout="vertical"
          initialValues={{ estate_id: estatesQuery.data?.items?.[0]?.id, floors: 1 }}
          onFinish={(values) => createBuildingMutation.mutate({ ...values, estate_id: values.estate_id || estatesQuery.data?.items?.[0]?.id, floors: Number(values.floors) })}
        >
          <Form.Item label="项目小区" name="estate_id">
            <Select loading={estatesQuery.isLoading} options={(estatesQuery.data?.items || []).map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item label="楼栋名" name="name" rules={[{ required: true, message: '请输入楼栋名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="楼层" name="floors" rules={[{ required: true, message: '请输入楼层' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createBuildingMutation.isPending}>
            保存楼栋
          </Button>
        </Form>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default OrganizationSettingsPage;
