import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Space, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useState } from 'react';
import { AdminToolbar, adminTableScroll, fullWidthStyle, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsAccountsApiCreateAdminUser,
  appsAccountsApiForceLogoutUser,
  appsAccountsApiListAdminUsers,
  appsAccountsApiPatchAdminUser,
  appsAccountsApiPatchUserStatus,
  appsAccountsApiResetUserMfa,
  appsAccountsApiSetAdminUserPassword,
  appsAccountsApiUnbindUserPhone,
  appsAccountsApiUnbindUserWechat,
} from '@/services/openapi/userAdmin';
import { normalizeEmailLikeInput } from '@/utils/email';
import { IdentityText, platformQueryKeys } from '../shared';

const PlatformUsersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<API.AdminUserOut | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<API.AdminUserOut | null>(null);
  const [userForm] = Form.useForm<API.AdminUserCreateIn & API.AdminUserPatchIn>();
  const [passwordForm] = Form.useForm<API.AdminUserPasswordIn>();
  const usersQuery = useQuery({
    queryKey: platformQueryKeys.users(page),
    queryFn: () => appsAccountsApiListAdminUsers({ page, page_size: 10 }),
  });
  const saveUserMutation = useMutation({
    mutationFn: (values: API.AdminUserCreateIn & API.AdminUserPatchIn) => {
      if (editingUser) {
        const { password: _password, ...payload } = values;
        return appsAccountsApiPatchAdminUser({ user_id: editingUser.id }, payload);
      }
      return appsAccountsApiCreateAdminUser(values);
    },
    onSuccess: async () => {
      setUserModalOpen(false);
      setEditingUser(null);
      userForm.resetFields();
      await usersQuery.refetch();
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) => appsAccountsApiPatchUserStatus({ user_id: userId }, { is_active: isActive }),
    onSuccess: () => usersQuery.refetch(),
  });
  const forceLogoutMutation = useMutation({
    mutationFn: (userId: number) => appsAccountsApiForceLogoutUser({ user_id: userId }),
  });
  const resetMfaMutation = useMutation({
    mutationFn: (userId: number) => appsAccountsApiResetUserMfa({ user_id: userId }),
  });
  const passwordMutation = useMutation({
    mutationFn: ({ userId, body }: { userId: number; body: API.AdminUserPasswordIn }) => appsAccountsApiSetAdminUserPassword({ user_id: userId }, body),
    onSuccess: async () => {
      setPasswordUser(null);
      passwordForm.resetFields();
      await usersQuery.refetch();
    },
  });
  const unbindPhoneMutation = useMutation({
    mutationFn: (userId: number) => appsAccountsApiUnbindUserPhone({ user_id: userId }),
    onSuccess: () => usersQuery.refetch(),
  });
  const unbindWechatMutation = useMutation({
    mutationFn: (userId: number) => appsAccountsApiUnbindUserWechat({ user_id: userId }),
    onSuccess: () => usersQuery.refetch(),
  });

  const openCreate = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ timezone: 'Asia/Shanghai', is_active: true, is_staff: false, is_superuser: false, phone_verified: false });
    setUserModalOpen(true);
  };

  const openEdit = (record: API.AdminUserOut) => {
    setEditingUser(record);
    userForm.setFieldsValue(record);
    setUserModalOpen(true);
  };

  const columns: ColumnsType<API.AdminUserOut> = [
    { title: '用户', dataIndex: 'username', width: 220, render: (_value, record) => <IdentityText primary={record.username} secondary={record.email} /> },
    { title: '手机号', dataIndex: 'phone_national_number', width: 180, render: (_value, record) => <span style={wrapTextStyle}>{record.phone_national_number ? `${record.phone_country_code || ''} ${record.phone_national_number}` : '未绑定'}</span> },
    { title: '角色', dataIndex: 'is_staff', width: 160, render: (_value, record) => <Space wrap={false}>{record.is_staff ? <Tag color="blue">Staff</Tag> : null}{record.is_superuser ? <Tag color="gold">Superuser</Tag> : null}</Space> },
    { title: '启用', dataIndex: 'is_active', width: 100, render: (value, record) => <Switch checked={value} onChange={(checked) => void statusMutation.mutateAsync({ userId: record.id, isActive: checked })} /> },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 420,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => openEdit(record)}>编辑</a>
          <a onClick={() => void statusMutation.mutateAsync({ userId: record.id, isActive: !record.is_active })}>{record.is_active ? '禁用' : '启用'}</a>
          <a onClick={() => setPasswordUser(record)}>设密码</a>
          <Popconfirm title="确认解绑该用户手机号？" onConfirm={() => void unbindPhoneMutation.mutateAsync(record.id)}>
            <a>解绑手机</a>
          </Popconfirm>
          <Popconfirm title="确认解绑该用户微信？" onConfirm={() => void unbindWechatMutation.mutateAsync(record.id)}>
            <a>解绑微信</a>
          </Popconfirm>
          <a onClick={() => void forceLogoutMutation.mutateAsync(record.id)}>强退</a>
          <a onClick={() => void resetMfaMutation.mutateAsync(record.id)}>重置 MFA</a>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <Card title="用户管理" extra={<AdminToolbar><Button type="primary" onClick={openCreate}>新建用户</Button></AdminToolbar>}>
      <Table
        rowKey="id"
        loading={usersQuery.isLoading}
        columns={columns}
        dataSource={usersQuery.data?.items || []}
        scroll={adminTableScroll}
        pagination={{ current: usersQuery.data?.page || page, pageSize: usersQuery.data?.page_size || 10, total: usersQuery.data?.total || 0, onChange: setPage }}
      />
      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={userModalOpen}
        confirmLoading={saveUserMutation.isPending}
        onCancel={() => {
          setUserModalOpen(false);
          setEditingUser(null);
        }}
        onOk={async () => {
          const values = await userForm.validateFields();
          await saveUserMutation.mutateAsync(values);
        }}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item label="用户名" name="username" rules={[{ required: !editingUser, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="邮箱" name="email" normalize={normalizeEmailLikeInput} rules={[{ required: !editingUser, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
            <Input />
          </Form.Item>
          {!editingUser ? (
            <Form.Item label="初始密码" name="password" rules={[{ required: true, message: '请输入初始密码' }]}>
              <Input.Password />
            </Form.Item>
          ) : null}
          <Form.Item label="名字" name="first_name"><Input /></Form.Item>
          <Form.Item label="姓氏" name="last_name"><Input /></Form.Item>
          <Form.Item label="时区" name="timezone"><Input /></Form.Item>
          <Form.Item label="手机号区号" name="phone_country_code"><Input /></Form.Item>
          <Form.Item label="手机号" name="phone_national_number"><Input /></Form.Item>
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Form.Item label="手机号已验证" name="phone_verified" valuePropName="checked"><Switch /></Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="启用" name="is_active" valuePropName="checked"><Switch /></Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="Staff" name="is_staff" valuePropName="checked"><Switch /></Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="Superuser" name="is_superuser" valuePropName="checked"><Switch /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Modal
        title={passwordUser ? `设置 ${passwordUser.username} 的密码` : '设置密码'}
        open={Boolean(passwordUser)}
        confirmLoading={passwordMutation.isPending}
        onCancel={() => setPasswordUser(null)}
        onOk={async () => {
          const values = await passwordForm.validateFields();
          if (passwordUser) await passwordMutation.mutateAsync({ userId: passwordUser.id, body: values });
        }}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item label="新密码" name="password" rules={[{ required: true, message: '请输入新密码' }]}>
            <Input.Password style={fullWidthStyle} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default PlatformUsersPage;
