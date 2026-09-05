import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Collapse,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { formatPersonLabel, useTenantWorkspace } from '@/pages/space/shared';
import { houseApi } from '@/services/manual/house';
import {
  getWorkspaceMemberEmployeeName,
  getWorkspaceMemberJobTitle,
  patchOrganizationMemberEmployeeProfile,
} from '@/services/manual/organizationMembers';
import {
  appsAccessApiCreateOrganizationBinding,
  appsAccessApiDeleteOrganizationBinding,
  appsAccessApiListOrganizationBindings,
} from '@/services/openapi/accessOrganizationBindings';
import { appsAccessApiListOrgRoles } from '@/services/openapi/accessOrganizationRoles';
import {
  appsAccessApiCreateTeamBinding,
  appsAccessApiDeleteTeamBinding,
  appsAccessApiListTeamBindingsView,
} from '@/services/openapi/accessTeamBindings';
import { appsAccessApiListTeamRoles } from '@/services/openapi/accessTeamRoles';
import { appsOrganizationsApiDeleteMember } from '@/services/openapi/organizationMembers';
import { appsOrganizationsWorkspaceApiGetWorkspaceMember } from '@/services/openapi/organizationWorkspace';
import {
  appsTeamsApiAddTeamMember,
  appsTeamsApiRemoveTeamMember,
} from '@/services/openapi/teams';
import { organizationQueryKeys } from '../queryKeys';
import { useStyles } from '../styles';
import {
  ResponsibilityEditor,
  type UnsavedResponsibilityState,
} from './ResponsibilityEditor';

export type MemberWorkspaceTab = 'profile' | 'access' | 'responsibilities';

function isNotFoundError(error: unknown) {
  const candidate = error as
    | { info?: { code?: number }; response?: { status?: number } }
    | undefined;
  return candidate?.response?.status === 404 || candidate?.info?.code === 404;
}

