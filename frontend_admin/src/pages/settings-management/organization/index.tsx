import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Divider, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Tabs, Tag, Typography, message, theme } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  HOUSE_PUBLISH_RULE_MODE,
  HOUSE_PUBLISH_RULE_PRESETS,
  HOUSE_PUBLISH_RULE_ROWS,
  type HousePublishRuleKey,
  buildHousePublishRulesPreset,
  normalizeHousePublishRules,
  resolveHousePublishRulesPreset,
  summarizeHousePublishRules as summarizePublishRules,
} from '@/pages/property-rental/publish-rules';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import {
  appsSettingsApiListOrgSettings,
  appsSettingsApiPutOrgSetting,
} from '@/services/openapi/organizationSettings';
import {
  SettingSchemaControl,
  parseSettingValue,
  settingsManagementQueryKeys,
  stringifySettingValue,
} from '../shared';
import { getLoadingSafeCount, getLoadingSafeText } from '@/pages/property-rental/loading';

type DraftValues = Record<string, unknown>;
type BuildingItem = { id: number; name: string; estate_id: number; estate_name?: string };
type SettingsClosureSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionButton?: React.ReactNode;
};

const categoryTitles: Record<string, string> = {
  property_rental: '房源租赁设置',
  general: '通用设置',
};
const categoryOrder = ['property_rental', 'general'];
const defaultBuildingSettingKey = 'property_rental.default_building_id';
const publishRulesSettingKey = 'property_rental.publish_rules';
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

function settingAnchorId(settingKey: string) {
  return `setting-${settingKey.replace(/\./g, '-')}`;
}

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
      options={buildings.map((item) => ({ value: item.id, label: item.estate_name ? `${item.estate_name} / ${item.name}` : item.name }))}
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

