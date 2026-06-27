import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { fullWidthStyle } from '@/pages/_shared/adminLayout';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import {
  appsOrganizationsApiGetSettings,
  appsOrganizationsApiUpdateSettings,
} from '@/services/openapi/organizationProfile';
import {
  appsOrganizationsApiGetOrganization,
  appsOrganizationsApiGetOrganizationUsage,
  appsOrganizationsApiPatchOrganization,
  appsOrganizationsApiPatchOrganizationStatus,
  appsOrganizationsApiTransferOwner,
} from '@/services/openapi/organizations';
import { setSelectedOrgSlug } from '@/utils/orgSelection';
import {
  formatPersonLabel,
  requireTenantSlug,
  TenantSelectionGuard,
  tenantQueryKeys,
  useTenantWorkspace,
} from '../shared';

function formatLimitLabel(used: number, limit?: number | null) {
  if (!limit) {
    return `${used} / 不限`;
  }
  return `${used} / ${limit}`;
}

const TenantSettingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [form] = Form.useForm();
  const [statusValue, setStatusValue] = useState(true);
  const [transferUserId, setTransferUserId] = useState<number>();

  const detailQuery = useQuery({
    queryKey: tenantQueryKeys.organizationDetail(workspace.selectedOrgSlug),
    queryFn: () =>
      appsOrganizationsApiGetOrganization({
        slug: requireTenantSlug(workspace.selectedOrgSlug),
      }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const profileQuery = useQuery({
    queryKey: tenantQueryKeys.organizationProfile(workspace.selectedOrgSlug),
    queryFn: () => appsOrganizationsApiGetSettings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const usageQuery = useQuery({
    queryKey: tenantQueryKeys.usage(workspace.selectedOrgSlug),
    queryFn: () =>
      appsOrganizationsApiGetOrganizationUsage({
        slug: requireTenantSlug(workspace.selectedOrgSlug),
      }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const membersQuery = useQuery({
    queryKey: [
      'tenant',
      'members',
      'owner-transfer',
      workspace.selectedOrgSlug,
    ],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    form.setFieldsValue({
      name: detailQuery.data.name,
      slug: detailQuery.data.slug,
      billing_email:
        profileQuery.data?.billing_email ??
        detailQuery.data.billing_email ??
        '',
      member_limit: detailQuery.data.member_limit ?? undefined,
      team_limit: detailQuery.data.team_limit ?? undefined,
    });
    setStatusValue(detailQuery.data.is_active);
  }, [detailQuery.data, form, profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: API.OrganizationPatchIn) => {
      const updated = await appsOrganizationsApiPatchOrganization(
        { slug: requireTenantSlug(workspace.selectedOrgSlug) },
        payload,
      );
      await appsOrganizationsApiUpdateSettings({
        billing_email: payload.billing_email ?? null,
      });
      return updated;
    },
    onSuccess: async (updated) => {
      const nextSlug = setSelectedOrgSlug(updated.slug);
      workspace.setInitialState((state: any) => ({
        ...state,
        selectedOrgSlug: nextSlug,
        organizations: (state?.organizations || []).map(
          (item: API.SwitchListItemOut) =>
            item.slug === workspace.selectedOrgSlug
              ? { ...item, name: updated.name, slug: updated.slug }
              : item,
        ),
      }));
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.appContext(nextSlug),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.organizationDetail(nextSlug),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.organizationProfile(nextSlug),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.organizations,
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.usage(nextSlug),
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      appsOrganizationsApiPatchOrganizationStatus(
        { slug: requireTenantSlug(workspace.selectedOrgSlug) },
        { is_active: isActive },
      ),
    onSuccess: async (_updated, isActive) => {
      setStatusValue(isActive);
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.organizationDetail(workspace.selectedOrgSlug),
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
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'members'],
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: tenantQueryKeys.appContext(workspace.selectedOrgSlug),
      });
    },
  });

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.items || []).map((item) => ({
        label: formatPersonLabel(item.user),
        value: item.user.id,
      })),
    [membersQuery.data],
  );

  const usage = usageQuery.data;
  const memberCount = usage?.member_count || 0;
  const teamCount = usage?.team_count || 0;
  const memberLimit =
    usage?.member_limit ?? detailQuery.data?.member_limit ?? null;
  const teamLimit = usage?.team_limit ?? detailQuery.data?.team_limit ?? null;

  return (
    <TenantSelectionGuard title="空间资料">
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            title="基础资料"
            loading={
              detailQuery.isLoading ||
              profileQuery.isLoading ||
              usageQuery.isLoading
            }
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={(values) => saveMutation.mutate(values)}
            >
              <Form.Item
                label="空间名称"
                name="name"
                rules={[{ required: true, message: '请输入空间名称' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Slug"
                name="slug"
                rules={[{ required: true, message: '请输入 slug' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label="账单邮箱" name="billing_email">
                <Input />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="成员上限"
                    name="member_limit"
                    extra={`当前使用：成员 ${formatLimitLabel(memberCount, memberLimit)}`}
                  >
                    <InputNumber
                      min={1}
                      style={fullWidthStyle}
                      placeholder="留空表示不限"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="团队上限"
                    name="team_limit"
                    extra={`当前使用：团队 ${formatLimitLabel(teamCount, teamLimit)}`}
                  >
                    <InputNumber
                      min={1}
                      style={fullWidthStyle}
                      placeholder="留空表示不限"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Button
                type="primary"
                htmlType="submit"
                loading={saveMutation.isPending}
              >
                保存空间资料
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="风险操作" loading={membersQuery.isLoading}>
            <Space orientation="vertical" size={20} style={{ width: '100%' }}>
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Text strong>租户启用状态</Typography.Text>
                <Space align="center">
                  <Switch
                    checked={statusValue}
                    checkedChildren="启用"
                    unCheckedChildren="归档"
                    loading={statusMutation.isPending}
                    onChange={(checked) =>
                      void statusMutation.mutateAsync(checked)
                    }
                  />
                  <Typography.Text type="secondary">
                    {statusValue
                      ? '当前空间正常对外运转。'
                      : '当前空间已归档，业务应视为停用。'}
                  </Typography.Text>
                </Space>
              </Space>
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Text strong>Owner 转移</Typography.Text>
                <Select
                  allowClear
                  placeholder="选择新 owner"
                  style={fullWidthStyle}
                  value={transferUserId}
                  options={memberOptions}
                  onChange={(value) => setTransferUserId(value)}
                />
                <Button
                  block
                  type="primary"
                  loading={transferMutation.isPending}
                  disabled={!transferUserId}
                  onClick={() =>
                    transferUserId &&
                    void transferMutation.mutateAsync(transferUserId)
                  }
                >
                  转移 Owner
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>
    </TenantSelectionGuard>
  );
};

export default TenantSettingsPage;
