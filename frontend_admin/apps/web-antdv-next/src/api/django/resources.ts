import {
  djangoDelete,
  djangoGet,
  djangoMultipartPost,
  djangoPatch,
  djangoPost,
  djangoPut,
} from './client';

export interface UserRow {
  avatar_url?: null | string;
  email?: string;
  first_name?: string;
  id: number;
  id_number_masked?: string;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  last_name?: string;
  phone?: null | string;
  phone_verified?: boolean;
  real_name_masked?: string;
  real_name_status?: string;
  timezone?: string;
  username: string;
}

export interface AdminUserPayload {
  email: string;
  first_name?: string;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  last_name?: string;
  phone?: null | string;
  phone_verified?: boolean;
  timezone?: string;
  username: string;
}

export interface OrganizationRow {
  id: number;
  is_current?: boolean;
  is_primary?: boolean;
  name: string;
  slug: string;
}

export interface OrganizationUsageRow {
  member_count: number;
  member_limit: null | number;
  team_count: number;
  team_limit: null | number;
}

export interface OrganizationSettingsRow {
  billing_email: string;
}

export interface MemberRow {
  created_at: string;
  is_owner: boolean;
  organization: number;
  pk: number;
  updated_at: string;
  user: {
    avatar_url?: null | string;
    email?: string;
    first_name?: string;
    id: number;
    last_name?: string;
    username: string;
  };
}

export interface MemberSearchRow {
  avatar_url?: null | string;
  email?: string;
  first_name?: string;
  last_name?: string;
  pk: number;
  username: string;
}

export interface InviteRow {
  created_at: string;
  invitee: null | number;
  invitee_email: string;
  is_owner: boolean;
  key: string;
  organization: number;
  pk: number;
  sender: number;
  updated_at: string;
}

export interface TeamRow {
  created_at: string;
  id: number;
  member_details: Array<{
    first_name?: string;
    id: number;
    last_name?: string;
    username: string;
  }>;
  members: number[];
  name: string;
  updated_at: string;
}

export interface NotificationRow {
  body: string;
  created_at: string;
  id: number;
  is_read: boolean;
  title: string;
  url?: null | string;
}

export interface SettingRow {
  description?: string;
  is_customized?: boolean;
  key: string;
  value: unknown;
  value_type?: string;
}

export interface NotificationPreferenceRow {
  description: string;
  email: boolean;
  key: string;
  label: string;
  default_channels?: string[];
  in_app: boolean;
}

export interface BulkActionResult {
  deleted: number;
  updated: number;
}

export interface AvatarUploadRow {
  avatar_url: null | string;
}

export interface OrganizationCreatePayload {
  name: string;
  slug: string;
}

export interface OrganizationPrimaryResult {
  is_primary: boolean;
  success: boolean;
}

export interface TeamSettingRow {
  description: string;
  is_customized: boolean;
  key: string;
  value: unknown;
  value_type: string;
}

export interface RealNameLogRow {
  action: string;
  action_label: string;
  created_at: string;
  from_status?: null | string;
  from_status_label?: string;
  note?: string;
  operator?: string;
  to_status?: null | string;
  to_status_label?: string;
}

export interface RealNameVerificationRow {
  created_at: string;
  failure_reason?: string;
  id: number;
  id_number_last4: string;
  id_number_masked: string;
  is_current: boolean;
  provider: string;
  provider_label: string;
  provider_request_id?: string;
  provider_result?: Record<string, unknown>;
  real_name_masked: string;
  review_note?: string;
  reviewed_at?: null | string;
  reviewed_by?: null | string;
  source: string;
  source_label: string;
  status: string;
  status_label: string;
  updated_at: string;
  user: {
    email?: string;
    id: number;
    phone?: null | string;
    username: string;
  };
}

export interface RealNameVerificationDetailRow extends RealNameVerificationRow {
  id_number: string;
  logs: RealNameLogRow[];
  real_name: string;
}

interface Paged<T> {
  count: number;
  next: null | string;
  previous: null | string;
  results: T[];
}

