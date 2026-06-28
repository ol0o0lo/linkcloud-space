import { Form, Input, Modal, Space, Tag, Typography } from 'antd';
import type { FormInstance } from 'antd';
import React from 'react';

export const platformQueryKeys = {
  users: (page?: number, keyword?: string) => ['platform-management', 'users', page, keyword],
  realName: (page?: number, keyword?: string, status?: string) => ['platform-management', 'real-name', page, keyword, status],
  notifications: (page?: number, isRead?: string) => ['platform-management', 'notifications', page, isRead],
  notificationDispatches: (page?: number) => ['platform-management', 'notification-dispatches', page],
  notificationDispatchDetail: (id?: number) => ['platform-management', 'notification-dispatch-detail', id],
  notificationDispatchNotifications: (id?: number, page?: number) => ['platform-management', 'notification-dispatch-notifications', id, page],
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
  description?: React.ReactNode;
  form: FormInstance<{ note: string }>;
  onCancel: () => void;
  onOk: () => void;
}> = ({ open, title, loading, description, form, onCancel, onOk }) => (
  <Modal title={title} open={open} confirmLoading={loading} onCancel={onCancel} onOk={onOk}>
    <Form form={form} layout="vertical">
      {description ? (
        <Form.Item>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </Form.Item>
      ) : null}
      <Form.Item label="备注" name="note">
        <Input />
      </Form.Item>
    </Form>
  </Modal>
);
