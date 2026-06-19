import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, Col, Descriptions, Form, Input, Modal, Row, Space, Statistic, Tag, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, fullWidthStyle, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsOrganizationsApiCreateOrganization, appsOrganizationsApiGetOrganizationUsage, appsOrganizationsApiSetPrimary } from '@/services/openapi/organizations';
import { TenantSectionHint, requireTenantSlug, useTenantWorkspace } from '../shared';

const OverviewPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<API.OrganizationCreateIn>();

  const usageQuery = useQuery({
    queryKey: ['tenant', 'usage', workspace.selectedOrgSlug],
    queryFn: () => appsOrganizationsApiGetOrganizationUsage({ slug: requireTenantSlug(workspace.selectedOrgSlug) }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.OrganizationCreateIn) => appsOrganizationsApiCreateOrganization(payload),
    onSuccess: async (created) => {
      setCreateOpen(false);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'organizations'] });
      await workspace.selectOrg(created.slug);
    },
  });

  const primaryMutation = useMutation({
    mutationFn: (slug: string) => appsOrganizationsApiSetPrimary({ slug }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'organizations'] });
    },
  });

  const organizationCards = useMemo(
    () =>
      workspace.organizations.map((item) => (
        <Col xs={24} md={12} xl={8} key={item.slug}>
          <Card
            title={
              <Space wrap style={{ minWidth: 0 }}>
                <span style={wrapTextStyle}>{item.name}</span>
                {item.is_current ? <Tag color="blue">当前</Tag> : null}
                {item.is_primary ? <Tag color="gold">主租户</Tag> : null}
              </Space>
            }
            extra={<Typography.Text type="secondary" style={wrapTextStyle}>{item.slug}</Typography.Text>}
          >
            <Space wrap>
              <a onClick={() => void workspace.selectOrg(item.slug)}>设为当前租户</a>
              {!item.is_primary ? <a onClick={() => void primaryMutation.mutateAsync(item.slug)}>设为主租户</a> : null}
            </Space>
          </Card>
        </Col>
      )),
    [primaryMutation, workspace],
  );

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card title="当前租户" extra={<AdminToolbar><a onClick={() => setCreateOpen(true)}>创建租户</a></AdminToolbar>}>
            {workspace.selectedOrganization ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="名称"><span style={wrapTextStyle}>{workspace.selectedOrganization.name}</span></Descriptions.Item>
                <Descriptions.Item label="Slug"><span style={wrapTextStyle}>{workspace.selectedOrganization.slug}</span></Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Space>
                    <Tag color="blue">已选择</Tag>
                    {workspace.selectedOrganization.is_primary ? <Tag color="gold">主租户</Tag> : null}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Typography.Text type="secondary">当前没有已选择租户。</Typography.Text>
            )}
            {workspace.selectedOrganization ? (
              <Space style={{ marginTop: 16 }}>
                <a onClick={() => void workspace.signoutOrg()}>退出当前租户</a>
              </Space>
            ) : null}
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title="租户用量">
            <TenantSectionHint text="成员和团队上限来自后端租户限制配置。" />
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Statistic
                  title="成员数"
                  loading={usageQuery.isLoading}
                  value={usageQuery.data?.member_count ?? 0}
                  suffix={usageQuery.data?.member_limit ? `/ ${usageQuery.data.member_limit}` : ' / 不限'}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="团队数"
                  loading={usageQuery.isLoading}
                  value={usageQuery.data?.team_count ?? 0}
                  suffix={usageQuery.data?.team_limit ? `/ ${usageQuery.data.team_limit}` : ' / 不限'}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card title="我的租户列表" style={{ marginTop: 16 }}>
        <TenantSectionHint text="这里直接承接后端的租户切换、主租户设置和创建能力。" />
        <Row gutter={[16, 16]}>{organizationCards}</Row>
      </Card>

      <Modal
        title="创建租户"
        open={createOpen}
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await createMutation.mutateAsync(values);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="租户名称" name="name" rules={[{ required: true, message: '请输入租户名称' }]}>
            <Input placeholder="例如：Acme Studio" style={fullWidthStyle} />
          </Form.Item>
          <Form.Item
            label="租户 Slug"
            name="slug"
            rules={[
              { required: true, message: '请输入 slug' },
              { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字和连字符' },
            ]}
          >
            <Input placeholder="例如：acme-studio" style={fullWidthStyle} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default OverviewPage;
