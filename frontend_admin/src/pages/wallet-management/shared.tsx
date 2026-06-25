import { Form, Input, Modal, Tooltip, Typography } from 'antd';
import type { FormInstance } from 'antd';
import React from 'react';

export const walletQueryKeys = {
  accounts: (page?: number) => ['wallet-management', 'accounts', page],
  ledger: (userId?: number, page?: number) => ['wallet-management', 'ledger', userId, page],
  withdrawals: (page?: number) => ['wallet-management', 'withdrawals', page],
};

export function formatWalletAmount(value: number) {
  return value.toLocaleString();
}

function stringifyJsonValue(value: unknown, pretty = false) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value || {}, null, pretty ? 2 : 0);
}

function summarizeJsonValue(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const snapshot = value as Record<string, unknown>;
    const preferredKeys = ['receiver_name', 'masked_account', 'social_provider', 'channel'];
    const summary = preferredKeys
      .map((key) => snapshot[key])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(' / ');

    if (summary) {
      return summary;
    }
  }

  const text = stringifyJsonValue(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export const JsonText: React.FC<{ value: unknown }> = ({ value }) => (
  <Tooltip
    placement="topLeft"
    styles={{ root: { maxWidth: 520 } }}
    title={<pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{stringifyJsonValue(value, true)}</pre>}
  >
    <Typography.Text code ellipsis style={{ display: 'inline-block', width: '100%', maxWidth: 360, verticalAlign: 'bottom' }}>
      {summarizeJsonValue(value)}
    </Typography.Text>
  </Tooltip>
);

export const IdempotencyFormItem: React.FC = () => (
  <Form.Item label="幂等键" name="idempotency_key" rules={[{ required: true, message: '请输入幂等键' }]}>
    <Input />
  </Form.Item>
);

export const PayoutModal: React.FC<{
  open: boolean;
  title: string;
  loading?: boolean;
  form: FormInstance<API.PayoutCreateIn>;
  onCancel: () => void;
  onOk: () => void;
}> = ({ open, title, loading, form, onCancel, onOk }) => (
  <Modal title={title} open={open} confirmLoading={loading} onCancel={onCancel} onOk={onOk}>
    <Form form={form} layout="vertical">
      <Form.Item label="渠道" name="provider" rules={[{ required: true, message: '请输入渠道' }]}>
        <Input />
      </Form.Item>
      <Form.Item label="商户单号" name="out_trade_no" rules={[{ required: true, message: '请输入商户单号' }]}>
        <Input />
      </Form.Item>
      <IdempotencyFormItem />
    </Form>
  </Modal>
);
