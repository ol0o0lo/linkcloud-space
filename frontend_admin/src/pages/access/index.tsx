import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  MenuOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { history, useLocation } from '@umijs/max';
import type { MenuProps, TableColumnsType } from 'antd';
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
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { TreeSectionHeader } from '@/components/TreeSectionHeader';
import {
  AdminToolbar,
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
type PermissionFormGroup = {
  key: string;
  name: string;
  items: PermissionOption[];
};

const PermissionGroupSelector: React.FC<{
  groupClassName: string;
  groups: PermissionFormGroup[];
  headerClassName: string;
  onChange?: (value: string[]) => void;
  value?: string[];
}> = ({ groupClassName, groups, headerClassName, onChange, value = [] }) => (
  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
    {groups.map((group) => {
      const groupKeys = new Set(
        group.items.map((permission) => permission.key),
      );
      const selectedCount = group.items.filter((permission) =>
        value.includes(permission.key),
      ).length;
      const updateGroup = (checked: boolean) => {
        const otherKeys = value.filter((key) => !groupKeys.has(key));
        onChange?.(
          checked
            ? [...otherKeys, ...group.items.map((permission) => permission.key)]
            : otherKeys,
        );
      };

      return (
        <div key={group.key} className={groupClassName}>
          <div className={headerClassName}>
            <Typography.Text strong>{group.name}</Typography.Text>
            <Checkbox
              aria-label={`全选${group.name}`}
              checked={selectedCount === group.items.length}
              indeterminate={
                selectedCount > 0 && selectedCount < group.items.length
              }
              onChange={(event) => updateGroup(event.target.checked)}
            >
              全选
            </Checkbox>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.items.map((permission) => (
              <Checkbox
                key={permission.key}
                checked={value.includes(permission.key)}
                onChange={(event) => {
                  onChange?.(
                    event.target.checked
                      ? [...value, permission.key]
                      : value.filter((key) => key !== permission.key),
                  );
                }}
              >
                {permission.name}
              </Checkbox>
            ))}
          </div>
        </div>
      );
    })}
  </Space>
);

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

export type RoleManagementPageProps = {
  embeddedScope?: RoleScope;
};

