import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Space, Statistic, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo, useState } from 'react';
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

type UserInsight = API.AdminUserOut & {
  phone_label: string;
  governance_label: string;
  governance_color: string;
  governance_summary: string;
  role_label: string;
  role_color: string;
  role_summary: string;
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};

const overviewTileStyle: React.CSSProperties = {
  height: '100%',
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--ant-color-border-secondary)',
  background: 'var(--ant-color-bg-container)',
};

function buildUserInsight(user: API.AdminUserOut): UserInsight {
  const phoneLabel = user.phone_national_number ? `${user.phone_country_code || ''} ${user.phone_national_number}`.trim() : '未绑定';

  if (!user.is_active) {
    return {
      ...user,
      phone_label: phoneLabel,
      governance_label: '已停用',
      governance_color: 'default',
      governance_summary: '账号已停用，后续重点是确认是否仍需保留资料、实名记录和授权关系。',
      role_label: user.is_superuser ? '停用中的超级管理员' : user.is_staff ? '停用中的后台账号' : '停用中的普通账号',
      role_color: user.is_superuser ? 'gold' : user.is_staff ? 'blue' : 'default',
      role_summary: '这类账号通常不应继续参与运营动作，但仍要保留必要审计信息。',
    };
  }

  if (user.is_superuser) {
    return {
      ...user,
      phone_label: phoneLabel,
      governance_label: '高权限账号',
      governance_color: 'gold',
      governance_summary: '该账号拥有平台级最高权限，安全、实名和联系方式都应该保持清晰可控。',
      role_label: 'Superuser',
      role_color: 'gold',
      role_summary: '高权限账号需要重点确认权限边界、可追溯性和安全恢复能力。',
    };
  }

  if (user.is_staff) {
    return {
      ...user,
      phone_label: phoneLabel,
      governance_label: '后台执行账号',
      governance_color: 'blue',
      governance_summary: '该账号可以进入后台执行操作，更应关注实名、联系方式和强退处置能力。',
      role_label: 'Staff',
      role_color: 'blue',
      role_summary: '这类账号负责真实后台操作，需要明确职责、联系方式和回收方式。',
    };
  }

  if (!user.phone_verified || !user.phone_national_number) {
    return {
      ...user,
      phone_label: phoneLabel,
      governance_label: '联系方式待补',
      governance_color: 'red',
      governance_summary: '手机号缺失或未验证，会让找回、安全校验和业务联系链路都变得脆弱。',
      role_label: '普通账号',
      role_color: 'default',
      role_summary: '这类账号权限不高，但资料完整性仍然影响后续业务处理。',
    };
  }

  return {
    ...user,
    phone_label: phoneLabel,
    governance_label: '基础资料完整',
    governance_color: 'green',
    governance_summary: '当前资料和联系方式较完整，后续重点是账号持续可用与行为可追溯。',
    role_label: '普通账号',
    role_color: 'default',
    role_summary: '可以继续作为平台账号使用，按需补充实名与授权信息。',
  };
}

const PlatformUsersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [editingUser, setEditingUser] = useState<API.AdminUserOut | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<API.AdminUserOut | null>(null);
  const [userForm] = Form.useForm<API.AdminUserCreateIn & API.AdminUserPatchIn>();
  const [passwordForm] = Form.useForm<API.AdminUserPasswordIn>();

  const usersQuery = useQuery({
    queryKey: platformQueryKeys.users(page, keyword),
    queryFn: () => appsAccountsApiListAdminUsers({ page, page_size: 10, q: keyword || undefined }),
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

  const users = useMemo(() => (usersQuery.data?.items || []).map(buildUserInsight), [usersQuery.data?.items]);
  const activeUsers = users.filter((item) => item.is_active);
  const privilegedUsers = users.filter((item) => item.is_staff || item.is_superuser);
  const incompletePhoneUsers = users.filter((item) => !item.phone_national_number || !item.phone_verified);
  const realNamePendingUsers = users.filter((item) => item.real_name_status && !['approved', 'verified', 'passed'].includes(String(item.real_name_status).toLowerCase()));
  const inactiveUsers = users.filter((item) => !item.is_active);

  const columns: ColumnsType<UserInsight> = [
    {
      title: '用户身份',
      dataIndex: 'username',
      width: 220,
      render: (_value, record) => <IdentityText primary={record.username} secondary={record.email} />,
    },
    {
      title: '账号状态',
      dataIndex: 'governance_label',
      width: 260,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Tag color={record.governance_color}>{record.governance_label}</Tag>
          <Typography.Text type="secondary">{record.governance_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '联系方式与实名',
      dataIndex: 'phone_national_number',
      width: 240,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{record.phone_label}</Typography.Text>
          <Typography.Text type="secondary">{`实名状态 ${record.real_name_status || '未提供'}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '权限说明',
      dataIndex: 'is_staff',
      width: 240,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Tag color={record.role_color}>{record.role_label}</Tag>
          <Typography.Text type="secondary">{record.role_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 110,
      render: (value, record) => <Switch checked={value} onChange={(checked) => void statusMutation.mutateAsync({ userId: record.id, isActive: checked })} />,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 380,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => openEdit(record)}>编辑</a>
          <a onClick={() => setPasswordUser(record)}>设密码</a>
          {record.phone_national_number ? (
            <Popconfirm title="确认解绑该用户手机号？" onConfirm={() => void unbindPhoneMutation.mutateAsync(record.id)}>
              <a>解绑手机</a>
            </Popconfirm>
          ) : null}
          <Popconfirm title="确认尝试解绑该用户微信？" onConfirm={() => void unbindWechatMutation.mutateAsync(record.id)}>
            <a>解绑微信</a>
          </Popconfirm>
          <a onClick={() => void forceLogoutMutation.mutateAsync(record.id)}>强退</a>
          <a onClick={() => void resetMfaMutation.mutateAsync(record.id)}>重置 MFA</a>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <Card
      title="用户管理"
      extra={
        <AdminToolbar>
          <Input.Search
            allowClear
            placeholder="按用户名、邮箱搜索"
            style={{ width: 240 }}
            onSearch={(value) => {
              setPage(1);
              setKeyword(value.trim());
            }}
          />
          <Button type="primary" onClick={openCreate}>
            新建用户
          </Button>
        </AdminToolbar>
      }
    >
      <div style={sectionStyle}>
        <Typography.Text strong>用户概览</Typography.Text>
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="当前用户" value={users.length} />
              <Typography.Text type="secondary">当前页用户总量。</Typography.Text>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="启用账号" value={activeUsers.length} />
              <Typography.Text type="secondary">这些账号仍可能继续参与后台或平台操作。</Typography.Text>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="高权限账号" value={privilegedUsers.length} />
              <Typography.Text type="secondary">Staff 与 Superuser 是平台安全重点关注对象。</Typography.Text>
            </div>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <div style={overviewTileStyle}>
              <Statistic title="待补手机号" value={incompletePhoneUsers.length} />
              <Typography.Text type="secondary">缺手机号或未验证的账号，后续处置成本通常更高。</Typography.Text>
            </div>
          </Col>
        </Row>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <Typography.Text strong>用户详情</Typography.Text>
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12} xl={6}>
            <div style={overviewTileStyle}>
              <Space orientation="vertical" size={8}>
                <Space wrap size={[8, 8]}>
                  <Typography.Text strong>高权限账号</Typography.Text>
                  <Tag color={privilegedUsers.length ? 'gold' : 'default'}>{privilegedUsers.length ? `${privilegedUsers.length} 个重点关注` : '暂无高权限'}</Tag>
                </Space>
                <Typography.Text>高权限账号的核心不是多几个操作，而是能否清楚解释权限、联系方式和安全恢复能力。</Typography.Text>
                <a href="/dashboard/super-admin/real-name">查看实名状态</a>
              </Space>
            </div>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <div style={overviewTileStyle}>
              <Space orientation="vertical" size={8}>
                <Space wrap size={[8, 8]}>
                  <Typography.Text strong>资料待补账号</Typography.Text>
                  <Tag color={incompletePhoneUsers.length ? 'red' : 'green'}>{incompletePhoneUsers.length ? `${incompletePhoneUsers.length} 个待补手机` : '资料完整'}</Tag>
                </Space>
                <Typography.Text>这类账号现在看着还能用，但一旦需要找回、强退或做身份确认，处理会更复杂。</Typography.Text>
                <a href="/dashboard/super-admin/users">继续处理</a>
              </Space>
            </div>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <div style={overviewTileStyle}>
              <Space orientation="vertical" size={8}>
                <Space wrap size={[8, 8]}>
                  <Typography.Text strong>实名待跟进</Typography.Text>
                  <Tag color={realNamePendingUsers.length ? 'gold' : 'default'}>{realNamePendingUsers.length ? `${realNamePendingUsers.length} 个待跟进` : '暂无积压'}</Tag>
                </Space>
                <Typography.Text>用户页至少要能看见哪些账号的实名状态仍不稳定，这会影响出款、权限和申诉链路。</Typography.Text>
                <a href="/dashboard/super-admin/real-name">进入实名管理</a>
              </Space>
            </div>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <div style={overviewTileStyle}>
              <Space orientation="vertical" size={8}>
                <Space wrap size={[8, 8]}>
                  <Typography.Text strong>停用账号</Typography.Text>
                  <Tag color={inactiveUsers.length ? 'default' : 'green'}>{inactiveUsers.length ? `${inactiveUsers.length} 个待确认` : '停用较少'}</Tag>
                </Space>
                <Typography.Text>停用后仍要看会话、MFA 和绑定是否清理，否则只是把按钮关掉，不算真正回收。</Typography.Text>
                <a href="/dashboard/personal-business/notifications">查看通知</a>
              </Space>
            </div>
          </Col>
        </Row>
      </div>

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          <div>
            <Typography.Text strong>用户列表</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              用户页需要同时说明权限、实名、联系方式和停用状态。
            </Typography.Paragraph>
          </div>
          <Table
            rowKey="id"
            loading={usersQuery.isLoading}
            columns={columns}
            dataSource={users}
            scroll={adminTableScroll}
            pagination={{ current: usersQuery.data?.page || page, pageSize: usersQuery.data?.page_size || 10, total: usersQuery.data?.total || 0, onChange: setPage }}
          />
        </Space>
      </div>

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
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          <Alert
            type="info"
            showIcon
            title={editingUser ? '编辑时优先保证账号身份、联系方式与权限层级一致，避免出现“账号还在、资料已乱”的情况。' : '新建后台用户时，最好一次性确定权限、联系方式和初始密码策略。'}
          />
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
        </Space>
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
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          <Alert type="warning" showIcon title="直接设置密码属于高风险管理动作，建议只在找回或安全处置场景下使用。" />
          <Form form={passwordForm} layout="vertical">
            <Form.Item label="新密码" name="password" rules={[{ required: true, message: '请输入新密码' }]}>
              <Input.Password style={fullWidthStyle} />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Card>
  );
};

export default PlatformUsersPage;
