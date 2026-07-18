import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Divider, Form, Input, InputNumber, Modal, message, Select, Space, Tabs, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { LocationPicker, type LocationValue } from '@/components/LocationPicker';
import { wrapTextStyle } from '@/pages/_shared/adminLayout';
import { PropertyTagSelect } from '@/pages/property-rental/components/PropertyTagSelect';
import { buildingLabel } from '@/pages/property-rental/constants';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { type BuildingOut, houseApi } from '@/services/manual/house';
import {
  appsSettingsApiDeleteOrgSettingView,
  appsSettingsApiListOrgSettings,
  appsSettingsApiPutOrgSetting,
} from '@/services/openapi/organizationSettings';
import {
  buildSettingSections,
  defaultBuildingSettingKey,
  initialDraftValue,
  PublishRulesControl,
  parseSettingValue,
  publishRulesSettingKey,
  SettingSchemaControl,
  settingAnchorId,
  settingsManagementQueryKeys,
} from '../shared';

type DraftValues = Record<string, unknown>;
type BuildingItem = BuildingOut | { id: number; name: string; address?: string | null; estate_id?: number | null; estate?: { id?: number; name?: string; display_name?: string } | null };

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'flex-start',
  padding: '18px 0',
  borderTop: '1px solid var(--ant-color-border-secondary)',
  flexWrap: 'wrap',
};
const settingMetaStyle: React.CSSProperties = { flex: '0 0 240px', minWidth: 200 };
const settingControlStyle: React.CSSProperties = { flex: '1 1 320px', minWidth: 280 };

function parseLocationValue(value: unknown): LocationValue | null {
  if (!value || typeof value !== 'object') return null;
  const { address, lat, lng } = value as LocationValue;
  return typeof address === 'string' && Number.isFinite(lat) && Number.isFinite(lng) ? { address, lat, lng } : null;
}

const DefaultBuildingControl: React.FC<{
  value: unknown;
  loading?: boolean;
  buildings: BuildingItem[];
  onChange: (value: unknown) => void;
  onCreate: () => void;
}> = ({ value, loading, buildings, onChange, onCreate }) => {
  const [open, setOpen] = useState(false);

  return (
    <Select
      aria-label="默认楼栋"
      loading={loading}
      open={open}
      onOpenChange={setOpen}
      value={value as number | undefined}
      onChange={(nextValue) => {
        onChange(nextValue);
        setOpen(false);
      }}
      options={buildings.map((item) => ({ value: item.id, label: buildingLabel(item) }))}
      popupRender={(menu) => (
        <>
          {menu}
          <Divider style={{ margin: '8px 0' }} />
          <Button
            type="text"
            block
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
          >
            新建楼栋
          </Button>
        </>
      )}
      style={{ width: 320, maxWidth: '100%' }}
    />
  );
};

const OrganizationSettingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [draftValues, setDraftValues] = useState<DraftValues>({});
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [createdBuildings, setCreatedBuildings] = useState<BuildingItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>();
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

  const tagSuggestions = useQuery({
    queryKey: ['house', 'tag-suggestions'],
    queryFn: () => houseApi.getTagSuggestions(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const buildingItems = useMemo(() => [...createdBuildings, ...(buildingsQuery.data?.items || [])], [buildingsQuery.data, createdBuildings]);
  const estateNameById = useMemo(
    () => new Map((estatesQuery.data?.items || []).map((item) => [item.id, item.name])),
    [estatesQuery.data],
  );
  const sections = useMemo(() => buildSettingSections(settingsQuery.data), [settingsQuery.data]);

  useEffect(() => {
    setDraftValues({});
    setCreatedBuildings([]);
    setActiveCategory(undefined);
  }, [workspace.selectedOrgSlug]);

  const contextualBuildingItems = useMemo(
    () =>
      buildingItems.map((item) => ({
        ...item,
        estate: item.estate || (item.estate_id == null ? null : {
          id: item.estate_id,
          name: estateNameById.get(item.estate_id) || '',
          display_name: estateNameById.get(item.estate_id) || '',
        }),
      })),
    [buildingItems, estateNameById],
  );
  useEffect(() => {
    if (sections.length > 0 && !sections.some((section) => section.category === activeCategory)) {
      setActiveCategory(sections[0].category);
    }
  }, [activeCategory, sections]);

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
    mutationFn: ({ setting, value }: { setting: API.SettingOut; value: unknown }) =>
      appsSettingsApiPutOrgSetting({ key: setting.key }, { value: parseSettingValue(value, setting.value_type) }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug) });
    },
    onError: () => message.error('设置保存失败，请检查输入内容'),
  });

  const createBuildingMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createBuilding(values),
    onSuccess: (building) => {
      setCreatedBuildings((items) => [building, ...items]);
      setDraftValues((values) => ({ ...values, 'property_rental.default_building_id': building.id }));
      const defaultBuildingSetting = settingsQuery.data?.find((setting) => setting.key === defaultBuildingSettingKey);
      if (defaultBuildingSetting) {
        updateMutation.mutate({ setting: defaultBuildingSetting, value: building.id });
      }
      setBuildingOpen(false);
      buildingForm.resetFields();
      message.success('楼栋已创建');
    },
  });

  const renderControl = (setting: API.SettingOut) => {
    const value = draftValues[setting.key];
    const onChange = (nextValue: unknown) => setDraftValues((values) => ({ ...values, [setting.key]: nextValue }));
    const onCommit = (nextValue: unknown) => {
      setDraftValues((values) => ({ ...values, [setting.key]: nextValue }));
      updateMutation.mutate({ setting, value: nextValue });
    };

    if (setting.key === defaultBuildingSettingKey) {
      return (
        <DefaultBuildingControl
          value={value}
          loading={buildingsQuery.isLoading}
          buildings={contextualBuildingItems}
          onChange={onCommit}
          onCreate={() => setBuildingOpen(true)}
        />
      );
    }

    if (setting.key === publishRulesSettingKey) {
      return <PublishRulesControl value={value} onCommit={onCommit} />;
    }

    if (setting.key === 'property_rental.default_location' || setting.widget === 'location_picker') {
      return (
        <LocationPicker
          ariaLabel="默认定位"
          value={parseLocationValue(value)}
          fallbackLocation={null}
          onChange={(nextValue) => {
            if (nextValue) {
              onCommit(nextValue);
              return;
            }
            appsSettingsApiDeleteOrgSettingView({ key: setting.key })
              .then(() => workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.organization(workspace.selectedOrgSlug) }))
              .catch(() => message.error('清除默认定位失败'));
          }}
          allowClear
        />
      );
    }

    return <SettingSchemaControl setting={setting} value={value} onChange={onChange} onCommit={onCommit} />;
  };

  return (
    <TenantSelectionGuard title="空间设置">
      <Card loading={settingsQuery.isLoading}>
        <Tabs
          tabPlacement="start"
          activeKey={activeCategory || sections[0]?.category}
          onChange={setActiveCategory}
          items={sections.map((section) => ({
            key: section.category,
            label: section.title,
            children: (
              <div style={{ paddingLeft: 8 }}>
                {section.rows.map((setting, settingIndex) => {
                  const title = setting.label || setting.key;
                  const description = setting.key !== publishRulesSettingKey && setting.description && setting.description !== title ? setting.description : undefined;

                  return (
                    <div key={setting.key} id={settingAnchorId(setting.key)} style={{ ...settingRowStyle, borderTop: settingIndex === 0 ? 0 : settingRowStyle.borderTop }}>
                      <Space orientation="vertical" size={4} style={settingMetaStyle}>
                        <Typography.Text strong>{title}</Typography.Text>
                        {description ? (
                          <Typography.Text type="secondary" style={wrapTextStyle}>
                            {description}
                          </Typography.Text>
                        ) : null}
                      </Space>
                      <Form layout="vertical" style={{ ...settingControlStyle, maxWidth: setting.value_type === 'json' ? 900 : 520 }}>
                        <Form.Item style={{ marginBottom: 0 }}>{renderControl(setting)}</Form.Item>
                      </Form>
                    </div>
                  );
                })}
              </div>
            ),
          }))}
        />
      </Card>
      <Modal title="新建楼栋" open={buildingOpen} onCancel={() => setBuildingOpen(false)} footer={null} destroyOnHidden>
        <Form
          form={buildingForm}
          layout="vertical"
          initialValues={{ floors: 1 }}
          onFinish={(values) => createBuildingMutation.mutate({ ...values, estate_id: values.estate_id ?? null, floors: Number(values.floors) })}
        >
          <Form.Item label="项目小区" name="estate_id">
            <Select allowClear loading={estatesQuery.isLoading} options={(estatesQuery.data?.items || []).map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item label="楼栋名" name="name" rules={[{ required: true, message: '请输入楼栋名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="楼层" name="floors" rules={[{ required: true, message: '请输入楼层' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="标签" name="tags" extra="房源会在自身标签之后自动继承这些楼栋标签。">
            <PropertyTagSelect
              suggestions={tagSuggestions.data?.tags ?? []}
              suggestionsLoading={tagSuggestions.isLoading}
              suggestionsError={tagSuggestions.isError}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previousValues, currentValues) => previousValues.estate_id !== currentValues.estate_id}>
            {() => (
              <Form.Item
                label="地址"
                name="address"
                rules={[
                  ({ getFieldValue }) => ({
                    validator: async (_rule, value) => {
                      if (getFieldValue('estate_id') === undefined || getFieldValue('estate_id') === null) {
                        if (!String(value || '').trim()) throw new Error('非小区楼栋必须填写楼栋地址');
                      }
                    },
                  }),
                ]}
              >
                <Input />
              </Form.Item>
            )}
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
