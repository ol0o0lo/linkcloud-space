import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Alert, Empty, Typography } from 'antd';
import React from 'react';
import { appsBaseApiAppContext } from '@/services/openapi/appSystem';
import {
  appsOrganizationsApiSelectOrg,
  appsOrganizationsApiSignout,
  appsOrganizationsApiSwitchList,
} from '@/services/openapi/organizations';
import { setSelectedOrgSlug } from '@/utils/orgSelection';

export const tenantQueryKeys = {
  appContext: (slug?: string) => ['tenant', 'app-context', slug],
  organizations: ['tenant', 'organizations'],
  organizationDetail: (slug?: string) => ['tenant', 'organization-detail', slug],
  organizationProfile: (slug?: string) => ['tenant', 'organization-profile', slug],
  members: (slug?: string, page?: number, q?: string) => ['tenant', 'members', slug, page, q],
  invites: (slug?: string, page?: number) => ['tenant', 'invites', slug, page],
  teams: (slug?: string, page?: number, q?: string) => ['tenant', 'teams', slug, page, q],
  usage: (slug?: string) => ['tenant', 'usage', slug],
};

type TenantState = {
  organizations?: API.SwitchListItemOut[];
  selectedOrgSlug?: string;
};

function updateSelectedOrgState(
  setInitialState: (updater: (state: TenantState | undefined) => TenantState) => void,
  slug?: string,
  organizations?: API.SwitchListItemOut[],
) {
  setInitialState((state) => {
    const nextOrganizations = (organizations || state?.organizations || []).map((item) => ({
      ...item,
      is_current: Boolean(slug) && item.slug === slug,
    }));

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

  const organizations = organizationsQuery.data || initialState?.organizations || [];
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
      await queryClient.invalidateQueries({ queryKey: tenantQueryKeys.appContext(slug) });
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

export const TenantSelectionGuard: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => {
  const workspace = useTenantWorkspace();

  if (workspace.organizationsQuery.isLoading && workspace.organizations.length === 0) {
    return <PageContainer title={title} subTitle={subtitle} loading />;
  }

  if (workspace.organizations.length === 0) {
    return (
      <PageContainer title={title} subTitle={subtitle}>
        <Empty description="当前用户还没有可用空间，请先在空间概览中创建空间。" />
      </PageContainer>
    );
  }

  if (!workspace.selectedOrgSlug || !workspace.selectedOrganization) {
    return (
      <PageContainer title={title} subTitle={subtitle}>
        <Alert type="warning" title="尚未选择空间，请在右上角空间切换器中选择。" showIcon />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={title} subTitle={subtitle}>
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

  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email || '未知用户';
}

export const TenantSectionHint: React.FC<{ text: string }> = ({ text }) => (
  <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
    {text}
  </Typography.Paragraph>
);

export function requireTenantSlug(slug?: string) {
  if (!slug) {
    throw new Error('Tenant slug is required.');
  }
  return slug;
}
