import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, Form, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, ResponsiveActions } from '@/pages/_shared/adminLayout';
import {
  appsAccessApiCreateOrganizationBinding,
  appsAccessApiDeleteOrganizationBinding,
  appsAccessApiListOrganizationBindings,
} from '@/services/openapi/accessOrganizationBindings';
import { appsAccessApiListOrgRoles } from '@/services/openapi/accessOrganizationRoles';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import { TenantSectionHint, TenantSelectionGuard, formatPersonLabel, useTenantWorkspace } from '@/pages/tenant/shared';
import { RoleSummary, accessQueryKeys, rolePermissionText, roleStatusTag } from '../shared';

type OrganizationBindingSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};
const overviewTileStyle: React.CSSProperties = {
  height: '100%',
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--ant-color-border-secondary)',
  background: 'var(--ant-color-bg-container)',
};

const OrganizationBindingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<API.RoleBindingIn>();

  const bindingsQuery = useQuery({
    queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrganizationBindings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const membersQuery = useQuery({
    queryKey: ['access', 'organization-binding-members', workspace.selectedOrgSlug],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.RoleBindingIn) => appsAccessApiCreateOrganizationBinding(payload),
    onSuccess: async () => {
      setOpen(false);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (bindingId: number) => appsAccessApiDeleteOrganizationBinding({ binding_id: bindingId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug) });
    },
  });

  const bindingItems = bindingsQuery.data || [];
  const memberItems = membersQuery.data?.items || [];
  const roleItems = rolesQuery.data || [];
  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.items || []).map((item) => ({
        label: `${formatPersonLabel(item.user)} (${item.user.username})`,
        value: item.user.id,
      })),
    [membersQuery.data],
  );
  const roleOptions = useMemo(
    () => (rolesQuery.data || []).filter((item) => item.is_active).map((item) => ({ label: item.name, value: item.id })),
    [rolesQuery.data],
  );
  const roleMap = new Map(roleItems.map((item) => [item.id, item]));
  const boundUserIds = new Set(bindingItems.map((item) => item.user.id));
  const boundRoleIds = new Set(bindingItems.map((item) => item.role.id));
  const pendingMembers = memberItems.filter((item) => !boundUserIds.has(item.user.id));
  const activeRoles = roleItems.filter((item) => item.is_active);
  const unusedRoles = activeRoles.filter((item) => !boundRoleIds.has(item.id));
  const assignedMemberPreview = bindingItems.slice(0, 3).map((item) => formatPersonLabel(item.user));
  const pendingMemberPreview = pendingMembers.slice(0, 3).map((item) => formatPersonLabel(item.user));
  const bindingSignals = useMemo<OrganizationBindingSignal[]>(
    () => [
      {
        key: 'global',
        title: '全局承接',
        emphasis: boundUserIds.size ? `${boundUserIds.size} 人已承接` : '待建立承接',
        summary: boundUserIds.size
          ? `${boundUserIds.size} 名成员已经承担空间级职责，开始接住 owner、管理员或运营类工作。`
          : '当前没有任何成员承接空间级职责，空间级权限还停留在配置层。',
        description: '空间级授权应该只给真正承担全局责任的人，否则局部成员会拿到过高权限。',
        actionLabel: '立即分配角色',
        actionHref: '#assign-role',
      },
      {
        key: 'coverage',
        title: '待分配成员',
        emphasis: pendingMembers.length ? `${pendingMembers.length} 人待补` : '已全部覆盖',
        summary: pendingMembers.length
          ? `还有 ${pendingMembers.length} 名空间成员没有明确的组织级角色，容易出现“参与管理但没有正式归属”的灰区。`
          : '当前空间成员的组织级授权覆盖相对完整。',
        description: '空间级待分配成员一般优先看管理岗、跨团队协调岗、财务/运营负责人。',
        actionLabel: '查看成员设置',
        actionHref: '/dashboard/settings-management/organization',
      },
      {
        key: 'roles',
        title: '角色承接',
        emphasis: unusedRoles.length ? `${unusedRoles.length} 个角色闲置` : '角色都在使用',
        summary: unusedRoles.length
          ? `还有 ${unusedRoles.length} 个空间级角色没有任何成员使用，角色设计和授权落地之间可能存在脱节。`
          : '空间级角色都已经进入实际使用，权限体系和执行组织相对一致。',
        description: '闲置角色要么继续等待明确场景，要么尽快清理，避免空间级权限体系持续膨胀。',
        actionLabel: '查看空间角色',
        actionHref: '/dashboard/access/organization-roles',
      },
      {
        key: 'policy',
        title: '策略联动',
        emphasis: '空间级治理',
        summary: '空间授权决定谁能改空间策略、谁能统筹团队治理、谁能处理跨团队的异常收口。',
        description: '如果空间设置已经成为规则中心，空间授权就必须同步回答谁有权修改这些规则。',
        actionLabel: '查看空间设置',
        actionHref: '/dashboard/settings-management/organization',
      },
    ],
    [boundUserIds.size, pendingMembers.length, unusedRoles.length],
  );

  const columns: ColumnsType<API.OrganizationBindingOut> = [
    {
      title: '成员',
      dataIndex: 'user',
      width: 220,
      render: (user) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{formatPersonLabel(user)}</Typography.Text>
          <Typography.Text type="secondary">{user.username}</Typography.Text>
        </Space>
      ),
    },
    { title: '角色', dataIndex: 'role', width: 220, render: (role) => <RoleSummary role={role} /> },
    {
      title: '权限范围',
      dataIndex: 'role_scope',
      width: 220,
      render: (_value, record) => {
        const role = roleMap.get(record.role.id);
        if (!role) {
          return <Typography.Text type="secondary">角色详情缺失</Typography.Text>;
        }
        return (
          <Space orientation="vertical" size={4}>
            {roleStatusTag(role)}
            <Typography.Text type="secondary">{rolePermissionText(role)}</Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '执行说明',
      dataIndex: 'execution',
      width: 280,
      render: (_value, record) => {
        const role = roleMap.get(record.role.id);
        return (
          <Typography.Text type="secondary">
            {role?.is_system ? '适合空间级稳定底座职责。' : '适合空间专项治理或阶段性全局任务。'}
          </Typography.Text>
        );
      },
    },
    { title: '授权时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      render: (_value, record) => (
        <ResponsiveActions>
          <Popconfirm title="确认移除该授权？" onConfirm={() => void deleteMutation.mutateAsync(record.id)}>
            <a>移除</a>
          </Popconfirm>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <TenantSelectionGuard title="租户授权" subtitle="为当前租户成员分配组织级角色。">
      <Card loading={bindingsQuery.isLoading || rolesQuery.isLoading || membersQuery.isLoading}>
        <div style={sectionStyle}>
          <Typography.Text strong>授权概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="空间成员" value={memberItems.length} />
                <Typography.Text type="secondary">当前空间内可被纳入组织级分工的成员数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="已授权成员" value={boundUserIds.size} />
                <Typography.Text type="secondary">{boundUserIds.size ? `${boundUserIds.size} 名成员已拿到空间级角色。` : '当前还没有成员被正式授权。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="待分配成员" value={pendingMembers.length} />
                <Typography.Text type="secondary">{pendingMembers.length ? '这些成员还没有被纳入空间级职责。' : '当前空间成员都已被明确分工。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="可用角色" value={activeRoles.length} />
                <Typography.Text type="secondary">{unusedRoles.length ? `${unusedRoles.length} 个角色当前还无人承接。` : '当前空间级角色都已在使用。'}</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>覆盖情况</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>已承接成员</Typography.Text>
                    <Tag color={boundUserIds.size ? 'blue' : 'default'}>{boundUserIds.size ? `${boundUserIds.size} 人` : '暂无'}</Tag>
                  </Space>
                  <Typography.Text>{boundUserIds.size ? '这些成员已经接住空间级职责。' : '当前还没有任何成员承接全局职责。'}</Typography.Text>
                  <Typography.Text type="secondary">{assignedMemberPreview.length ? assignedMemberPreview.join('、') : '建议优先明确 owner、空间管理员、跨团队运营负责人。'}</Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>待分配成员</Typography.Text>
                    <Tag color={pendingMembers.length ? 'gold' : 'green'}>{pendingMembers.length ? `${pendingMembers.length} 人待补` : '已覆盖'}</Tag>
                  </Space>
                  <Typography.Text>{pendingMembers.length ? '这些成员还没有明确的组织级职责归属。' : '当前没有空间级悬空成员。'}</Typography.Text>
                  <Typography.Text type="secondary">{pendingMemberPreview.length ? pendingMemberPreview.join('、') : '如果后续新增跨团队职责，再补充组织级角色即可。'}</Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>角色承接</Typography.Text>
                    <Tag color={unusedRoles.length ? 'purple' : 'green'}>{unusedRoles.length ? `${unusedRoles.length} 个闲置` : '全部启用中'}</Tag>
                  </Space>
                  <Typography.Text>{unusedRoles.length ? '有空间级角色已经设计好，但还没有任何成员使用。' : '空间级角色都已经对应到实际成员。'}</Typography.Text>
                  <Typography.Text type="secondary">{unusedRoles.length ? unusedRoles.slice(0, 3).map((item) => item.name).join('、') : '角色设计和授权落地当前是一致的。'}</Typography.Text>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {bindingSignals.map((signal) => (
              <Col key={signal.key} xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap size={[8, 8]}>
                      <Typography.Text strong>{signal.title}</Typography.Text>
                      <Tag color="blue">{signal.emphasis}</Tag>
                    </Space>
                    <Typography.Text>{signal.summary}</Typography.Text>
                    <Typography.Text type="secondary">{signal.description}</Typography.Text>
                    {signal.actionHref === '#assign-role' ? (
                      <a
                        href={signal.actionHref}
                        onClick={(event) => {
                          event.preventDefault();
                          setOpen(true);
                        }}
                      >
                        {signal.actionLabel}
                      </a>
                    ) : (
                      <a href={signal.actionHref}>{signal.actionLabel}</a>
                    )}
                  </Space>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          title="空间授权决定谁能统筹全局规则、跨团队协同和异常收口"
          description="如果空间设置已经成为规则中心，但空间授权没有把 owner、管理员、运营职责分配清楚，最终还是会回到“大家都能改，出了问题没人收”的状态。"
        />
      </Card>
      <Card
        title="空间授权台账"
        style={{ marginTop: 16 }}
        extra={
          <AdminToolbar>
            <Button id="assign-role" type="primary" onClick={() => setOpen(true)}>
              分配角色
            </Button>
          </AdminToolbar>
        }
      >
        <TenantSectionHint text="租户级授权对当前空间全局生效，适合 owner、管理员、运营等组织级职责；先看上面的覆盖缺口，再在这里处理具体授权。 " />
        <Table
          rowKey="id"
          loading={bindingsQuery.isLoading}
          columns={columns}
          dataSource={bindingItems}
          pagination={false}
          scroll={adminTableScroll}
          locale={{
            emptyText: (
              <Empty
                description="当前空间还没有任何组织级授权记录，先分配首批全局负责人。"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>
      <Modal
        title="分配角色"
        open={open}
        confirmLoading={createMutation.isPending}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await createMutation.mutateAsync(values);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="成员" name="user" rules={[{ required: true, message: '请选择成员' }]}>
            <Select showSearch optionFilterProp="label" options={memberOptions} placeholder="选择成员" loading={membersQuery.isLoading} />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
            <Select showSearch optionFilterProp="label" options={roleOptions} placeholder="选择角色" loading={rolesQuery.isLoading} />
          </Form.Item>
        </Form>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default OrganizationBindingsPage;