function rows<T>(data: Paged<T> | T[]) {
  return Array.isArray(data) ? data : data.results;
}

export const listUsersApi = (q?: string) =>
  djangoGet<Paged<UserRow> | UserRow[]>('/users/', { q }).then(rows);

export const getCurrentUserApi = () => djangoGet<UserRow>('/users/me/');

export const updateCurrentUserApi = (
  userId: number,
  payload: Pick<AdminUserPayload, 'first_name' | 'last_name' | 'timezone'>,
) => djangoPatch<UserRow>(`/users/${userId}/`, payload);

export const uploadCurrentUserAvatarApi = (image: File) => {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('crop_data', '{}');
  return djangoMultipartPost<AvatarUploadRow>('/users/me/avatar/', formData);
};

export const deleteCurrentUserAvatarApi = () => djangoDelete('/users/me/avatar/');

export const listAdminUsersApi = (q?: string) =>
  djangoGet<Paged<UserRow> | UserRow[]>('/admin/users/', { q }).then(rows);

export const createAdminUserApi = (payload: AdminUserPayload & { password: string }) =>
  djangoPost<UserRow>('/admin/users/', payload);

export const updateAdminUserApi = (userId: number, payload: Partial<AdminUserPayload>) =>
  djangoPatch<UserRow>(`/admin/users/${userId}/`, payload);

export const patchUserStatusApi = (userId: number, isActive: boolean) =>
  djangoPatch(`/admin/users/${userId}/status/`, { is_active: isActive });

export const setAdminUserPasswordApi = (userId: number, password: string) =>
  djangoPost<UserRow>(`/admin/users/${userId}/set-password/`, { password });

export const forceLogoutUserApi = (userId: number) =>
  djangoPost(`/admin/users/${userId}/force-logout/`);

export const resetUserMfaApi = (userId: number) =>
  djangoPost(`/admin/users/${userId}/reset-mfa/`);

export const unbindUserPhoneApi = (userId: number) =>
  djangoDelete(`/admin/users/${userId}/phone/`);

export const unbindUserWechatApi = (userId: number) =>
  djangoDelete(`/admin/users/${userId}/wechat/`);

export const listOrganizationsApi = () =>
  djangoGet<OrganizationRow[]>('/organizations/switch-list/');

export const createOrganizationApi = (payload: OrganizationCreatePayload) =>
  djangoPost<OrganizationRow>('/organizations/', payload);

export const selectOrganizationApi = (slug: string) =>
  djangoPost(`/organizations/${slug}/select/`);

export const signoutOrganizationApi = () => djangoPost('/organizations/signout/');

export const setPrimaryOrganizationApi = (slug: string) =>
  djangoPost<OrganizationPrimaryResult>(`/organizations/${slug}/set-primary/`);

export const listMembersApi = (q?: string) =>
  djangoGet<Paged<MemberRow> | MemberRow[]>('/organization-members/', { q }).then(rows);

export const searchMembersApi = (q: string) =>
  djangoGet<MemberSearchRow[]>('/organization-members/search/', { q });

export const createMemberApi = (userId: number, isOwner = false) =>
  djangoPost<MemberRow>('/organization-members/', { is_owner: isOwner, user: userId });

export const patchMemberApi = (memberId: number, isOwner: boolean) =>
  djangoPatch<MemberRow>(`/organization-members/${memberId}/`, { is_owner: isOwner });

export const deleteMemberApi = (memberId: number) =>
  djangoDelete(`/organization-members/${memberId}/`);

export const listInvitesApi = () =>
  djangoGet<Paged<InviteRow> | InviteRow[]>('/organization-invites/').then(rows);

export const createInviteApi = (payload: {
  invitee?: null | number;
  invitee_email?: string;
  is_owner?: boolean;
}) => djangoPost<InviteRow>('/organization-invites/', payload);

export const resendInviteApi = (inviteId: number) =>
  djangoPost(`/organization-invites/${inviteId}/resend/`);

