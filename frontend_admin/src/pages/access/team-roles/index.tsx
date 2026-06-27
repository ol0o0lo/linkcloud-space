import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Form, Popconfirm, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsAccessApiListPermissions } from '@/services/openapi/accessPermissions';
import { appsAccessApiListTeamBindingsView } from '@/services/openapi/accessTeamBindings';
import {
  appsAccessApiCreateTeamRole,
  appsAccessApiDeleteTeamRole,
  appsAccessApiListTeamRoles,
  appsAccessApiPatchTeamRole,
} from '@/services/openapi/accessTeamRoles';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { EmptyTeamHint, RoleModal, RoleSummary, TeamContextCard, accessQueryKeys, rolePermissionText, roleStatusTag } from '../shared';

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

const TeamRolesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<API.AccessRoleOut | null>(null);
  const [form] = Form.useForm<API.CustomRoleCreateIn & API.CustomRolePatchIn>();

  const permissionsQuery = useQuery({
    queryKey: accessQueryKeys.permissions,
    queryFn: () => appsAccessApiListPermissions(),
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.teamRoles(workspace.selectedOrgSlug, selectedTeamId),
    queryFn: () => appsAccessApiListTeamRoles({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });
  const bindingsQuery = useQuery({
    queryKey: accessQueryKeys.teamBindings(workspace.selectedOrgSlug, selectedTeamId),
    queryFn: () => appsAccessApiListTeamBindingsView({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: API.CustomRoleCreateIn & API.CustomRolePatchIn) => {
      if (editingRole) {
        return appsAccessApiPatchTeamRole({ team_id: selectedTeamId!, role_id: editingRole.id }, payload);
      }
      return appsAccessApiCreateTeamRole({ team_id: selectedTeamId! }, payload);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingRole(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.teamRoles(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (roleId: number) => appsAccessApiDeleteTeamRole({ team_id: selectedTeamId!, role_id: roleId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.teamRoles(workspace.selectedOrgSlug, selectedTeamId) });
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.teamBindings(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });

  const roleItems = rolesQuery.data || [];
  const bindingItems = bindingsQuery.data || [];
  const activeRoles = roleItems.filter((role) => role.is_active);
  const systemRoles = roleItems.filter((role) => role.is_system);
  const customRoles = roleItems.filter((role) => !role.is_system);
  const boundRoleIds = new Set(bindingItems.map((item) => item.role.id));
  const usedRoles = roleItems.filter((role) => boundRoleIds.has(role.id));
  const unusedRoles = roleItems.filter((role) => !boundRoleIds.has(role.id));
  const usedRolePreview = usedRoles.slice(0, 3).map((role) => role.name);
  const unusedRolePreview = unusedRoles.slice(0, 3).map((role) => role.name);
  const columns: ColumnsType<API.AccessRoleOut> = useMemo(
    () => [
      { title: '角色', dataIndex: 'name', width: 220, render: (_value, record) => <RoleSummary role={record} /> },
      { title: '状态', dataIndex: 'is_active', width: 120, render: (_value, record) => roleStatusTag(record) },
      {
        title: '权限范围',
        dataIndex: 'permission_keys',
        width: 220,
        render: (_value, record) => (
          <Space orientation="vertical" size={4}>
            <Typography.Text>{rolePermissionText(record)}</Typography.Text>
            <Typography.Text type="secondary">{record.is_system ? '系统底座角色' : '团队自定义角色'}</Typography.Text>
          </Space>
        ),
      },
      {
        title: '承接情况',
        dataIndex: 'role_usage',
        width: 220,
        render: (_value, record) => {
          const usageCount = bindingItems.filter((item) => item.role.id === record.id).length;
          return (
            <Space orientation="vertical" size={4}>
              <Tag color={usageCount ? 'blue' : 'default'}>{usageCount ? `${usageCount} 条授权` : '暂未承接'}</Tag>
              <Typography.Text type="secondary">{usageCount ? '已有成员在实际使用该角色。' : '建议确认是否仍需要保留该角色。'}</Typography.Text>
            </Space>
          );
        },
      },
      { title: '执行说明', dataIndex: 'permission_keys', width: 320, render: (_value, record) => <span style={wrapTextStyle}>{record.is_system ? '适合稳定、通用的基础职责。' : '适合专项流程、试点团队或细分职责。'}</span> },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 120,
        render: (_value, record) =>
          record.is_system ? null : (
            <ResponsiveActions>
              <a
                onClick={() => {
                  setEditingRole(record);
                  form.setFieldsValue({ name: record.name, permission_keys: record.permission_keys });
                  setOpen(true);
                }}
              >
                编辑
              </a>
              <Popconfirm title="确认删除该角色？已有授权引用时将无法删除。" onConfirm={() => void deleteMutation.mutateAsync(record.id)}>
                <a>删除</a>
              </Popconfirm>
            </ResponsiveActions>
          ),
      },
    ],
    [bindingItems, deleteMutation, form],
  );

  return (
    <TenantSelectionGuard title="团队角色" subtitle="配置指定团队可分配的团队级角色。">
      <TeamContextCard selectedTeamId={selectedTeamId} onChange={setSelectedTeamId} />
      {selectedTeamId ? (
        <>
          <Card loading={rolesQuery.isLoading || bindingsQuery.isLoading}>
            <div style={sectionStyle}>
              <Typography.Text strong>角色概览</Typography.Text>
              <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title="可用角色" value={activeRoles.length} />
                    <Typography.Text type="secondary">当前团队可直接分配的角色数。</Typography.Text>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title="系统角色" value={systemRoles.length} />
                    <Typography.Text type="secondary">{systemRoles.length ? '承担稳定底座职责。' : '当前没有系统底座角色。'}</Typography.Text>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title="自定义角色" value={customRoles.length} />
                    <Typography.Text type="secondary">{customRoles.length ? '适合专项流程和局部职责。' : '当前还没有团队自定义角色。'}</Typography.Text>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic title="已被承接角色" value={usedRoles.length} />
                    <Typography.Text type="secondary">{usedRoles.length ? `${usedRoles.length} 个角色已被实际授权。` : '当前角色还没有进入执行层。'}</Typography.Text>
                  </div>
                </Col>
              </Row>
            </div>

            <div style={{ ...sectionStyle, marginTop: 16 }}>
              <Typography.Text strong>角色覆盖情况</Typography.Text>
              <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                <Col xs={24} md={12} xl={8}>
                  <div style={overviewTileStyle}>
                    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap size={[8, 8]}>
                        <Typography.Text strong>执行编组</Typography.Text>
                        <Tag color={usedRoles.length ? 'blue' : 'default'}>{usedRoles.length ? `${usedRoles.length} 个已承接` : '待承接'}</Tag>
                      </Space>
                      <Typography.Text>{usedRoles.length ? '这些角色已经被成员拿去承担真实职责。' : '当前没有任何角色真正进入团队执行链路。'}</Typography.Text>
                      <Typography.Text type="secondary">{usedRolePreview.length ? usedRolePreview.join('、') : '建议至少先让运营、主管或审核角色进入实际授权。'}</Typography.Text>
                    </Space>
                  </div>
                </Col>
                <Col xs={24} md={12} xl={8}>
                  <div style={overviewTileStyle}>
                    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap size={[8, 8]}>
                        <Typography.Text strong>闲置角色</Typography.Text>
                        <Tag color={unusedRoles.length ? 'gold' : 'green'}>{unusedRoles.length ? `${unusedRoles.length} 个待治理` : '无闲置'}</Tag>
                      </Space>
                      <Typography.Text>{unusedRoles.length ? '这些角色当前存在，但没有任何成员使用。' : '当前角色都已经对应到了真实成员。'}</Typography.Text>
                      <Typography.Text type="secondary">{unusedRolePreview.length ? unusedRolePreview.join('、') : '角色体系和授权落地当前是一致的。'}</Typography.Text>
                    </Space>
                  </div>
                </Col>
                <Col xs={24} md={12} xl={8}>
                  <div style={overviewTileStyle}>
                    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap size={[8, 8]}>
                        <Typography.Text strong>权限目录</Typography.Text>
                        <Tag color="purple">{`${permissionsQuery.data?.length || 0} 个权限点`}</Tag>
                      </Space>
                      <Typography.Text>团队角色是对权限点的业务化编组，不应该直接让管理员面对散乱权限清单。</Typography.Text>
                      <Typography.Text type="secondary">新建角色时尽量围绕真实岗位或业务动作打包，而不是按技术模块机械堆权限。</Typography.Text>
                    </Space>
                  </div>
                </Col>
              </Row>
            </div>

            <Alert
              type="info"
              showIcon
              style={{ marginTop: 16 }}
              title="团队角色不是权限清单，而是团队职责的业务化映射"
              description="如果角色页只展示角色名和权限数，管理员很难判断角色体系是否真正支撑了房源发布、审核、补资料和异常收口这些核心动作。"
            />
          </Card>
          <Card
            title="团队角色台账"
            style={{ marginTop: 16 }}
            extra={
              <AdminToolbar>
                <Button
                  type="primary"
                  onClick={() => {
                    setEditingRole(null);
                    form.resetFields();
                    setOpen(true);
                  }}
                >
                  新建角色
                </Button>
              </AdminToolbar>
            }
          >
            <Table rowKey="id" loading={rolesQuery.isLoading} columns={columns} dataSource={roleItems} pagination={false} scroll={adminTableScroll} />
          </Card>
        </>
      ) : (
        <EmptyTeamHint />
      )}
      <RoleModal
        open={open}
        title={editingRole ? '编辑角色' : '新建角色'}
        loading={saveMutation.isPending}
        permissions={permissionsQuery.data}
        form={form}
        onCancel={() => {
          setOpen(false);
          setEditingRole(null);
        }}
        onOk={async () => {
          const values = await form.validateFields();
          await saveMutation.mutateAsync(values);
        }}
      />
    </TenantSelectionGuard>
  );
};

export default TeamRolesPage;
