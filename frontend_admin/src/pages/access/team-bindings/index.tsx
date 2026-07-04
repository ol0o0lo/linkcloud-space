import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, Form, Modal, Popconfirm, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, ResponsiveActions } from '@/pages/_shared/adminLayout';
import { appsAccessApiListTeamRoles } from '@/services/openapi/accessTeamRoles';
import {
  appsAccessApiCreateTeamBinding,
  appsAccessApiDeleteTeamBinding,
  appsAccessApiListTeamBindingsView,
} from '@/services/openapi/accessTeamBindings';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import { TenantSelectionGuard, formatPersonLabel, useTenantWorkspace } from '@/pages/tenant/shared';
import { EmptyTeamHint, RoleSummary, TeamContextCard, accessQueryKeys, rolePermissionText, roleStatusTag } from '../shared';

const TeamBindingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<API.RoleBindingIn>();

  const bindingsQuery = useQuery({
    queryKey: accessQueryKeys.teamBindings(workspace.selectedOrgSlug, selectedTeamId),
    queryFn: () => appsAccessApiListTeamBindingsView({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.teamRoles(workspace.selectedOrgSlug, selectedTeamId),
    queryFn: () => appsAccessApiListTeamRoles({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });
  const membersQuery = useQuery({
    queryKey: ['access', 'team-binding-members', workspace.selectedOrgSlug, selectedTeamId],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.RoleBindingIn) => appsAccessApiCreateTeamBinding({ team_id: selectedTeamId! }, payload),
    onSuccess: async () => {
      setOpen(false);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.teamBindings(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (bindingId: number) => appsAccessApiDeleteTeamBinding({ team_id: selectedTeamId!, binding_id: bindingId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.teamBindings(workspace.selectedOrgSlug, selectedTeamId) });
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
  const bindingItems = bindingsQuery.data || [];
  const roleMap = new Map((rolesQuery.data || []).map((item) => [item.id, item]));
  const columns: ColumnsType<API.TeamBindingOut> = [
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
    <TenantSelectionGuard title="团队授权">
      <TeamContextCard selectedTeamId={selectedTeamId} onChange={setSelectedTeamId} />
      {selectedTeamId ? (
        <Card
          title="团队授权"
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
              emptyText: <Empty description="暂无授权记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        </Card>
      ) : (
        <EmptyTeamHint />
      )}
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

export default TeamBindingsPage;
