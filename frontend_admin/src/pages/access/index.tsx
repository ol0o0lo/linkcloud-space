import {
  DeleteOutlined,
  EditOutlined,
  MenuOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { history, useLocation } from '@umijs/max';
import type { MenuProps, TableColumnsType, TreeDataNode } from 'antd';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Flex,
  Form,
  Grid,
  Input,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Tree,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  adminTableScroll,
  drawerWidthLg,
  fixedPagePagination,
} from '@/pages/_shared/adminLayout';
import {
  formatPersonLabel,
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/space/shared';
import {
  createRole,
  deleteRole,
  getRoleManagementNavigation,
  listRoleMembers,
  listRolePermissions,
  listRoles,
  type PermissionOption,
  patchRoleMembers,
  type RoleInput,
  type RoleMemberOption,
  type RoleRecord,
  type RoleScope,
  updateRole,
} from '@/services/manual/roleManagement';
import { buildRoleManagementPath } from '@/utils/adminRouting';
import { useRoleManagementStyles } from './roleManagement.styles';

type DrawerMode = 'view' | 'edit' | 'create' | 'members' | null;
type RoleTypeFilter = 'all' | 'system' | 'custom';
type AssignmentFilter = 'all' | 'assigned' | 'unassigned';
type MemberChange = { original: boolean; next: boolean };

function readRequestedScope(search: string) {
  const params = new URLSearchParams(search);
  const scope = params.get('scope');
  const teamValue = params.get('team');
  if (scope === 'team') {
    const teamId = teamValue && /^\d+$/.test(teamValue) ? Number(teamValue) : 0;
    return { requested: true, kind: 'team' as const, teamId };
  }
  if (scope === 'space') return { requested: true, kind: 'space' as const };
  return { requested: false, kind: 'space' as const };
}

function scopeKey(scope?: RoleScope) {
  if (!scope) return 'invalid';
  return scope.kind === 'space' ? 'space' : `team:${scope.teamId}`;
}

function roleTypeTag(role: RoleRecord) {
  return role.is_system ? (
    <Tag color="blue">系统角色</Tag>
  ) : (
    <Tag color="green">自定义角色</Tag>
  );
}

function permissionGroups(
  permissions: PermissionOption[],
  selectedKeys: string[],
) {
  const selected = new Set(selectedKeys);
  const groups = new Map<string, { name: string; items: PermissionOption[] }>();
  permissions.forEach((permission) => {
    if (!selected.has(permission.key)) return;
    const group = groups.get(permission.module_key) || {
      name: permission.module_name,
      items: [],
    };
    group.items.push(permission);
    groups.set(permission.module_key, group);
  });
  return [...groups.entries()].map(([key, value]) => ({ key, ...value }));
}

const RoleManagementPage: React.FC = () => {
  const { styles } = useRoleManagementStyles();
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.md;
  const location = useLocation();
  const workspace = useTenantWorkspace();
  const requestedScope = useMemo(
    () => readRequestedScope(location.search),
    [location.search],
  );
  const [scopeSearch, setScopeSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [roleType, setRoleType] = useState<RoleTypeFilter>('all');
  const [moduleFilter, setModuleFilter] = useState<string>();
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [scopeDrawerOpen, setScopeDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [selectedRole, setSelectedRole] = useState<RoleRecord | null>(null);
  const [copySourceId, setCopySourceId] = useState<number>();
  const [memberKeyword, setMemberKeyword] = useState('');
  const [memberFilter, setMemberFilter] = useState<AssignmentFilter>('all');
  const [memberPage, setMemberPage] = useState(1);
  const [memberChanges, setMemberChanges] = useState<
    Record<number, MemberChange>
  >({});
  const [roleForm] = Form.useForm<RoleInput>();

  const navigationQuery = useQuery({
    queryKey: [
      'access',
      'role-management',
      'navigation',
      workspace.selectedOrgSlug,
    ],
    queryFn: getRoleManagementNavigation,
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const navigation = navigationQuery.data;
  const defaultTeam = navigation?.teams[0];
  const requestedTeam =
    requestedScope.kind === 'team'
      ? navigation?.teams.find((team) => team.id === requestedScope.teamId)
      : undefined;
  const currentScope: RoleScope | undefined = requestedScope.requested
    ? requestedScope.kind === 'space'
      ? { kind: 'space' }
      : requestedTeam
        ? {
            kind: 'team',
            teamId: requestedTeam.id,
            teamName: requestedTeam.name,
          }
        : undefined
    : navigation?.capabilities.role_view
      ? { kind: 'space' }
      : defaultTeam
        ? {
            kind: 'team',
            teamId: defaultTeam.id,
            teamName: defaultTeam.name,
          }
        : undefined;
  const canView = Boolean(
    currentScope?.kind === 'space'
      ? navigation?.capabilities.role_view
      : currentScope &&
          navigation?.capabilities.team_role_view_ids.includes(
            currentScope.teamId,
          ),
  );
  const canManage = Boolean(
    currentScope?.kind === 'space'
      ? navigation?.capabilities.role_manage
      : currentScope &&
          navigation?.capabilities.team_role_manage_ids.includes(
            currentScope.teamId,
          ),
  );

  useEffect(() => {
    if (!navigation || requestedScope.requested || !currentScope) return;
    history.replace(
      currentScope.kind === 'space'
        ? buildRoleManagementPath('space')
        : buildRoleManagementPath('team', currentScope.teamId),
    );
  }, [currentScope, navigation, requestedScope.requested]);

  const rolesQuery = useQuery({
    queryKey: [
      'access',
      'role-management',
      'roles',
      workspace.selectedOrgSlug,
      scopeKey(currentScope),
    ],
    queryFn: () => listRoles(currentScope as RoleScope),
    enabled: Boolean(workspace.selectedOrgSlug && currentScope && canView),
  });
  const permissionsQuery = useQuery({
    queryKey: ['access', 'role-management', 'permissions'],
    queryFn: listRolePermissions,
    enabled: Boolean(currentScope && canView),
  });

  useEffect(() => {
    if (!selectedRole || !rolesQuery.data) return;
    const freshRole = rolesQuery.data.find(
      (role) => role.id === selectedRole.id,
    );
    if (freshRole) setSelectedRole(freshRole);
  }, [rolesQuery.data, selectedRole?.id]);

  const roleItems = rolesQuery.data || [];
  const moduleOptions = useMemo(() => {
    const modules = new Map<string, string>();
    (permissionsQuery.data || []).forEach((permission) => {
      modules.set(permission.module_key, permission.module_name);
    });
    roleItems.forEach((role) => {
      role.permission_modules.forEach((module) => {
        modules.set(module.key, module.name);
      });
    });
    return [...modules.entries()].map(([value, label]) => ({ value, label }));
  }, [permissionsQuery.data, roleItems]);
  const filteredRoles = useMemo(() => {
    const keyword = roleSearch.trim().toLocaleLowerCase();
    return roleItems.filter((role) => {
      if (
        keyword &&
        !`${role.name} ${role.description}`
          .toLocaleLowerCase()
          .includes(keyword)
      )
        return false;
      if (roleType === 'system' && !role.is_system) return false;
      if (roleType === 'custom' && role.is_system) return false;
      if (
        moduleFilter &&
        !role.permission_modules.some((module) => module.key === moduleFilter)
      )
        return false;
      if (assignedOnly && role.assigned_member_count === 0) return false;
      return true;
    });
  }, [assignedOnly, moduleFilter, roleItems, roleSearch, roleType]);

  const currentTeamSummary =
    currentScope?.kind === 'team'
      ? navigation?.teams.find((team) => team.id === currentScope.teamId)
      : undefined;
  const summary = {
    total: roleItems.length,
    system: roleItems.filter((role) => role.is_system).length,
    custom: roleItems.filter((role) => !role.is_system).length,
    assigned:
      currentScope?.kind === 'space'
        ? navigation?.space_assigned_member_count || 0
        : currentTeamSummary?.assigned_member_count || 0,
  };

  const memberQuery = useQuery({
    queryKey: [
      'access',
      'role-management',
      'members',
      workspace.selectedOrgSlug,
      scopeKey(currentScope),
      selectedRole?.id,
      drawerMode,
      memberPage,
      memberKeyword,
      memberFilter,
    ],
    queryFn: () =>
      listRoleMembers(currentScope as RoleScope, selectedRole?.id || 0, {
        page: drawerMode === 'view' ? 1 : memberPage,
        page_size: drawerMode === 'view' ? 5 : 20,
        keyword:
          drawerMode === 'members' ? memberKeyword || undefined : undefined,
        assignment: drawerMode === 'view' ? 'assigned' : memberFilter,
      }),
    enabled: Boolean(
      currentScope &&
        selectedRole &&
        ['view', 'members'].includes(drawerMode || ''),
    ),
  });

  const invalidateCurrentScope = async () => {
    await Promise.all([
      workspace.queryClient.invalidateQueries({
        queryKey: [
          'access',
          'role-management',
          'roles',
          workspace.selectedOrgSlug,
          scopeKey(currentScope),
        ],
      }),
      workspace.queryClient.invalidateQueries({
        queryKey: [
          'access',
          'role-management',
          'navigation',
          workspace.selectedOrgSlug,
        ],
      }),
    ]);
  };

  const roleMutation = useMutation({
    mutationFn: async (values: RoleInput) => {
      if (!currentScope) throw new Error('请选择角色作用范围');
      if (drawerMode === 'edit' && selectedRole) {
        return updateRole(currentScope, selectedRole.id, values);
      }
      return createRole(currentScope, {
        ...values,
        copy_from: copySourceId,
      });
    },
    onSuccess: async (role) => {
      message.success(drawerMode === 'edit' ? '角色已更新' : '角色已创建');
      setSelectedRole(role);
      setCopySourceId(undefined);
      setDrawerMode('view');
      roleForm.resetFields();
      await invalidateCurrentScope();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (role: RoleRecord) => {
      if (!currentScope) throw new Error('请选择角色作用范围');
      return deleteRole(currentScope, role.id);
    },
    onSuccess: async () => {
      message.success('角色已删除');
      setDrawerMode(null);
      setSelectedRole(null);
      await invalidateCurrentScope();
    },
  });
  const memberMutation = useMutation({
    mutationFn: async () => {
      if (!currentScope || !selectedRole) throw new Error('请选择角色');
      const changes = Object.entries(memberChanges);
      return patchRoleMembers(currentScope, selectedRole.id, {
        add_user_ids: changes
          .filter(([, change]) => change.next && !change.original)
          .map(([userId]) => Number(userId)),
        remove_user_ids: changes
          .filter(([, change]) => !change.next && change.original)
          .map(([userId]) => Number(userId)),
      });
    },
    onSuccess: async () => {
      message.success('角色成员已更新');
      setMemberChanges({});
      setMemberKeyword('');
      setMemberFilter('all');
      setMemberPage(1);
      setDrawerMode('view');
      await invalidateCurrentScope();
      await workspace.queryClient.invalidateQueries({
        queryKey: [
          'access',
          'role-management',
          'members',
          workspace.selectedOrgSlug,
          scopeKey(currentScope),
          selectedRole?.id,
        ],
      });
    },
  });

  const openView = (role: RoleRecord) => {
    setSelectedRole(role);
    setDrawerMode('view');
  };
  const openEdit = (role: RoleRecord) => {
    setSelectedRole(role);
    setCopySourceId(undefined);
    roleForm.setFieldsValue({
      name: role.name,
      description: role.description,
      permission_keys: role.permission_keys,
    });
    setDrawerMode('edit');
  };
  const openCreate = (source?: RoleRecord) => {
    setSelectedRole(source || null);
    setCopySourceId(source?.id);
    roleForm.setFieldsValue({
      name: source ? `${source.name} 副本` : '',
      description: source?.description || '',
      permission_keys: source?.permission_keys || [],
    });
    setDrawerMode('create');
  };
  const openMembers = (role: RoleRecord) => {
    setSelectedRole(role);
    setMemberChanges({});
    setMemberKeyword('');
    setMemberFilter('all');
    setMemberPage(1);
    setDrawerMode('members');
  };
  const confirmDelete = (role: RoleRecord) => {
    modal.confirm({
      title: `删除角色“${role.name}”？`,
      content:
        role.assigned_member_count > 0
          ? '该角色仍有成员授权，请先移除全部授权后再删除。'
          : '删除后无法恢复，请确认是否继续。',
      okText: '删除',
      okButtonProps: {
        danger: true,
        disabled: role.assigned_member_count > 0,
      },
      onOk: () => deleteMutation.mutateAsync(role),
    });
  };

  const requestDrawerClose = () => {
    const dirty =
      ((drawerMode === 'edit' || drawerMode === 'create') &&
        roleForm.isFieldsTouched()) ||
      (drawerMode === 'members' && Object.keys(memberChanges).length > 0);
    if (!dirty) {
      setDrawerMode(null);
      return;
    }
    modal.confirm({
      title: '放弃未保存的修改？',
      content: '关闭后，本次修改不会保留。',
      okText: '放弃修改',
      okButtonProps: { danger: true },
      onOk: () => {
        setMemberChanges({});
        roleForm.resetFields();
        setDrawerMode(null);
      },
    });
  };

  const selectScope = (key: React.Key) => {
    setScopeDrawerOpen(false);
    if (key === 'space') {
      history.push(buildRoleManagementPath('space'));
      return;
    }
    const teamId = Number(String(key).replace('team:', ''));
    history.push(buildRoleManagementPath('team', teamId));
  };

  const filteredTeams = (navigation?.teams || []).filter((team) =>
    team.name
      .toLocaleLowerCase()
      .includes(scopeSearch.trim().toLocaleLowerCase()),
  );
  const scopeTreeData: TreeDataNode[] = [
    ...(navigation?.capabilities.role_view &&
    (!scopeSearch || '空间角色'.includes(scopeSearch.trim()))
      ? [
          {
            key: 'space-group',
            title: '空间范围',
            selectable: false,
            children: [
              {
                key: 'space',
                title: (
                  <span className={styles.scopeTitle}>
                    <span className={styles.scopeName}>空间角色</span>
                    <span className={styles.scopeCount}>
                      {navigation.space_role_count}
                    </span>
                  </span>
                ),
              },
            ],
          },
        ]
      : []),
    ...(filteredTeams.length
      ? [
          {
            key: 'team-group',
            title: '团队范围',
            selectable: false,
            children: filteredTeams.map((team) => ({
              key: `team:${team.id}`,
              title: (
                <span className={styles.scopeTitle}>
                  <span className={styles.scopeName}>{team.name}</span>
                  <span className={styles.scopeCount}>{team.role_count}</span>
                </span>
              ),
            })),
          },
        ]
      : []),
  ];

  const renderScopeNavigation = () => (
    <>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索团队或空间"
        value={scopeSearch}
        onChange={(event) => setScopeSearch(event.target.value)}
      />
      <Tree
        blockNode
        className={styles.scopeTree}
        defaultExpandAll
        selectedKeys={currentScope ? [scopeKey(currentScope)] : []}
        showLine={{ showLeafIcon: false }}
        treeData={scopeTreeData}
        onSelect={(keys) => keys[0] && selectScope(keys[0])}
      />
    </>
  );

  const columns: TableColumnsType<RoleRecord> = [
    {
      title: '角色',
      dataIndex: 'name',
      width: 300,
      render: (_value, role) => (
        <div>
          <Button
            type="link"
            className={styles.roleNameButton}
            onClick={() => openView(role)}
          >
            {role.name}
          </Button>
          {role.description ? (
            <Typography.Text
              type="secondary"
              className={styles.roleDescription}
              ellipsis={{ tooltip: role.description }}
            >
              {role.description}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'is_system',
      width: 120,
      align: 'center',
      render: (_value, role) => roleTypeTag(role),
    },
    {
      title: '权限',
      dataIndex: 'permission_count',
      width: 160,
      align: 'right',
      render: (_value, role) => (
        <Button type="link" size="small" onClick={() => openView(role)}>
          {role.permission_count} 个权限
        </Button>
      ),
    },
    {
      title: '已授权',
      dataIndex: 'assigned_member_count',
      width: 120,
      align: 'right',
      render: (_value, role) => (
        <Button type="link" size="small" onClick={() => openMembers(role)}>
          {role.assigned_member_count} 人
        </Button>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 260,
      align: 'center',
      render: (_value, role) => {
        const menuItems: MenuProps['items'] = [
          ...(role.is_system || !canManage
            ? []
            : [
                {
                  key: 'edit',
                  icon: <EditOutlined />,
                  label: '编辑角色',
                },
              ]),
          ...(canManage ? [{ key: 'copy', label: '复制角色' }] : []),
          ...(role.is_system || !canManage
            ? []
            : [
                { type: 'divider' as const },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  danger: true,
                  label: '删除角色',
                },
              ]),
        ];
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => openView(role)}>
              查看权限
            </Button>
            {canManage ? (
              <Button
                type="link"
                size="small"
                onClick={() => openMembers(role)}
              >
                分配成员
              </Button>
            ) : null}
            {menuItems.length ? (
              <Dropdown
                menu={{
                  items: menuItems,
                  onClick: ({ key }) => {
                    if (key === 'edit') openEdit(role);
                    if (key === 'copy') openCreate(role);
                    if (key === 'delete') confirmDelete(role);
                  },
                }}
                trigger={['click']}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  aria-label={`${role.name}更多操作`}
                />
              </Dropdown>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const memberColumns: TableColumnsType<RoleMemberOption> = [
    {
      title: '成员',
      dataIndex: 'user',
      render: (_value, member) => (
        <div className={styles.memberIdentity}>
          <Avatar src={member.user.avatar_url}>
            {formatPersonLabel(member.user).slice(0, 1)}
          </Avatar>
          <div className={styles.memberText}>
            <Typography.Text strong>
              {formatPersonLabel(member.user)}
            </Typography.Text>
            <span className={styles.memberSecondary}>
              {member.user.email || member.user.username}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'assigned',
      width: 100,
      align: 'center',
      render: (_value, member) => {
        const assigned = memberChanges[member.user.id]?.next ?? member.assigned;
        return assigned ? <Tag color="blue">已分配</Tag> : <Tag>未分配</Tag>;
      },
    },
  ];

  const selectedPermissionGroups = selectedRole
    ? permissionGroups(
        permissionsQuery.data || [],
        selectedRole.permission_keys,
      )
    : [];
  const permissionFormGroups = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; items: PermissionOption[] }
    >();
    (permissionsQuery.data || []).forEach((permission) => {
      const group = groups.get(permission.module_key) || {
        name: permission.module_name,
        items: [],
      };
      group.items.push(permission);
      groups.set(permission.module_key, group);
    });
    return [...groups.entries()].map(([key, value]) => ({ key, ...value }));
  }, [permissionsQuery.data]);

  const renderDrawerContent = () => {
    if (drawerMode === 'edit' || drawerMode === 'create') {
      return (
        <Form form={roleForm} layout="vertical">
          <Alert
            type="info"
            showIcon
            title={
              currentScope?.kind === 'space'
                ? '作用范围：当前空间'
                : `作用范围：${currentScope?.teamName || '当前团队'}`
            }
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            label="角色名称"
            name="name"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item label="角色描述" name="description">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="权限" required>
            {permissionsQuery.isError ? (
              <Alert
                type="error"
                showIcon
                title="权限目录加载失败"
                action={
                  <Button onClick={() => permissionsQuery.refetch()}>
                    重试
                  </Button>
                }
              />
            ) : (
              <Form.Item name="permission_keys" noStyle>
                <Checkbox.Group style={{ width: '100%' }}>
                  <Space
                    orientation="vertical"
                    size="middle"
                    style={{ width: '100%' }}
                  >
                    {permissionFormGroups.map((group) => (
                      <div key={group.key} className={styles.permissionGroup}>
                        <Typography.Text strong>{group.name}</Typography.Text>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {group.items.map((permission) => (
                            <Checkbox
                              key={permission.key}
                              value={permission.key}
                            >
                              {permission.name}
                            </Checkbox>
                          ))}
                        </div>
                      </div>
                    ))}
                  </Space>
                </Checkbox.Group>
              </Form.Item>
            )}
          </Form.Item>
        </Form>
      );
    }

    if (drawerMode === 'members') {
      const pageItems = memberQuery.data?.items || [];
      const selectedKeys = pageItems
        .filter(
          (member) => memberChanges[member.user.id]?.next ?? member.assigned,
        )
        .map((member) => member.user.id);
      return (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            title={
              currentScope?.kind === 'space'
                ? '仅可选择当前空间的有效成员'
                : `仅可选择“${currentScope?.teamName}”的团队成员`
            }
          />
          <Flex gap="small" wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索姓名、账号或邮箱"
              value={memberKeyword}
              onChange={(event) => {
                setMemberKeyword(event.target.value);
                setMemberPage(1);
              }}
              style={{ width: 280, maxWidth: '100%' }}
            />
            <Select
              value={memberFilter}
              options={[
                { label: '全部成员', value: 'all' },
                { label: '已分配', value: 'assigned' },
                { label: '未分配', value: 'unassigned' },
              ]}
              onChange={(value) => {
                setMemberFilter(value);
                setMemberPage(1);
              }}
              style={{ width: 140 }}
            />
            <Typography.Text type="secondary">
              待保存 {Object.keys(memberChanges).length} 项修改
            </Typography.Text>
          </Flex>
          <Table<RoleMemberOption>
            rowKey={(member) => member.user.id}
            loading={memberQuery.isLoading}
            columns={memberColumns}
            dataSource={pageItems}
            rowSelection={{
              preserveSelectedRowKeys: true,
              selectedRowKeys: selectedKeys,
              onChange: (keys) => {
                const selected = new Set(keys.map(Number));
                setMemberChanges((current) => {
                  const next = { ...current };
                  pageItems.forEach((member) => {
                    const nextAssigned = selected.has(member.user.id);
                    if (nextAssigned === member.assigned)
                      delete next[member.user.id];
                    else
                      next[member.user.id] = {
                        original: member.assigned,
                        next: nextAssigned,
                      };
                  });
                  return next;
                });
              },
            }}
            pagination={fixedPagePagination(
              memberPage,
              20,
              memberQuery.data?.total || 0,
              setMemberPage,
            )}
          />
        </Space>
      );
    }

    if (!selectedRole) return null;
    return (
      <>
        <Descriptions
          size="small"
          column={2}
          items={[
            { key: 'type', label: '类型', children: roleTypeTag(selectedRole) },
            {
              key: 'scope',
              label: '作用范围',
              children:
                currentScope?.kind === 'space'
                  ? '当前空间'
                  : currentScope?.teamName,
            },
            {
              key: 'permission-count',
              label: '权限数量',
              children: `${selectedRole.permission_count} 项`,
            },
            {
              key: 'member-count',
              label: '已授权',
              children: `${selectedRole.assigned_member_count} 人`,
            },
            {
              key: 'created',
              label: '创建时间',
              children: dayjs(selectedRole.created_at).format(
                'YYYY-MM-DD HH:mm',
              ),
            },
            {
              key: 'updated',
              label: '更新时间',
              children: dayjs(selectedRole.updated_at).format(
                'YYYY-MM-DD HH:mm',
              ),
            },
            {
              key: 'description',
              label: '角色描述',
              span: 2,
              children: selectedRole.description || '未填写',
            },
          ]}
        />
        <section className={styles.drawerSection}>
          <div className={styles.drawerSectionHeader}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              权限概览
            </Typography.Title>
            <Typography.Text type="secondary">
              {selectedRole.permission_count} 项
            </Typography.Text>
          </div>
          {selectedPermissionGroups.length ? (
            <div className={styles.permissionGroups}>
              {selectedPermissionGroups.map((group) => (
                <div key={group.key} className={styles.permissionGroup}>
                  <Flex justify="space-between" gap="small">
                    <Typography.Text strong>{group.name}</Typography.Text>
                    <Typography.Text type="secondary">
                      {group.items.length} 项
                    </Typography.Text>
                  </Flex>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {group.items.map((permission) => (
                      <Tag key={permission.key}>{permission.name}</Tag>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="未配置权限"
            />
          )}
        </section>
        <section className={styles.drawerSection}>
          <div className={styles.drawerSectionHeader}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              已授权成员
            </Typography.Title>
            <Button type="link" onClick={() => openMembers(selectedRole)}>
              查看全部
            </Button>
          </div>
          {memberQuery.isError ? (
            <Alert
              type="error"
              showIcon
              title="成员加载失败"
              action={
                <Button onClick={() => memberQuery.refetch()}>重试</Button>
              }
            />
          ) : memberQuery.data?.items.length ? (
            <Table<RoleMemberOption>
              rowKey={(member) => member.user.id}
              loading={memberQuery.isLoading}
              columns={memberColumns.slice(0, 1)}
              dataSource={memberQuery.data.items}
              pagination={false}
              showHeader={false}
              size="small"
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="尚未分配成员"
            />
          )}
        </section>
      </>
    );
  };

  const drawerTitle =
    drawerMode === 'create'
      ? copySourceId
        ? '复制角色'
        : '新建角色'
      : drawerMode === 'edit'
        ? '编辑角色'
        : drawerMode === 'members'
          ? `${selectedRole?.name || '角色'} · 分配成员`
          : selectedRole?.name || '角色详情';
  const drawerFooter =
    drawerMode === 'edit' || drawerMode === 'create' ? (
      <Flex justify="flex-end" gap="small">
        <Button onClick={requestDrawerClose}>取消</Button>
        <Button
          type="primary"
          loading={roleMutation.isPending}
          onClick={async () => {
            const values = await roleForm.validateFields();
            await roleMutation.mutateAsync(values);
          }}
        >
          保存
        </Button>
      </Flex>
    ) : drawerMode === 'members' ? (
      <Flex justify="space-between" gap="small">
        <Button onClick={() => setDrawerMode('view')}>返回详情</Button>
        <Button
          type="primary"
          disabled={!Object.keys(memberChanges).length}
          loading={memberMutation.isPending}
          onClick={() => memberMutation.mutateAsync()}
        >
          保存成员
        </Button>
      </Flex>
    ) : canManage && selectedRole ? (
      <Button type="primary" block onClick={() => openMembers(selectedRole)}>
        分配成员
      </Button>
    ) : null;

  const renderContent = () => {
    if (navigationQuery.isLoading) {
      return (
        <div className={styles.workspace}>
          <aside className={styles.scopeNavigator}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </aside>
          <main className={styles.content}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </main>
        </div>
      );
    }
    if (navigationQuery.isError) {
      return (
        <div className={styles.content}>
          <Alert
            type="error"
            showIcon
            title="角色管理加载失败"
            description={(navigationQuery.error as Error).message}
            action={
              <Button onClick={() => navigationQuery.refetch()}>
                重新加载
              </Button>
            }
          />
        </div>
      );
    }
    if (
      !navigation?.capabilities.role_view &&
      !navigation?.capabilities.team_role_view_ids.length
    ) {
      return (
        <div className={styles.content}>
          <Alert
            type="warning"
            showIcon
            title="无权访问角色管理"
            description="当前账号没有空间或任何团队的角色查看权限。"
          />
        </div>
      );
    }
    if (!currentScope || !canView) {
      return (
        <div className={styles.workspace}>
          {!isNarrow ? (
            <aside className={styles.scopeNavigator}>
              {renderScopeNavigation()}
            </aside>
          ) : null}
          <main className={styles.content}>
            <Alert
              type="warning"
              showIcon
              title="无权查看所选作用范围"
              description="该团队不存在、已被删除，或当前账号没有查看权限。请从左侧选择可访问范围。"
            />
          </main>
        </div>
      );
    }
    return (
      <div className={styles.workspace}>
        {!isNarrow ? (
          <aside className={styles.scopeNavigator}>
            {renderScopeNavigation()}
          </aside>
        ) : null}
        <main className={styles.content} aria-label="角色列表">
          <div className={styles.mobileScopeBar}>
            <Space>
              <TeamOutlined />
              <Typography.Text strong>
                {currentScope.kind === 'space'
                  ? '空间角色'
                  : currentScope.teamName}
              </Typography.Text>
            </Space>
            <Button
              icon={<MenuOutlined />}
              onClick={() => setScopeDrawerOpen(true)}
            >
              切换范围
            </Button>
          </div>
          <div className={styles.summaryStrip}>
            {[
              ['角色总数', summary.total],
              ['系统角色', summary.system],
              ['自定义角色', summary.custom],
              ['已授权成员', summary.assigned],
            ].map(([title, value]) => (
              <div key={String(title)} className={styles.summaryItem}>
                <Statistic
                  title={title}
                  value={value}
                  styles={{ content: { fontSize: 20 } }}
                />
              </div>
            ))}
          </div>
          {rolesQuery.isError ? (
            <Alert
              type="error"
              showIcon
              title="角色列表加载失败"
              description={(rolesQuery.error as Error).message}
              action={
                <Button onClick={() => rolesQuery.refetch()}>重新加载</Button>
              }
            />
          ) : (
            <Table<RoleRecord>
              rowKey="id"
              loading={rolesQuery.isLoading}
              columns={columns}
              dataSource={filteredRoles}
              pagination={false}
              scroll={adminTableScroll}
              locale={{
                emptyText: (
                  <Empty
                    description={
                      roleItems.length
                        ? '没有符合条件的角色'
                        : '当前范围暂无角色'
                    }
                  >
                    {roleItems.length ? (
                      <Button
                        onClick={() => {
                          setRoleSearch('');
                          setRoleType('all');
                          setModuleFilter(undefined);
                          setAssignedOnly(false);
                        }}
                      >
                        重置筛选
                      </Button>
                    ) : canManage ? (
                      <Button type="primary" onClick={() => openCreate()}>
                        新建角色
                      </Button>
                    ) : null}
                  </Empty>
                ),
              }}
            />
          )}
        </main>
      </div>
    );
  };

  return (
    <TenantSelectionGuard title="角色管理">
      <Typography.Paragraph type="secondary" className={styles.pageDescription}>
        统一管理空间与团队角色、权限及成员授权。
      </Typography.Paragraph>
      <Card className={styles.workbenchCard}>
        <div className={styles.toolbar}>
          <Input
            allowClear
            className={styles.toolbarSearch}
            prefix={<SearchOutlined />}
            placeholder="搜索角色名称或描述"
            value={roleSearch}
            onChange={(event) => setRoleSearch(event.target.value)}
          />
          <Select
            className={styles.toolbarSelect}
            value={roleType}
            options={[
              { label: '全部类型', value: 'all' },
              { label: '系统角色', value: 'system' },
              { label: '自定义角色', value: 'custom' },
            ]}
            onChange={setRoleType}
          />
          <Select
            allowClear
            className={styles.toolbarSelect}
            placeholder="权限模块"
            value={moduleFilter}
            options={moduleOptions}
            onChange={setModuleFilter}
          />
          <Checkbox
            checked={assignedOnly}
            onChange={(event) => setAssignedOnly(event.target.checked)}
          >
            仅看已授权
          </Checkbox>
          <Button
            onClick={() => {
              setRoleSearch('');
              setRoleType('all');
              setModuleFilter(undefined);
              setAssignedOnly(false);
            }}
          >
            重置
          </Button>
          <div className={styles.toolbarSpacer} />
          {canManage ? (
            <Button
              type="primary"
              className={styles.toolbarPrimary}
              icon={<PlusOutlined />}
              onClick={() => openCreate()}
            >
              新建角色
            </Button>
          ) : null}
        </div>
        {renderContent()}
      </Card>

      <Drawer
        title="选择作用范围"
        open={scopeDrawerOpen}
        size={drawerWidthLg}
        onClose={() => setScopeDrawerOpen(false)}
      >
        {renderScopeNavigation()}
      </Drawer>
      <Drawer
        title={drawerTitle}
        open={Boolean(drawerMode)}
        size={drawerWidthLg}
        destroyOnHidden
        extra={
          drawerMode === 'view' &&
          selectedRole &&
          !selectedRole.is_system &&
          canManage ? (
            <Button onClick={() => openEdit(selectedRole)}>编辑</Button>
          ) : null
        }
        footer={drawerFooter}
        onClose={requestDrawerClose}
      >
        {renderDrawerContent()}
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default RoleManagementPage;
