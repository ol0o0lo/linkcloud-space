import type {
  CustomRoleCreateIn,
  CustomRolePatchIn,
  HouseBuildingsUsingGetParams,
  HouseContactsUsingGetParams,
  HouseEstatesUsingGetParams,
  HouseStaffResponsibilitiesUsingGetParams,
  InviteIn,
  InvoiceProfileIn,
  InvoiceRequestIn,
  MemberPatchIn,
  NavigationAccessCapabilitiesOut,
  NotificationDispatchIn,
  OrganizationMembersUsingGetParams,
  OrganizationWorkspaceMembersUsingGetParams,
  PagedMemberOut,
  PropertyResponsibilityUpdateIn,
  PurchaseOrderIn,
  RoleBindingIn,
  RoleMemberAssignmentIn,
  SetSettingIn,
  TeamIn,
  TeamPatchIn,
  TeamsUsingGetParams,
} from '@/services/openapi/types'
import type { TenantDispatchScope } from '@/domain/organization-admin'
import { organizationAdminRequestOptions } from '@/domain/organization-admin'
import { httpGet } from '@/http/http'
import { collectAllPages } from '@/shared/pagination/collectAllPages'
import { accessNavigationUsingGet } from '@/services/openapi/daohangnengli'
import {
  organizationMembersMemberIdUsingDelete,
  organizationMembersMemberIdUsingGet,
  organizationMembersMemberIdUsingPatch,
  organizationMembersSearchUsingGet,
  organizationMembersUsingGet,
  organizationMembersUsingPost,
} from '@/services/openapi/chengyuan'
import {
  houseBuildingsUsingGet,
  houseContactsUsingGet,
  houseEstatesUsingGet,
  houseStaffResponsibilitiesMemberIdUsingGet,
  houseStaffResponsibilitiesMemberIdUsingPut,
  houseStaffResponsibilitiesSummaryUsingGet,
  houseStaffResponsibilitiesUsingGet,
} from '@/services/openapi/guanli'
import {
  accessRoleManagementNavigationUsingGet,
  accessRoleManagementRolesRoleIdMembersUsingGet,
  accessRoleManagementRolesRoleIdMembersUsingPatch,
} from '@/services/openapi/jiaoseguanligongzuotai'
import {
  teamsTeamIdMembersUserIdUsingDelete,
  teamsTeamIdMembersUserIdUsingPost,
  teamsTeamIdUsingDelete,
  teamsTeamIdUsingGet,
  teamsTeamIdUsingPatch,
  teamsUsingGet,
  teamsUsingPost,
} from '@/services/openapi/jichu'
import { accessPermissionsUsingGet } from '@/services/openapi/quanxianqingdan'
import {
  notificationDispatchesDispatchIdNotificationsUsingGet,
  notificationDispatchesDispatchIdUsingGet,
  notificationDispatchesTargetsUsingGet,
  notificationDispatchesUsingGet,
  notificationDispatchesUsingPost,
} from '@/services/openapi/tongzhifenfa'
import {
  accessTeamsTeamIdBindingsBindingIdUsingDelete,
  accessTeamsTeamIdBindingsUsingGet,
  accessTeamsTeamIdBindingsUsingPost,
} from '@/services/openapi/tuanduishouquan'
import {
  accessTeamsTeamIdRolesRoleIdUsingDelete,
  accessTeamsTeamIdRolesRoleIdUsingPatch,
  accessTeamsTeamIdRolesUsingGet,
  accessTeamsTeamIdRolesUsingPost,
} from '@/services/openapi/tuanduijiaose'
import { settingsTeamsTeamIdKeyUsingDelete, settingsTeamsTeamIdKeyUsingPut, settingsTeamsTeamIdUsingGet } from '@/services/openapi/tuanduishezhi'
import {
  organizationInvitesInviteIdResendUsingPost,
  organizationInvitesInviteIdUsingDelete,
  organizationInvitesInviteIdUsingGet,
  organizationInvitesUsingGet,
  organizationInvitesUsingPost,
} from '@/services/openapi/yaoqing'
import {
  accessOrganizationBindingsBindingIdUsingDelete,
  accessOrganizationBindingsUsingGet,
  accessOrganizationBindingsUsingPost,
} from '@/services/openapi/zuhushouquan'
import {
  accessOrganizationRolesRoleIdUsingDelete,
  accessOrganizationRolesRoleIdUsingPatch,
  accessOrganizationRolesUsingGet,
  accessOrganizationRolesUsingPost,
} from '@/services/openapi/zuhujiaose'
import { settingsOrgKeyUsingDelete, settingsOrgKeyUsingPut, settingsOrgUsingGet } from '@/services/openapi/zuhushezhi'
import {
  subscriptionsCurrentUsingGet,
  subscriptionsInvoiceProfileUsingGet,
  subscriptionsInvoiceProfileUsingPut,
  subscriptionsInvoiceRequestsUsingGet,
  subscriptionsInvoiceRequestsUsingPost,
  subscriptionsOrdersOrderNoCancelUsingPost,
  subscriptionsOrdersOrderNoCheckoutUsingPost,
  subscriptionsOrdersOrderNoRefreshPaymentUsingPost,
  subscriptionsOrdersOrderNoUsingGet,
  subscriptionsOrdersUsingGet,
  subscriptionsOrdersUsingPost,
  subscriptionsPlansUsingGet,
} from '@/services/openapi/zuzhi'
import {
  organizationWorkspaceMembersMemberIdUsingGet,
  organizationWorkspaceMembersUsingGet,
  organizationWorkspaceNavigationUsingGet,
} from '@/services/openapi/zuzhijiagou'