export const deleteInviteApi = (inviteId: number) =>
  djangoDelete(`/organization-invites/${inviteId}/`);

export const listTeamsApi = (q?: string) =>
  djangoGet<Paged<TeamRow> | TeamRow[]>('/teams/', { q }).then(rows);

export const createTeamApi = (name: string, members: number[] = []) =>
  djangoPost<TeamRow>('/teams/', { members, name });

export const updateTeamApi = (teamId: number, payload: { members?: number[]; name?: string }) =>
  djangoPatch<TeamRow>(`/teams/${teamId}/`, payload);

export const deleteTeamApi = (teamId: number) => djangoDelete(`/teams/${teamId}/`);

export const listNotificationsApi = (isRead?: string) =>
  djangoGet<Paged<NotificationRow> | NotificationRow[]>('/notifications/', {
    is_read: isRead,
  }).then(rows);

export const markNotificationApi = (id: number, isRead: boolean) =>
  djangoPatch<NotificationRow>(`/notifications/${id}/`, { is_read: isRead });

export const deleteNotificationApi = (id: number) =>
  djangoDelete(`/notifications/${id}/`);

export const bulkNotificationsApi = (payload: {
  action: 'delete' | 'mark_read' | 'mark_unread';
  all_unread?: boolean;
  ids?: number[];
}) => djangoPost<BulkActionResult>('/notifications/bulk/', payload);

export const getUnreadCountApi = () =>
  djangoGet<{ count: number }>('/notifications/unread-count/');

export const listNotificationPreferencesApi = () =>
  djangoGet<NotificationPreferenceRow[]>('/notifications/preferences/');

export const updateNotificationPreferenceApi = (
  key: string,
  payload: { email?: boolean; in_app?: boolean },
) => djangoPatch<NotificationPreferenceRow>(`/notifications/preferences/${key}/`, payload);

export const listUserSettingsApi = () =>
  djangoGet<SettingRow[]>('/settings/user/');

export const updateUserSettingApi = (key: string, value: unknown) =>
  djangoPut<{ key: string; value: unknown }>(`/settings/user/${key}/`, { value });

export const listOrgSettingsApi = () =>
  djangoGet<SettingRow[]>('/settings/org/');

export const updateOrgSettingApi = (key: string, value: unknown) =>
  djangoPut<SettingRow>(`/settings/org/${key}/`, { value });

export const resetOrgSettingApi = (key: string) =>
  djangoDelete(`/settings/org/${key}/`);

export const listTeamSettingsApi = (teamId: number) =>
  djangoGet<TeamSettingRow[]>(`/settings/teams/${teamId}/`);

export const updateTeamSettingApi = (teamId: number, key: string, value: unknown) =>
  djangoPut<TeamSettingRow>(`/settings/teams/${teamId}/${key}/`, { value });

export const listOrganizationUsageApi = (slug: string) =>
  djangoGet<OrganizationUsageRow>(`/organizations/${slug}/usage/`);

export const getOrganizationProfileApi = () =>
  djangoGet<OrganizationSettingsRow>('/organization-settings/');

export const updateOrganizationProfileApi = (payload: { billing_email?: null | string }) =>
  djangoPatch<OrganizationSettingsRow>('/organization-settings/update_settings/', payload);

export const listAdminRealNameVerificationsApi = (params?: { q?: string; status?: string }) =>
  djangoGet<Paged<RealNameVerificationRow> | RealNameVerificationRow[]>('/admin/real-name-verifications/', params).then(rows);

export const getAdminRealNameVerificationApi = (verificationId: number) =>
  djangoGet<RealNameVerificationDetailRow>(`/admin/real-name-verifications/${verificationId}/`);

export const moveAdminRealNameToManualReviewApi = (verificationId: number, note = '') =>
  djangoPost<RealNameVerificationDetailRow>(`/admin/real-name-verifications/${verificationId}/manual-review/`, { note });

export const approveAdminRealNameApi = (verificationId: number, note = '') =>
  djangoPost<RealNameVerificationDetailRow>(`/admin/real-name-verifications/${verificationId}/approve/`, { note });

