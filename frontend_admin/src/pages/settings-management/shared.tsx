import { Button, Card, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import type { FormInstance } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import { adminTableScroll, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { TenantSectionHint } from '@/pages/tenant/shared';
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

export type SettingOption = { label: string; value: string | number | boolean };

type SettingUi = {
  options?: SettingOption[];
  options_source?: string;
  placeholder?: string;
  min?: number;
  max?: number;
};

type SettingWithSchema = API.SettingOut & {
  label?: string;
  widget?: string;
  ui?: SettingUi;
};

export type SettingCustomControlProps = {
  value?: unknown;
  onChange?: (value: unknown) => void;
};

export type SettingCustomControls = Record<string, React.ComponentType<SettingCustomControlProps>>;

export const settingsManagementQueryKeys = {
  organization: (slug?: string) => ['settings-management', 'organization', slug],
  teams: (slug?: string) => ['settings-management', 'teams', slug],
  team: (slug?: string, teamId?: number) => ['settings-management', 'team', slug, teamId],
};

export const defaultBuildingSettingKey = 'property_rental.default_building_id';
export const publishRulesSettingKey = 'property_rental.publish_rules';

const categoryTitles: Record<string, string> = {
  property_rental: '房源租赁设置',
  general: '通用设置',
};
const categoryOrder = ['property_rental', 'general'];

export function initialDraftValue(setting: API.SettingOut) {
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

export function buildSettingSections(settings: API.SettingOut[] = []) {
  const sections = new Map<string, API.SettingOut[]>();
  settings.forEach((setting) => {
    const category = resolveSettingCategory(setting);
    sections.set(category, [...(sections.get(category) || []), setting]);
  });

  return categoryOrder
    .filter((category) => sections.has(category))
    .map((category) => ({ category, title: categoryTitles[category], rows: sections.get(category) || [] }));
}

export function settingAnchorId(settingKey: string) {
  return `setting-${settingKey.replace(/\./g, '-')}`;
}

export function parseSettingValue(rawValue: unknown, valueType: string) {
  if (typeof rawValue !== 'string') {
    return rawValue;
  }
  if (valueType === 'bool' || valueType === 'boolean') {
    return ['true', '1', 'yes', 'on'].includes(rawValue.trim().toLowerCase());
  }
  if (valueType === 'int' || valueType === 'integer') {
    const parsed = Number.parseInt(rawValue, 10);
    return Number.isNaN(parsed) ? rawValue : parsed;
  }
  if (valueType === 'float' || valueType === 'number') {
    const parsed = Number.parseFloat(rawValue);
    return Number.isNaN(parsed) ? rawValue : parsed;
  }
  if (valueType === 'json') {
    return JSON.parse(rawValue);
  }
  return rawValue;
}

export function stringifySettingValue(value: unknown, pretty = true) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, pretty ? 2 : 0);
}

export function settingFormValue(setting: SettingWithSchema) {
  const widget = setting.widget || defaultWidget(setting.value_type);
  if (setting.value_type === 'json' || widget === 'json_editor') {
    return stringifySettingValue(setting.value);
  }
  return setting.value;
}

function summarizeSettingValue(value: unknown) {
  const text = stringifySettingValue(value, false);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export const SettingValue: React.FC<{ value: unknown }> = ({ value }) => (
  <Tooltip
    placement="topLeft"
    overlayStyle={{ maxWidth: 520 }}
    title={<pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{stringifySettingValue(value)}</pre>}
  >
    <Typography.Text code ellipsis style={{ display: 'inline-block', width: '100%', maxWidth: 320, verticalAlign: 'bottom' }}>
      {summarizeSettingValue(value)}
    </Typography.Text>
  </Tooltip>
);

export const SettingEditModal: React.FC<{
  open: boolean;
  setting?: SettingWithSchema | null;
  loading?: boolean;
  form: FormInstance<{ value: unknown }>;
  optionSources?: Record<string, SettingOption[]>;
  customControls?: SettingCustomControls;
  onCancel: () => void;
  onOk: () => void;
}> = ({ open, setting, loading, form, optionSources, customControls, onCancel, onOk }) => {
  const widget = setting?.widget || defaultWidget(setting?.value_type);
  const options = setting?.ui?.options || (setting?.ui?.options_source ? optionSources?.[setting.ui.options_source] : undefined);
  const CustomControl = setting ? customControls?.[setting.key] : undefined;

  return (
    <Modal title={setting ? `编辑 ${setting.label || setting.key}` : '编辑设置'} open={open} confirmLoading={loading} onCancel={onCancel} onOk={onOk}>
      <Form form={form} layout="vertical">
        <Form.Item label={setting?.label || '设置值'} name="value" valuePropName={widget === 'switch' ? 'checked' : 'value'} rules={widget === 'switch' ? [] : [{ required: true, message: '请输入设置值' }]}>
          {CustomControl ? <CustomControl /> : renderSettingControl(widget, setting?.ui, options)}
        </Form.Item>
        {setting ? (
          <Typography.Paragraph type="secondary">
            当前类型：{setting.value_type} / 组件：{widget}
          </Typography.Paragraph>
        ) : null}
      </Form>
    </Modal>
  );
};

function defaultWidget(valueType?: string) {
  if (valueType === 'bool' || valueType === 'boolean') return 'switch';
  if (valueType === 'int' || valueType === 'integer' || valueType === 'float' || valueType === 'number') return 'input_number';
  if (valueType === 'password') return 'password';
  if (valueType === 'json') return 'json_editor';
  return 'input';
}

function renderSettingControl(widget: string, ui?: SettingUi, options?: SettingOption[]) {
  if (widget === 'switch') return <Switch />;
  if (widget === 'input_number') return <InputNumber min={ui?.min} max={ui?.max} placeholder={ui?.placeholder} style={{ width: '100%' }} />;
  if (widget === 'select') return <Select options={options || []} placeholder={ui?.placeholder} />;
  if (widget === 'password') return <Input.Password placeholder={ui?.placeholder} />;
  if (widget === 'textarea' || widget === 'json_editor') return <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder={ui?.placeholder} />;
  return <Input placeholder={ui?.placeholder} />;
}

function settingOptions(setting: API.SettingOut) {
  const rawOptions = Array.isArray(setting.ui?.options) ? setting.ui.options : [];
  return rawOptions.map((option) => {
    if (typeof option === 'object' && option !== null && 'value' in option) {
      return option as { label?: React.ReactNode; value: string | number | boolean };
    }
    return { label: String(option), value: option as string | number | boolean };
  });
}

export const SettingSchemaControl: React.FC<{
  setting: API.SettingOut;
  value: unknown;
  onChange: (value: unknown) => void;
  onCommit?: (value: unknown) => void;
}> = ({ setting, value, onChange, onCommit }) => {
  const widget = setting.widget || 'textarea';

  if (widget === 'switch') {
    return (
      <Switch
        aria-label={setting.label || setting.key}
        checked={Boolean(value)}
        onChange={(nextValue) => {
          onChange(nextValue);
          onCommit?.(nextValue);
        }}
      />
    );
  }
  if (widget === 'input_number') {
    return (
      <InputNumber
        aria-label={setting.label || setting.key}
        value={typeof value === 'number' ? value : Number(value)}
        onChange={(nextValue) => onChange(nextValue)}
        onBlur={(event) => onCommit?.(event.target.value)}
        style={{ width: 240, maxWidth: '100%' }}
      />
    );
  }
  if (widget === 'select') {
    return (
      <Select
        aria-label={setting.label || setting.key}
        value={value as string | number | boolean | undefined}
        onChange={(nextValue) => {
          onChange(nextValue);
          onCommit?.(nextValue);
        }}
        options={settingOptions(setting)}
        style={{ width: 320, maxWidth: '100%' }}
      />
    );
  }
  if (widget === 'input') {
    return (
      <Input
        aria-label={setting.label || setting.key}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit?.(event.target.value)}
      />
    );
  }
  if (widget === 'password') {
    return (
      <Input.Password
        aria-label={setting.label || setting.key}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit?.(event.target.value)}
      />
    );
  }

  return (
    <Input.TextArea
      aria-label={setting.label || setting.key}
      value={stringifySettingValue(value)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit?.(event.target.value)}
      autoSize={{ minRows: widget === 'json_editor' ? 4 : 3, maxRows: 10 }}
    />
  );
};