export const RoleManagementPage: React.FC<RoleManagementPageProps> = ({
  embeddedScope,
}) => {
  const { styles } = useRoleManagementStyles();
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.md;
  const embedded = Boolean(embeddedScope);
  const location = useLocation();
  const workspace = useTenantWorkspace();
  const requestedScope = useMemo(
    () => readRequestedScope(location.search),
    [location.search],
  );
  const [scopeSearch, setScopeSearch] = useState('');
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
  const currentScope: RoleScope | undefined = embeddedScope
    ? embeddedScope
    : requestedScope.requested
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
    if (embedded || !navigation || requestedScope.requested || !currentScope)
      return;
    history.replace(
      currentScope.kind === 'space'
        ? buildRoleManagementPath('space')
        : buildRoleManagementPath('team', currentScope.teamId),
    );
  }, [currentScope, embedded, navigation, requestedScope.requested]);

  const currentScopeKey = scopeKey(currentScope);

  useEffect(() => {
    setDrawerMode(null);
    setSelectedRole(null);
    setCopySourceId(undefined);
    setMemberChanges({});
    setMemberKeyword('');
    setMemberFilter('all');
    setMemberPage(1);
  }, [currentScopeKey]);

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
    return roleItems.filter((role) => {
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
  }, [assignedOnly, moduleFilter, roleItems, roleType]);

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
  const normalizedScopeSearch = scopeSearch.trim().toLocaleLowerCase();
  const showScopeSearch = (navigation?.teams || []).length > 8;
  const showSpaceScope = Boolean(navigation?.capabilities.role_view);
  const hasScopeSearchResult = normalizedScopeSearch
    ? filteredTeams.length > 0
    : showSpaceScope || filteredTeams.length > 0;

  const renderScopeNavigation = () => (
    <>
      {showScopeSearch ? (
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索团队"
          value={scopeSearch}
          onChange={(event) => setScopeSearch(event.target.value)}
        />
      ) : null}
      <div className={styles.scopeNavigationBody}>
        {showSpaceScope ? (
          <div className={styles.scopePrimaryLinks}>
            <div
              className={styles.scopeRow}
              data-active={currentScope?.kind === 'space'}
            >
              <AppIcon name="key" />
              <Button
                type="text"
                className={styles.scopeRowButton}
                aria-current={
                  currentScope?.kind === 'space' ? 'page' : undefined
                }
                onClick={() => selectScope('space')}
              >
                空间角色
              </Button>
              <span className={`${styles.scopeCount} role-scope-count`}>
                {navigation?.space_role_count || 0}
              </span>
            </div>
          </div>
        ) : null}

        {filteredTeams.length ? (
          <>
            <TreeSectionHeader
              title="团队角色"
              count={`${filteredTeams.length} 个团队`}
            />
            <div className={styles.scopeTeamList}>
              {filteredTeams.map((team) => (
                <div
                  className={styles.scopeRow}
                  data-active={
                    currentScope?.kind === 'team' &&
                    currentScope.teamId === team.id
                  }
                  key={team.id}
                >
                  <AppIcon name="team" />
                  <Button
                    type="text"
                    className={styles.scopeRowButton}
                    aria-current={
                      currentScope?.kind === 'team' &&
                      currentScope.teamId === team.id
                        ? 'page'
                        : undefined
                    }
                    onClick={() => selectScope(`team:${team.id}`)}
                  >
                    {team.name}
                  </Button>
                  <span className={`${styles.scopeCount} role-scope-count`}>
                    {team.role_count}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {!hasScopeSearchResult ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              normalizedScopeSearch
                ? '没有找到匹配的团队'
                : '没有可访问的作用范围'
            }
          >
            {normalizedScopeSearch ? (
              <Button onClick={() => setScopeSearch('')}>清空搜索</Button>
            ) : null}
          </Empty>
        ) : null}
      </div>
    </>
  );

  const columns: TableColumnsType<RoleRecord> = [
    {
      title: '角色',
      dataIndex: 'name',
      width: 300,
      render: (_value, role) => (
        <div className={styles.roleIdentity}>
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
      width: 210,
      align: 'right',
      render: (_value, role) => {
        const menuItems: MenuProps['items'] = [
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
            {!role.is_system && canManage ? (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(role)}
              >
                编辑
              </Button>
            ) : null}
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
                <PermissionGroupSelector
                  groupClassName={styles.permissionGroup}
                  groups={permissionFormGroups}
                  headerClassName={styles.permissionGroupHeader}
                />
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
          {!embedded ? (
            <aside className={styles.scopeNavigator}>
              <Skeleton active paragraph={{ rows: 6 }} />
            </aside>
          ) : null}
          <main className={embedded ? styles.embeddedContent : styles.content}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </main>
        </div>
      );
    }
    if (navigationQuery.isError) {
      return (
        <div className={embedded ? styles.embeddedContent : styles.content}>
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
        <div className={embedded ? styles.embeddedContent : styles.content}>
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
          {!embedded && !isNarrow ? (
            <aside className={styles.scopeNavigator}>
              {renderScopeNavigation()}
            </aside>
          ) : null}
          <main className={embedded ? styles.embeddedContent : styles.content}>
            <Alert
              type="warning"
              showIcon
              title="无权查看所选作用范围"
              description={
                embedded
                  ? '当前账号没有查看该角色范围的权限。'
                  : '该团队不存在、已被删除，或当前账号没有查看权限。请从左侧选择可访问范围。'
              }
            />
          </main>
        </div>
      );
    }
    return (
      <div className={styles.workspace}>
        {!embedded && !isNarrow ? (
          <aside className={styles.scopeNavigator}>
            {renderScopeNavigation()}
          </aside>
        ) : null}
        <main
          className={embedded ? styles.embeddedContent : styles.content}
          aria-label="角色列表"
        >
          {!embedded ? (
            <div className={styles.mobileScopeBar}>
              <Space>
                <AppIcon
                  name={currentScope.kind === 'space' ? 'key' : 'team'}
                />
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
          ) : null}
          <div className={styles.scopeContext}>
            <span className={styles.scopeContextIcon}>
              <AppIcon name={currentScope.kind === 'space' ? 'key' : 'team'} />
            </span>
            <div className={styles.scopeContextCopy}>
              <div className={styles.scopeContextTitleRow}>
                <Typography.Title
                  level={5}
                  className={styles.scopeContextTitle}
                >
                  {currentScope.kind === 'space'
                    ? '空间角色'
                    : `${currentScope.teamName} · 团队角色`}
                </Typography.Title>
                <Tag color={currentScope.kind === 'space' ? 'blue' : undefined}>
                  {currentScope.kind === 'space' ? '空间范围' : '团队范围'}
                </Tag>
              </div>
              <Typography.Text
                type="secondary"
                className={styles.scopeContextDescription}
              >
                {currentScope.kind === 'space'
                  ? '管理当前空间通用的访问角色、权限与成员授权。'
                  : '系统角色由空间统一维护，各团队独立分配；自定义角色仅在当前团队生效。'}
              </Typography.Text>
            </div>
            {canManage ? (
              <Button
                type="primary"
                className={styles.scopeContextAction}
                icon={<PlusOutlined />}
                onClick={() => openCreate()}
              >
                新建角色
              </Button>
            ) : null}
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
                  styles={{ content: { fontSize: 18 } }}
                />
              </div>
            ))}
          </div>
          <div className={styles.roleListToolbar}>
            <AdminToolbar>
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
              {moduleOptions.length > 0 || moduleFilter ? (
                <Select
                  allowClear
                  className={styles.toolbarSelect}
                  placeholder="权限模块"
                  value={moduleFilter}
                  options={moduleOptions}
                  onChange={setModuleFilter}
                />
              ) : null}
              <Checkbox
                checked={assignedOnly}
                onChange={(event) => setAssignedOnly(event.target.checked)}
              >
                仅看已授权
              </Checkbox>
              {roleType !== 'all' || moduleFilter || assignedOnly ? (
                <Button
                  type="link"
                  onClick={() => {
                    setRoleType('all');
                    setModuleFilter(undefined);
                    setAssignedOnly(false);
                  }}
                >
                  清除筛选
                </Button>
              ) : null}
            </AdminToolbar>
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

  const drawers = (
    <>
      <Drawer
        title="选择作用范围"
        open={!embedded && scopeDrawerOpen}
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
          drawerMode === 'view' && selectedRole ? (
            selectedRole.is_system ? (
              <Typography.Text type="secondary">
                <LockOutlined /> 系统角色不可编辑
              </Typography.Text>
            ) : canManage ? (
              <Button
                icon={<EditOutlined />}
                onClick={() => openEdit(selectedRole)}
              >
                编辑角色
              </Button>
            ) : null
          ) : null
        }
        footer={drawerFooter}
        onClose={requestDrawerClose}
      >
        {renderDrawerContent()}
      </Drawer>
    </>
  );

  if (embedded) {
    return (
      <>
        {renderContent()}
        {drawers}
      </>
    );
  }

  return (
    <TenantSelectionGuard title="角色管理">
      <Typography.Paragraph type="secondary" className={styles.pageDescription}>
        统一管理空间与团队角色、权限及成员授权。
      </Typography.Paragraph>
      <Card className={styles.workbenchCard}>{renderContent()}</Card>
      {drawers}
    </TenantSelectionGuard>
  );
};

export default RoleManagementPage;
