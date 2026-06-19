import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Form, Modal, Popconfirm, Select, Table } from 'antd';
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
import { TenantSectionHint, TenantSelectionGuard, formatPersonLabel, useTenantWorkspace } from '@/pages/tenant/shared';
import { RoleSummary, accessQueryKeys } from '../shared';

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
    enabled: open && Boolean(workspace.selectedOrgSlug),
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

  const columns: ColumnsType<API.OrganizationBindingOut> = [
    { title: '成员', dataIndex: 'user', width: 180, render: (user) => formatPersonLabel(user) },
    { title: '角色', dataIndex: 'role', width: 220, render: (role) => <RoleSummary role={role} /> },
    { title: '授权时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
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
    <TenantSelectionGuard title="租户授权" subtitle="为当前租户成员分配组织级角色。">
      <Card
        title="授权列表"
        extra={
          <AdminToolbar>
            <Button type="primary" onClick={() => setOpen(true)}>
              分配角色
            </Button>
          </AdminToolbar>
        }
      >
        <TenantSectionHint text="租户级授权对当前租户全局生效，适合 owner、管理员、运营等组织级职责。" />
        <Table rowKey="id" loading={bindingsQuery.isLoading} columns={columns} dataSource={bindingsQuery.data || []} pagination={false} scroll={adminTableScroll} />
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
            <Select showSearch optionFilterProp="label" options={memberOptions} placeholder="选择成员" />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
            <Select showSearch optionFilterProp="label" options={roleOptions} placeholder="选择角色" />
          </Form.Item>
        </Form>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default OrganizationBindingsPage;
