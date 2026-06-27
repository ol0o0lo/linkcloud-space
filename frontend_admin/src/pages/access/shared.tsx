import { Card, Empty, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import type { FormInstance } from 'antd';
import React from 'react';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import { useQuery } from '@tanstack/react-query';
import { TenantSectionHint, useTenantWorkspace } from '@/pages/tenant/shared';

export const accessQueryKeys = {
  permissions: ['access', 'permissions'],
  orgRoles: (slug?: string) => ['access', 'organization-roles', slug],
  orgBindings: (slug?: string) => ['access', 'organization-bindings', slug],
  teams: (slug?: string) => ['access', 'teams', slug],
  teamRoles: (slug?: string, teamId?: number) => ['access', 'team-roles', slug, teamId],
  teamBindings: (slug?: string, teamId?: number) => ['access', 'team-bindings', slug, teamId],
};

export function rolePermissionText(role: API.AccessRoleOut) {
  return role.permission_keys.length ? `${role.permission_keys.length} 个权限` : '未配置权限';
}

export function roleStatusTag(role: API.AccessRoleOut) {
  if (role.is_system) {
    return <Tag color="blue">系统角色</Tag>;
  }
  return <Tag color="green">自定义角色</Tag>;
}

export const PermissionSelect: React.FC<{
  permissions?: API.PermissionOut[];
}> = ({ permissions = [] }) => (
  <Form.Item label="权限点" name="permission_keys">
    <Select
      mode="multiple"
      allowClear
      optionFilterProp="label"
      options={permissions.map((item) => ({
        label: `${item.name} (${item.key})`,
        value: item.key,
      }))}
      placeholder="选择权限点"
    />
  </Form.Item>
);

export const RoleFormItems: React.FC<{ permissions?: API.PermissionOut[] }> = ({ permissions }) => (
  <>
    <Form.Item label="角色名称" name="name" rules={[{ required: true, message: '请输入角色名称' }]}>
      <Input />
    </Form.Item>
    <PermissionSelect permissions={permissions} />
  </>
);

export const TeamContextCard: React.FC<{
  selectedTeamId?: number;
  onChange: (teamId?: number) => void;
}> = ({ selectedTeamId, onChange }) => {
  const workspace = useTenantWorkspace();
  const teamsQuery = useQuery({
    queryKey: accessQueryKeys.teams(workspace.selectedOrgSlug),
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  React.useEffect(() => {
    const firstTeamId = teamsQuery.data?.items?.[0]?.id;
    if (!selectedTeamId && firstTeamId) {
      onChange(firstTeamId);
    }
  }, [onChange, selectedTeamId, teamsQuery.data]);

  return (
    <Card title="团队上下文" style={{ marginBottom: 16 }}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <TenantSectionHint text="团队级角色和授权需要先选择一个当前空间下的团队。" />
        <Select
          aria-label="团队"
          loading={teamsQuery.isLoading}
          options={(teamsQuery.data?.items || []).map((item) => ({ label: item.name, value: item.id }))}
          placeholder="选择团队"
          value={selectedTeamId}
          onChange={onChange}
          style={{ width: 320, maxWidth: '100%' }}
        />
      </Space>
    </Card>
  );
};

export const EmptyTeamHint: React.FC = () => (
  <Empty description="当前空间还没有团队，请先到团队管理页创建团队。" />
);

export const RoleModal: React.FC<{
  open: boolean;
  title: string;
  loading?: boolean;
  permissions?: API.PermissionOut[];
  form: FormInstance<API.CustomRoleCreateIn & API.CustomRolePatchIn>;
  onCancel: () => void;
  onOk: () => void;
}> = ({ open, title, loading, permissions, form, onCancel, onOk }) => (
  <Modal title={title} open={open} confirmLoading={loading} onCancel={onCancel} onOk={onOk}>
    <Form form={form} layout="vertical">
      <RoleFormItems permissions={permissions} />
    </Form>
  </Modal>
);

export const RoleSummary: React.FC<{ role: API.AccessRoleOut | API.AccessRoleSummaryOut }> = ({ role }) => (
  <Space orientation="vertical" size={0}>
    <Typography.Text>{role.name}</Typography.Text>
  </Space>
);