const PublishRulesControl: React.FC<{
  value: unknown;
  onCommit: (value: unknown) => void;
}> = ({ value, onCommit }) => {
  const rules = normalizeHousePublishRules(value);
  const summary = summarizePublishRules(rules);
  const activePreset = resolveHousePublishRulesPreset(rules);
  const presetKeys = Object.keys(HOUSE_PUBLISH_RULE_PRESETS) as Array<keyof typeof HOUSE_PUBLISH_RULE_PRESETS>;

  const updateRule = (ruleKey: HousePublishRuleKey, patch: Record<string, unknown>) => {
    onCommit({
      ...rules,
      [ruleKey]: {
        ...rules[ruleKey],
        ...patch,
      },
    });
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        title="当前发布策略"
        description={
          <Space orientation="vertical" size={8}>
            <Space wrap size={8}>
              <Tag color="red">阻断发布：{summary.blocking.join('、') || '无'}</Tag>
              <Tag color="gold">仅提醒：{summary.warning.join('、') || '无'}</Tag>
              <Tag>不校验：{summary.ignored.join('、') || '无'}</Tag>
              <Tag color={activePreset === 'custom' ? 'blue' : 'green'}>
                当前策略：{activePreset === 'custom' ? '自定义' : HOUSE_PUBLISH_RULE_PRESETS[activePreset].title}
              </Tag>
            </Space>
            <Typography.Text type="secondary">房东和租金建议始终保持阻断；封面、图片、户型图和视频可以按项目阶段单独调整。</Typography.Text>
          </Space>
        }
      />
      <Space wrap size={8}>
        {presetKeys.map((presetKey) => (
          <Button key={presetKey} type={activePreset === presetKey ? 'primary' : 'default'} onClick={() => onCommit(buildHousePublishRulesPreset(presetKey))}>
            {HOUSE_PUBLISH_RULE_PRESETS[presetKey].title}
          </Button>
        ))}
      </Space>
      <div
        style={{
          display: 'grid',
          gap: 12,
          padding: 12,
          border: '1px solid var(--ant-color-border-secondary)',
          borderRadius: 8,
          background: 'var(--ant-color-fill-quaternary)',
        }}
      >
        {HOUSE_PUBLISH_RULE_ROWS.map((rule, index) => (
          <div
            key={rule.key}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              paddingTop: index === 0 ? 0 : 12,
              borderTop: index === 0 ? 0 : '1px solid var(--ant-color-border-secondary)',
            }}
          >
            <Space orientation="vertical" size={2} style={{ flex: '1 1 320px', minWidth: 260 }}>
              <Space wrap size={8}>
                <Typography.Text strong>{rule.label}</Typography.Text>
                {rule.countLabel ? <Tag color="blue">{rule.countLabel}</Tag> : <Tag>基础字段</Tag>}
              </Space>
              <Typography.Text type="secondary">{rule.description}</Typography.Text>
            </Space>
            <div style={{ flex: '0 0 140px' }}>
              <Select
                aria-label={rule.label}
                value={rules[rule.key]?.mode}
                options={[
                  { value: HOUSE_PUBLISH_RULE_MODE.REQUIRED, label: '阻断发布' },
                  { value: HOUSE_PUBLISH_RULE_MODE.WARNING, label: '仅提醒' },
                  { value: HOUSE_PUBLISH_RULE_MODE.OFF, label: '不校验' },
                ]}
                onChange={(nextValue) => updateRule(rule.key, { mode: nextValue })}
                style={{ width: 140 }}
              />
            </div>
            {rule.countLabel ? (
              <Space orientation="vertical" size={4} style={{ flex: '0 0 180px' }}>
                <Typography.Text type="secondary">{rule.countLabel}</Typography.Text>
                <InputNumber
                  aria-label={`${rule.label}${rule.countLabel}`}
                  min={0}
                  value={rules[rule.key]?.min_count}
                  disabled={rules[rule.key]?.mode === HOUSE_PUBLISH_RULE_MODE.OFF}
                  onChange={(nextValue) => updateRule(rule.key, { min_count: Number(nextValue ?? 0) })}
                  style={{ width: '100%' }}
                />
                {rules[rule.key]?.mode === HOUSE_PUBLISH_RULE_MODE.OFF ? <Typography.Text type="secondary">关闭时仅保留阈值，不参与发布判断。</Typography.Text> : null}
              </Space>
            ) : (
              <Typography.Text type="secondary" style={{ flex: '0 0 160px' }}>-</Typography.Text>
            )}
          </div>
        ))}
      </div>
      <Typography.Text type="secondary">
        缺“阻断发布”的房源不能发布；“仅提醒”项目会继续出现在房源台账和工作台里，但不会阻断发布。
      </Typography.Text>
    </Space>
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
  const houseImpactQueries = useQueries({
    queries: [
      {
        queryKey: ['settings-management', 'organization', 'house-impact', workspace.selectedOrgSlug, 'blocked'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_blocked: true }),
        enabled: Boolean(workspace.selectedOrgSlug),
      },
      {
        queryKey: ['settings-management', 'organization', 'house-impact', workspace.selectedOrgSlug, 'ready'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_ready: true }),
        enabled: Boolean(workspace.selectedOrgSlug),
      },
      {
        queryKey: ['settings-management', 'organization', 'house-impact', workspace.selectedOrgSlug, 'published'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_status: 'published' }),
        enabled: Boolean(workspace.selectedOrgSlug),
      },
    ],
  });

  const buildingItems = useMemo(() => [...createdBuildings, ...(buildingsQuery.data?.items || [])], [buildingsQuery.data, createdBuildings]);
  const estateNameById = useMemo(
    () => new Map((estatesQuery.data?.items || []).map((item) => [item.id, item.name])),
    [estatesQuery.data],
  );
  const sections = useMemo(() => buildSettingSections(settingsQuery.data), [settingsQuery.data]);
  const { token } = theme.useToken();

  useEffect(() => {
    setDraftValues({});
    setCreatedBuildings([]);
    setActiveCategory(undefined);
  }, [workspace.selectedOrgSlug]);

  const contextualBuildingItems = useMemo(
    () =>
      buildingItems.map((item) => ({
        ...item,
        estate_name: item.estate_name || estateNameById.get(item.estate_id),
      })),
    [buildingItems, estateNameById],
  );
  const impactLoading = houseImpactQueries.some((query) => query.isPending);
  const blockedCount = houseImpactQueries[0]?.data?.total || 0;
  const readyCount = houseImpactQueries[1]?.data?.total || 0;
  const publishedCount = houseImpactQueries[2]?.data?.total || 0;
  const defaultBuildingSetting = settingsQuery.data?.find((setting) => setting.key === defaultBuildingSettingKey);
  const defaultBuildingId = Number(draftValues[defaultBuildingSettingKey] ?? defaultBuildingSetting?.value ?? 0) || undefined;
  const defaultBuilding = contextualBuildingItems.find((item) => item.id === defaultBuildingId);
  const defaultBuildingLabel = defaultBuilding ? `${defaultBuilding.estate_name || '未命名项目'} / ${defaultBuilding.name}` : '未设置默认楼栋';
  const activePreset = resolveHousePublishRulesPreset(normalizeHousePublishRules(draftValues[publishRulesSettingKey]));
  const currentRuleSummary = summarizePublishRules(normalizeHousePublishRules(draftValues[publishRulesSettingKey]));
  const sectionStyle: React.CSSProperties = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorBgContainer,
  };
  const overviewTileStyle: React.CSSProperties = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorFillQuaternary,
    height: '100%',
  };
  const signalTileStyle: React.CSSProperties = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    background: token.colorBgContainer,
    height: '100%',
  };
  const closureSignals: SettingsClosureSignal[] = [
    {
      key: 'default_building',
      title: '默认楼栋',
      emphasis: defaultBuilding ? '录入已就绪' : '先设默认',
      summary: defaultBuildingLabel,
      description: '常用录入默认楼栋设清楚，建房源时能少一步选择，也能避免误挂到错误楼栋。',
      actionLabel: '查看默认楼栋',
      actionHref: `#${settingAnchorId(defaultBuildingSettingKey)}`,
    },
    {
      key: 'publish_rules',
      title: '发布规则',
      emphasis: activePreset === 'strict' ? '规则偏严格' : activePreset === 'relaxed' ? '规则偏宽松' : activePreset === 'standard' ? '标准策略' : '自定义策略',
      summary: `阻断 ${currentRuleSummary.blocking.length} 项 / 提醒 ${currentRuleSummary.warning.length} 项 / 忽略 ${currentRuleSummary.ignored.length} 项`,
      description: '空间规则决定房东、租金和媒体资料哪些会阻断发布，哪些只做提醒，不同阶段可以按业务节奏调整。',
      actionLabel: '查看发布规则',
      actionHref: `#${settingAnchorId(publishRulesSettingKey)}`,
    },
    {
      key: 'inventory_impact',
      title: '库存影响',
      emphasis: blockedCount > 0 ? '先清阻断' : readyCount > 0 ? '可排上架' : '库存平稳',
      summary: `${blockedCount} 套阻断 / ${readyCount} 套可发布 / ${publishedCount} 套已发布`,
      description: '设置页不该脱离业务库存；这里直接反馈规则目前影响了多少房源，方便边调策略边看结果。',
      actionLabel: '查看库存影响',
      actionHref: '#settings-inventory-impact',
    },
    {
      key: 'building_supply',
      title: '楼栋供给',
      emphasis: contextualBuildingItems.length > 0 ? '可继续录入' : '先补楼栋',
      summary: `${contextualBuildingItems.length} 个可选楼栋 / ${estatesQuery.data?.items?.length || 0} 个项目`,
      description: '默认楼栋和发布规则都依赖底座供给，缺楼栋时应该直接能从这里补齐，不用跳出当前策略页。',
      actionButton: (
        <Button size="small" onClick={() => setBuildingOpen(true)}>
          补楼栋供给
        </Button>
      ),
    },
  ];

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

    return <SettingSchemaControl setting={setting} value={value} onChange={onChange} onCommit={onCommit} />;
  };

  return (
    <TenantSelectionGuard title="空间设置" subtitle="按业务功能管理当前空间的设置。">
      <Card loading={settingsQuery.isLoading}>
        <div id="settings-inventory-impact" style={sectionStyle}>
          <Typography.Text strong>策略概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="默认楼栋" value={defaultBuilding ? 1 : 0} />
                <Typography.Text type="secondary">{defaultBuildingLabel}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="在管楼栋" value={contextualBuildingItems.length} />
                <Typography.Text type="secondary">当前空间可直接作为默认录入和房源挂接底座的楼栋数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="阻断发布" value={getLoadingSafeCount(blockedCount, impactLoading)} />
                <Typography.Text type="secondary">{getLoadingSafeText(`${blockedCount} 套房源仍被当前规则阻断`, '正在计算库存影响...', impactLoading)}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="可发布" value={getLoadingSafeCount(readyCount, impactLoading)} />
                <Typography.Text type="secondary">{getLoadingSafeText(`${readyCount} 套房源当前满足发布条件`, '正在汇总可发布库存...', impactLoading)}</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>
        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {closureSignals.map((signal) => (
              <Col key={signal.key} xs={24} sm={12} xl={6}>
                <div style={signalTileStyle}>
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap size={[8, 8]}>
                      <Typography.Text strong>{signal.title}</Typography.Text>
                      <Tag color="blue">{signal.emphasis}</Tag>
                    </Space>
                    <Typography.Text>{signal.summary}</Typography.Text>
                    <Typography.Text type="secondary">{signal.description}</Typography.Text>
                    {signal.actionHref && signal.actionLabel ? <a href={signal.actionHref}>{signal.actionLabel}</a> : signal.actionButton}
                  </Space>
                </div>
              </Col>
            ))}
          </Row>
        </div>
        <Alert
          type="info"
          showIcon
          title="这组设置会同步影响房源详情、新建房源和工作台的发布判断"
          description="建议把房东、租金维持为阻断发布项，把封面、图片、户型图和视频按当前业务阶段配置成阻断发布、仅提醒或不校验。"
          style={{ marginBottom: 16 }}
        />
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
                  const description = setting.description && setting.description !== title ? setting.description : undefined;

                  return (
                    <div key={setting.key} id={settingAnchorId(setting.key)} style={{ ...settingRowStyle, borderTop: settingIndex === 0 ? 0 : settingRowStyle.borderTop }}>
                      <Space orientation="vertical" size={4} style={settingMetaStyle}>
                        <Space wrap align="center">
                          <Typography.Text strong>{title}</Typography.Text>
                          {setting.is_customized ? <Tag color="gold">已自定义</Tag> : <Tag>默认值</Tag>}
                        </Space>
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
            <InputNumber min={1} style={{ width: '100%' }} />
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
