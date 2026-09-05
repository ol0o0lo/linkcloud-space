import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SaveOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  AutoComplete,
  Avatar,
  Button,
  Card,
  Collapse,
  Descriptions,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LocationPicker,
  type LocationValue,
} from '@/components/LocationPicker';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { RoleManagementPage } from '@/pages/access';
import { formatPersonLabel, useTenantWorkspace } from '@/pages/space/shared';
import { houseApi } from '@/services/manual/house';
import {
  getWorkspaceMemberEmployeeName,
  getWorkspaceMemberJobTitle,
} from '@/services/manual/organizationMembers';
import { appsOrganizationsWorkspaceApiListWorkspaceMembers } from '@/services/openapi/organizationWorkspace';
import { appsHouseApiGetStaffResponsibilitySummary } from '@/services/openapi/propertyRentalManagement';
import {
  appsTeamsApiAddTeamMember,
  appsTeamsApiCreateTeam,
  appsTeamsApiDeleteTeam,
  appsTeamsApiGetTeam,
  appsTeamsApiPatchTeam,
  appsTeamsApiRemoveTeamMember,
} from '@/services/openapi/teams';
import type { UnsavedWorkspaceRegistration } from '../hooks/useUnsavedWorkspaceGuard';
import { organizationQueryKeys } from '../queryKeys';
import { useStyles } from '../styles';

export type TeamWorkspaceTab =
  | 'profile'
  | 'members'
  | 'roles'
  | 'responsibilities';
type TeamFormValues = Pick<
  API.TeamIn,
  'name' | 'phone' | 'wechat' | 'address' | 'business_hours'
>;

const BUSINESS_HOURS_OPTIONS = [
  '工作日 09:00-18:00',
  '周一至周六 09:00-18:00',
  '周一至周日 09:00-21:00',
  '每天 09:00-18:00',
  '24小时营业',
  '需提前预约',
].map((value) => ({ value }));

export const BusinessHoursInput: React.FC<
  React.ComponentProps<typeof AutoComplete>
> = ({ className, ...props }) => (
  <AutoComplete
    {...props}
    className={['w-full', className].filter(Boolean).join(' ')}
    options={BUSINESS_HOURS_OPTIONS}
    placeholder="例如：工作日 09:00-18:00"
  />
);

export const BusinessHoursField: React.FC = () => (
  <Form.Item
    label="营业时间"
    name="business_hours"
    tooltip={{
      trigger: 'click',
      icon: <QuestionCircleOutlined aria-label="查看营业时间填写说明" />,
      title: <div>填写团队对外服务时间，可直接输入或选择常用时间。</div>,
    }}
  >
    <BusinessHoursInput />
  </Form.Item>
);

function isNotFoundError(error: unknown) {
  const candidate = error as
    | { info?: { code?: number }; response?: { status?: number } }
    | undefined;
  return candidate?.response?.status === 404 || candidate?.info?.code === 404;
}

function normalizeTeamFormValues(values?: Partial<TeamFormValues>) {
  return {
    name: values?.name || '',
    phone: values?.phone || '',
    wechat: values?.wechat || '',
    address: values?.address || '',
    business_hours: values?.business_hours || '',
  };
}

const TEAM_FIELDS: Array<{
  label: string;
  name: keyof TeamFormValues;
  placeholder?: string;
  required?: boolean;
}> = [
  { label: '团队名称', name: 'name', required: true },
  { label: '联系电话', name: 'phone' },
  { label: '联系微信', name: 'wechat' },
  { label: '团队地址', name: 'address' },
  {
    label: '营业时间',
    name: 'business_hours',
    placeholder: '例如：工作日 09:00-18:00',
  },
];

