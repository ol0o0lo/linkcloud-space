import { SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AdminToolbar,
  adminTableScroll,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import { useTenantWorkspace } from '@/pages/space/shared';
import { appsAccessApiListPermissions } from '@/services/openapi/accessPermissions';
import { appsAccessApiListTeamBindingsView } from '@/services/openapi/accessTeamBindings';
import {
  appsAccessApiCreateTeamRole,
  appsAccessApiDeleteTeamRole,
  appsAccessApiListTeamRoles,
  appsAccessApiPatchTeamRole,
} from '@/services/openapi/accessTeamRoles';
import { SPACE_PATHS } from '@/utils/adminRouting';
import { useRoleManagementStyles } from '../roleManagement.styles';
import {
  accessQueryKeys,
  RoleModal,
  RoleSummary,
  RoleUsageDrawer,
  rolePermissionText,
  roleStatusTag,
  useRoleManagementNavigation,
} from '../shared';

function requireTeamId(teamId?: number) {
  if (!teamId) throw new Error('请先选择团队');
  return teamId;
}

export type TeamRolesPanelProps = {
  selectedTeamId?: number;
  onTeamChange: (teamId?: number) => void;
};

export const TeamRolesPanel: React.FC<TeamRolesPanelProps> = ({
  selectedTeamId,
  onTeamChange,
}) => {
  const { styles } = useRoleManagementStyles();
  const workspace = useTenantWorkspace();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<API.AccessRoleOut | null>(
    null,
  );
  const [usageRole, setUsageRole] = useState<API.AccessRoleOut | null>(null);
  const [form] = Form.useForm<API.CustomRoleCreateIn & API.CustomRolePatchIn>();
  const navigationQuery = useRoleManagementNavigation();
  const visibleTeamIds =
    navigationQuery.data?.capabilities.team_role_view_ids || [];
  const manageableTeamIds =
    navigationQuery.data?.capabilities.team_role_manage_ids || [];
  const teamItems = useMemo(
    () =>
      (navigationQuery.data?.teams || []).filter((team) =>
        visibleTeamIds.includes(team.id),
      ),
    [navigationQuery.data?.teams, visibleTeamIds],
  );
  const filteredTeamItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return teamItems;
    return teamItems.filter((team) =>
      team.name.toLocaleLowerCase().includes(keyword),
    );
  }, [search, teamItems]);
  const selectedTeam = teamItems.find((team) => team.id === selectedTeamId);
  const canView = Boolean(
    selectedTeamId && visibleTeamIds.includes(selectedTeamId),
  );
  const canManage = Boolean(
    selectedTeamId && manageableTeamIds.includes(selectedTeamId),
  );

  useEffect(() => {
    if (!navigationQuery.data || selectedTeamId || !teamItems[0]) return;
    onTeamChange(teamItems[0].id);
  }, [navigationQuery.data, onTeamChange, selectedTeamId, teamItems]);

  const permissionsQuery = useQuery({
    queryKey: accessQueryKeys.permissions,
    queryFn: () => appsAccessApiListPermissions(),
    enabled: canManage,
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.teamRoles(
      workspace.selectedOrgSlug,
      selectedTeamId,
    ),
    queryFn: () =>
      appsAccessApiListTeamRoles({ team_id: requireTeamId(selectedTeamId) }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId && canView),
  });
  const bindingsQuery = useQuery({
    queryKey: accessQueryKeys.teamBindings(
      workspace.selectedOrgSlug,
      selectedTeamId,
    ),
    queryFn: () =>
      appsAccessApiListTeamBindingsView({
        team_id: requireTeamId(selectedTeamId),
      }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId && canView),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: API.CustomRoleCreateIn & API.CustomRolePatchIn) => {
      if (editingRole) {
        return appsAccessApiPatchTeamRole(
          {
            team_id: requireTeamId(selectedTeamId),
            role_id: editingRole.id,
          },
          payload,
        );
      }
      return appsAccessApiCreateTeamRole(
        { team_id: requireTeamId(selectedTeamId) },
        payload,
      );
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingRole(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({
        queryKey: accessQueryKeys.teamRoles(
          workspace.selectedOrgSlug,
          selectedTeamId,
        ),
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (roleId: number) =>
      appsAccessApiDeleteTeamRole({
        team_id: requireTeamId(selectedTeamId),
        role_id: roleId,
      }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({
        queryKey: accessQueryKeys.teamRoles(
          workspace.selectedOrgSlug,
          selectedTeamId,
        ),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: accessQueryKeys.teamBindings(
          workspace.selectedOrgSlug,
          selectedTeamId,
        ),
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

  if (navigationQuery.isLoading) return <Card loading />;

  if (navigationQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title="团队角色权限加载失败"
        description={(navigationQuery.error as Error).message}
        action={
          <Button onClick={() => navigationQuery.refetch()}>重新加载</Button>
        }
      />
    );
  }

  if (!visibleTeamIds.length) {
    return (
      <Alert
        type="warning"
        showIcon
        title="无权访问团队角色管理"
        description="当前账号没有任何团队的角色查看权限，请联系空间管理员。"
      />
    );
  }

  return (
    <>
      <Select
        className={styles.mobileTeamSelect}
        aria-label="团队"
        showSearch={{ optionFilterProp: 'label' }}
        placeholder="选择团队"
        value={selectedTeamId}
        options={teamItems.map((team) => ({
          label: team.name,
          value: team.id,
        }))}
        onChange={onTeamChange}
      />
      <div className={styles.teamWorkspace}>
        <aside className={styles.teamNavigator} aria-label="团队角色导航">
          <Input
            allowClear
            className={styles.teamSearch}
            prefix={<SearchOutlined />}
            placeholder="搜索团队"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className={styles.teamList}>
            {filteredTeamItems.map((team) => (
              <button
                key={team.id}
                type="button"
                className={styles.teamButton}
                data-active={team.id === selectedTeamId}
                aria-label={`选择 ${team.name} 团队`}
                onClick={() => onTeamChange(team.id)}
              >
                <span className={styles.teamName}>{team.name}</span>
                <span className={styles.teamMeta}>{team.member_count} 人</span>
              </button>
            ))}
          </div>
        </aside>
        <section className={styles.roleContent}>
          {!selectedTeamId ? (
            <Card loading />
          ) : !canView ? (
            <Alert
              type="warning"
              showIcon
              title="无权查看所选团队的角色"
              description="当前账号没有该团队的角色查看权限，请返回团队列表重新选择。"
            />
          ) : (
            <>
              <div className={styles.panelHeader}>
                <div>
                  <Typography.Title level={5} className={styles.panelTitle}>
                    {selectedTeam?.name || '团队'}角色
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    当前共 {roleItems.length} 个角色，仅影响该团队内部职责。
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
              </div>
              <Space
                orientation="vertical"
                size="middle"
                style={{ width: '100%' }}
              >
                {!canManage ? (
                  <Alert
                    type="info"
                    showIcon
                    title="团队角色定义为只读"
                    description="当前账号可以查看该团队角色，但不能创建、编辑或删除角色。"
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
            </>
          )}
        </section>
      </div>
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
        teamName={selectedTeam?.name}
        onClose={() => setUsageRole(null)}
        onOpenOrganization={() =>
          history.push(
            `${SPACE_PATHS.organization}?section=members&node=team:${selectedTeamId}&tab=roles`,
          )
        }
      />
    </>
  );
};
