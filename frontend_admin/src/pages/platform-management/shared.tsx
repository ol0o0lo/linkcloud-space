import { Form, Input, Modal, Space, Tag, Typography } from 'antd';
import type { FormInstance } from 'antd';
import React from 'react';

export const platformQueryKeys = {
  users: (page?: number) => ['platform-management', 'users', page],
  realName: (page?: number) => ['platform-management', 'real-name', page],
  notifications: (page?: number) => ['platform-management', 'notifications', page],
  notificationDispatches: (page?: number) => ['platform-management', 'notification-dispatches', page],
  notificationDispatchDetail: (id?: number) => ['platform-management', 'notification-dispatch-detail', id],
  notificationPreferences: ['platform-management', 'notification-preferences'],
  referralConfig: ['platform-management', 'referral-config'],
  referralRecords: (page?: number) => ['platform-management', 'referral-records', page],
};

export function personText(user: { username?: string; email?: string; first_name?: string; last_name?: string } = {}) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email || '未知用户';
}

export const StatusTag: React.FC<{ value?: string; color?: string }> = ({ value, color }) => <Tag color={color}>{value || 'unknown'}</Tag>;

export const IdentityText: React.FC<{ primary: string; secondary?: string }> = ({ primary, secondary }) => (
  <Space orientation="vertical" size={0}>
    <Typography.Text>{primary}</Typography.Text>
    {secondary ? <Typography.Text type="secondary">{secondary}</Typography.Text> : null}
  </Space>
);

export const NoteModal: React.FC<{
  open: boolean;
  title: string;
  loading?: boolean;
  form: FormInstance<{ note: string }>;
  onCancel: () => void;
  onOk: () => void;
}> = ({ open, title, loading, form, onCancel, onOk }) => (
  <Modal title={title} open={open} confirmLoading={loading} onCancel={onCancel} onOk={onOk}>
    <Form form={form} layout="vertical">
      <Form.Item label="备注" name="note">
        <Input />
      </Form.Item>
    </Form>
  </Modal>
);
