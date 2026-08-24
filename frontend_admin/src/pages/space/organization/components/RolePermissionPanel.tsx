import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Empty,
  Form,
  message,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import {
  accessQueryKeys,
  RoleModal,
  RoleSummary,
  rolePermissionText,
  roleStatusTag,
} from '@/pages/access/shared';
import { useTenantWorkspace } from '@/pages/space/shared';
import { appsAccessApiListOrganizationBindings } from '@/services/openapi/accessOrganizationBindings';
import {
  appsAccessApiCreateOrgRole,
  appsAccessApiDeleteOrgRole,
  appsAccessApiListOrgRoles,
  appsAccessApiPatchOrgRole,
} from '@/services/openapi/accessOrganizationRoles';
import { appsAccessApiListPermissions } from '@/services/openapi/accessPermissions';
import { appsAccessApiListTeamBindingsView } from '@/services/openapi/accessTeamBindings';
import {
  appsAccessApiCreateTeamRole,
  appsAccessApiDeleteTeamRole,
  appsAccessApiListTeamRoles,
  appsAccessApiPatchTeamRole,
} from '@/services/openapi/accessTeamRoles';

type RoleFormPayload = API.CustomRoleCreateIn & API.CustomRolePatchIn;

export const RolePermissionPanel: React.FC<{
  action?: 'new-role';
  canManage: boolean;
  canView: boolean;
  scope: 'organization' | 'team';
  teamId?: number;
  teamName?: string;
  onActionHandled: () => void;
}> = ({
  action,
  canManage,
  canView,
  onActionHandled,
  scope,
  teamId,
  teamName,
}) => {
  const workspace = useTenantWorkspace();
  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<API.AccessRoleOut | null>(
    null,
  );
  const [copyFromRole, setCopyFromRole] = useState<API.AccessRoleOut | null>(
    null,
  );
  const [form] = Form.useForm<RoleFormPayload>();
  const isTeam = scope === 'team';
  const canLoad = Boolean(
    workspace.selectedOrgSlug && (!isTeam || teamId) && canView,
  );

  const permissionsQuery = useQuery({
    queryKey: accessQueryKeys.permissions,
    queryFn: () => appsAccessApiListPermissions(),
    enabled: canLoad && canManage,
  });
  const rolesQuery = useQuery({
    queryKey: isTeam
      ? accessQueryKeys.teamRoles(workspace.selectedOrgSlug, teamId)
      : accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
    queryFn: () =>
      isTeam
        ? appsAccessApiListTeamRoles({ team_id: teamId ?? 0 })
        : appsAccessApiListOrgRoles(),
    enabled: canLoad,
  });
  const bindingsQuery = useQuery<
    Array<API.OrganizationBindingOut | API.TeamBindingOut>
  >({
    queryKey: isTeam
      ? accessQueryKeys.teamBindings(workspace.selectedOrgSlug, teamId)
      : accessQueryKeys.orgBindings(workspace.selectedOrgSlug),
    queryFn: async () =>
      (isTeam
        ? appsAccessApiListTeamBindingsView({ team_id: teamId ?? 0 })
        : appsAccessApiListOrganizationBindings()) as Promise<
        Array<API.OrganizationBindingOut | API.TeamBindingOut>
      >,
    enabled: canLoad,
  });

  const openCreate = () => {
    setEditingRole(null);
    setCopyFromRole(null);
    form.resetFields();
    setOpen(true);
  };
  useEffect(() => {
    if (action !== 'new-role') return;
    if (canManage) openCreate();
    else onActionHandled();
  }, [action, canManage]);

  const saveMutation = useMutation({
    mutationFn: (payload: RoleFormPayload) => {
      if (editingRole) {
        if (isTeam && !teamId) throw new Error('请选择团队');
        const targetTeamId = teamId ?? 0;
        return isTeam
          ? appsAccessApiPatchTeamRole(
              { team_id: targetTeamId, role_id: editingRole.id },
              payload,
            )
          : appsAccessApiPatchOrgRole({ role_id: editingRole.id }, payload);
      }
      const createPayload: API.CustomRoleCreateIn = copyFromRole
        ? {
            name: payload.name || `${copyFromRole.name} 副本`,
            copy_from: copyFromRole.id,
          }
        : {
            name: payload.name || '',
            permission_keys: payload.permission_keys || [],
          };
      if (isTeam && !teamId) throw new Error('请选择团队');
      const targetTeamId = teamId ?? 0;
      return isTeam
        ? appsAccessApiCreateTeamRole({ team_id: targetTeamId }, createPayload)
        : appsAccessApiCreateOrgRole(createPayload);
    },
    onSuccess: async () => {
      message.success(editingRole ? '角色已更新' : '角色已创建');
      setOpen(false);
      setEditingRole(null);
      setCopyFromRole(null);
      form.resetFields();
      onActionHandled();
      await workspace.queryClient.invalidateQueries({
        queryKey: isTeam
          ? accessQueryKeys.teamRoles(workspace.selectedOrgSlug, teamId)
          : accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (roleId: number) => {
      if (isTeam && !teamId) throw new Error('请选择团队');
      const targetTeamId = teamId ?? 0;
      return isTeam
        ? appsAccessApiDeleteTeamRole({
            team_id: targetTeamId,
            role_id: roleId,
          })
        : appsAccessApiDeleteOrgRole({ role_id: roleId });
    },
    onSuccess: async () => {
      message.success('角色已删除');
      await workspace.queryClient.invalidateQueries({
        queryKey: isTeam
          ? accessQueryKeys.teamRoles(workspace.selectedOrgSlug, teamId)
          : accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
      });
    },
  });

  const columns: ProColumns<API.AccessRoleOut>[] = useMemo(
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
        title: '授权数量',
        dataIndex: 'bindings',
        width: 120,
        align: 'right',
        render: (_value, record) =>
          `${(bindingsQuery.data || []).filter((binding) => binding.role.id === record.id).length} 条`,
      },
      ...(canManage
        ? [
            {
              title: '操作',
              dataIndex: 'actions',
              width: 220,
              align: 'center' as const,
              render: (_value: unknown, record: API.AccessRoleOut) => (
                <Space>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      setEditingRole(null);
                      setCopyFromRole(record);
                      form.setFieldsValue({ name: `${record.name} 副本` });
                      setOpen(true);
                    }}
                  >
                    复制
                  </Button>
                  {!record.is_system ? (
                    <>
                      <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          setCopyFromRole(null);
                          setEditingRole(record);
                          form.setFieldsValue({
                            name: record.name,
                            permission_keys: record.permission_keys,
                          });
                          setOpen(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Popconfirm
                        title="删除该角色？"
                        description="已有授权引用时无法删除。"
                        okText="确认删除"
                        onConfirm={() => deleteMutation.mutateAsync(record.id)}
                      >
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </>
                  ) : null}
                </Space>
              ),
            },
          ]
        : []),
    ],
    [bindingsQuery.data, canManage, deleteMutation, form],
  );

  if (isTeam && !teamId) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="请选择一个团队后管理团队级角色"
      />
    );
  }
  if (!canView) {
    return (
      <Alert
        type="info"
        showIcon
        title="无法查看角色权限"
        description={
          isTeam
            ? '当前角色缺少该团队的角色查看权限。'
            : '当前角色缺少组织角色查看权限。'
        }
      />
    );
  }
  if (rolesQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title="角色列表加载失败"
        description={(rolesQuery.error as Error).message}
        action={<Button onClick={() => rolesQuery.refetch()}>重试</Button>}
      />
    );
  }
  if (bindingsQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title="角色授权加载失败"
        description={(bindingsQuery.error as Error).message}
        action={<Button onClick={() => bindingsQuery.refetch()}>重试</Button>}
      />
    );
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Space wrap>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {isTeam ? `${teamName || '当前团队'} · 团队级角色` : '组织级角色'}
            </Typography.Title>
            <Tag>{isTeam ? '仅在当前团队生效' : '在整个组织生效'}</Tag>
          </Space>
          <div>
            <Typography.Text type="secondary">
              角色权限定义“这个角色能做什么”；具体分配请在员工的权限管理中完成。
            </Typography.Text>
          </div>
        </div>
        {canManage ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建角色
          </Button>
        ) : null}
      </div>
      {!canManage ? (
        <Alert
          type="info"
          showIcon
          title="角色定义为只读"
          description="当前角色没有角色管理权限，可以查看角色及授权数量，但不能创建、复制、编辑或删除。"
        />
      ) : null}
      <ProTable<API.AccessRoleOut>
        rowKey="id"
        columns={columns}
        dataSource={rolesQuery.data || []}
        loading={rolesQuery.isLoading}
        search={false}
        options={false}
        toolBarRender={false}
        pagination={false}
        scroll={adminTableScroll}
      />
      {canManage ? (
        <RoleModal
          open={open}
          title={
            editingRole ? '编辑角色' : copyFromRole ? '复制角色' : '新建角色'
          }
          okText="保存角色"
          loading={saveMutation.isPending}
          permissions={permissionsQuery.data}
          form={form}
          onCancel={() => {
            setOpen(false);
            setEditingRole(null);
            setCopyFromRole(null);
            form.resetFields();
            onActionHandled();
          }}
          onOk={async () =>
            saveMutation.mutateAsync(await form.validateFields())
          }
        />
      ) : null}
    </Space>
  );
};
