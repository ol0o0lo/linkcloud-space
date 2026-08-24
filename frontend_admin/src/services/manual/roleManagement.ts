import { request } from '@umijs/max';

export type RoleScope =
  | { kind: 'space' }
  | { kind: 'team'; teamId: number; teamName: string };

export type RoleManagementTeam = {
  id: number;
  name: string;
  role_count: number;
  assigned_member_count: number;
};

export type RoleManagementNavigation = {
  space_role_count: number;
  space_assigned_member_count: number;
  teams: RoleManagementTeam[];
  capabilities: {
    role_view: boolean;
    role_manage: boolean;
    team_role_view_ids: number[];
    team_role_manage_ids: number[];
  };
};

export type PermissionOption = {
  key: string;
  name: string;
  app_label: string;
  codename: string;
  module_key: string;
  module_name: string;
};

export type PermissionModuleSummary = {
  key: string;
  name: string;
  count: number;
};

export type RoleRecord = {
  id: number;
  code: string;
  name: string;
  description: string;
  scope: 'org' | 'team';
  is_system: boolean;
  is_active: boolean;
  organization_id?: number | null;
  team_id?: number | null;
  permission_keys: string[];
  permission_count: number;
  permission_modules: PermissionModuleSummary[];
  assigned_member_count: number;
  created_at: string;
  updated_at: string;
};

export type RoleInput = {
  name: string;
  description?: string;
  permission_keys?: string[];
  copy_from?: number;
};

export type RoleMemberOption = {
  member_id: number;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string | null;
  };
  assigned: boolean;
};

export type RoleMemberPage = {
  items: RoleMemberOption[];
  total: number;
  page: number;
  page_size: number;
};

function teamParams(scope: RoleScope) {
  return scope.kind === 'team' ? { team_id: scope.teamId } : undefined;
}

function roleCollectionPath(scope: RoleScope) {
  return scope.kind === 'team'
    ? `/api/access/teams/${scope.teamId}/roles/`
    : '/api/access/organization-roles/';
}

export function getRoleManagementNavigation() {
  return request<RoleManagementNavigation>(
    '/api/access/role-management/navigation/',
  );
}

export function listRolePermissions() {
  return request<PermissionOption[]>('/api/access/permissions/');
}

export function listRoles(scope: RoleScope) {
  return request<RoleRecord[]>(roleCollectionPath(scope));
}

export function createRole(scope: RoleScope, input: RoleInput) {
  return request<RoleRecord>(roleCollectionPath(scope), {
    method: 'POST',
    data: input,
  });
}

export function updateRole(
  scope: RoleScope,
  roleId: number,
  input: Partial<RoleInput>,
) {
  const path =
    scope.kind === 'team'
      ? `/api/access/teams/${scope.teamId}/roles/${roleId}/`
      : `/api/access/organization-roles/${roleId}/`;
  return request<RoleRecord>(path, { method: 'PATCH', data: input });
}

export function deleteRole(scope: RoleScope, roleId: number) {
  const path =
    scope.kind === 'team'
      ? `/api/access/teams/${scope.teamId}/roles/${roleId}/`
      : `/api/access/organization-roles/${roleId}/`;
  return request<Record<string, never>>(path, { method: 'DELETE' });
}

export function listRoleMembers(
  scope: RoleScope,
  roleId: number,
  params: {
    page: number;
    page_size: number;
    keyword?: string;
    assignment?: 'all' | 'assigned' | 'unassigned';
  },
) {
  return request<RoleMemberPage>(
    `/api/access/role-management/roles/${roleId}/members/`,
    { params: { ...params, ...teamParams(scope) } },
  );
}

export function patchRoleMembers(
  scope: RoleScope,
  roleId: number,
  input: { add_user_ids: number[]; remove_user_ids: number[] },
) {
  return request<{ assigned_member_count: number }>(
    `/api/access/role-management/roles/${roleId}/members/`,
    { method: 'PATCH', params: teamParams(scope), data: input },
  );
}