export const TeamFormModal: React.FC<{
  open: boolean;
  onCancel: () => void;
  onCreated: (team: API.TeamOut) => void;
}> = ({ onCancel, onCreated, open }) => {
  const workspace = useTenantWorkspace();
  const { token } = theme.useToken();
  const [form] = Form.useForm<TeamFormValues>();
  const [selectedLocation, setSelectedLocation] =
    useState<LocationValue | null>(null);
  const createMutation = useMutation({
    mutationFn: (values: TeamFormValues) =>
      appsTeamsApiCreateTeam({ ...values, members: [] }),
    onSuccess: async (team) => {
      message.success('团队已创建');
      form.resetFields();
      setSelectedLocation(null);
      await workspace.queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.navigation(workspace.selectedOrgSlug),
      });
      onCreated(team);
    },
  });
  const close = () => {
    form.resetFields();
    setSelectedLocation(null);
    onCancel();
  };
  return (
    <Modal
      title={
        <Space size={10}>
          <Avatar
            shape="square"
            size={32}
            icon={<TeamOutlined />}
            style={{
              color: token.colorPrimary,
              backgroundColor: token.colorPrimaryBg,
            }}
          />
          <span>新建团队</span>
        </Space>
      }
      open={open}
      width={560}
      okText="创建团队"
      confirmLoading={createMutation.isPending}
      styles={{
        body: { paddingTop: token.paddingXS },
        footer: { marginTop: token.marginLG },
      }}
      onCancel={close}
      onOk={async () => createMutation.mutateAsync(await form.validateFields())}
    >
      <Form
        form={form}
        layout="vertical"
        className="[&>.ant-form-item]:mb-5 [&>.ant-form-item:last-child]:mb-0"
      >
        {TEAM_FIELDS.map((field) => {
          if (field.name === 'address') {
            return (
              <Form.Item
                key={field.name}
                label={field.label}
                htmlFor="team-create-address"
              >
                <Space.Compact block>
                  <Form.Item name={field.name} noStyle>
                    <Input
                      id="team-create-address"
                      className="min-w-0 flex-1"
                      placeholder="输入详细地址，或通过地图选择"
                    />
                  </Form.Item>
                  {open ? (
                    <LocationPicker
                      ariaLabel="地图选址"
                      value={selectedLocation}
                      fallbackLocation={null}
                      onChange={(location) => {
                        setSelectedLocation(location);
                        if (location) {
                          form.setFieldValue('address', location.address);
                        }
                      }}
                    />
                  ) : null}
                </Space.Compact>
              </Form.Item>
            );
          }
          if (field.name === 'business_hours') {
            return <BusinessHoursField key={field.name} />;
          }
          return (
            <Form.Item
              key={field.name}
              label={field.label}
              name={field.name}
              rules={
                field.required
                  ? [{ required: true, message: '请输入团队名称' }]
                  : undefined
              }
            >
              <Input placeholder={field.placeholder} />
            </Form.Item>
          );
        })}
      </Form>
    </Modal>
  );
};

export const TeamProfileDetails: React.FC<{
  team: Pick<
    API.TeamOut,
    | 'name'
    | 'phone'
    | 'wechat'
    | 'address'
    | 'business_hours'
    | 'created_at'
    | 'updated_at'
  >;
  canEdit: boolean;
  onEdit: () => void;
}> = ({ canEdit, onEdit, team }) => {
  const displayValue = (value?: string) =>
    value || <Typography.Text type="secondary">未填写</Typography.Text>;

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Descriptions
        title="基本信息"
        layout="vertical"
        column={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }}
        extra={
          canEdit ? (
            <Button icon={<EditOutlined />} onClick={onEdit}>
              编辑
            </Button>
          ) : null
        }
        items={[
          { key: 'name', label: '团队名称', children: displayValue(team.name) },
          {
            key: 'phone',
            label: '联系电话',
            children: displayValue(team.phone),
          },
          {
            key: 'wechat',
            label: '联系微信',
            children: displayValue(team.wechat),
          },
          {
            key: 'address',
            label: '团队地址',
            children: displayValue(team.address),
          },
          {
            key: 'business_hours',
            label: '营业时间',
            children: displayValue(team.business_hours),
          },
        ]}
      />
      <Typography.Text type="secondary">
        创建于 {dayjs(team.created_at).format('YYYY-MM-DD HH:mm')} · 更新于{' '}
        {dayjs(team.updated_at).format('YYYY-MM-DD HH:mm')}
      </Typography.Text>
    </Space>
  );
};

