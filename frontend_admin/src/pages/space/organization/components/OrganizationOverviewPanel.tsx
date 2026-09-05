import {
  EditOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Col,
  Collapse,
  Descriptions,
  Flex,
  Form,
  Input,
  message,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import {
  AdminToolbar,
  fullWidthStyle,
  responsiveDescriptionColumns,
} from '@/pages/_shared/adminLayout';
import {
  formatPersonLabel,
  requireTenantSlug,
  tenantQueryKeys,
  useTenantWorkspace,
} from '@/pages/space/shared';
import { getWorkspaceMemberEmployeeName } from '@/services/manual/organizationMembers';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import {
  appsOrganizationsApiGetSettings,
  appsOrganizationsApiUpdateSettings,
} from '@/services/openapi/organizationProfile';
import {
  appsOrganizationsApiGetOrganization,
  appsOrganizationsApiPatchOrganization,
  appsOrganizationsApiPatchOrganizationStatus,
  appsOrganizationsApiTransferOwner,
} from '@/services/openapi/organizations';
import { setSelectedOrgSlug } from '@/utils/orgSelection';
import type { UnsavedWorkspaceRegistration } from '../hooks/useUnsavedWorkspaceGuard';
import { organizationQueryKeys } from '../queryKeys';
import { useStyles } from '../styles';
import {
  OrganizationWorkspaceCard,
  type OrganizationWorkspaceCardContext,
} from './OrganizationWorkspaceCard';

type OverviewTarget =
  | 'all'
  | 'teams'
  | 'ungrouped'
  | 'invites'
  | 'responsibilities';

type OrganizationProfileValues = {
  billing_email?: string;
  name: string;
  slug: string;
};

function normalizeProfileValues(
  values?: Partial<OrganizationProfileValues>,
): OrganizationProfileValues {
  return {
    billing_email: values?.billing_email?.trim() || '',
    name: values?.name?.trim() || '',
    slug: values?.slug?.trim() || '',
  };
}

export const OrganizationOverviewPanel: React.FC<{
  canCreateTeam: boolean;
  navigation: API.OrganizationNavigationOut;
  onOpen: (target: OverviewTarget) => void;
  onCreateTeam: () => void;
  onDirtyStateChange?: (state: UnsavedWorkspaceRegistration) => void;
  onInvite: () => void;
  workspaceCard: OrganizationWorkspaceCardContext;
}> = ({
  canCreateTeam,
  navigation,
  onCreateTeam,
  onDirtyStateChange,
  onInvite,
  onOpen,
  workspaceCard,
}) => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const [form] = Form.useForm<OrganizationProfileValues>();
  const watchedValues = Form.useWatch([], form);
  const [editing, setEditing] = useState(false);
  const [dangerExpanded, setDangerExpanded] = useState(false);
  const [transferUserId, setTransferUserId] = useState<number>();
  const isOwner = workspace.appContext?.org?.is_owner === true;
  const ownershipResolved = Boolean(workspace.appContext?.org);
  const detailQuery = useQuery({
    queryKey: tenantQueryKeys.organizationDetail(workspace.selectedOrgSlug),
    queryFn: () =>
      appsOrganizationsApiGetOrganization({
        slug: requireTenantSlug(workspace.selectedOrgSlug),
      }),
    enabled: Boolean(workspace.selectedOrgSlug && isOwner),
  });
  const profileQuery = useQuery({
    queryKey: tenantQueryKeys.organizationProfile(workspace.selectedOrgSlug),
    queryFn: () => appsOrganizationsApiGetSettings(),
    enabled: Boolean(workspace.selectedOrgSlug && isOwner),
  });
  const membersQuery = useQuery({
    queryKey: [
      'tenant',
      'members',
      'owner-transfer',
      workspace.selectedOrgSlug,
    ],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug && isOwner && dangerExpanded),
  });
  const initialProfileValues = useMemo(
    () =>
      normalizeProfileValues({
        name: detailQuery.data?.name || navigation.organization.name,
        slug: detailQuery.data?.slug || navigation.organization.slug,
        billing_email:
          profileQuery.data?.billing_email ||
          detailQuery.data?.billing_email ||
          '',
      }),
    [detailQuery.data, navigation.organization, profileQuery.data],
  );

  useEffect(() => {
    if (editing) return;
    form.setFieldsValue(initialProfileValues);
  }, [editing, form, initialProfileValues]);

  const saveMutation = useMutation({
    mutationFn: async (values: OrganizationProfileValues) => {
      const payload = normalizeProfileValues(values);
      const updated = await appsOrganizationsApiPatchOrganization(
        { slug: requireTenantSlug(workspace.selectedOrgSlug) },
        payload,
      );
      await appsOrganizationsApiUpdateSettings({
        billing_email: payload.billing_email || null,
      });
      return updated;
    },
    onSuccess: async (updated) => {
      const previousSlug = workspace.selectedOrgSlug;
      const nextSlug = setSelectedOrgSlug(updated.slug);
      form.setFieldsValue(
        normalizeProfileValues({
          name: updated.name,
          slug: updated.slug,
          billing_email: updated.billing_email || '',
        }),
      );
      setEditing(false);
      workspace.setInitialState((state: any) => ({
        ...state,
        selectedOrgSlug: nextSlug,
        organizations: (state?.organizations || []).map(
          (item: API.SwitchListItemOut) =>
            item.slug === previousSlug
              ? { ...item, name: updated.name, slug: updated.slug }
              : item,
        ),
      }));
      await Promise.all([
        workspace.queryClient.invalidateQueries({
          queryKey: tenantQueryKeys.appContext(nextSlug),
        }),
        workspace.queryClient.invalidateQueries({
          queryKey: tenantQueryKeys.organizationDetail(nextSlug),
        }),
        workspace.queryClient.invalidateQueries({
          queryKey: tenantQueryKeys.organizationProfile(nextSlug),
        }),
        workspace.queryClient.invalidateQueries({
          queryKey: tenantQueryKeys.organizations,
        }),
        workspace.queryClient.invalidateQueries({
          queryKey: organizationQueryKeys.root(nextSlug),
        }),
      ]);
      message.success('组织资料已保存');
    },
  });
  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      appsOrganizationsApiPatchOrganizationStatus(
        { slug: requireTenantSlug(workspace.selectedOrgSlug) },
        { is_active: isActive },
      ),
    onSuccess: async (_updated, isActive) => {
      message.success(isActive ? '组织已恢复' : '组织已归档');
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.organizationDetail(workspace.selectedOrgSlug),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.appContext(workspace.selectedOrgSlug),
      });
    },
  });
  const transferMutation = useMutation({
    mutationFn: (userId: number) =>
      appsOrganizationsApiTransferOwner(
        { slug: requireTenantSlug(workspace.selectedOrgSlug) },
        { user: userId },
      ),
    onSuccess: async () => {
      setTransferUserId(undefined);
      setDangerExpanded(false);
      message.success('所有者已转移');
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.appContext(workspace.selectedOrgSlug),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.root(workspace.selectedOrgSlug),
      });
    },
  });

  const resetProfileForm = useCallback(() => {
    form.resetFields();
    form.setFieldsValue(initialProfileValues);
    setEditing(false);
  }, [form, initialProfileValues]);
  const saveProfileForm = useCallback(async () => {
    await saveMutation.mutateAsync(await form.validateFields());
  }, [form, saveMutation.mutateAsync]);
  const profileDirty =
    editing &&
    JSON.stringify(normalizeProfileValues(watchedValues)) !==
      JSON.stringify(initialProfileValues);

  useEffect(() => {
    onDirtyStateChange?.({
      dirty: profileDirty,
      reset: resetProfileForm,
      save: saveProfileForm,
    });
  }, [onDirtyStateChange, profileDirty, resetProfileForm, saveProfileForm]);

  useEffect(
    () => () => onDirtyStateChange?.({ dirty: false, reset: () => undefined }),
    [onDirtyStateChange],
  );

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.items || [])
        .filter((item) => item.user.id !== workspace.appContext?.user?.id)
        .map((item) => ({
          label:
            getWorkspaceMemberEmployeeName(item) ||
            formatPersonLabel(item.user),
          value: item.user.id,
        })),
    [membersQuery.data, workspace.appContext?.user?.id],
  );
  const items = [
    {
      id: 'members',
      key: 'all' as const,
      label: '组织成员',
      value: navigation.member_count,
      suffix: '人',
      icon: 'member',
    },
    {
      id: 'owners',
      key: 'all' as const,
      label: '所有者',
      value: navigation.owner_count,
      suffix: '人',
      icon: 'member',
    },
    {
      id: 'teams',
      key: 'teams' as const,
      label: '团队',
      value: navigation.team_count,
      suffix: '个',
      icon: 'team',
    },
    {
      id: 'ungrouped',
      key: 'ungrouped' as const,
      label: '未分组成员',
      value: navigation.ungrouped_member_count,
      suffix: '人',
      icon: 'member',
    },
    ...(navigation.pending_invite_count === null
      ? []
      : [
          {
            key: 'invites' as const,
            id: 'invites',
            label: '待加入',
            value: navigation.pending_invite_count,
            suffix: '项',
            icon: 'organization-invite',
          },
        ]),
    {
      key: 'responsibilities' as const,
      id: 'responsibilities',
      label: '未配置房源分工',
      value: navigation.unassigned_responsibility_count,
      suffix: '人',
      icon: 'member',
    },
  ];

  const actions =
    canCreateTeam || workspaceCard.canManageInvites ? (
      <AdminToolbar>
        {canCreateTeam ? (
          <Button icon={<PlusOutlined />} onClick={onCreateTeam}>
            新建团队
          </Button>
        ) : null}
        {workspaceCard.canManageInvites ? (
          <Button type="primary" icon={<UserAddOutlined />} onClick={onInvite}>
            邀请成员
          </Button>
        ) : null}
      </AdminToolbar>
    ) : undefined;

  return (
    <OrganizationWorkspaceCard {...workspaceCard} actions={actions}>
      <Flex
        align="center"
        justify="space-between"
        gap="small"
        style={{ marginBottom: 12 }}
      >
        <Typography.Text strong>组织资料</Typography.Text>
        {isOwner ? (
          editing ? (
            <Space>
              <Button onClick={resetProfileForm}>取消</Button>
              <Button
                type="primary"
                loading={saveMutation.isPending}
                onClick={() => void saveProfileForm()}
              >
                保存资料
              </Button>
            </Space>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={detailQuery.isLoading || profileQuery.isLoading}
              onClick={() => setEditing(true)}
            >
              编辑资料
            </Button>
          )
        ) : null}
      </Flex>
      {isOwner && (detailQuery.isLoading || profileQuery.isLoading) ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : isOwner && (detailQuery.isError || profileQuery.isError) ? (
        <Alert
          type="error"
          showIcon
          title="组织资料加载失败"
          description="组织统计仍可使用，你可以重新加载资料。"
          action={
            <Button
              onClick={() => {
                void detailQuery.refetch();
                void profileQuery.refetch();
              }}
            >
              重新加载
            </Button>
          }
          style={{ marginBottom: 20 }}
        />
      ) : editing ? (
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="组织名称"
                name="name"
                rules={[{ required: true, message: '请输入组织名称' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="组织标识"
                name="slug"
                extra="修改后组织相关地址会同步变化。"
                rules={[{ required: true, message: '请输入组织标识' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="账单邮箱"
                name="billing_email"
                rules={[{ type: 'email', message: '请输入有效邮箱' }]}
              >
                <Input placeholder="name@example.com" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ) : (
        <Descriptions
          bordered
          size="small"
          column={responsiveDescriptionColumns}
          style={{ marginBottom: 20 }}
        >
          <Descriptions.Item label="组织名称">
            {detailQuery.data?.name || navigation.organization.name}
          </Descriptions.Item>
          <Descriptions.Item label="组织标识">
            {detailQuery.data?.slug || navigation.organization.slug}
          </Descriptions.Item>
          <Descriptions.Item label="账单邮箱">
            {!ownershipResolved
              ? '正在加载…'
              : isOwner
                ? profileQuery.data?.billing_email ||
                  detailQuery.data?.billing_email ||
                  '未设置'
                : '仅所有者可查看'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {!ownershipResolved
              ? '正在加载…'
              : isOwner
                ? detailQuery.data?.is_active === false
                  ? '已归档'
                  : '正常'
                : '仅所有者可查看'}
          </Descriptions.Item>
        </Descriptions>
      )}
      <Typography.Paragraph type="secondary">
        查看组织治理概况，并直接进入需要处理的成员、团队、邀请或房源分工。
      </Typography.Paragraph>
      <div className={styles.summaryGrid}>
        {items.map((item) => (
          <button
            className={styles.summaryButton}
            key={item.id}
            onClick={() => onOpen(item.key)}
            type="button"
          >
            <Typography.Text type="secondary">
              <AppIcon name={item.icon} style={{ marginRight: 8 }} />
              {item.label}
            </Typography.Text>
            <div>
              <Typography.Title level={3} style={{ margin: '8px 0 0' }}>
                {item.value}{' '}
                <Typography.Text type="secondary">
                  {item.suffix}
                </Typography.Text>
              </Typography.Title>
            </div>
          </button>
        ))}
      </div>
      {isOwner && !editing ? (
        <Collapse
          ghost
          className={styles.dangerCollapse}
          activeKey={dangerExpanded ? ['danger'] : []}
          onChange={(keys) =>
            setDangerExpanded(
              (Array.isArray(keys) ? keys : [keys]).includes('danger'),
            )
          }
          items={[
            {
              key: 'danger',
              label: (
                <Space size="small">
                  <ExclamationCircleOutlined />
                  危险操作
                </Space>
              ),
              children: (
                <Space orientation="vertical" size={12} style={fullWidthStyle}>
                  <div className={styles.dangerActionPanel}>
                    <div className={styles.dangerActionCopy}>
                      <Typography.Text strong>
                        {detailQuery.data?.is_active === false
                          ? '恢复组织'
                          : '归档组织'}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {detailQuery.data?.is_active === false
                          ? '恢复后组织可以继续正常开展业务。'
                          : '归档后组织将视为停用，但不会删除已有数据。'}
                      </Typography.Text>
                    </div>
                    <Popconfirm
                      title={
                        detailQuery.data?.is_active === false
                          ? '恢复当前组织？'
                          : '归档当前组织？'
                      }
                      description={
                        detailQuery.data?.is_active === false
                          ? '恢复后组织将重新启用。'
                          : '归档不会删除数据，之后仍可由所有者恢复。'
                      }
                      okText={
                        detailQuery.data?.is_active === false
                          ? '确认恢复'
                          : '确认归档'
                      }
                      onConfirm={() =>
                        statusMutation.mutateAsync(
                          detailQuery.data?.is_active === false,
                        )
                      }
                    >
                      <Button
                        danger={detailQuery.data?.is_active !== false}
                        loading={statusMutation.isPending}
                      >
                        {detailQuery.data?.is_active === false
                          ? '恢复组织'
                          : '归档组织'}
                      </Button>
                    </Popconfirm>
                  </div>
                  <div className={styles.dangerActionPanel}>
                    <div className={styles.dangerActionCopy}>
                      <Typography.Text strong>转移所有者</Typography.Text>
                      <Typography.Text type="secondary">
                        转移后你将失去组织资料和危险操作的管理权限。
                      </Typography.Text>
                    </div>
                    <Space wrap>
                      <Select
                        allowClear
                        showSearch={{ optionFilterProp: 'label' }}
                        placeholder="选择新所有者"
                        loading={membersQuery.isLoading}
                        value={transferUserId}
                        options={memberOptions}
                        style={{ width: 220 }}
                        onChange={setTransferUserId}
                      />
                      <Popconfirm
                        title="确认转移所有者？"
                        description="转移后你将不再拥有当前组织的所有者权限。"
                        okText="确认转移"
                        disabled={!transferUserId}
                        onConfirm={() =>
                          transferUserId &&
                          transferMutation.mutateAsync(transferUserId)
                        }
                      >
                        <Button
                          danger
                          disabled={!transferUserId}
                          loading={transferMutation.isPending}
                        >
                          转移所有者
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>
                </Space>
              ),
            },
          ]}
        />
      ) : null}
    </OrganizationWorkspaceCard>
  );
};