export const MemberWorkspacePanel: React.FC<{
  memberId: number;
  tab: MemberWorkspaceTab;
  navigation?: API.OrganizationNavigationOut;
  capabilities: API.OrganizationWorkspaceCapabilitiesOut;
  onDeleted: () => void;
  onMissing: () => void;
  onDirtyStateChange?: (state: UnsavedResponsibilityState) => void;
  onOpenRoleSettings?: (
    scope: 'organization' | 'team',
    teamId?: number,
  ) => void;
  onTabChange: (tab: MemberWorkspaceTab) => void;
}> = ({
  capabilities,
  memberId,
  navigation,
  onDeleted,
  onDirtyStateChange,
  onMissing,
  onOpenRoleSettings,
  onTabChange,
  tab,
}) => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const [teamToAdd, setTeamToAdd] = useState<number>();
  const [orgRoleToAdd, setOrgRoleToAdd] = useState<number>();
  const [teamRoleToAdd, setTeamRoleToAdd] = useState<
    Record<number, number | undefined>
  >({});
  const [employeeEditorOpen, setEmployeeEditorOpen] = useState(false);
  const [employeeForm] = Form.useForm<{
    employee_name: string;
    job_title: string;
  }>();
  const missingHandledRef = useRef(false);
  const memberQuery = useQuery({
    queryKey: organizationQueryKeys.member(workspace.selectedOrgSlug, memberId),
    queryFn: () =>
      appsOrganizationsWorkspaceApiGetWorkspaceMember(
        { member_id: memberId },
        { skipErrorHandler: true },
      ),
    enabled: Boolean(workspace.selectedOrgSlug && memberId),
  });
  const responsibilityQuery = useQuery({
    queryKey: organizationQueryKeys.responsibilities(
      workspace.selectedOrgSlug,
      memberId,
    ),
    queryFn: () => houseApi.getStaffResponsibility(memberId),
    enabled: Boolean(workspace.selectedOrgSlug && memberId),
  });
  const member = memberQuery.data;

  const orgRolesQuery = useQuery({
    queryKey: ['access', 'organization-roles', workspace.selectedOrgSlug],
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(
      workspace.selectedOrgSlug && tab === 'access' && capabilities.role_view,
    ),
  });
  const orgBindingsQuery = useQuery({
    queryKey: ['access', 'organization-bindings', workspace.selectedOrgSlug],
    queryFn: () => appsAccessApiListOrganizationBindings(),
    enabled: Boolean(
      workspace.selectedOrgSlug && tab === 'access' && capabilities.role_view,
    ),
  });
  const teamRoleQueries = useQueries({
    queries: (member?.teams || []).map((team) => ({
      queryKey: ['access', 'team-roles', workspace.selectedOrgSlug, team.id],
      queryFn: () => appsAccessApiListTeamRoles({ team_id: team.id }),
      enabled:
        tab === 'access' && capabilities.team_role_view_ids.includes(team.id),
    })),
  });
  const teamBindingQueries = useQueries({
    queries: (member?.teams || []).map((team) => ({
      queryKey: ['access', 'team-bindings', workspace.selectedOrgSlug, team.id],
      queryFn: () => appsAccessApiListTeamBindingsView({ team_id: team.id }),
      enabled:
        tab === 'access' && capabilities.team_role_view_ids.includes(team.id),
    })),
  });

  useEffect(() => {
    missingHandledRef.current = false;
  }, [memberId]);

  useEffect(() => {
    if (
      !memberQuery.isError ||
      !isNotFoundError(memberQuery.error) ||
      missingHandledRef.current
    )
      return;
    missingHandledRef.current = true;
    onMissing();
  }, [memberQuery.error, memberQuery.isError, onMissing]);

  const invalidateMember = async () => {
    await workspace.queryClient.invalidateQueries({
      queryKey: organizationQueryKeys.root(workspace.selectedOrgSlug),
    });
    await workspace.queryClient.invalidateQueries({ queryKey: ['access'] });
  };
  const teamMutation = useMutation({
    mutationFn: ({
      action,
      teamId,
    }: {
      action: 'add' | 'remove';
      teamId: number;
    }) => {
      if (!member) throw new Error('成员尚未加载');
      const params = { team_id: teamId, user_id: member.user.id };
      return action === 'add'
        ? appsTeamsApiAddTeamMember(params)
        : appsTeamsApiRemoveTeamMember(params);
    },
    onSuccess: async (_result, variables) => {
      message.success(
        variables.action === 'add' ? '已加入团队' : '已从团队移除',
      );
      setTeamToAdd(undefined);
      await invalidateMember();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => appsOrganizationsApiDeleteMember({ member_id: memberId }),
    onSuccess: async () => {
      message.success('成员已移出组织');
      await invalidateMember();
      onDeleted();
    },
  });
  const employeeProfileMutation = useMutation({
    mutationFn: (values: { employee_name: string; job_title: string }) =>
      patchOrganizationMemberEmployeeProfile(memberId, {
        employee_name: values.employee_name?.trim() || '',
        job_title: values.job_title?.trim() || '',
      }),
    onSuccess: async () => {
      message.success('员工信息已更新');
      setEmployeeEditorOpen(false);
      employeeForm.resetFields();
      await invalidateMember();
    },
  });
  const orgBindingMutation = useMutation({
    mutationFn: ({
      action,
      bindingId,
      roleId,
    }: {
      action: 'add' | 'remove';
      bindingId?: number;
      roleId?: number;
    }) => {
      if (!member) throw new Error('成员尚未加载');
      if (action === 'remove' && bindingId)
        return appsAccessApiDeleteOrganizationBinding({
          binding_id: bindingId,
        });
      if (!roleId) throw new Error('请选择角色');
      return appsAccessApiCreateOrganizationBinding({
        user: member.user.id,
        role: roleId,
      });
    },
    onSuccess: async () => {
      setOrgRoleToAdd(undefined);
      await workspace.queryClient.invalidateQueries({
        queryKey: [
          'access',
          'organization-bindings',
          workspace.selectedOrgSlug,
        ],
      });
    },
  });
  const teamBindingMutation = useMutation({
    mutationFn: ({
      action,
      bindingId,
      roleId,
      teamId,
    }: {
      action: 'add' | 'remove';
      bindingId?: number;
      roleId?: number;
      teamId: number;
    }) => {
      if (!member) throw new Error('成员尚未加载');
      if (action === 'remove' && bindingId)
        return appsAccessApiDeleteTeamBinding({
          team_id: teamId,
          binding_id: bindingId,
        });
      if (!roleId) throw new Error('请选择角色');
      return appsAccessApiCreateTeamBinding(
        { team_id: teamId },
        { user: member.user.id, role: roleId },
      );
    },
    onSuccess: async (_result, variables) => {
      setTeamRoleToAdd((current) => ({
        ...current,
        [variables.teamId]: undefined,
      }));
      await workspace.queryClient.invalidateQueries({
        queryKey: [
          'access',
          'team-bindings',
          workspace.selectedOrgSlug,
          variables.teamId,
        ],
      });
    },
  });

  const currentOrgBindings = useMemo(
    () =>
      (orgBindingsQuery.data || []).filter(
        (binding) => binding.user.id === member?.user.id,
      ),
    [member?.user.id, orgBindingsQuery.data],
  );
  const availableTeams = (navigation?.teams || []).filter(
    (team) => !member?.teams.some((current) => current.id === team.id),
  );
  const manageableAvailableTeams = availableTeams.filter((team) =>
    capabilities.team_member_manage_ids.includes(team.id),
  );

  if (memberQuery.isError) {
    if (isNotFoundError(memberQuery.error)) return <Card loading />;
    return (
      <Alert
        type="error"
        showIcon
        title="成员信息加载失败"
        description={(memberQuery.error as Error).message}
        action={<Button onClick={() => memberQuery.refetch()}>重试</Button>}
      />
    );
  }
  if (!member) return <Card loading />;

  const employeeName = getWorkspaceMemberEmployeeName(member);
  const jobTitle = getWorkspaceMemberJobTitle(member);
  const memberDisplayName = employeeName || formatPersonLabel(member.user);
  const memberAccountLabel = member.user.email || member.user.username;
  const openEmployeeEditor = () => {
    employeeForm.setFieldsValue({
      employee_name: employeeName,
      job_title: jobTitle,
    });
    setEmployeeEditorOpen(true);
  };
  const closeEmployeeEditor = () => {
    setEmployeeEditorOpen(false);
    employeeForm.resetFields();
  };

  const memberInformationContent = (
    <Card
      size="small"
      title="员工信息"
      extra={
        capabilities.member_manage ? (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={openEmployeeEditor}
          >
            编辑
          </Button>
        ) : undefined
      }
    >
      <Descriptions bordered column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label="员工姓名">
          {employeeName || '未填写'}
        </Descriptions.Item>
        <Descriptions.Item label="职位">
          {jobTitle || '未填写'}
        </Descriptions.Item>
        <Descriptions.Item label="用户名">
          {member.user.username}
        </Descriptions.Item>
        <Descriptions.Item label="邮箱">
          {member.user.email || '未提供'}
        </Descriptions.Item>
        <Descriptions.Item label="空间身份">
          {member.is_owner ? '所有者' : '普通成员'}
        </Descriptions.Item>
        <Descriptions.Item label="所属团队">
          {member.teams.length ? `${member.teams.length} 个` : '未分组'}
        </Descriptions.Item>
        <Descriptions.Item label="加入时间">
          {dayjs(member.created_at).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {dayjs(member.updated_at).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );

  const teamsContent = (
    <Card
      size="small"
      className={styles.memberTeamsCard}
      title={
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>所属团队</Typography.Text>
          <Typography.Text type="secondary" className={styles.memberTeamsHint}>
            成员可同时加入多个平级团队。
          </Typography.Text>
        </Space>
      }
      extra={
        manageableAvailableTeams.length ? (
          <div className={styles.memberTeamsHeaderActions}>
            <Select
              aria-label="选择团队"
              allowClear
              placeholder="选择团队"
              value={teamToAdd}
              onChange={setTeamToAdd}
              onClear={() => setTeamToAdd(undefined)}
              options={manageableAvailableTeams.map((team) => ({
                value: team.id,
                label: team.name,
              }))}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!teamToAdd}
              loading={teamMutation.isPending}
              onClick={() =>
                teamToAdd &&
                teamMutation.mutateAsync({ action: 'add', teamId: teamToAdd })
              }
            >
              加入团队
            </Button>
          </div>
        ) : undefined
      }
    >
      {!manageableAvailableTeams.length && availableTeams.length ? (
        <Alert
          type="info"
          showIcon
          title="团队归属为只读"
          description="当前角色没有可管理团队的成员调整权限。"
          className="mb-4"
        />
      ) : null}
      {member.teams.length ? (
        <Space orientation="vertical" size={0} style={{ width: '100%' }}>
          {member.teams.map((team, index) => (
            <React.Fragment key={team.id}>
              <Flex
                align="center"
                justify="space-between"
                gap="middle"
                wrap
                className={styles.memberTeamRow}
              >
                <Space align="center">
                  <AppIcon name="team" />
                  <Space>
                    <Typography.Text strong>{team.name}</Typography.Text>
                    <Tag>{team.member_count} 人</Tag>
                  </Space>
                </Space>
                {capabilities.team_member_manage_ids.includes(team.id) ? (
                  <Popconfirm
                    title={`从 ${team.name} 移除该成员？`}
                    description="不会将成员移出组织，也不会清理个人房源分工；该团队下的角色绑定会同步清理。"
                    okText="确认移除"
                    onConfirm={() =>
                      teamMutation.mutateAsync({
                        action: 'remove',
                        teamId: team.id,
                      })
                    }
                  >
                    <Button type="link" danger size="small">
                      移出团队
                    </Button>
                  </Popconfirm>
                ) : null}
              </Flex>
              {index < member.teams.length - 1 ? (
                <Divider className={styles.memberTeamDivider} />
              ) : null}
            </React.Fragment>
          ))}
        </Space>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="该成员尚未加入任何团队"
        />
      )}
    </Card>
  );

  const profileContent = (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {memberInformationContent}
      {teamsContent}
      {member.is_owner || capabilities.member_manage ? (
        <Collapse
          size="small"
          ghost
          className={styles.dangerCollapse}
          items={[
            {
              key: 'danger',
              label: '危险操作',
              children: member.is_owner ? (
                <div className={styles.dangerActionPanel}>
                  <div className={styles.dangerActionCopy}>
                    <Typography.Text strong>
                      所有者不能直接移出组织
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      如需移除该成员，请先在组织概览的危险操作中完成所有者
                      转移。
                    </Typography.Text>
                  </div>
                </div>
              ) : (
                <div className={styles.dangerActionPanel}>
                  <div className={styles.dangerActionCopy}>
                    <Typography.Text strong>移除成员</Typography.Text>
                    <Typography.Text type="secondary">
                      团队关系、访问角色和房源分工将失效或被清理，当前界面无法直接恢复。
                    </Typography.Text>
                  </div>
                  <Popconfirm
                    title="将成员移出当前组织？"
                    description="成员将离开当前组织，团队关系、访问角色和房源分工都会失效或清理；当前界面无法直接恢复。"
                    okText="确认移除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteMutation.mutateAsync()}
                  >
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      loading={deleteMutation.isPending}
                    >
                      移除成员
                    </Button>
                  </Popconfirm>
                </div>
              ),
            },
          ]}
        />
      ) : null}
    </Space>
  );

  const accessContent = (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      {capabilities.role_view ? (
        <Card
          size="small"
          title="组织级访问角色"
          extra={
            onOpenRoleSettings ? (
              <Button
                type="link"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => onOpenRoleSettings('organization')}
              >
                角色设置
              </Button>
            ) : null
          }
        >
          {!capabilities.role_manage ? (
            <Alert
              type="info"
              showIcon
              title="组织级角色为只读"
              description="当前角色可以查看已有组织授权，但不能新增或移除。"
              className="mb-4"
            />
          ) : null}
          {orgRolesQuery.isError || orgBindingsQuery.isError ? (
            <Alert
              type="error"
              showIcon
              title="组织级角色加载失败"
              description={
                ((orgRolesQuery.error || orgBindingsQuery.error) as Error)
                  .message
              }
              action={
                <Button
                  onClick={() => {
                    void orgRolesQuery.refetch();
                    void orgBindingsQuery.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : (
            <Space
              orientation="vertical"
              size="middle"
              style={{ width: '100%' }}
            >
              {capabilities.role_manage ? (
                <Space wrap>
                  <Select
                    aria-label="组织角色"
                    placeholder="选择组织角色"
                    value={orgRoleToAdd}
                    onChange={setOrgRoleToAdd}
                    options={(orgRolesQuery.data || [])
                      .filter((role) => role.is_active)
                      .map((role) => ({ value: role.id, label: role.name }))}
                    style={{ width: 260 }}
                  />
                  <Button
                    type="primary"
                    disabled={!orgRoleToAdd}
                    loading={orgBindingMutation.isPending}
                    onClick={() =>
                      orgRoleToAdd &&
                      orgBindingMutation.mutateAsync({
                        action: 'add',
                        roleId: orgRoleToAdd,
                      })
                    }
                  >
                    分配角色
                  </Button>
                </Space>
              ) : null}
              <Space wrap>
                {currentOrgBindings.length ? (
                  currentOrgBindings.map((binding) => (
                    <Tag
                      key={binding.id}
                      closable={capabilities.role_manage}
                      onClose={(event) => {
                        event.preventDefault();
                        void orgBindingMutation.mutateAsync({
                          action: 'remove',
                          bindingId: binding.id,
                        });
                      }}
                    >
                      {binding.role.name}
                    </Tag>
                  ))
                ) : (
                  <Typography.Text type="secondary">
                    暂无组织级角色
                  </Typography.Text>
                )}
              </Space>
            </Space>
          )}
        </Card>
      ) : (
        <Alert
          type="info"
          showIcon
          title="无法查看组织级角色"
          description="当前角色缺少组织角色查看权限。"
        />
      )}
      {member.teams.map((team, index) => {
        const canView = capabilities.team_role_view_ids.includes(team.id);
        const canManage = capabilities.team_role_manage_ids.includes(team.id);
        const roleQuery = teamRoleQueries[index];
        const bindingQuery = teamBindingQueries[index];
        const roles = teamRoleQueries[index]?.data || [];
        const bindings = (teamBindingQueries[index]?.data || []).filter(
          (binding) => binding.user.id === member.user.id,
        );
        return (
          <Card
            size="small"
            key={team.id}
            title={`${team.name} · 团队角色`}
            extra={
              canView && onOpenRoleSettings ? (
                <Button
                  type="link"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => onOpenRoleSettings('team', team.id)}
                >
                  角色设置
                </Button>
              ) : null
            }
          >
            {canView ? (
              roleQuery?.isError || bindingQuery?.isError ? (
                <Alert
                  type="error"
                  showIcon
                  title="团队角色加载失败"
                  description={
                    ((roleQuery.error || bindingQuery.error) as Error).message
                  }
                  action={
                    <Button
                      onClick={() => {
                        void roleQuery.refetch();
                        void bindingQuery.refetch();
                      }}
                    >
                      重试
                    </Button>
                  }
                />
              ) : (
                <Space
                  orientation="vertical"
                  size="middle"
                  style={{ width: '100%' }}
                >
                  {!canManage ? (
                    <Alert
                      type="info"
                      showIcon
                      title="团队角色为只读"
                      description="当前角色可以查看该团队授权，但不能新增或移除。"
                    />
                  ) : null}
                  {canManage ? (
                    <Space wrap>
                      <Select
                        aria-label={`${team.name}角色`}
                        placeholder="选择团队角色"
                        value={teamRoleToAdd[team.id]}
                        onChange={(value) =>
                          setTeamRoleToAdd((current) => ({
                            ...current,
                            [team.id]: value,
                          }))
                        }
                        options={roles
                          .filter((role) => role.is_active)
                          .map((role) => ({
                            value: role.id,
                            label: role.name,
                          }))}
                        style={{ width: 260 }}
                      />
                      <Button
                        disabled={!teamRoleToAdd[team.id]}
                        onClick={() =>
                          teamBindingMutation.mutateAsync({
                            action: 'add',
                            teamId: team.id,
                            roleId: teamRoleToAdd[team.id],
                          })
                        }
                      >
                        分配团队角色
                      </Button>
                    </Space>
                  ) : null}
                  <Space wrap>
                    {bindings.length ? (
                      bindings.map((binding) => (
                        <Tag
                          key={binding.id}
                          closable={canManage}
                          onClose={(event) => {
                            event.preventDefault();
                            void teamBindingMutation.mutateAsync({
                              action: 'remove',
                              teamId: team.id,
                              bindingId: binding.id,
                            });
                          }}
                        >
                          {binding.role.name}
                        </Tag>
                      ))
                    ) : (
                      <Typography.Text type="secondary">
                        暂无团队角色
                      </Typography.Text>
                    )}
                  </Space>
                </Space>
              )
            ) : (
              <Alert
                type="info"
                showIcon
                title="无法查看团队角色"
                description="当前角色缺少该团队的角色查看权限。"
              />
            )}
          </Card>
        );
      })}
    </Space>
  );

  return (
    <Card>
      <div className={styles.entityHeader}>
        <div className={styles.entityIdentity}>
          <Avatar size={56} src={member.user.avatar_url}>
            {memberDisplayName.slice(0, 1)}
          </Avatar>
          <div>
            <Space wrap>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {memberDisplayName}
              </Typography.Title>
              {member.is_owner ? <Tag color="gold">所有者</Tag> : null}
            </Space>
            <Typography.Text type="secondary">
              {[jobTitle, memberAccountLabel].filter(Boolean).join(' · ')}
            </Typography.Text>
            <div>
              <Space size={[4, 4]} wrap>
                {member.teams.map((team) => (
                  <Tag key={team.id}>{team.name}</Tag>
                ))}
              </Space>
            </div>
          </div>
        </div>
        <Tag
          color={
            responsibilityQuery.data?.responsible_house_count
              ? 'processing'
              : 'default'
          }
        >
          负责 {responsibilityQuery.data?.responsible_house_count || 0} 套房源
        </Tag>
      </div>
      <Tabs
        activeKey={tab}
        onChange={(key) => onTabChange(key as MemberWorkspaceTab)}
        items={[
          { key: 'profile', label: '基础信息', children: profileContent },
          { key: 'access', label: '权限管理', children: accessContent },
          {
            key: 'responsibilities',
            label: '房源分工',
            children: (
              <ResponsibilityEditor
                editable={capabilities.responsibility_manage}
                memberId={memberId}
                memberName={memberDisplayName}
                onDirtyStateChange={onDirtyStateChange}
              />
            ),
          },
        ]}
      />
      <Modal
        title="编辑员工信息"
        open={employeeEditorOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={employeeProfileMutation.isPending}
        onCancel={closeEmployeeEditor}
        onOk={async () =>
          employeeProfileMutation.mutateAsync(
            await employeeForm.validateFields(),
          )
        }
      >
        <Typography.Paragraph type="secondary">
          以下信息仅用于当前组织，不会修改该用户的账号姓名和邮箱。
        </Typography.Paragraph>
        <Form form={employeeForm} layout="vertical">
          <Form.Item
            name="employee_name"
            label="员工姓名"
            rules={[{ max: 150, message: '员工姓名不能超过 150 个字符' }]}
          >
            <Input allowClear maxLength={150} placeholder="请输入员工姓名" />
          </Form.Item>
          <Form.Item
            name="job_title"
            label="职位"
            rules={[{ max: 100, message: '职位不能超过 100 个字符' }]}
          >
            <Input allowClear maxLength={100} placeholder="请输入职位" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