export type {
  AccessRoleOut,
  BuildingInventoryOut,
  ContactOut,
  CurrentSubscriptionOut,
  EstateDetailOut,
  InviteOut,
  InvoiceProfileIn,
  InvoiceProfileOut,
  InvoiceRequestOut,
  MemberOut,
  MemberSearchOut,
  NavigationAccessCapabilitiesOut,
  NotificationDispatchOut,
  NotificationDispatchTargetOut,
  NotificationOut,
  OrganizationBindingOut,
  OrganizationNavigationOut,
  PermissionOut,
  PlanOut,
  PropertyResponsibilityMemberOut,
  PropertyResponsibilitySummaryOut,
  RoleManagementNavigationOut,
  RoleMemberOptionOut,
  SaaSOrderOut,
  SettingOut,
  TeamBindingOut,
  TeamOut,
  WorkspaceMemberOut,
} from '@/services/openapi/types'

export type OrganizationMemberFilters = Omit<OrganizationMembersUsingGetParams, 'page' | 'page_size'>
export type OrganizationWorkspaceMemberFilters = Omit<OrganizationWorkspaceMembersUsingGetParams, 'page' | 'page_size'>
export type OrganizationTeamFilters = Omit<TeamsUsingGetParams, 'page' | 'page_size'>
export type OrganizationResponsibilityFilters = Omit<HouseStaffResponsibilitiesUsingGetParams, 'page' | 'page_size'>
export type MobileMemberPatchIn = Pick<MemberPatchIn, 'employee_name' | 'job_title'>
export type MobileInviteIn = Omit<InviteIn, 'is_owner'>
export type TenantNotificationDispatchIn = Omit<NotificationDispatchIn, 'scope'> & { scope: TenantDispatchScope }
export interface OrganizationAdminNavigationCapabilities extends NavigationAccessCapabilitiesOut {
  organization_settings_manage: boolean
  team_update_ids: number[]
  team_member_manage_ids: number[]
  team_role_view_ids: number[]
  team_role_manage_ids: number[]
  team_settings_view_ids: number[]
  team_settings_manage_ids: number[]
}

