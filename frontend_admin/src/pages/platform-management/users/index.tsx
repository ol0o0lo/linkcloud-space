import { EllipsisOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useMutation } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Switch,
  Tag,
  Typography,
  type MenuProps,
} from 'antd';
import React, { useRef, useState } from 'react';
import {
  adminTableScroll,
  fullWidthStyle,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
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
import { IdentityText } from '../shared';

type UserInsight = API.AdminUserOut & {
  phone_label: string;
  role_label: string;
  role_color: string;
};

type UserSearchParams = {
  current?: number;
  pageSize?: number;
  keyword?: string;
  username?: string;
  phone?: string;
  real_name_status?: string;
  role?: string;
};

const trimParam = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const realNameStatusOptions = [
  { label: '未实名', value: 'unverified' },
  { label: '待校验', value: 'pending' },
  { label: '已实名', value: 'verified' },
  { label: '已驳回', value: 'rejected' },
  { label: '人工复核', value: 'manual_review' },
  { label: '已撤销', value: 'revoked' },
];

const roleOptions = [
  { label: '超级管理员', value: 'superuser' },
  { label: '后台账号', value: 'staff' },
  { label: '普通账号', value: 'user' },
];

function buildUserInsight(user: API.AdminUserOut): UserInsight {
  const phoneLabel = user.phone_national_number
    ? `${user.phone_country_code || ''} ${user.phone_national_number}`.trim()
    : '未绑定';

  if (!user.is_active) {
    return {
      ...user,
      phone_label: phoneLabel,
      role_label: user.is_superuser
        ? '停用中的超级管理员'
        : user.is_staff
          ? '停用中的后台账号'
          : '停用中的普通账号',
      role_color: user.is_superuser
        ? 'gold'
        : user.is_staff
          ? 'blue'
          : 'default',
    };
  }

  if (user.is_superuser) {
    return {
      ...user,
      phone_label: phoneLabel,
      role_label: 'Superuser',
      role_color: 'gold',
    };
  }

  if (user.is_staff) {
    return {
      ...user,
      phone_label: phoneLabel,
      role_label: 'Staff',
      role_color: 'blue',
    };
  }

  if (!user.phone_verified || !user.phone_national_number) {
    return {
      ...user,
      phone_label: phoneLabel,
      role_label: '普通账号',
      role_color: 'default',
    };
  }

  return {
    ...user,
    phone_label: phoneLabel,
    role_label: '普通账号',
    role_color: 'default',
  };
}

const PlatformUsersPage: React.FC = () => {
  const [editingUser, setEditingUser] = useState<API.AdminUserOut | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<API.AdminUserOut | null>(
    null,
  );
  const tableActionRef = useRef<ActionType>(null);
  const [userForm] = Form.useForm<
    API.AdminUserCreateIn & API.AdminUserPatchIn
  >();
  const [passwordForm] = Form.useForm<API.AdminUserPasswordIn>();
  const [modal, modalContextHolder] = Modal.useModal();

  const saveUserMutation = useMutation({
    mutationFn: (values: API.AdminUserCreateIn & API.AdminUserPatchIn) => {
      if (editingUser) {
        const { password: _password, ...payload } = values;
        return appsAccountsApiPatchAdminUser(
          { user_id: editingUser.id },
          payload,
        );
      }
      return appsAccountsApiCreateAdminUser(values);
    },
    onSuccess: async () => {
      setUserModalOpen(false);
      setEditingUser(null);
      userForm.resetFields();
      tableActionRef.current?.reload();
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      appsAccountsApiPatchUserStatus(
        { user_id: userId },
        { is_active: isActive },
      ),
    onSuccess: () => tableActionRef.current?.reload(),
  });
  const forceLogoutMutation = useMutation({
    mutationFn: (userId: number) =>
      appsAccountsApiForceLogoutUser({ user_id: userId }),
  });
  const resetMfaMutation = useMutation({
    mutationFn: (userId: number) =>
      appsAccountsApiResetUserMfa({ user_id: userId }),
  });
  const passwordMutation = useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: number;
      body: API.AdminUserPasswordIn;
    }) => appsAccountsApiSetAdminUserPassword({ user_id: userId }, body),
    onSuccess: async () => {
      setPasswordUser(null);
      passwordForm.resetFields();
      tableActionRef.current?.reload();
    },
  });
  const unbindPhoneMutation = useMutation({
    mutationFn: (userId: number) =>
      appsAccountsApiUnbindUserPhone({ user_id: userId }),
    onSuccess: () => tableActionRef.current?.reload(),
  });
  const unbindWechatMutation = useMutation({
    mutationFn: (userId: number) =>
      appsAccountsApiUnbindUserWechat({ user_id: userId }),
    onSuccess: () => tableActionRef.current?.reload(),
  });

  const openCreate = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({
      timezone: 'Asia/Shanghai',
      is_active: true,
      is_staff: false,
      is_superuser: false,
      phone_verified: false,
    });
    setUserModalOpen(true);
  };

  const openEdit = (record: API.AdminUserOut) => {
    setEditingUser(record);
    userForm.setFieldsValue(record);
    setUserModalOpen(true);
  };

  const handleUserAction = (record: UserInsight, key: string) => {
    if (key === 'unbind_phone') {
      modal.confirm({
        title: '确认解绑该用户手机号？',
        onOk: async () => unbindPhoneMutation.mutateAsync(record.id),
      });
      return;
    }
    if (key === 'unbind_wechat') {
      modal.confirm({
        title: '确认尝试解绑该用户微信？',
        onOk: async () => unbindWechatMutation.mutateAsync(record.id),
      });
      return;
    }
    if (key === 'force_logout') {
      void forceLogoutMutation.mutateAsync(record.id);
      return;
    }
    if (key === 'reset_mfa') {
      void resetMfaMutation.mutateAsync(record.id);
    }
  };

  const buildUserActionItems = (
    record: UserInsight,
  ): NonNullable<MenuProps['items']> => {
    const items: NonNullable<MenuProps['items']> = [];
    if (record.phone_national_number) {
      items.push({ key: 'unbind_phone', label: '解绑手机' });
    }
    items.push({ key: 'unbind_wechat', label: '解绑微信' });
    items.push({ key: 'force_logout', label: '强退' });
    items.push({ key: 'reset_mfa', label: '重置 MFA' });
    return items;
  };

  const columns: ProColumns<UserInsight>[] = [
    {
      title: '用户名',
      dataIndex: 'username',
      hideInTable: true,
      fieldProps: { placeholder: '按用户名搜索' },
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      hideInTable: true,
      fieldProps: { placeholder: '按手机号搜索' },
    },
    {
      title: '实名状态',
      dataIndex: 'real_name_status',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        allowClear: true,
        options: realNameStatusOptions,
      },
    },
    {
      title: '权限',
      dataIndex: 'role',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        allowClear: true,
        options: roleOptions,
      },
    },
    {
      title: '用户身份',
      dataIndex: 'username',
      width: 220,
      search: false,
      render: (_value, record) => (
        <IdentityText primary={record.username} secondary={record.email} />
      ),
    },
    {
      title: '联系方式与实名',
      dataIndex: 'phone_national_number',
      width: 240,
      search: false,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{record.phone_label}</Typography.Text>
          <Typography.Text type="secondary">{`实名状态 ${record.real_name_status || '未提供'}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '权限',
      dataIndex: 'is_staff',
      width: 140,
      search: false,
      render: (_value, record) => (
        <Tag color={record.role_color}>{record.role_label}</Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 110,
      search: false,
      render: (_value, record) => (
        <Switch
          checked={record.is_active}
          onChange={(checked) =>
            void statusMutation.mutateAsync({
              userId: record.id,
              isActive: checked,
            })
          }
        />
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 180,
      valueType: 'option',
      search: false,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => openEdit(record)}>编辑</a>
          <a onClick={() => setPasswordUser(record)}>设密码</a>
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: buildUserActionItems(record),
              onClick: ({ key, domEvent }) => {
                domEvent.preventDefault();
                handleUserAction(record, String(key));
              },
            }}
          >
            <Button
              type="link"
              size="small"
              aria-label="更多操作"
              icon={<EllipsisOutlined />}
            />
          </Dropdown>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <PageContainer
      title="用户管理"
      subTitle="管理平台用户、联系方式、实名和权限。"
    >
      <Card>
        <ProTable<UserInsight>
          actionRef={tableActionRef}
          rowKey="id"
          headerTitle="用户列表"
          columns={columns}
          request={async (params: UserSearchParams) => {
            const result = await appsAccountsApiListAdminUsers({
              page: params.current || 1,
              page_size: params.pageSize || 10,
              keyword: trimParam(params.keyword),
              username: trimParam(params.username),
              phone: trimParam(params.phone),
              real_name_status: trimParam(params.real_name_status),
              role: trimParam(params.role),
            });
            return {
              data: (result.items || []).map(buildUserInsight),
              total: result.total || 0,
              success: true,
            };
          }}
          search={{ labelWidth: 'auto' }}
          options={{
            density: true,
            reload: false,
            search: { name: 'keyword', placeholder: '按用户名、邮箱搜索' },
            setting: true,
          }}
          toolBarRender={() => [
            <Button key="create" type="primary" onClick={openCreate}>
              新建用户
            </Button>,
          ]}
          ghost
          scroll={adminTableScroll}
          pagination={{ defaultPageSize: 10 }}
        />

        {modalContextHolder}
      </Card>

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
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: !editingUser, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            normalize={normalizeEmailLikeInput}
            rules={[
              { required: !editingUser, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input />
          </Form.Item>
          {!editingUser ? (
            <Form.Item
              label="初始密码"
              name="password"
              rules={[{ required: true, message: '请输入初始密码' }]}
            >
              <Input.Password />
            </Form.Item>
          ) : null}
          <Form.Item label="名字" name="first_name">
            <Input />
          </Form.Item>
          <Form.Item label="姓氏" name="last_name">
            <Input />
          </Form.Item>
          <Form.Item label="时区" name="timezone">
            <Input />
          </Form.Item>
          <Form.Item label="手机号区号" name="phone_country_code">
            <Input />
          </Form.Item>
          <Form.Item label="手机号" name="phone_national_number">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Form.Item
                label="手机号已验证"
                name="phone_verified"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="启用" name="is_active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="Staff" name="is_staff" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item
                label="Superuser"
                name="is_superuser"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={
          passwordUser ? `设置 ${passwordUser.username} 的密码` : '设置密码'
        }
        open={Boolean(passwordUser)}
        confirmLoading={passwordMutation.isPending}
        onCancel={() => setPasswordUser(null)}
        onOk={async () => {
          const values = await passwordForm.validateFields();
          if (passwordUser)
            await passwordMutation.mutateAsync({
              userId: passwordUser.id,
              body: values,
            });
        }}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            label="新密码"
            name="password"
            rules={[{ required: true, message: '请输入新密码' }]}
          >
            <Input.Password style={fullWidthStyle} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default PlatformUsersPage;