export const PublishRulesControl: React.FC<{
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
      <Space wrap size={8}>
        <Tag color="red">阻断发布：{summary.blocking.join('、') || '无'}</Tag>
        <Tag color="gold">仅提醒：{summary.warning.join('、') || '无'}</Tag>
        <Tag>不校验：{summary.ignored.join('、') || '无'}</Tag>
      </Space>
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(160px, 1fr) 140px 140px',
            gap: 12,
            padding: '0 12px 8px',
            color: 'var(--ant-color-text-secondary)',
          }}
        >
          <span>资料项</span>
          <span>校验</span>
          <span>数量</span>
        </div>
        {HOUSE_PUBLISH_RULE_ROWS.map((rule, index) => (
          <div
            key={rule.key}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(160px, 1fr) 140px 140px',
              gap: 12,
              alignItems: 'center',
              paddingTop: index === 0 ? 0 : 12,
              borderTop: index === 0 ? 0 : '1px solid var(--ant-color-border-secondary)',
            }}
          >
            <Typography.Text strong>{rule.label}</Typography.Text>
            <Select
              aria-label={rule.label}
              value={rules[rule.key]?.mode}
              options={[
                { value: HOUSE_PUBLISH_RULE_MODE.REQUIRED, label: '阻断发布' },
                { value: HOUSE_PUBLISH_RULE_MODE.WARNING, label: '仅提醒' },
                { value: HOUSE_PUBLISH_RULE_MODE.OFF, label: '不校验' },
              ]}
              onChange={(nextValue) => updateRule(rule.key, { mode: nextValue })}
              style={{ width: '100%' }}
            />
            {rule.countLabel ? (
              <InputNumber
                aria-label={`${rule.label}${rule.countLabel}`}
                min={0}
                value={rules[rule.key]?.min_count}
                disabled={rules[rule.key]?.mode === HOUSE_PUBLISH_RULE_MODE.OFF}
                onChange={(nextValue) => updateRule(rule.key, { min_count: Number(nextValue ?? 0) })}
                style={{ width: '100%' }}
              />
            ) : (
              <Typography.Text type="secondary">-</Typography.Text>
            )}
          </div>
        ))}
      </div>
    </Space>
  );
};

