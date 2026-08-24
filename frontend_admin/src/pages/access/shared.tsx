import { useQuery } from '@tanstack/react-query';
import type { FormInstance } from 'antd';
import {
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import React from 'react';
import { organizationQueryKeys } from '@/pages/space/organization/queryKeys';
import { formatPersonLabel, useTenantWorkspace } from '@/pages/space/shared';
import { appsOrganizationsWorkspaceApiGetNavigation } from '@/services/openapi/organizationWorkspace';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';

export const accessQueryKeys = {
  permissions: ['access', 'permissions'],
  orgRoles: (slug?: string) => ['access', 'organization-roles', slug],
  orgBindings: (slug?: string) => ['access', 'organization-bindings', slug],
  teams: (slug?: string) => ['access', 'teams', slug],
  teamRoles: (slug?: string, teamId?: number) => [
    'access',
    'team-roles',
    slug,
    teamId,
  ],
  teamBindings: (slug?: string, teamId?: number) => [
    'access',
    'team-bindings',
    slug,
    teamId,
  ],
};

export function useRoleManagementNavigation() {
  const workspace = useTenantWorkspace();
  return useQuery({
    queryKey: organizationQueryKeys.navigation(workspace.selectedOrgSlug),
    queryFn: () => appsOrganizationsWorkspaceApiGetNavigation(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
}

export function rolePermissionText(role: API.AccessRoleOut) {
  return role.permission_keys.length
    ? `${role.permission_keys.length} 个权限`
    : '未配置权限';
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
      showSearch={{ optionFilterProp: 'label' }}
      options={permissions.map((item) => ({
        label: `${item.name} (${item.key})`,
        value: item.key,
      }))}
      placeholder="选择权限点"
    />
  </Form.Item>
);

export const RoleFormItems: React.FC<{ permissions?: API.PermissionOut[] }> = ({
  permissions,
}) => (
  <>
    <Form.Item
      label="角色名称"
      name="name"
      rules={[{ required: true, message: '请输入角色名称' }]}
    >
      <Input />
    </Form.Item>
    <PermissionSelect permissions={permissions} />
  </>
);

export const TeamContextCard: React.FC<{
  allowedTeamIds?: number[];
  selectedTeamId?: number;
  onChange: (teamId?: number) => void;
}> = ({ allowedTeamIds, selectedTeamId, onChange }) => {
  const workspace = useTenantWorkspace();
  const teamsQuery = useQuery({
    queryKey: accessQueryKeys.teams(workspace.selectedOrgSlug),
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const teamItems = React.useMemo(
    () =>
      (teamsQuery.data?.items || []).filter(
        (item) => !allowedTeamIds || allowedTeamIds.includes(item.id),
      ),
    [allowedTeamIds, teamsQuery.data?.items],
  );

  React.useEffect(() => {
    const firstTeamId = teamItems[0]?.id;
    if (!selectedTeamId && firstTeamId) {
      onChange(firstTeamId);
    }
  }, [onChange, selectedTeamId, teamItems]);

  return (
    <Card title="团队上下文" style={{ marginBottom: 16 }}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Select
          aria-label="团队"
          loading={teamsQuery.isLoading}
          options={teamItems.map((item) => ({
            label: item.name,
            value: item.id,
          }))}
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
  okText?: string;
  onCancel: () => void;
  onOk: () => void;
}> = ({ open, title, loading, permissions, form, okText, onCancel, onOk }) => (
  <Modal
    title={title}
    open={open}
    okText={okText}
    confirmLoading={loading}
    onCancel={onCancel}
    onOk={onOk}
  >
    <Form form={form} layout="vertical">
      <RoleFormItems permissions={permissions} />
    </Form>
  </Modal>
);

export const RoleSummary: React.FC<{
  role: API.AccessRoleOut | API.AccessRoleSummaryOut;
}> = ({ role }) => (
  <Space orientation="vertical" size={0}>
    <Typography.Text>{role.name}</Typography.Text>
  </Space>
);

type RoleUsageBinding = API.OrganizationBindingOut | API.TeamBindingOut;

export const RoleUsageDrawer: React.FC<{
  open: boolean;
  role?: API.AccessRoleOut | null;
  bindings: RoleUsageBinding[];
  teamName?: string;
  onClose: () => void;
  onOpenOrganization: () => void;
}> = ({ open, role, bindings, teamName, onClose, onOpenOrganization }) => {
  const roleBindings = role
    ? bindings.filter((item) => item.role.id === role.id)
    : [];

  return (
    <Drawer
      title={role ? `${role.name} · 已授权成员` : '已授权成员'}
      open={open}
      size="large"
      destroyOnHidden
      onClose={onClose}
      footer={
        <Button type="primary" block onClick={onOpenOrganization}>
          前往组织架构调整
        </Button>
      }
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {teamName ? (
          <Typography.Text type="secondary">
            当前团队：{teamName}
          </Typography.Text>
        ) : null}
        {roleBindings.length ? (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            {roleBindings.map((item) => (
              <div key={item.id}>
                <Typography.Text strong>
                  {formatPersonLabel(item.user)}
                </Typography.Text>
                <br />
                <Typography.Text type="secondary">
                  {item.user.username}
                </Typography.Text>
              </div>
            ))}
          </Space>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无授权成员"
          />
        )}
      </Space>
    </Drawer>
  );
};