export function requestOrganizationAdminNavigationCapabilities(organizationSlug: string): Promise<OrganizationAdminNavigationCapabilities> {
  return accessNavigationUsingGet({ options: organizationAdminRequestOptions(organizationSlug) }) as Promise<OrganizationAdminNavigationCapabilities>
}

export function requestOrganizationAdminNavigation(organizationSlug: string) {
  return organizationWorkspaceNavigationUsingGet({ options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestOrganizationWorkspaceMembers(organizationSlug: string, page: number, pageSize: number, filters: OrganizationWorkspaceMemberFilters = {}) {
  return organizationWorkspaceMembersUsingGet({ params: { ...filters, page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestOrganizationWorkspaceMember(organizationSlug: string, memberId: number) {
  return organizationWorkspaceMembersMemberIdUsingGet({ params: { member_id: memberId }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestOrganizationMembers(organizationSlug: string, page: number, pageSize: number, filters: OrganizationMemberFilters = {}) {
  return organizationMembersUsingGet({ params: { ...filters, page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestAllOrganizationMembers(organizationSlug: string, filters: OrganizationMemberFilters = {}, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestOrganizationMembers(organizationSlug, page, currentPageSize, filters),
    { pageSize, getKey: item => item.pk },
  )
}

export function requestOrganizationMember(organizationSlug: string, memberId: number) {
  return organizationMembersMemberIdUsingGet({ params: { member_id: memberId }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function searchOrganizationMemberCandidates(organizationSlug: string, keyword: string) {
  return organizationMembersSearchUsingGet({ params: { keyword }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function createOrganizationMember(organizationSlug: string, userId: number) {
  return organizationMembersUsingPost({ body: { user: userId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function updateOrganizationMember(organizationSlug: string, memberId: number, payload: MobileMemberPatchIn) {
  return organizationMembersMemberIdUsingPatch({ params: { member_id: memberId }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function deleteOrganizationMember(organizationSlug: string, memberId: number) {
  return organizationMembersMemberIdUsingDelete({ params: { member_id: memberId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestOrganizationInvites(organizationSlug: string, page: number, pageSize: number) {
  return organizationInvitesUsingGet({ params: { page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestOrganizationInvite(organizationSlug: string, inviteId: number) {
  return organizationInvitesInviteIdUsingGet({ params: { invite_id: inviteId }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function createOrganizationInvite(organizationSlug: string, payload: MobileInviteIn) {
  return organizationInvitesUsingPost({ body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function cancelOrganizationInvite(organizationSlug: string, inviteId: number) {
  return organizationInvitesInviteIdUsingDelete({ params: { invite_id: inviteId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function resendOrganizationInvite(organizationSlug: string, inviteId: number) {
  return organizationInvitesInviteIdResendUsingPost({ params: { invite_id: inviteId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestOrganizationTeams(organizationSlug: string, page: number, pageSize: number, filters: OrganizationTeamFilters = {}) {
  return teamsUsingGet({ params: { ...filters, page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestAllOrganizationTeams(organizationSlug: string, filters: OrganizationTeamFilters = {}, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestOrganizationTeams(organizationSlug, page, currentPageSize, filters),
    { pageSize, getKey: item => item.id },
  )
}

export function requestOrganizationTeam(organizationSlug: string, teamId: number) {
  return teamsTeamIdUsingGet({ params: { team_id: teamId }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestOrganizationTeamMemberCandidates(organizationSlug: string, teamId: number, page: number, pageSize: number, keyword?: string) {
  return httpGet<PagedMemberOut>(
    `/api/teams/${teamId}/member-candidates/`,
    { page, page_size: pageSize, keyword },
    undefined,
    organizationAdminRequestOptions(organizationSlug),
  )
}

export function requestAllOrganizationTeamMemberCandidates(organizationSlug: string, teamId: number, keyword?: string, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestOrganizationTeamMemberCandidates(organizationSlug, teamId, page, currentPageSize, keyword),
    { pageSize, getKey: item => item.pk },
  )
}

export function createOrganizationTeam(organizationSlug: string, payload: TeamIn) {
  return teamsUsingPost({ body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function updateOrganizationTeam(organizationSlug: string, teamId: number, payload: TeamPatchIn) {
  return teamsTeamIdUsingPatch({ params: { team_id: teamId }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function deleteOrganizationTeam(organizationSlug: string, teamId: number) {
  return teamsTeamIdUsingDelete({ params: { team_id: teamId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function addOrganizationTeamMember(organizationSlug: string, teamId: number, userId: number) {
  return teamsTeamIdMembersUserIdUsingPost({ params: { team_id: teamId, user_id: userId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function removeOrganizationTeamMember(organizationSlug: string, teamId: number, userId: number) {
  return teamsTeamIdMembersUserIdUsingDelete({ params: { team_id: teamId, user_id: userId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestOrganizationRoles(organizationSlug: string) {
  return accessOrganizationRolesUsingGet({ options: organizationAdminRequestOptions(organizationSlug) })
}

export function createOrganizationRole(organizationSlug: string, payload: CustomRoleCreateIn) {
  return accessOrganizationRolesUsingPost({ body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function updateOrganizationRole(organizationSlug: string, roleId: number, payload: CustomRolePatchIn) {
  return accessOrganizationRolesRoleIdUsingPatch({ params: { role_id: roleId }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function deleteOrganizationRole(organizationSlug: string, roleId: number) {
  return accessOrganizationRolesRoleIdUsingDelete({ params: { role_id: roleId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestTeamRoles(organizationSlug: string, teamId: number) {
  return accessTeamsTeamIdRolesUsingGet({ params: { team_id: teamId }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function createTeamRole(organizationSlug: string, teamId: number, payload: CustomRoleCreateIn) {
  return accessTeamsTeamIdRolesUsingPost({ params: { team_id: teamId }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function updateTeamRole(organizationSlug: string, teamId: number, roleId: number, payload: CustomRolePatchIn) {
  return accessTeamsTeamIdRolesRoleIdUsingPatch({ params: { team_id: teamId, role_id: roleId }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function deleteTeamRole(organizationSlug: string, teamId: number, roleId: number) {
  return accessTeamsTeamIdRolesRoleIdUsingDelete({ params: { team_id: teamId, role_id: roleId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestAssignablePermissions(organizationSlug: string) {
  return accessPermissionsUsingGet({ options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestOrganizationRoleBindings(organizationSlug: string) {
  return accessOrganizationBindingsUsingGet({ options: organizationAdminRequestOptions(organizationSlug) })
}

export function createOrganizationRoleBinding(organizationSlug: string, payload: RoleBindingIn) {
  return accessOrganizationBindingsUsingPost({ body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function deleteOrganizationRoleBinding(organizationSlug: string, bindingId: number) {
  return accessOrganizationBindingsBindingIdUsingDelete({ params: { binding_id: bindingId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestTeamRoleBindings(organizationSlug: string, teamId: number) {
  return accessTeamsTeamIdBindingsUsingGet({ params: { team_id: teamId }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function createTeamRoleBinding(organizationSlug: string, teamId: number, payload: RoleBindingIn) {
  return accessTeamsTeamIdBindingsUsingPost({ params: { team_id: teamId }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function deleteTeamRoleBinding(organizationSlug: string, teamId: number, bindingId: number) {
  return accessTeamsTeamIdBindingsBindingIdUsingDelete({ params: { team_id: teamId, binding_id: bindingId }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestRoleManagementNavigation(organizationSlug: string) {
  return accessRoleManagementNavigationUsingGet({ options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestRoleMembers(organizationSlug: string, roleId: number, page: number, pageSize: number, assignment: 'all' | 'assigned' | 'unassigned' = 'all', teamId?: number) {
  return accessRoleManagementRolesRoleIdMembersUsingGet({ params: { role_id: roleId, team_id: teamId, assignment, page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestAllRoleMembers(organizationSlug: string, roleId: number, assignment: 'all' | 'assigned' | 'unassigned' = 'all', teamId?: number, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestRoleMembers(organizationSlug, roleId, page, currentPageSize, assignment, teamId),
    { pageSize, getKey: item => item.member_id },
  )
}

export function updateRoleMembers(organizationSlug: string, roleId: number, payload: RoleMemberAssignmentIn, teamId?: number) {
  return accessRoleManagementRolesRoleIdMembersUsingPatch({ params: { role_id: roleId, team_id: teamId }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestOrganizationResponsibilities(organizationSlug: string, page: number, pageSize: number, filters: OrganizationResponsibilityFilters = {}) {
  return houseStaffResponsibilitiesUsingGet({ params: { ...filters, page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestOrganizationResponsibility(organizationSlug: string, memberId: number) {
  return houseStaffResponsibilitiesMemberIdUsingGet({ params: { member_id: memberId }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function updateOrganizationResponsibility(organizationSlug: string, memberId: number, payload: PropertyResponsibilityUpdateIn) {
  return houseStaffResponsibilitiesMemberIdUsingPut({ params: { member_id: memberId }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestResponsibilitySummary(organizationSlug: string, teamId: number) {
  return houseStaffResponsibilitiesSummaryUsingGet({ params: { team_id: teamId }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestResponsibilityLandlords(organizationSlug: string, page: number, pageSize: number, filters: Omit<HouseContactsUsingGetParams, 'page' | 'page_size'> = {}) {
  return houseContactsUsingGet({ params: { ...filters, page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestAllResponsibilityLandlords(organizationSlug: string, filters: Omit<HouseContactsUsingGetParams, 'page' | 'page_size'> = {}, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestResponsibilityLandlords(organizationSlug, page, currentPageSize, filters),
    { pageSize, getKey: item => item.id },
  )
}

export function requestResponsibilityBuildings(organizationSlug: string, page: number, pageSize: number, filters: Omit<HouseBuildingsUsingGetParams, 'page' | 'page_size'> = {}) {
  return houseBuildingsUsingGet({ params: { ...filters, page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestAllResponsibilityBuildings(organizationSlug: string, filters: Omit<HouseBuildingsUsingGetParams, 'page' | 'page_size'> = {}, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestResponsibilityBuildings(organizationSlug, page, currentPageSize, filters),
    { pageSize, getKey: item => item.id },
  )
}

export function requestAllOrganizationBuildings(organizationSlug: string, filters: Omit<HouseBuildingsUsingGetParams, 'page' | 'page_size'> = {}, pageSize = 100) {
  return requestAllResponsibilityBuildings(organizationSlug, filters, pageSize)
}

export function requestResponsibilityEstates(organizationSlug: string, page: number, pageSize: number, filters: Omit<HouseEstatesUsingGetParams, 'page' | 'page_size'> = {}) {
  return houseEstatesUsingGet({ params: { ...filters, page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestAllResponsibilityEstates(organizationSlug: string, filters: Omit<HouseEstatesUsingGetParams, 'page' | 'page_size'> = {}, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestResponsibilityEstates(organizationSlug, page, currentPageSize, filters),
    { pageSize, getKey: item => item.id },
  )
}

export function requestOrganizationSettings(organizationSlug: string) {
  return settingsOrgUsingGet({ options: organizationAdminRequestOptions(organizationSlug) })
}

export function updateOrganizationSetting(organizationSlug: string, key: string, payload: SetSettingIn) {
  return settingsOrgKeyUsingPut({ params: { key }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function resetOrganizationSetting(organizationSlug: string, key: string) {
  return settingsOrgKeyUsingDelete({ params: { key }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestTeamSettings(organizationSlug: string, teamId: number) {
  return settingsTeamsTeamIdUsingGet({ params: { team_id: teamId }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function updateTeamSetting(organizationSlug: string, teamId: number, key: string, payload: SetSettingIn) {
  return settingsTeamsTeamIdKeyUsingPut({ params: { team_id: teamId, key }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function resetTeamSetting(organizationSlug: string, teamId: number, key: string) {
  return settingsTeamsTeamIdKeyUsingDelete({ params: { team_id: teamId, key }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestCurrentSubscription(organizationSlug: string) {
  return subscriptionsCurrentUsingGet({ options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestSubscriptionPlans(organizationSlug: string) {
  return subscriptionsPlansUsingGet({ options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestSubscriptionOrders(organizationSlug: string, page: number, pageSize: number) {
  return subscriptionsOrdersUsingGet({ params: { page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestAllSubscriptionOrders(organizationSlug: string, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestSubscriptionOrders(organizationSlug, page, currentPageSize),
    { pageSize, getKey: item => item.id },
  )
}

export function requestSubscriptionOrder(organizationSlug: string, orderNo: string) {
  return subscriptionsOrdersOrderNoUsingGet({ params: { order_no: orderNo }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function createSubscriptionOrder(organizationSlug: string, payload: PurchaseOrderIn) {
  return subscriptionsOrdersUsingPost({ body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function cancelSubscriptionOrder(organizationSlug: string, orderNo: string) {
  return subscriptionsOrdersOrderNoCancelUsingPost({ params: { order_no: orderNo }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function checkoutSubscriptionOrder(organizationSlug: string, orderNo: string) {
  return subscriptionsOrdersOrderNoCheckoutUsingPost({ params: { order_no: orderNo }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function refreshSubscriptionOrderPayment(organizationSlug: string, orderNo: string) {
  return subscriptionsOrdersOrderNoRefreshPaymentUsingPost({ params: { order_no: orderNo }, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestInvoiceProfile(organizationSlug: string) {
  return subscriptionsInvoiceProfileUsingGet({ options: organizationAdminRequestOptions(organizationSlug) })
}

export function updateInvoiceProfile(organizationSlug: string, payload: InvoiceProfileIn) {
  return subscriptionsInvoiceProfileUsingPut({ body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestInvoiceRequests(organizationSlug: string, page: number, pageSize: number) {
  return subscriptionsInvoiceRequestsUsingGet({ params: { page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestAllInvoiceRequests(organizationSlug: string, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestInvoiceRequests(organizationSlug, page, currentPageSize),
    { pageSize, getKey: item => item.id },
  )
}

export function createInvoiceRequest(organizationSlug: string, payload: InvoiceRequestIn) {
  return subscriptionsInvoiceRequestsUsingPost({ body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestNotificationDispatches(organizationSlug: string, page: number, pageSize: number) {
  return notificationDispatchesUsingGet({ params: { management_context: 'tenant', page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestNotificationDispatch(organizationSlug: string, dispatchId: number) {
  return notificationDispatchesDispatchIdUsingGet({ params: { dispatch_id: dispatchId, management_context: 'tenant' }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function createNotificationDispatch(organizationSlug: string, payload: TenantNotificationDispatchIn) {
  return notificationDispatchesUsingPost({ params: { management_context: 'tenant' }, body: payload, options: organizationAdminRequestOptions(organizationSlug, 'never') })
}

export function requestNotificationDispatchTargets(organizationSlug: string, scope: TenantDispatchScope, page: number, pageSize: number, keyword = '') {
  return notificationDispatchesTargetsUsingGet({ params: { scope, keyword: keyword || undefined, management_context: 'tenant', page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}

export function requestAllNotificationDispatchTargets(organizationSlug: string, scope: TenantDispatchScope, keyword = '', pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestNotificationDispatchTargets(organizationSlug, scope, page, currentPageSize, keyword),
    { pageSize, getKey: item => item.id },
  )
}

export function requestNotificationDispatchDeliveries(organizationSlug: string, dispatchId: number, page: number, pageSize: number) {
  return notificationDispatchesDispatchIdNotificationsUsingGet({ params: { dispatch_id: dispatchId, management_context: 'tenant', page, page_size: pageSize }, options: organizationAdminRequestOptions(organizationSlug) })
}