export function buildSettingColumns(
  onEdit: (setting: SettingWithSchema) => void,
  onRestore: (setting: SettingWithSchema) => void,
  onView?: (setting: SettingWithSchema) => void,
): ColumnsType<SettingWithSchema> {
  return [
    {
      title: '设置项',
      dataIndex: 'key',
      width: 300,
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{record.key}</Typography.Text>
          <Typography.Text type="secondary" style={wrapTextStyle}>{record.label || record.description || '无描述'}</Typography.Text>
        </Space>
      ),
    },
    { title: '类型', dataIndex: 'value_type', width: 110, render: (value) => <Tag>{value}</Tag> },
    { title: '当前值', dataIndex: 'value', width: 320, render: (value) => <SettingValue value={value} /> },
    {
      title: '状态',
      dataIndex: 'is_customized',
      width: 110,
      render: (value) => (value ? <Tag color="gold">已覆盖</Tag> : <Tag>默认值</Tag>),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 150,
      render: (_value, record) => (
        <ResponsiveActions>
          {onView ? <a onClick={() => onView(record)}>详情</a> : null}
          <a onClick={() => onEdit(record)}>编辑</a>
          {record.is_customized ? (
            <Popconfirm title="确认恢复该设置默认值？" onConfirm={() => onRestore(record)}>
              <a>恢复默认</a>
            </Popconfirm>
          ) : null}
        </ResponsiveActions>
      ),
    },
  ];
}

export const SettingsTableCard: React.FC<{
  title: string;
  hint?: string;
  loading?: boolean;
  data?: SettingWithSchema[];
  onEdit: (setting: SettingWithSchema) => void;
  onRestore: (setting: SettingWithSchema) => void;
  onView?: (setting: SettingWithSchema) => void;
}> = ({ title, hint, loading, data, onEdit, onRestore, onView }) => (
  <Card title={title}>
    {hint ? <TenantSectionHint text={hint} /> : null}
    <Table
      rowKey="key"
      loading={loading}
      columns={buildSettingColumns(onEdit, onRestore, onView)}
      dataSource={data || []}
      pagination={false}
      scroll={adminTableScroll}
      locale={{ emptyText: <Empty description="当前没有可配置设置项。" /> }}
    />
  </Card>
);

export const SettingsToolbarCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card style={{ marginBottom: 16 }}>
    {children}
  </Card>
);

export const PrimaryActionButton = Button;