export const TeamWorkspacePanel: React.FC<{
  teamId: number;
  tab: TeamWorkspaceTab;
  capabilities: API.OrganizationWorkspaceCapabilitiesOut;
  onDeleted: () => void;
  onMissing: () => void;
  onDirtyStateChange?: (state: UnsavedWorkspaceRegistration) => void;
  onOpenMember: (memberId: number, tab: 'profile' | 'responsibilities') => void;
  onTabChange: (tab: TeamWorkspaceTab) => void;
}> = ({
  capabilities,
  onDeleted,
  onDirtyStateChange,
  onMissing,
  onOpenMember,
  onTabChange,
  tab,
  teamId,
}) => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const [form] = Form.useForm<TeamFormValues>();
  const watchedTeamValues = Form.useWatch([], form);
  const [profileEditing, setProfileEditing] = useState(false);
  const [memberPage, setMemberPage] = useState(1);
  const [responsibilityPage, setResponsibilityPage] = useState(1);
  const [candidateKeyword, setCandidateKeyword] = useState('');
  const [candidateMemberId, setCandidateMemberId] = useState<number>();
  const missingHandledRef = useRef(false);
  const canUpdate = capabilities.team_update_ids.includes(teamId);
  const canDelete = capabilities.team_delete_ids.includes(teamId);
  const canManageMembers = capabilities.team_member_manage_ids.includes(teamId);
  const canViewRoles = capabilities.team_role_view_ids.includes(teamId);
  const teamQuery = useQuery({
    queryKey: organizationQueryKeys.team(workspace.selectedOrgSlug, teamId),
    queryFn: () =>
      appsTeamsApiGetTeam({ team_id: teamId }, { skipErrorHandler: true }),
    enabled: Boolean(workspace.selectedOrgSlug && teamId),
  });
  const membersQuery = useQuery({
    queryKey: organizationQueryKeys.members(workspace.selectedOrgSlug, {
      page: memberPage,
      teamId,
    }),
    queryFn: () =>
      appsOrganizationsWorkspaceApiListWorkspaceMembers({
        page: memberPage,
        page_size: 20,
        team_id: teamId,
      }),
    enabled: Boolean(workspace.selectedOrgSlug && teamId),
  });
  const candidatesQuery = useQuery({
    queryKey: organizationQueryKeys.members(workspace.selectedOrgSlug, {
      page: 1,
      keyword: candidateKeyword,
    }),
    queryFn: () =>
      appsOrganizationsWorkspaceApiListWorkspaceMembers({
        page: 1,
        page_size: 20,
        keyword: candidateKeyword || undefined,
      }),
    enabled: Boolean(
      workspace.selectedOrgSlug && tab === 'members' && canManageMembers,
    ),
  });
  const responsibilitiesQuery = useQuery({
    queryKey: [
      'house',
      'staff-responsibilities',
      workspace.selectedOrgSlug,
      'team',
      teamId,
      responsibilityPage,
    ],
    queryFn: () =>
      houseApi.listStaffResponsibilities({
        page: responsibilityPage,
        page_size: 20,
        team_id: teamId,
      }),
    enabled: Boolean(workspace.selectedOrgSlug && tab === 'responsibilities'),
  });
  const responsibilitySummaryQuery = useQuery({
    queryKey: [
      'house',
      'staff-responsibilities',
      workspace.selectedOrgSlug,
      'team',
      teamId,
      'summary',
    ],
    queryFn: () =>
      appsHouseApiGetStaffResponsibilitySummary({ team_id: teamId }),
    enabled: Boolean(workspace.selectedOrgSlug && tab === 'responsibilities'),
  });

  useEffect(() => {
    missingHandledRef.current = false;
    setProfileEditing(false);
    setMemberPage(1);
    setResponsibilityPage(1);
  }, [teamId]);

  useEffect(() => {
    if (tab !== 'profile') setProfileEditing(false);
  }, [tab]);

  useEffect(() => {
    if (
      !teamQuery.isError ||
      !isNotFoundError(teamQuery.error) ||
      missingHandledRef.current
    )
      return;
    missingHandledRef.current = true;
    onMissing();
  }, [onMissing, teamQuery.error, teamQuery.isError]);

  const initialTeamValues = useMemo(
    () =>
      normalizeTeamFormValues(
        teamQuery.data
          ? {
              name: teamQuery.data.name,
              phone: teamQuery.data.phone,
              wechat: teamQuery.data.wechat,
              address: teamQuery.data.address,
              business_hours: teamQuery.data.business_hours,
            }
          : undefined,
      ),
    [teamQuery.data],
  );

  useEffect(() => {
    if (!teamQuery.data) return;
    form.setFieldsValue(initialTeamValues);
  }, [form, initialTeamValues, teamQuery.data]);

  const invalidateTeam = async () => {
    await Promise.all([
      workspace.queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.root(workspace.selectedOrgSlug),
      }),
      workspace.queryClient.invalidateQueries({
        queryKey: [
          'access',
          'role-management',
          'roles',
          workspace.selectedOrgSlug,
          `team:${teamId}`,
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
  const saveMutation = useMutation({
    mutationFn: (values: TeamFormValues) =>
      appsTeamsApiPatchTeam({ team_id: teamId }, values),
    onSuccess: async () => {
      message.success('团队资料已保存');
      await invalidateTeam();
      setProfileEditing(false);
    },
  });
  const resetTeamForm = useCallback(() => {
    form.resetFields();
    form.setFieldsValue(initialTeamValues);
    setProfileEditing(false);
  }, [form, initialTeamValues]);
  const saveTeamForm = useCallback(async () => {
    await saveMutation.mutateAsync(await form.validateFields());
  }, [form, saveMutation.mutateAsync]);
  const teamFormDirty =
    canUpdate &&
    profileEditing &&
    tab === 'profile' &&
    JSON.stringify(normalizeTeamFormValues(watchedTeamValues)) !==
      JSON.stringify(initialTeamValues);

  useEffect(() => {
    onDirtyStateChange?.({
      dirty: teamFormDirty,
      reset: resetTeamForm,
      save: saveTeamForm,
    });
  }, [onDirtyStateChange, resetTeamForm, saveTeamForm, teamFormDirty]);

  useEffect(
    () => () => onDirtyStateChange?.({ dirty: false, reset: () => undefined }),
    [onDirtyStateChange],
  );
  const deleteMutation = useMutation({
    mutationFn: () => appsTeamsApiDeleteTeam({ team_id: teamId }),
    onSuccess: async () => {
      message.success('团队已删除');
      await invalidateTeam();
      onDeleted();
    },
  });
  const memberMutation = useMutation({
    mutationFn: ({
      action,
      userId,
    }: {
      action: 'add' | 'remove';
      userId: number;
    }) =>
      action === 'add'
        ? appsTeamsApiAddTeamMember({ team_id: teamId, user_id: userId })
        : appsTeamsApiRemoveTeamMember({ team_id: teamId, user_id: userId }),
    onSuccess: async (_result, variables) => {
      message.success(
        variables.action === 'add' ? '成员已加入团队' : '成员已移出团队',
      );
      setCandidateMemberId(undefined);
      await invalidateTeam();
    },
  });
  const candidateOptions = (candidatesQuery.data?.items || [])
    .filter((member) => !member.teams.some((team) => team.id === teamId))
    .map((member) => ({
      value: member.user.id,
      label: `${getWorkspaceMemberEmployeeName(member) || formatPersonLabel(member.user)} (${member.user.email || member.user.username})`,
    }));

  const memberColumns: ProColumns<API.WorkspaceMemberOut>[] = useMemo(
    () => [
      {
        title: '成员',
        dataIndex: 'user',
        render: (_value, record) => (
          <Space>
            <Avatar src={record.user.avatar_url}>
              {(
                getWorkspaceMemberEmployeeName(record) ||
                formatPersonLabel(record.user)
              ).slice(0, 1)}
            </Avatar>
            <Space orientation="vertical" size={0}>
              <Typography.Text strong>
                {getWorkspaceMemberEmployeeName(record) ||
                  formatPersonLabel(record.user)}
              </Typography.Text>
              <Typography.Text type="secondary">
                {[
                  getWorkspaceMemberJobTitle(record),
                  record.user.email || record.user.username,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography.Text>
            </Space>
          </Space>
        ),
      },
      {
        title: '房源分工',
        dataIndex: 'has_responsibility',
        width: 120,
        align: 'center',
        render: (_value, record) => (
          <Tag color={record.has_responsibility ? 'success' : 'warning'}>
            {record.has_responsibility ? '已配置' : '未配置'}
          </Tag>
        ),
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 180,
        align: 'center',
        render: (_value, record) => (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => onOpenMember(record.member_id, 'profile')}
            >
              查看
            </Button>
            {canManageMembers ? (
              <Popconfirm
                title={`从团队移除 ${getWorkspaceMemberEmployeeName(record) || formatPersonLabel(record.user)}？`}
                description="不会移出组织或清理个人房源分工，但会清理该团队下的角色绑定。"
                okText="确认移除"
                onConfirm={() =>
                  memberMutation.mutateAsync({
                    action: 'remove',
                    userId: record.user.id,
                  })
                }
              >
                <Button
                  type="link"
                  danger
                  size="small"
                  aria-label={`移除 ${getWorkspaceMemberEmployeeName(record) || formatPersonLabel(record.user)}`}
                >
                  移除
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [canManageMembers, memberMutation, onOpenMember],
  );

  const responsibilityColumns: ProColumns<API.PropertyResponsibilityMemberOut>[] =
    [
      {
        title: '成员',
        dataIndex: 'user',
        render: (_value, record) => formatPersonLabel(record.user),
      },
      {
        title: '分工状态',
        dataIndex: 'responsibility',
        align: 'center',
        render: (_value, record) => (
          <Tag
            color={
              record.landlords.length ||
              record.buildings.length ||
              record.estates.length
                ? 'success'
                : 'warning'
            }
          >
            {record.landlords.length ||
            record.buildings.length ||
            record.estates.length
              ? '已配置'
              : '未配置'}
          </Tag>
        ),
      },
      {
        title: '负责房源',
        dataIndex: 'responsible_house_count',
        align: 'right',
        render: (_value, record) => `${record.responsible_house_count} 套`,
      },
      {
        title: '操作',
        dataIndex: 'actions',
        align: 'center',
        render: (_value, record) => (
          <Button
            type="link"
            size="small"
            onClick={() => onOpenMember(record.member_id, 'responsibilities')}
          >
            查看分工
          </Button>
        ),
      },
    ];

  if (teamQuery.isError) {
    if (isNotFoundError(teamQuery.error)) return <Card loading />;
    return (
      <Alert
        type="error"
        showIcon
        title="团队信息加载失败"
        description={(teamQuery.error as Error).message}
        action={<Button onClick={() => teamQuery.refetch()}>重试</Button>}
      />
    );
  }
  if (!teamQuery.data) return <Card loading />;
  const team = teamQuery.data;

  return (
    <Card>
      <Tabs
        activeKey={tab}
        onChange={(key) => onTabChange(key as TeamWorkspaceTab)}
        items={[
          {
            key: 'profile',
            label: '团队资料',
            children: (
              <Space
                orientation="vertical"
                size="large"
                style={{ width: '100%' }}
              >
                {profileEditing ? (
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={(values) => saveMutation.mutateAsync(values)}
                  >
                    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                      {TEAM_FIELDS.map((field) =>
                        field.name === 'business_hours' ? (
                          <BusinessHoursField key={field.name} />
                        ) : (
                          <Form.Item
                            key={field.name}
                            label={field.label}
                            name={field.name}
                            rules={
                              field.required
                                ? [
                                    {
                                      required: true,
                                      message: '请输入团队名称',
                                    },
                                  ]
                                : undefined
                            }
                          >
                            <Input placeholder={field.placeholder} />
                          </Form.Item>
                        ),
                      )}
                    </div>
                    <Space wrap>
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={saveMutation.isPending}
                      >
                        保存团队资料
                      </Button>
                      <Button onClick={resetTeamForm}>取消</Button>
                    </Space>
                  </Form>
                ) : (
                  <TeamProfileDetails
                    team={team}
                    canEdit={canUpdate}
                    onEdit={() => {
                      form.setFieldsValue(initialTeamValues);
                      setProfileEditing(true);
                    }}
                  />
                )}
                {canDelete ? (
                  <Collapse
                    size="small"
                    ghost
                    className={styles.dangerCollapse}
                    items={[
                      {
                        key: 'danger',
                        label: '危险操作',
                        children: (
                          <div className={styles.dangerActionPanel}>
                            <div className={styles.dangerActionCopy}>
                              <Typography.Text strong>删除团队</Typography.Text>
                              <Typography.Text type="secondary">
                                团队资料和团队角色将失效，组织成员及个人房源分工不受影响。
                              </Typography.Text>
                            </div>
                            <Popconfirm
                              title={`删除团队 ${team.name}？`}
                              description="团队资料不可恢复；组织成员和个人房源分工不会删除，但该团队角色会失效。"
                              okText="确认删除"
                              okButtonProps={{ danger: true }}
                              onConfirm={() => deleteMutation.mutateAsync()}
                            >
                              <Button
                                danger
                                icon={<DeleteOutlined />}
                                loading={deleteMutation.isPending}
                              >
                                删除团队
                              </Button>
                            </Popconfirm>
                          </div>
                        ),
                      },
                    ]}
                  />
                ) : null}
              </Space>
            ),
          },
          {
            key: 'members',
            label: '团队成员',
            children: (
              <Space
                orientation="vertical"
                size="middle"
                style={{ width: '100%' }}
              >
                {canManageMembers ? (
                  <Card size="small" title="添加成员">
                    <Space wrap>
                      <Select
                        showSearch={{
                          filterOption: false,
                          onSearch: setCandidateKeyword,
                        }}
                        aria-label="选择成员"
                        placeholder="搜索组织成员"
                        value={candidateMemberId}
                        onChange={setCandidateMemberId}
                        options={candidateOptions}
                        style={{ width: 320 }}
                      />
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        disabled={!candidateMemberId}
                        loading={memberMutation.isPending}
                        onClick={() =>
                          candidateMemberId &&
                          memberMutation.mutateAsync({
                            action: 'add',
                            userId: candidateMemberId,
                          })
                        }
                      >
                        添加成员
                      </Button>
                    </Space>
                  </Card>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    title="团队成员为只读"
                    description="当前角色没有该团队的成员管理权限。"
                  />
                )}
                {membersQuery.isError ? (
                  <Alert
                    type="error"
                    showIcon
                    title="团队成员加载失败"
                    description={(membersQuery.error as Error).message}
                    action={
                      <Button onClick={() => membersQuery.refetch()}>
                        重试
                      </Button>
                    }
                  />
                ) : (
                  <ProTable<API.WorkspaceMemberOut>
                    rowKey="member_id"
                    columns={memberColumns}
                    dataSource={membersQuery.data?.items || []}
                    loading={membersQuery.isLoading}
                    search={false}
                    options={false}
                    pagination={{
                      current: memberPage,
                      pageSize: 20,
                      total: membersQuery.data?.total || 0,
                      showSizeChanger: false,
                      onChange: setMemberPage,
                    }}
                    scroll={adminTableScroll}
                  />
                )}
              </Space>
            ),
          },
          {
            key: 'roles',
            label: '团队角色',
            children: canViewRoles ? (
              <RoleManagementPage
                embeddedScope={{
                  kind: 'team',
                  teamId,
                  teamName: team.name,
                }}
              />
            ) : (
              <Alert
                type="info"
                showIcon
                title="无法查看团队角色"
                description="当前角色缺少该团队的角色查看权限。"
              />
            ),
          },
          {
            key: 'responsibilities',
            label: '分工概览',
            children: (
              <Space
                orientation="vertical"
                size="middle"
                style={{ width: '100%' }}
              >
                <Alert
                  type="info"
                  showIcon
                  title="按成员口径汇总"
                  description="成员之间的房源负责范围可能重叠，合计数不是团队去重后的唯一覆盖房源数。"
                />
                {responsibilitySummaryQuery.isError ? (
                  <Alert
                    type="error"
                    showIcon
                    title="分工汇总加载失败"
                    action={
                      <Button
                        onClick={() => responsibilitySummaryQuery.refetch()}
                      >
                        重试
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Card
                      size="small"
                      loading={responsibilitySummaryQuery.isLoading}
                    >
                      <Statistic
                        title="成员负责房源合计"
                        value={
                          responsibilitySummaryQuery.data
                            ?.responsible_house_count_sum || 0
                        }
                        suffix="套"
                      />
                    </Card>
                    <Card
                      size="small"
                      loading={responsibilitySummaryQuery.isLoading}
                    >
                      <Statistic
                        title="已配置分工"
                        value={
                          responsibilitySummaryQuery.data
                            ?.configured_member_count || 0
                        }
                        suffix="人"
                      />
                    </Card>
                    <Card
                      size="small"
                      loading={responsibilitySummaryQuery.isLoading}
                    >
                      <Statistic
                        title="未配置分工"
                        value={
                          responsibilitySummaryQuery.data
                            ?.unconfigured_member_count || 0
                        }
                        suffix="人"
                      />
                    </Card>
                    <Card
                      size="small"
                      loading={responsibilitySummaryQuery.isLoading}
                    >
                      <Statistic
                        title="团队成员"
                        value={
                          responsibilitySummaryQuery.data?.member_count || 0
                        }
                        suffix="人"
                      />
                    </Card>
                  </div>
                )}
                {responsibilitiesQuery.isError ? (
                  <Alert
                    type="error"
                    showIcon
                    title="成员分工明细加载失败"
                    description={(responsibilitiesQuery.error as Error).message}
                    action={
                      <Button onClick={() => responsibilitiesQuery.refetch()}>
                        重试
                      </Button>
                    }
                  />
                ) : (
                  <ProTable<API.PropertyResponsibilityMemberOut>
                    rowKey="member_id"
                    columns={responsibilityColumns}
                    dataSource={responsibilitiesQuery.data?.items || []}
                    loading={responsibilitiesQuery.isLoading}
                    search={false}
                    options={false}
                    pagination={{
                      current: responsibilityPage,
                      pageSize: 20,
                      total: responsibilitiesQuery.data?.total || 0,
                      showSizeChanger: false,
                      onChange: setResponsibilityPage,
                    }}
                    scroll={adminTableScroll}
                  />
                )}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
};
