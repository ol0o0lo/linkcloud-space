import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useModel } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import {
  getNavigationAccessCapabilities,
  type NavigationAccessCapabilities,
} from '@/services/manual/navigationAccess';
import {
  getTeamOperationsCapabilities,
  type TeamOperationsCapabilities,
} from '@/services/manual/teamOperations';
import { appsBaseApiAppContext } from '@/services/openapi/appSystem';
import {
  appsOrganizationsApiCreateOrganization,
  appsOrganizationsApiSelectOrg,
  appsOrganizationsApiSignout,
  appsOrganizationsApiSwitchList,
} from '@/services/openapi/organizations';
import { setSelectedOrgSlug } from '@/utils/orgSelection';

export const tenantQueryKeys = {
  appContext: (slug?: string) => ['tenant', 'app-context', slug],
  organizations: ['tenant', 'organizations'],
  organizationDetail: (slug?: string) => [
    'tenant',
    'organization-detail',
    slug,
  ],
  organizationProfile: (slug?: string) => [
    'tenant',
    'organization-profile',
    slug,
  ],
  members: (slug?: string, page?: number, q?: string) => [
    'tenant',
    'members',
    slug,
    page,
    q,
  ],
  invites: (slug?: string, page?: number) => ['tenant', 'invites', slug, page],
  teams: (slug?: string, page?: number, q?: string) => [
    'tenant',
    'teams',
    slug,
    page,
    q,
  ],
  usage: (slug?: string) => ['tenant', 'usage', slug],
};

type TenantState = {
  organizations?: API.SwitchListItemOut[];
  selectedOrgSlug?: string;
  teamOperationsCapabilities?: TeamOperationsCapabilities;
  navigationCapabilities?: NavigationAccessCapabilities;
};

function updateSelectedOrgState(
  setInitialState: (
    updater: (state: TenantState | undefined) => TenantState,
  ) => void,
  slug?: string,
  organizations?: API.SwitchListItemOut[],
) {
  setInitialState((state) => {
    const nextOrganizations = (organizations || state?.organizations || []).map(
      (item) => ({
        ...item,
        is_current: Boolean(slug) && item.slug === slug,
      }),
    );

    return {
      ...state,
      organizations: nextOrganizations,
      selectedOrgSlug: slug,
    };
  });
}

export function useTenantWorkspace() {
  const queryClient = useQueryClient();
  const { initialState, setInitialState } = useModel('@@initialState');

  const organizationsQuery = useQuery({
    queryKey: tenantQueryKeys.organizations,
    queryFn: () => appsOrganizationsApiSwitchList(),
  });

  const organizations =
    organizationsQuery.data || initialState?.organizations || [];
  const selectedOrgSlug = initialState?.selectedOrgSlug;
  const selectedOrganization =
    organizations.find((item) => item.slug === selectedOrgSlug) ||
    organizations.find((item) => item.is_current) ||
    null;

  const appContextQuery = useQuery({
    queryKey: tenantQueryKeys.appContext(selectedOrgSlug),
    queryFn: () => appsBaseApiAppContext(),
    enabled: Boolean(selectedOrgSlug),
  });

  const selectMutation = useMutation({
    mutationFn: async (slug: string) => {
      await appsOrganizationsApiSelectOrg({ slug });
      return slug;
    },
    onSuccess: async (slug) => {
      const storedSlug = setSelectedOrgSlug(slug);
      const nextOrganizations = await queryClient.fetchQuery({
        queryKey: tenantQueryKeys.organizations,
        queryFn: () => appsOrganizationsApiSwitchList(),
      });
      updateSelectedOrgState(setInitialState, storedSlug, nextOrganizations);
      await queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.appContext(slug),
      });
    },
  });

  const signoutMutation = useMutation({
    mutationFn: () => appsOrganizationsApiSignout(),
    onSuccess: async () => {
      const storedSlug = setSelectedOrgSlug(undefined);
      const nextOrganizations = await queryClient.fetchQuery({
        queryKey: tenantQueryKeys.organizations,
        queryFn: () => appsOrganizationsApiSwitchList(),
      });
      updateSelectedOrgState(setInitialState, storedSlug, nextOrganizations);
      await queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
  });

  return {
    appContext: appContextQuery.data,
    organizations,
    organizationsQuery,
    selectedOrgSlug,
    selectedOrganization,
    selectOrg: selectMutation.mutateAsync,
    selectOrgLoading: selectMutation.isPending,
    signoutOrg: signoutMutation.mutateAsync,
    signoutLoading: signoutMutation.isPending,
    setInitialState,
    queryClient,
  };
}