export const rejectAdminRealNameApi = (verificationId: number, note = '') =>
  djangoPost<RealNameVerificationDetailRow>(`/admin/real-name-verifications/${verificationId}/reject/`, { note });

export const revokeAdminRealNameApi = (verificationId: number, note = '') =>
  djangoPost<RealNameVerificationDetailRow>(`/admin/real-name-verifications/${verificationId}/revoke/`, { note });

// ---------- Access / RBAC ----------

export interface AccessRoleRow {
  id: number;
  code: string;
  name: string;
  scope: string;
  is_system: boolean;
  is_active: boolean;
  organization_id: number | null;
  permission_keys: string[];
}

export interface PermissionRow {
  key: string;
  name: string;
  app_label: string;
  codename: string;
}

export interface AccessUserRow {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url?: null | string;
}

export interface AccessRoleSummaryRow {
  id: number;
  code: string;
  name: string;
  scope: string;
}

export interface OrgBindingRow {
  id: number;
  organization_id: number;
  user: AccessUserRow;
  role: AccessRoleSummaryRow;
  created_at: string;
  updated_at: string;
}

export interface TeamBindingRow {
  id: number;
  team_id: number;
  user: AccessUserRow;
  role: AccessRoleSummaryRow;
  created_at: string;
  updated_at: string;
}

export interface CustomRolePayload {
  code: string;
  name: string;
  permission_keys?: string[];
  copy_from?: number;
}

export interface CustomRolePatchPayload {
  code?: string;
  name?: string;
  permission_keys?: string[];
  is_active?: boolean;
}

export const listPermissionsApi = () =>
  djangoGet<PermissionRow[]>('/access/permissions/');

export const listOrgRolesApi = () =>
  djangoGet<AccessRoleRow[]>('/access/organization-roles/');

export const createOrgRoleApi = (payload: CustomRolePayload) =>
  djangoPost<AccessRoleRow>('/access/organization-roles/', payload);

export const updateOrgRoleApi = (roleId: number, payload: CustomRolePatchPayload) =>
  djangoPatch<AccessRoleRow>(`/access/organization-roles/${roleId}/`, payload);

export const deleteOrgRoleApi = (roleId: number) =>
  djangoDelete(`/access/organization-roles/${roleId}/`);

export const listOrgBindingsApi = () =>
  djangoGet<OrgBindingRow[]>('/access/organization-bindings/');

export const createOrgBindingApi = (userId: number, roleId: number) =>
  djangoPost<OrgBindingRow>('/access/organization-bindings/', { user: userId, role: roleId });

export const deleteOrgBindingApi = (bindingId: number) =>
  djangoDelete(`/access/organization-bindings/${bindingId}/`);

export const listTeamRolesApi = (teamId: number) =>
  djangoGet<AccessRoleRow[]>(`/access/teams/${teamId}/roles/`);

export const createTeamRoleApi = (teamId: number, payload: CustomRolePayload) =>
  djangoPost<AccessRoleRow>(`/access/teams/${teamId}/roles/`, payload);

export const updateTeamRoleApi = (teamId: number, roleId: number, payload: CustomRolePatchPayload) =>
  djangoPatch<AccessRoleRow>(`/access/teams/${teamId}/roles/${roleId}/`, payload);

export const deleteTeamRoleApi = (teamId: number, roleId: number) =>
  djangoDelete(`/access/teams/${teamId}/roles/${roleId}/`);

export const listTeamBindingsApi = (teamId: number) =>
  djangoGet<TeamBindingRow[]>(`/access/teams/${teamId}/bindings/`);

export const createTeamBindingApi = (teamId: number, userId: number, roleId: number) =>
  djangoPost<TeamBindingRow>(`/access/teams/${teamId}/bindings/`, { user: userId, role: roleId });

export const deleteTeamBindingApi = (teamId: number, bindingId: number) =>
  djangoDelete(`/access/teams/${teamId}/bindings/${bindingId}/`);
