import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { wrapTextStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import {
  appsSettingsApiDeleteOrgSettingView,
  appsSettingsApiListOrgSettings,
  appsSettingsApiPutOrgSetting,
} from '@/services/openapi/organizationSettings';
import {
  SettingSchemaControl,
  parseSettingValue,
  settingsManagementQueryKeys,
  stringifySettingValue,
} from '../shared';

type DraftValues = Record<string, unknown>;
type BuildingItem = { id: number; name: string; estate_id: number };

type SectionRegistryItem = {
  key: string;
  control?: 'default_building';
};

const sectionRegistry: Record<string, { title: string; items: SectionRegistryItem[] }> = {
  property_rental: {
    title: '房源租赁设置',
    items: [{ key: 'property_rental.default_building_id', control: 'default_building' }],
  },
  general: {
    title: '通用设置',
    items: [],
  },
};

function initialDraftValue(setting: API.SettingOut) {
  if (setting.widget === 'switch') {
    return Boolean(setting.value);
  }
  if (setting.widget === 'input_number') {
    return typeof setting.value === 'number' ? setting.value : Number(setting.value);
  }
  return setting.value;
}

function resolveSettingCategory(setting: API.SettingOut) {
  return setting.category && sectionRegistry[setting.category] ? setting.category : 'general';
}

function buildSettingSections(settings: API.SettingOut[] = []) {
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const usedKeys = new Set<string>();
  const sections = Object.entries(sectionRegistry).map(([category, registry]) => {
    const rows = registry.items.flatMap((item) => {
      const setting = byKey.get(item.key);
      if (!setting) {
        return [];
      }
      usedKeys.add(setting.key);
      return [{ setting, control: item.control }];
    });
    return { category, title: registry.title, rows };
  });

  settings.forEach((setting) => {
    if (usedKeys.has(setting.key)) {
      return;
    }
    const category = resolveSettingCategory(setting);
    const section = sections.find((item) => item.category === category) || sections.find((item) => item.category === 'general');
    section?.rows.push({ setting, control: undefined });
  });

  return sections.filter((section) => section.rows.length > 0);
}

const DefaultBuildingControl: React.FC<{
  value: unknown;
  loading?: boolean;
  buildings: BuildingItem[];
  onChange: (value: unknown) => void;
  onCreate: () => void;
}> = ({ value, loading, buildings, onChange, onCreate }) => (
  <Space wrap>
    <Select
      aria-label="默认楼栋"
      loading={loading}
      value={value as number | undefined}
      onChange={onChange}
      options={buildings.map((item) => ({ value: item.id, label: item.name }))}
      style={{ width: 240, maxWidth: '100%' }}
    />
    <Button onClick={onCreate}>新建楼栋</Button>
  </Space>
);

const OrganizationSettingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [draftValues, setDraftValues] = useState<DraftValues>({});
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [createdBuildings, setCreatedBuildings] = useState<BuildingItem[]>([]);
  const [buildingForm] = Form.useForm();

  const settingsQuery = useQuery({
    queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug),
    queryFn: () => appsSettingsApiListOrgSettings(),
    enabled: Boolean(workspace.selectedOrgSlug),
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

  const buildingItems = useMemo(() => [...createdBuildings, ...(buildingsQuery.data?.items || [])], [buildingsQuery.data, createdBuildings]);
  const sections = useMemo(() => buildSettingSections(settingsQuery.data), [settingsQuery.data]);

  useEffect(() => {
    const nextDrafts: DraftValues = {};
    (settingsQuery.data || []).forEach((setting) => {
      nextDrafts[setting.key] = initialDraftValue(setting);
    });
    setDraftValues(nextDrafts);
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (setting: API.SettingOut) =>
      appsSettingsApiPutOrgSetting({ key: setting.key }, { value: parseSettingValue(draftValues[setting.key], setting.value_type) }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug) });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (setting: API.SettingOut) => appsSettingsApiDeleteOrgSettingView({ key: setting.key }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug) });
    },
  });

  const createBuildingMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createBuilding(values),
    onSuccess: (building) => {
      setCreatedBuildings((items) => [building, ...items]);
      setDraftValues((values) => ({ ...values, 'property_rental.default_building_id': building.id }));
      setBuildingOpen(false);
      buildingForm.resetFields();
      message.success('楼栋已创建');
    },
  });

  const renderControl = (setting: API.SettingOut, control?: SectionRegistryItem['control']) => {
    const value = draftValues[setting.key];
    const onChange = (nextValue: unknown) => setDraftValues((values) => ({ ...values, [setting.key]: nextValue }));

    if (control === 'default_building') {
      return (
        <DefaultBuildingControl
          value={value}
          loading={buildingsQuery.isLoading}
          buildings={buildingItems}
          onChange={onChange}
          onCreate={() => setBuildingOpen(true)}
        />
      );
    }

    return <SettingSchemaControl setting={setting} value={value} onChange={onChange} />;
  };

  return (
    <TenantSelectionGuard title="租户设置" subtitle="管理当前租户的动态设置覆盖值。">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {sections.map((section) => (
          <Card key={section.category} title={section.title} loading={settingsQuery.isLoading}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              {section.rows.map(({ setting, control }) => (
                <div key={setting.key} style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 6, padding: 16 }}>
                  <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                      <Space wrap>
                        <Typography.Text strong>{setting.label || setting.key}</Typography.Text>
                        {setting.is_customized ? <Tag color="gold">已覆盖</Tag> : <Tag>默认值</Tag>}
                      </Space>
                      <Typography.Text type="secondary" style={wrapTextStyle}>
                        {setting.description || setting.key}
                      </Typography.Text>
                    </Space>
                    <Form layout="vertical">
                      <Form.Item label={setting.label || setting.key}>
                        {renderControl(setting, control)}
                      </Form.Item>
                    </Form>
                    <Space wrap>
                      <Button type="primary" loading={updateMutation.isPending} onClick={() => updateMutation.mutate(setting)}>
                        保存{setting.label || setting.key}
                      </Button>
                      {setting.is_customized ? (
                        <Popconfirm title="确认恢复该设置默认值？" onConfirm={() => restoreMutation.mutate(setting)}>
                          <Button loading={restoreMutation.isPending}>恢复{setting.label || setting.key}默认值</Button>
                        </Popconfirm>
                      ) : null}
                    </Space>
                  </Space>
                </div>
              ))}
            </Space>
          </Card>
        ))}
      </Space>
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