function getRequestErrorMessage(error: any, fallback: string) {
  const detail =
    error?.response?.data?.errors?.[0]?.message ||
    error?.data?.errors?.[0]?.message;
  return String(
    detail ||
      error?.response?.data?.message ||
      error?.data?.message ||
      error?.message ||
      fallback,
  );
}

const CreateOrganizationButton: React.FC<{
  workspace: ReturnType<typeof useTenantWorkspace>;
}> = ({ workspace }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<API.OrganizationCreateIn>();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const createMutation = useMutation({
    mutationFn: (values: API.OrganizationCreateIn) =>
      appsOrganizationsApiCreateOrganization({
        name: values.name.trim(),
        slug: values.slug.trim().toLowerCase(),
      }),
    onSuccess: async (created) => {
      const [organizations, teamOperationsResult, navigationResult] =
        await Promise.all([
          workspace.queryClient.fetchQuery({
            queryKey: tenantQueryKeys.organizations,
            queryFn: () => appsOrganizationsApiSwitchList(),
          }),
          getTeamOperationsCapabilities().catch(() => undefined),
          getNavigationAccessCapabilities().catch(() => undefined),
        ]);
      const storedSlug = setSelectedOrgSlug(created.slug);
      workspace.setInitialState((state) => ({
        ...state,
        organizations: organizations.map((item) => ({
          ...item,
          is_current: item.slug === storedSlug,
        })),
        selectedOrgSlug: storedSlug,
        teamOperationsCapabilities: teamOperationsResult,
        navigationCapabilities: navigationResult,
      }));
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant'] });
      form.resetFields();
      setErrorMessage('');
      setOpen(false);
      message.success(`空间「${created.name}」已创建`);
    },
    onError: (error) => {
      setErrorMessage(
        getRequestErrorMessage(error, '空间创建失败，请检查填写内容后重试。'),
      );
    },
  });

  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)}>
        创建空间
      </Button>
      <Modal
        open={open}
        title="创建空间"
        okText="创建空间"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        destroyOnHidden
        onCancel={() => {
          setOpen(false);
          setErrorMessage('');
          form.resetFields();
        }}
        onOk={() => void form.submit()}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            创建后你将成为空间所有者，并自动进入新空间。
          </Typography.Text>
          {errorMessage ? (
            <Alert type="error" showIcon title={errorMessage} />
          ) : null}
          <Form
            form={form}
            layout="vertical"
            preserve={false}
            onFinish={(values) => createMutation.mutate(values)}
          >
            <Form.Item
              label="空间名称"
              name="name"
              rules={[
                { required: true, message: '请输入空间名称' },
                { max: 75, message: '空间名称最多 75 个字符' },
              ]}
            >
              <Input autoFocus placeholder="例如：链云深圳运营中心" />
            </Form.Item>
            <Form.Item
              label="空间标识"
              name="slug"
              extra="用于空间切换和链接，只能包含小写字母、数字、下划线或连字符。"
              normalize={(value) => String(value || '').toLowerCase()}
              rules={[
                { required: true, message: '请输入空间标识' },
                { max: 40, message: '空间标识最多 40 个字符' },
                {
                  pattern: /^[a-z0-9_-]+$/,
                  message: '仅支持小写字母、数字、下划线或连字符',
                },
              ]}
            >
              <Input placeholder="例如：linkcloud-shenzhen" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </>
  );
};

export const TenantSelectionGuard: React.FC<{
  title: React.ReactNode | false;
  extra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, extra, children }) => {
  const workspace = useTenantWorkspace();

  if (
    workspace.organizationsQuery.isLoading &&
    workspace.organizations.length === 0
  ) {
    return <PageContainer title={title} loading />;
  }

  if (workspace.organizations.length === 0) {
    return (
      <PageContainer title={title} extra={extra}>
        <Empty description="当前用户还没有可用空间，可以创建新空间或通过邀请加入。">
          <CreateOrganizationButton workspace={workspace} />
        </Empty>
      </PageContainer>
    );
  }

  if (!workspace.selectedOrgSlug || !workspace.selectedOrganization) {
    return (
      <PageContainer title={title}>
        <Alert
          type="warning"
          title="尚未选择空间，请在右上角空间切换器中选择。"
          showIcon
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={title} extra={extra}>
      {children}
    </PageContainer>
  );
};

export function formatPersonLabel(user?: {
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
}) {
  if (!user) {
    return '未知用户';
  }

  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    user.email ||
    '未知用户'
  );
}

export function requireTenantSlug(slug?: string) {
  if (!slug) {
    throw new Error('Tenant slug is required.');
  }
  return slug;
}
