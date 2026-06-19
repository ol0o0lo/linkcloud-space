import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Popconfirm, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsAccessApiListPermissions } from '@/services/openapi/accessPermissions';
import {
  appsAccessApiCreateOrgRole,
  appsAccessApiDeleteOrgRole,
  appsAccessApiListOrgRoles,
  appsAccessApiPatchOrgRole,
} from '@/services/openapi/accessOrganizationRoles';
import { TenantSectionHint, TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { RoleModal, RoleSummary, accessQueryKeys, rolePermissionText, roleStatusTag } from '../shared';
import { Form } from 'antd';

const OrganizationRolesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<API.AccessRoleOut | null>(null);
  const [form] = Form.useForm<API.CustomRoleCreateIn & API.CustomRolePatchIn>();

  const permissionsQuery = useQuery({
    queryKey: accessQueryKeys.permissions,
    queryFn: () => appsAccessApiListPermissions(),
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: API.CustomRoleCreateIn & API.CustomRolePatchIn) => {
      if (editingRole) {
        return appsAccessApiPatchOrgRole({ role_id: editingRole.id }, payload);
      }
      return appsAccessApiCreateOrgRole(payload);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingRole(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: number) => appsAccessApiDeleteOrgRole({ role_id: roleId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug) });
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
    <TenantSelectionGuard title="租户角色" subtitle="配置当前租户可分配的组织级角色。">
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
        <TenantSectionHint text="系统角色只读，自定义角色支持创建、编辑权限点和删除；已有授权引用时不能删除。" />
        <Table rowKey="id" loading={rolesQuery.isLoading} columns={columns} dataSource={rolesQuery.data || []} pagination={false} scroll={adminTableScroll} />
      </Card>
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

export default OrganizationRolesPage;
