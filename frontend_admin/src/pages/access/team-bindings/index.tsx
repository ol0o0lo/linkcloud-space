import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, Form, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, ResponsiveActions } from '@/pages/_shared/adminLayout';
import { appsAccessApiListTeamRoles } from '@/services/openapi/accessTeamRoles';
import {
  appsAccessApiCreateTeamBinding,
  appsAccessApiDeleteTeamBinding,
  appsAccessApiListTeamBindingsView,
} from '@/services/openapi/accessTeamBindings';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import { TenantSelectionGuard, formatPersonLabel, useTenantWorkspace } from '@/pages/tenant/shared';
import { EmptyTeamHint, RoleSummary, TeamContextCard, accessQueryKeys, rolePermissionText, roleStatusTag } from '../shared';

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

const TeamBindingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<API.RoleBindingIn>();

  const bindingsQuery = useQuery({
    queryKey: accessQueryKeys.teamBindings(workspace.selectedOrgSlug, selectedTeamId),
    queryFn: () => appsAccessApiListTeamBindingsView({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.teamRoles(workspace.selectedOrgSlug, selectedTeamId),
    queryFn: () => appsAccessApiListTeamRoles({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });
  const membersQuery = useQuery({
    queryKey: ['access', 'team-binding-members', workspace.selectedOrgSlug, selectedTeamId],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.RoleBindingIn) => appsAccessApiCreateTeamBinding({ team_id: selectedTeamId! }, payload),
    onSuccess: async () => {
      setOpen(false);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.teamBindings(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (bindingId: number) => appsAccessApiDeleteTeamBinding({ team_id: selectedTeamId!, binding_id: bindingId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.teamBindings(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });

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
  const memberItems = membersQuery.data?.items || [];
  const bindingItems = bindingsQuery.data || [];
  const activeRoles = (rolesQuery.data || []).filter((item) => item.is_active);
  const customRoles = activeRoles.filter((item) => !item.is_system);
  const roleMap = new Map((rolesQuery.data || []).map((item) => [item.id, item]));
  const boundUserIds = new Set(bindingItems.map((item) => item.user.id));
  const boundRoleIds = new Set(bindingItems.map((item) => item.role.id));
  const pendingMembers = memberItems.filter((item) => !boundUserIds.has(item.user.id));
  const unusedRoles = activeRoles.filter((item) => !boundRoleIds.has(item.id));
  const assignedMemberPreview = bindingItems.slice(0, 3).map((item) => formatPersonLabel(item.user));
  const pendingMemberPreview = pendingMembers.slice(0, 3).map((item) => formatPersonLabel(item.user));
  const columns: ColumnsType<API.TeamBindingOut> = [
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
    <TenantSelectionGuard title="团队授权" subtitle="为指定团队成员分配团队级角色。">
      <TeamContextCard selectedTeamId={selectedTeamId} onChange={setSelectedTeamId} />
      {selectedTeamId ? (
        <>
          <Card loading={bindingsQuery.isLoading || rolesQuery.isLoading || membersQuery.isLoading}>
            <div style={sectionStyle}>
              <Typography.Text strong>授权概览</Typography.Text>
              <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title="团队成员" value={memberItems.length} />
                    <Typography.Text type="secondary">当前团队内可被纳入角色分工的成员数。</Typography.Text>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title="已授权成员" value={boundUserIds.size} />
                    <Typography.Text type="secondary">{boundUserIds.size ? `${boundUserIds.size} 名成员已拿到团队级角色。` : '当前还没有成员被正式授权。'}</Typography.Text>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title="待分配成员" value={pendingMembers.length} />
                    <Typography.Text type="secondary">{pendingMembers.length ? '这些成员还没有被明确纳入执行分工。' : '当前成员都已有角色承接。'}</Typography.Text>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title="可用角色" value={activeRoles.length} />
                    <Typography.Text type="secondary">{customRoles.length ? `${customRoles.length} 个自定义角色，适合团队差异化分工。` : '当前主要依赖系统角色承接职责。'}</Typography.Text>
                  </div>
                </Col>
              </Row>
            </div>

            <div style={{ ...sectionStyle, marginTop: 16 }}>
              <Typography.Text strong>角色覆盖与待分配</Typography.Text>
              <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                <Col xs={24} md={12} xl={8}>
                  <div style={overviewTileStyle}>
                    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap size={[8, 8]}>
                        <Typography.Text strong>已承接成员</Typography.Text>
                        <Tag color={boundUserIds.size ? 'blue' : 'default'}>{boundUserIds.size ? `${boundUserIds.size} 人` : '暂无'}</Tag>
                      </Space>
                      <Typography.Text>{boundUserIds.size ? '这些成员已经正式进入团队执行链路。' : '当前还没有任何成员接住团队级职责。'}</Typography.Text>
                      <Typography.Text type="secondary">
                        {assignedMemberPreview.length ? assignedMemberPreview.join('、') : '建议先补上负责发房、审核、补资料的首批执行人。'}
                      </Typography.Text>
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
                      <Typography.Text>{pendingMembers.length ? '这些成员在团队内但还没有明确的授权归属。' : '当前没有悬空成员。'}</Typography.Text>
                      <Typography.Text type="secondary">
                        {pendingMemberPreview.length ? pendingMemberPreview.join('、') : '授权覆盖已经完整，可以继续细化角色边界。'}
                      </Typography.Text>
                    </Space>
                  </div>
                </Col>
                <Col xs={24} md={12} xl={8}>
                  <div style={overviewTileStyle}>
                    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap size={[8, 8]}>
                        <Typography.Text strong>角色覆盖</Typography.Text>
                        <Tag color={unusedRoles.length ? 'purple' : 'green'}>{unusedRoles.length ? `${unusedRoles.length} 个闲置` : '全部启用中'}</Tag>
                      </Space>
                      <Typography.Text>{unusedRoles.length ? '有角色已经设计出来，但还没有被任何成员承接。' : '角色设计和成员承接当前是一致的。'}</Typography.Text>
                      <Typography.Text type="secondary">
                        {unusedRoles.length ? unusedRoles.slice(0, 3).map((item) => item.name).join('、') : '如果后续要拆运营、审核、主管职责，可以继续在团队角色页细化。'}
                      </Typography.Text>
                    </Space>
                  </div>
                </Col>
              </Row>
            </div>

            <Alert
              type="info"
              showIcon
              style={{ marginTop: 16 }}
              title="团队授权决定谁来承接房源发布、资料补齐和异常收口"
              description="如果团队设置已经做了差异化规则，但授权页没有同步补人，最终只会出现“策略存在、没人执行”的管理断层。"
            />
          </Card>
          <Card
            title="团队授权台账"
            style={{ marginTop: 16 }}
            extra={
              <AdminToolbar>
                <Button id="assign-role" type="primary" onClick={() => setOpen(true)}>
                  分配角色
                </Button>
              </AdminToolbar>
            }
          >
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
                    description="当前团队还没有任何授权记录，先分配首批执行人。"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            />
          </Card>
        </>
      ) : (
        <EmptyTeamHint />
      )}
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

export default TeamBindingsPage;
