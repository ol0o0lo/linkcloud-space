import { useMutation, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo, useState } from 'react';
import {
  AdminToolbar,
  adminTableScroll,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import { appsAccessApiListOrganizationBindings } from '@/services/openapi/accessOrganizationBindings';
import {
  appsAccessApiCreateOrgRole,
  appsAccessApiDeleteOrgRole,
  appsAccessApiListOrgRoles,
  appsAccessApiPatchOrgRole,
} from '@/services/openapi/accessOrganizationRoles';
import { appsAccessApiListPermissions } from '@/services/openapi/accessPermissions';
import { SPACE_PATHS } from '@/utils/adminRouting';
import {
  accessQueryKeys,
  RoleModal,
  RoleSummary,
  RoleUsageDrawer,
  rolePermissionText,
  roleStatusTag,
  useRoleManagementNavigation,
} from '../shared';

export const OrganizationRolesPanel: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<API.AccessRoleOut | null>(
    null,
  );
  const [usageRole, setUsageRole] = useState<API.AccessRoleOut | null>(null);
  const [form] = Form.useForm<API.CustomRoleCreateIn & API.CustomRolePatchIn>();
  const navigationQuery = useRoleManagementNavigation();
  const canView = Boolean(navigationQuery.data?.capabilities.role_view);
  const canManage = Boolean(navigationQuery.data?.capabilities.role_manage);

  const permissionsQuery = useQuery({
    queryKey: accessQueryKeys.permissions,
    queryFn: () => appsAccessApiListPermissions(),
    enabled: canManage,
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug && canView),
  });
  const bindingsQuery = useQuery({
    queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrganizationBindings(),
    enabled: Boolean(workspace.selectedOrgSlug && canView),
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
      await workspace.queryClient.invalidateQueries({
        queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: number) =>
      appsAccessApiDeleteOrgRole({ role_id: roleId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({
        queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
      });
    },
  });

  const roleItems = rolesQuery.data || [];
  const bindingItems = bindingsQuery.data || [];
  const columns: ColumnsType<API.AccessRoleOut> = useMemo(
    () => [
      {
        title: '角色',
        dataIndex: 'name',
        width: 220,
        render: (_value, record) => <RoleSummary role={record} />,
      },
      {
        title: '类型',
        dataIndex: 'is_system',
        width: 120,
        align: 'center',
        render: (_value, record) => roleStatusTag(record),
      },
      {
        title: '权限',
        dataIndex: 'permission_keys',
        width: 160,
        render: (_value, record) => rolePermissionText(record),
      },
      {
        title: '已授权',
        dataIndex: 'role_usage',
        width: 140,
        align: 'center',
        render: (_value, record) => {
          const usageCount = bindingItems.filter(
            (item) => item.role.id === record.id,
          ).length;
          if (!usageCount) return <Tag>无</Tag>;
          return (
            <Button
              type="link"
              size="small"
              aria-label={`查看${record.name}的已授权成员`}
              onClick={() => setUsageRole(record)}
            >
              {usageCount} 人
            </Button>
          );
        },
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 120,
        align: 'center',
        render: (_value, record) =>
          record.is_system || !canManage ? null : (
            <ResponsiveActions>
              <a
                onClick={() => {
                  setEditingRole(record);
                  form.setFieldsValue({
                    name: record.name,
                    permission_keys: record.permission_keys,
                  });
                  setOpen(true);
                }}
              >
                编辑
              </a>
              <Popconfirm
                title="确认删除该角色？已有授权引用时将无法删除。"
                onConfirm={() => void deleteMutation.mutateAsync(record.id)}
              >
                <a>删除</a>
              </Popconfirm>
            </ResponsiveActions>
          ),
      },
    ],
    [bindingItems, canManage, deleteMutation, form],
  );

  if (navigationQuery.isLoading) {
    return <Card loading />;
  }

  if (navigationQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title="角色管理权限加载失败"
        description={(navigationQuery.error as Error).message}
        action={
          <Button onClick={() => navigationQuery.refetch()}>重新加载</Button>
        }
      />
    );
  }

  if (!canView) {
    return (
      <Alert
        type="warning"
        showIcon
        title="无权访问角色管理"
        description="当前账号没有查看空间角色定义的权限，请联系空间管理员。"
      />
    );
  }

  return (
    <>
      <Flex align="center" justify="space-between" gap="middle" wrap>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            空间角色
          </Typography.Title>
          <Typography.Text type="secondary">
            定义作用于当前空间的全局职责和权限范围。
          </Typography.Text>
        </div>
        {canManage ? (
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
        ) : null}
      </Flex>
      <Space
        orientation="vertical"
        size="middle"
        style={{ width: '100%', marginTop: 16 }}
      >
        {!canManage ? (
          <Alert
            type="info"
            showIcon
            title="角色定义为只读"
            description="当前账号可以查看空间角色，但不能创建、编辑或删除角色。"
          />
        ) : null}
        <Table
          rowKey="id"
          loading={rolesQuery.isLoading || bindingsQuery.isLoading}
          columns={columns}
          dataSource={roleItems}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Space>
      {canManage ? (
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
      ) : null}
      <RoleUsageDrawer
        open={Boolean(usageRole)}
        role={usageRole}
        bindings={bindingItems}
        onClose={() => setUsageRole(null)}
        onOpenOrganization={() =>
          history.push(
            `${SPACE_PATHS.organization}?section=members&node=all&tab=directory`,
          )
        }
      />
    </>
  );
};

const OrganizationRolesPage: React.FC = () => (
  <TenantSelectionGuard title="角色管理">
    <Card>
      <OrganizationRolesPanel />
    </Card>
  </TenantSelectionGuard>
);

export default OrganizationRolesPage;
