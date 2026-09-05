import { Button, Card, Input, InputNumber, Select, Space, Switch, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  HOUSE_PUBLISH_RULE_MODE,
  HOUSE_PUBLISH_RULE_PRESETS,
  HOUSE_PUBLISH_RULE_ROWS,
  type HousePublishRuleKey,
  buildHousePublishRulesPreset,
  normalizeHousePublishRules,
  resolveHousePublishRulesPreset,
} from '@/pages/rental/publish-rules';

export type SettingOption = { label: string; value: string | number | boolean };

type SettingUi = {
  options?: SettingOption[];
  options_source?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

export const settingsManagementQueryKeys = {
  organization: (slug?: string) => ['settings-management', 'organization', slug],
  teams: (slug?: string) => ['settings-management', 'teams', slug],
  team: (slug?: string, teamId?: number) => ['settings-management', 'team', slug, teamId],
};

export const defaultBuildingSettingKey = 'property_rental.default_building_id';
export const publishRulesSettingKey = 'property_rental.publish_rules';
export const leaseAllocationRuleSettingKey = 'property_rental.lease_allocation_rule';

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
  const ui = (setting.ui || {}) as SettingUi;

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
        min={ui.min}
        max={ui.max}
        step={ui.step}
        suffix={ui.unit}
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

type LeaseAllocationRuleValue = {
  method: 'percentage' | 'fixed';
  rate_bp: number | null;
  fixed_amount: string | null;
};

function normalizeLeaseAllocationRule(value: unknown): LeaseAllocationRuleValue {
  if (value && typeof value === 'object') {
    const raw = value as Partial<LeaseAllocationRuleValue>;
    if (raw.method === 'fixed') {
      return {
        method: 'fixed',
        rate_bp: null,
        fixed_amount:
          raw.fixed_amount == null ? '' : String(raw.fixed_amount),
      };
    }
    if (
      raw.method === 'percentage' &&
      typeof raw.rate_bp === 'number' &&
      raw.rate_bp >= 1 &&
      raw.rate_bp <= 10000
    ) {
      return {
        method: 'percentage',
        rate_bp: raw.rate_bp,
        fixed_amount: null,
      };
    }
  }
  return { method: 'percentage', rate_bp: 9000, fixed_amount: null };
}

export const LeaseAllocationRuleControl: React.FC<{
  value: unknown;
  onCommit: (value: LeaseAllocationRuleValue) => void;
}> = ({ value, onCommit }) => {
  const [draft, setDraft] = useState(() => normalizeLeaseAllocationRule(value));

  useEffect(() => {
    setDraft(normalizeLeaseAllocationRule(value));
  }, [value]);

  const percentage = (draft.rate_bp || 0) / 100;
  const fixedAmount = Number(draft.fixed_amount || 0);
  const valid =
    draft.method === 'percentage'
      ? percentage >= 0.01 && percentage <= 100
      : Number.isFinite(fixedAmount) && fixedAmount > 0;

  const save = () => {
    if (!valid) return;
    if (draft.method === 'percentage') {
      onCommit({
        method: 'percentage',
        rate_bp: Math.round(percentage * 100),
        fixed_amount: null,
      });
      return;
    }
    onCommit({
      method: 'fixed',
      rate_bp: null,
      fixed_amount: fixedAmount.toFixed(2),
    });
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Select
        aria-label="收益计算方式"
        value={draft.method}
        options={[
          { value: 'percentage', label: '按成交房源月租比例' },
          { value: 'fixed', label: '每笔签约固定金额' },
        ]}
        onChange={(method: LeaseAllocationRuleValue['method']) =>
          setDraft(
            method === 'percentage'
              ? { method, rate_bp: draft.rate_bp || 9000, fixed_amount: null }
              : {
                  method,
                  rate_bp: null,
                  fixed_amount: draft.fixed_amount || '',
                },
          )
        }
        style={{ width: 320, maxWidth: '100%' }}
      />
      {draft.method === 'percentage' ? (
        <InputNumber
          aria-label="员工收益比例"
          min={0.01}
          max={100}
          precision={2}
          suffix="%"
          value={percentage}
          onChange={(nextValue) =>
            setDraft({
              method: 'percentage',
              rate_bp: Math.round(Number(nextValue || 0) * 100),
              fixed_amount: null,
            })
          }
          style={{ width: 240, maxWidth: '100%' }}
        />
      ) : (
        <InputNumber<string>
          aria-label="每笔签约固定员工收益"
          stringMode
          min="0.01"
          precision={2}
          prefix="¥"
          suffix="元"
          value={draft.fixed_amount || undefined}
          onChange={(nextValue) =>
            setDraft({
              method: 'fixed',
              rate_bp: null,
              fixed_amount: nextValue || '',
            })
          }
          style={{ width: 240, maxWidth: '100%' }}
        />
      )}
      <Typography.Text type="secondary">
        {draft.method === 'percentage'
          ? `新签约将按成交房源月租的 ${percentage || 0}% 计算员工收益。`
          : `新签约每笔固定产生 ¥${fixedAmount.toFixed(2)} 员工收益。`}
      </Typography.Text>
      <div>
        <Button type="primary" disabled={!valid} onClick={save}>
          保存收益规则
        </Button>
      </div>
    </Space>
  );
};

export const SettingsToolbarCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card style={{ marginBottom: 16 }}>
    {children}
  </Card>
);
