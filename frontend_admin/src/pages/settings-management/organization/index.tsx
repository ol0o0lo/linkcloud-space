import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Divider, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd';
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

const categoryTitles: Record<string, string> = {
  property_rental: '房源租赁设置',
  general: '通用设置',
};
const categoryOrder = ['property_rental', 'general'];
const defaultBuildingSettingKey = 'property_rental.default_building_id';
const settingCardStyle: React.CSSProperties = {
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  overflow: 'hidden',
};
const settingCardBodyStyle: React.CSSProperties = { padding: 24 };
const settingCardFooterStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderTop: '1px solid var(--ant-color-border-secondary)',
  background: 'var(--ant-color-fill-alter)',
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
  return setting.category && categoryTitles[setting.category] ? setting.category : 'general';
}

function buildSettingSections(settings: API.SettingOut[] = []) {
  const sections = new Map<string, API.SettingOut[]>();
  settings.forEach((setting) => {
    const category = resolveSettingCategory(setting);
    sections.set(category, [...(sections.get(category) || []), setting]);
  });

  return categoryOrder
    .filter((category) => sections.has(category))
    .map((category) => ({ category, title: categoryTitles[category], rows: sections.get(category) || [] }));
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
      style={{ width: 320, maxWidth: '100%' }}
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
    setDraftValues({});
    setCreatedBuildings([]);
  }, [workspace.selectedOrgSlug]);

  useEffect(() => {
    setDraftValues((currentValues) => {
      const nextDrafts = { ...currentValues };
      (settingsQuery.data || []).forEach((setting) => {
        if (!(setting.key in nextDrafts)) {
          nextDrafts[setting.key] = initialDraftValue(setting);
        }
      });
      return nextDrafts;
    });
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
    onSuccess: async (_data, setting) => {
      setDraftValues(({ [setting.key]: _restoredValue, ...restValues }) => restValues);
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

  const renderControl = (setting: API.SettingOut) => {
    const value = draftValues[setting.key];
    const onChange = (nextValue: unknown) => setDraftValues((values) => ({ ...values, [setting.key]: nextValue }));

    if (setting.key === defaultBuildingSettingKey) {
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
    <TenantSelectionGuard title="空间设置" subtitle="按业务功能管理当前空间的设置。">
      <Card title="租户设置" loading={settingsQuery.isLoading}>
        <Space orientation="vertical" size={24} style={{ width: '100%' }}>
          {sections.map((section, sectionIndex) => (
            <div key={section.category}>
              {sectionIndex > 0 ? <Divider style={{ margin: '4px 0 24px' }} /> : null}
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {section.title}
                </Typography.Title>
                <Space orientation="vertical" size={20} style={{ width: '100%' }}>
                  {section.rows.map((setting) => {
                    const title = setting.label || setting.key;
                    const description = setting.description && setting.description !== title ? setting.description : undefined;

                    return (
                      <div key={setting.key} style={settingCardStyle}>
                        <div style={settingCardBodyStyle}>
                          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                              <Space wrap align="center">
                                <Typography.Title level={5} style={{ margin: 0 }}>
                                  {title}
                                </Typography.Title>
                                {setting.is_customized ? <Tag color="gold">已自定义</Tag> : <Tag>默认值</Tag>}
                              </Space>
                              {description ? (
                                <Typography.Text type="secondary" style={wrapTextStyle}>
                                  {description}
                                </Typography.Text>
                              ) : null}
                            </Space>
                            <Form layout="vertical" style={{ maxWidth: setting.value_type === 'json' ? 760 : 520 }}>
                              <Form.Item style={{ marginBottom: 0 }}>{renderControl(setting)}</Form.Item>
                            </Form>
                          </Space>
                        </div>
                        <div style={settingCardFooterStyle}>
                          <Space wrap>
                            <Button aria-label={`保存${title}`} type="primary" loading={updateMutation.isPending} onClick={() => updateMutation.mutate(setting)}>
                              保存设置
                            </Button>
                            {setting.is_customized ? (
                              <Popconfirm title="确认恢复该设置默认值？" onConfirm={() => restoreMutation.mutate(setting)}>
                                <Button aria-label={`恢复${title}默认值`} loading={restoreMutation.isPending}>
                                  恢复默认值
                                </Button>
                              </Popconfirm>
                            ) : null}
                          </Space>
                        </div>
                      </div>
                    );
                  })}
                </Space>
              </Space>
            </div>
          ))}
        </Space>
      </Card>
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
