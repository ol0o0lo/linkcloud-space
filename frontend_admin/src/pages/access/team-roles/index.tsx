import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Form, Popconfirm, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsAccessApiListPermissions } from '@/services/openapi/accessPermissions';
import {
  appsAccessApiCreateTeamRole,
  appsAccessApiDeleteTeamRole,
  appsAccessApiListTeamRoles,
  appsAccessApiPatchTeamRole,
} from '@/services/openapi/accessTeamRoles';
import { TenantSectionHint, TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { EmptyTeamHint, RoleModal, RoleSummary, TeamContextCard, accessQueryKeys, rolePermissionText, roleStatusTag } from '../shared';

const TeamRolesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<API.AccessRoleOut | null>(null);
  const [form] = Form.useForm<API.CustomRoleCreateIn & API.CustomRolePatchIn>();

  const permissionsQuery = useQuery({
    queryKey: accessQueryKeys.permissions,
    queryFn: () => appsAccessApiListPermissions(),
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.teamRoles(workspace.selectedOrgSlug, selectedTeamId),
    queryFn: () => appsAccessApiListTeamRoles({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: API.CustomRoleCreateIn & API.CustomRolePatchIn) => {
      if (editingRole) {
        return appsAccessApiPatchTeamRole({ team_id: selectedTeamId!, role_id: editingRole.id }, payload);
      }
      return appsAccessApiCreateTeamRole({ team_id: selectedTeamId! }, payload);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingRole(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.teamRoles(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (roleId: number) => appsAccessApiDeleteTeamRole({ team_id: selectedTeamId!, role_id: roleId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.teamRoles(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });

  const columns: ColumnsType<API.AccessRoleOut> = useMemo(
    () => [
      { title: '角色', dataIndex: 'name', width: 220, render: (_value, record) => <RoleSummary role={record} /> },
      { title: '状态', dataIndex: 'is_active', width: 100, render: (_value, record) => roleStatusTag(record) },
      { title: '权限', dataIndex: 'permission_keys', width: 420, render: (_value, record) => <span style={wrapTextStyle}>{rolePermissionText(record)}</span> },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 120,
        render: (_value, record) =>
          record.is_system ? null : (
            <ResponsiveActions>
              <a
                onClick={() => {
                  setEditingRole(record);
                  form.setFieldsValue({ name: record.name, permission_keys: record.permission_keys });
                  setOpen(true);
                }}
              >
                编辑
              </a>
              <Popconfirm title="确认删除该角色？已有授权引用时将无法删除。" onConfirm={() => void deleteMutation.mutateAsync(record.id)}>
                <a>删除</a>
              </Popconfirm>
            </ResponsiveActions>
          ),
      },
    ],
    [deleteMutation, form],
  );

  return (
    <TenantSelectionGuard title="团队角色" subtitle="配置指定团队可分配的团队级角色。">
      <TeamContextCard selectedTeamId={selectedTeamId} onChange={setSelectedTeamId} />
      {selectedTeamId ? (
        <Card
          title="角色列表"
          extra={
            <AdminToolbar>
              <Button
                type="primary"
                onClick={() => {
                  setEditingRole(null);
                  form.resetFields();
                  setOpen(true);
                }}
              >
                新建角色
              </Button>
            </AdminToolbar>
          }
        >
          <TenantSectionHint text="团队级角色只在所选团队内生效，适合项目管理员、团队运营等局部职责。" />
          <Table rowKey="id" loading={rolesQuery.isLoading} columns={columns} dataSource={rolesQuery.data || []} pagination={false} scroll={adminTableScroll} />
        </Card>
      ) : (
        <EmptyTeamHint />
      )}
      <RoleModal
        open={open}
        title={editingRole ? '编辑角色' : '新建角色'}
        loading={saveMutation.isPending}
        permissions={permissionsQuery.data}
        form={form}
        onCancel={() => {
          setOpen(false);
          setEditingRole(null);
        }}
        onOk={async () => {
          const values = await form.validateFields();
          await saveMutation.mutateAsync(values);
        }}
      />
    </TenantSelectionGuard>
  );
};

export default TeamRolesPage;
