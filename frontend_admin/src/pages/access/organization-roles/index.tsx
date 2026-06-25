import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Popconfirm, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsAccessApiListPermissions } from '@/services/openapi/accessPermissions';
import { appsAccessApiListOrganizationBindings } from '@/services/openapi/accessOrganizationBindings';
import {
  appsAccessApiCreateOrgRole,
  appsAccessApiDeleteOrgRole,
  appsAccessApiListOrgRoles,
  appsAccessApiPatchOrgRole,
} from '@/services/openapi/accessOrganizationRoles';
import { TenantSectionHint, TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { RoleModal, RoleSummary, accessQueryKeys, rolePermissionText, roleStatusTag } from '../shared';
import { Form } from 'antd';

type OrganizationRoleSignal = {
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

const OrganizationRolesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<API.AccessRoleOut | null>(null);
  const [form] = Form.useForm<API.CustomRoleCreateIn & API.CustomRolePatchIn>();

  const permissionsQuery = useQuery({
    queryKey: accessQueryKeys.permissions,
    queryFn: () => appsAccessApiListPermissions(),
  });
  const rolesQuery = useQuery({
    queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const bindingsQuery = useQuery({
    queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug),
    queryFn: () => appsAccessApiListOrganizationBindings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: API.CustomRoleCreateIn & API.CustomRolePatchIn) => {
      if (editingRole) {
        return appsAccessApiPatchOrgRole({ role_id: editingRole.id }, payload);
      }
      return appsAccessApiCreateOrgRole(payload);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingRole(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug) });
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.orgBindings(workspace.selectedOrgSlug) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: number) => appsAccessApiDeleteOrgRole({ role_id: roleId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: accessQueryKeys.orgRoles(workspace.selectedOrgSlug) });
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
  const roleSignals = useMemo<OrganizationRoleSignal[]>(
    () => [
      {
        key: 'execution',
        title: '执行编组',
        emphasis: usedRoles.length ? `${usedRoles.length} 个已承接` : '待承接',
        summary: usedRoles.length
          ? `${usedRoles.length} 个空间级角色已经进入实际使用，开始承接全局职责。`
          : '当前空间角色还没有进入实际授权，角色体系停留在设计层。',
        description: '空间级角色首先要服务 owner、空间管理员、跨团队运营这些真实岗位，而不是只作为权限仓库存在。',
        actionLabel: '查看空间授权',
        actionHref: '/dashboard/access/organization-bindings',
      },
      {
        key: 'coverage',
        title: '角色治理',
        emphasis: unusedRoles.length ? `${unusedRoles.length} 个闲置` : '角色都在使用',
        summary: unusedRoles.length
          ? `还有 ${unusedRoles.length} 个空间级角色没有被任何成员承接，角色设计和授权落地之间存在脱节。`
          : '所有空间角色都已经被实际成员承接，角色治理相对健康。',
        description: '长期闲置的空间角色会让权限体系越来越重，建议及时合并、删除或重新定义使用场景。',
        actionLabel: '查看空间授权',
        actionHref: '/dashboard/access/organization-bindings',
      },
      {
        key: 'system',
        title: '系统底座',
        emphasis: `${systemRoles.length} 个系统角色`,
        summary: systemRoles.length
          ? '系统角色负责稳定底座职责，应该尽量保持简洁、稳定和全局通用。'
          : '当前没有系统角色底座，空间级权限会更依赖人工维护。',
        description: '自定义角色应该补充业务差异，不应该把系统底座不断复制成多个相似角色。',
        actionLabel: '查看空间设置',
        actionHref: '/dashboard/settings-management/organization',
      },
      {
        key: 'policy',
        title: '策略联动',
        emphasis: '角色跟规则走',
        summary: '空间角色定义应该直接映射到“谁能改空间设置、谁能统筹团队治理、谁能收口跨团队异常”这些核心动作。',
        description: '如果空间设置已经是规则中心，空间角色就必须明确谁拥有这些规则的修改权和最终责任。',
        actionLabel: '查看空间设置',
        actionHref: '/dashboard/settings-management/organization',
      },
    ],
    [systemRoles.length, unusedRoles.length, usedRoles.length],
  );

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
            <Typography.Text type="secondary">{record.is_system ? '系统底座角色' : '空间自定义角色'}</Typography.Text>
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
      { title: '执行说明', dataIndex: 'permission_keys', width: 320, render: (_value, record) => <span style={wrapTextStyle}>{record.is_system ? '适合空间级稳定底座职责。' : '适合空间专项治理或阶段性全局任务。'}</span> },
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
    <TenantSelectionGuard title="租户角色" subtitle="配置当前租户可分配的组织级角色。">
      <Card loading={rolesQuery.isLoading || bindingsQuery.isLoading}>
        <div style={sectionStyle}>
          <Typography.Text strong>角色概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="可用角色" value={activeRoles.length} />
                <Typography.Text type="secondary">当前空间可直接分配的角色数。</Typography.Text>
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
                <Typography.Text type="secondary">{customRoles.length ? '适合空间专项治理与局部职责。' : '当前还没有空间自定义角色。'}</Typography.Text>
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
                  <Typography.Text>{usedRoles.length ? '这些角色已经被成员拿去承担空间级职责。' : '当前没有任何角色真正进入空间执行链路。'}</Typography.Text>
                  <Typography.Text type="secondary">{usedRolePreview.length ? usedRolePreview.join('、') : '建议至少先让 owner、空间管理员、跨团队运营角色进入实际授权。'}</Typography.Text>
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
                  <Typography.Text>空间角色是对全局权限点的业务化编组，不应该让管理员直接面对离散权限清单。</Typography.Text>
                  <Typography.Text type="secondary">新建空间角色时尽量围绕真实岗位和全局职责打包，而不是按技术模块机械堆权限。</Typography.Text>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {roleSignals.map((signal) => (
              <Col key={signal.key} xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap size={[8, 8]}>
                      <Typography.Text strong>{signal.title}</Typography.Text>
                      <Tag color="blue">{signal.emphasis}</Tag>
                    </Space>
                    <Typography.Text>{signal.summary}</Typography.Text>
                    <Typography.Text type="secondary">{signal.description}</Typography.Text>
                    <a href={signal.actionHref}>{signal.actionLabel}</a>
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
          title="空间角色不是权限名录，而是全局职责的业务化映射"
          description="如果空间角色页只展示角色名和权限数，管理员很难判断这些角色是否真的支撑了空间设置、跨团队协同和异常收口这些全局动作。"
        />
      </Card>
      <Card
        title="空间角色台账"
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
        <TenantSectionHint text="系统角色只读，自定义角色支持创建、编辑权限点和删除；已有授权引用时不能删除。先看上面的治理信息，再在这里处理具体角色。 " />
        <Table rowKey="id" loading={rolesQuery.isLoading} columns={columns} dataSource={roleItems} pagination={false} scroll={adminTableScroll} />
      </Card>
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

export default OrganizationRolesPage;
