import { Button, Card, Input, InputNumber, Select, Space, Switch, Typography } from 'antd';
import React from 'react';
import {
  HOUSE_PUBLISH_RULE_MODE,
  HOUSE_PUBLISH_RULE_PRESETS,
  HOUSE_PUBLISH_RULE_ROWS,
  type HousePublishRuleKey,
  buildHousePublishRulesPreset,
  normalizeHousePublishRules,
  resolveHousePublishRulesPreset,
} from '@/pages/property-rental/publish-rules';

export type SettingOption = { label: string; value: string | number | boolean };

type SettingUi = {
  options?: SettingOption[];
  options_source?: string;
  placeholder?: string;
  min?: number;
  max?: number;
};

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

export const SettingsToolbarCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card style={{ marginBottom: 16 }}>
    {children}
  </Card>
);
