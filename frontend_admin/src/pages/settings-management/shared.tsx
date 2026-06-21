import { Button, Card, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import { adminTableScroll, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { TenantSectionHint } from '@/pages/tenant/shared';

export const settingsManagementQueryKeys = {
  organization: (slug?: string) => ['settings-management', 'organization', slug],
  teams: (slug?: string) => ['settings-management', 'teams', slug],
  team: (slug?: string, teamId?: number) => ['settings-management', 'team', slug, teamId],
};

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
  setting?: API.SettingOut | null;
  loading?: boolean;
  form: ReturnType<typeof Form.useForm<{ value: string }>>[0];
  onCancel: () => void;
  onOk: () => void;
}> = ({ open, setting, loading, form, onCancel, onOk }) => (
  <Modal title={setting ? `编辑 ${setting.key}` : '编辑设置'} open={open} confirmLoading={loading} onCancel={onCancel} onOk={onOk}>
    <Form form={form} layout="vertical">
      <Form.Item label="设置值" name="value" rules={[{ required: true, message: '请输入设置值' }]}>
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
      </Form.Item>
      {setting ? (
        <Typography.Paragraph type="secondary">
          当前类型：{setting.value_type}
        </Typography.Paragraph>
      ) : null}
    </Form>
  </Modal>
);

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
}> = ({ setting, value, onChange }) => {
  const widget = setting.widget || 'textarea';

  if (widget === 'switch') {
    return <Switch aria-label={setting.label || setting.key} checked={Boolean(value)} onChange={onChange} />;
  }
  if (widget === 'input_number') {
    return (
      <InputNumber
        aria-label={setting.label || setting.key}
        value={typeof value === 'number' ? value : Number(value)}
        onChange={(nextValue) => onChange(nextValue)}
        style={{ width: 240, maxWidth: '100%' }}
      />
    );
  }
  if (widget === 'select') {
    return (
      <Select
        aria-label={setting.label || setting.key}
        value={value as string | number | boolean | undefined}
        onChange={onChange}
        options={settingOptions(setting)}
        style={{ width: 320, maxWidth: '100%' }}
      />
    );
  }
  if (widget === 'input') {
    return <Input aria-label={setting.label || setting.key} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
  }
  if (widget === 'password') {
    return <Input.Password aria-label={setting.label || setting.key} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
  }

  return (
    <Input.TextArea
      aria-label={setting.label || setting.key}
      value={stringifySettingValue(value)}
      onChange={(event) => onChange(event.target.value)}
      autoSize={{ minRows: widget === 'json_editor' ? 4 : 3, maxRows: 10 }}
    />
  );
};

export function buildSettingColumns(
  onEdit: (setting: API.SettingOut) => void,
  onRestore: (setting: API.SettingOut) => void,
  onView?: (setting: API.SettingOut) => void,
): ColumnsType<API.SettingOut> {
  return [
    {
      title: '设置项',
      dataIndex: 'key',
      width: 300,
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{record.key}</Typography.Text>
          <Typography.Text type="secondary" style={wrapTextStyle}>{record.description || '无描述'}</Typography.Text>
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
  hint: string;
  loading?: boolean;
  data?: API.SettingOut[];
  onEdit: (setting: API.SettingOut) => void;
  onRestore: (setting: API.SettingOut) => void;
  onView?: (setting: API.SettingOut) => void;
}> = ({ title, hint, loading, data, onEdit, onRestore, onView }) => (
  <Card title={title}>
    <TenantSectionHint text={hint} />
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
