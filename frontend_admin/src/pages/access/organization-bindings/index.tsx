import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, Form, Modal, Popconfirm, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, ResponsiveActions } from '@/pages/_shared/adminLayout';
import {
  appsAccessApiCreateOrganizationBinding,
  appsAccessApiDeleteOrganizationBinding,
  appsAccessApiListOrganizationBindings,
} from '@/services/openapi/accessOrganizationBindings';
import { appsAccessApiListOrgRoles } from '@/services/openapi/accessOrganizationRoles';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import { TenantSelectionGuard, formatPersonLabel, useTenantWorkspace } from '@/pages/space/shared';
import { RoleSummary, accessQueryKeys, rolePermissionText, roleStatusTag } from '../shared';

const OrganizationBindingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<API.RoleBindingIn>();

  const bindingsQuery = useQuery({
    queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrganizationBindings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const membersQuery = useQuery({
    queryKey: ['access', 'organization-binding-members', workspace.selectedOrgSlug],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.RoleBindingIn) => appsAccessApiCreateOrganizationBinding(payload),
    onSuccess: async () => {
      setOpen(false);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (bindingId: number) => appsAccessApiDeleteOrganizationBinding({ binding_id: bindingId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug) });
    },
  });

  const bindingItems = bindingsQuery.data || [];
  const roleItems = rolesQuery.data || [];
  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.items || []).map((item) => ({
        label: `${formatPersonLabel(item.user)} (${item.user.username})`,
        value: item.user.id,
      })),
    [membersQuery.data],
  );
  const roleOptions = useMemo(
    () => (rolesQuery.data || []).filter((item) => item.is_active).map((item) => ({ label: item.name, value: item.id })),
    [rolesQuery.data],
  );
  const roleMap = new Map(roleItems.map((item) => [item.id, item]));
  const columns: ColumnsType<API.OrganizationBindingOut> = [
    {
      title: '成员',
      dataIndex: 'user',
      width: 220,
      render: (user) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{formatPersonLabel(user)}</Typography.Text>
          <Typography.Text type="secondary">{user.username}</Typography.Text>
        </Space>
      ),
    },
    { title: '角色', dataIndex: 'role', width: 220, render: (role) => <RoleSummary role={role} /> },
    {
      title: '权限范围',
      dataIndex: 'role_scope',
      width: 220,
      render: (_value, record) => {
        const role = roleMap.get(record.role.id);
        if (!role) {
          return <Typography.Text type="secondary">角色详情缺失</Typography.Text>;
        }
        return (
          <Space orientation="vertical" size={4}>
            {roleStatusTag(role)}
            <Typography.Text type="secondary">{rolePermissionText(role)}</Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '授权时间',
      dataIndex: 'created_at',
      width: 170,
      align: 'center',
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      align: 'center',
      render: (_value, record) => (
        <ResponsiveActions>
          <Popconfirm title="确认移除该授权？" onConfirm={() => void deleteMutation.mutateAsync(record.id)}>
            <a>移除</a>
          </Popconfirm>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <TenantSelectionGuard title="空间授权">
      <Card
        title="空间授权"
        extra={
          <AdminToolbar>
            <Button id="assign-role" type="primary" onClick={() => setOpen(true)}>
              分配角色
            </Button>
          </AdminToolbar>
        }
      >
        <Table
          rowKey="id"
          loading={bindingsQuery.isLoading}
          columns={columns}
          dataSource={bindingItems}
          pagination={false}
          scroll={adminTableScroll}
          locale={{
            emptyText: (
              <Empty
                description="当前空间还没有任何组织级授权记录，先分配首批全局负责人。"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>
      <Modal
        title="分配角色"
        open={open}
        confirmLoading={createMutation.isPending}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await createMutation.mutateAsync(values);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="成员" name="user" rules={[{ required: true, message: '请选择成员' }]}>
            <Select showSearch optionFilterProp="label" options={memberOptions} placeholder="选择成员" loading={membersQuery.isLoading} />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
            <Select showSearch optionFilterProp="label" options={roleOptions} placeholder="选择角色" loading={rolesQuery.isLoading} />
          </Form.Item>
        </Form>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default OrganizationBindingsPage;
