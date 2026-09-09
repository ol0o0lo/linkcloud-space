import { buildSubpackageRoute } from './subpackages.ts'
import { getCatalogModule } from './catalog.ts'

export const APP_ROUTES = {
  home: getCatalogModule('home').mainRoute,
  houses: getCatalogModule('houses').mainRoute,
  houseDetail: buildSubpackageRoute('housing', 'detail/index'),
  houseMatch: '/pages/house-match/index',
  houseMatchDetail: buildSubpackageRoute('housing', 'match-detail/index'),
  favorites: getCatalogModule('favorites').mainRoute,
  tenantViewings: buildSubpackageRoute('personal-rental', 'viewings/index'),
  tenantViewingDetail: buildSubpackageRoute('personal-rental', 'viewings/detail'),
  tenantLeases: buildSubpackageRoute('personal-rental', 'leases/index'),
  tenantLeaseDetail: buildSubpackageRoute('personal-rental', 'leases/detail'),
  landlordHouseDetail: buildSubpackageRoute('landlord', 'houses/detail'),
  landlordLeaseDetail: buildSubpackageRoute('landlord', 'leases/detail'),
  landlordStore: buildSubpackageRoute('landlord', 'store/index'),
  landlordInvite: buildSubpackageRoute('landlord', 'invite/index'),
  organizationRental: buildSubpackageRoute('organization-rental', 'index'),
  organizationHouses: buildSubpackageRoute('organization-rental', 'houses/index'),
  organizationHouseDetail: buildSubpackageRoute('organization-rental', 'houses/detail'),
  organizationHouseForm: buildSubpackageRoute('organization-rental', 'houses/form'),
  organizationEstates: buildSubpackageRoute('organization-rental', 'estates/index'),
  organizationBuildings: buildSubpackageRoute('organization-rental', 'buildings/index'),
  organizationMap: buildSubpackageRoute('organization-rental', 'map/index'),
  organizationVacancySync: buildSubpackageRoute('organization-rental', 'vacancy-sync/index'),
  organizationContacts: buildSubpackageRoute('organization-rental', 'contacts/index'),
  organizationViewings: buildSubpackageRoute('organization-rental', 'viewings/index'),
  organizationViewingDetail: buildSubpackageRoute('organization-rental', 'viewings/detail'),
  organizationLeases: buildSubpackageRoute('organization-rental', 'leases/index'),
  organizationLeaseDetail: buildSubpackageRoute('organization-rental', 'leases/detail'),
  organizationLeaseForm: buildSubpackageRoute('organization-rental', 'leases/form'),
  organizationSigning: buildSubpackageRoute('organization-rental', 'signing/index'),
  organizationAllocation: buildSubpackageRoute('organization-rental', 'allocation/index'),
  organizationAllocationDetail: buildSubpackageRoute('organization-rental', 'allocation/detail'),
  organizationAnalytics: buildSubpackageRoute('organization-rental', 'analytics/index'),
  organizationWork: buildSubpackageRoute('organization-work', 'index'),
  organizationTasks: buildSubpackageRoute('organization-work', 'tasks/index'),
  organizationTaskDetail: buildSubpackageRoute('organization-work', 'tasks/detail'),
  organizationAnnouncements: buildSubpackageRoute('organization-work', 'announcements/index'),
  organizationAnnouncementDetail: buildSubpackageRoute('organization-work', 'announcements/detail'),
  organizationAdmin: buildSubpackageRoute('organization-admin', 'index'),
  organizationAdminMembers: buildSubpackageRoute('organization-admin', 'members/index'),
  organizationAdminMemberDetail: buildSubpackageRoute('organization-admin', 'members/detail'),
  organizationAdminInvitations: buildSubpackageRoute('organization-admin', 'invitations/index'),
  organizationAdminTeams: buildSubpackageRoute('organization-admin', 'teams/index'),
  organizationAdminTeamDetail: buildSubpackageRoute('organization-admin', 'teams/detail'),
  organizationAdminRoles: buildSubpackageRoute('organization-admin', 'roles/index'),
  organizationAdminResponsibilities: buildSubpackageRoute('organization-admin', 'responsibilities/index'),
  organizationAdminSettings: buildSubpackageRoute('organization-admin', 'settings/index'),
  organizationAdminSubscription: buildSubpackageRoute('organization-admin', 'subscription/index'),
  organizationAdminNotificationDispatches: buildSubpackageRoute('organization-admin', 'notification-dispatches/index'),
  organizationAdminNotificationDispatchDetail: buildSubpackageRoute('organization-admin', 'notification-dispatches/detail'),
  messages: getCatalogModule('messages').mainRoute,
  messageDetail: '/pages/messages/detail',
  notificationPreferences: '/pages/messages/preferences',
  me: getCatalogModule('me').mainRoute,
  phoneVerification: '/pages/account/phone',
  profile: '/pages/account/profile',
  realName: '/pages/account/real-name',
  wallet: '/pages/account/wallet',
  referrals: '/pages/account/referrals',
  security: '/pages/account/security',
  login: '/pages/auth/login',
  register: '/pages/auth/register',
  startupError: '/pages/error/startup',
  forbidden: '/pages/error/forbidden',
  notFound: '/pages/error/not-found',
} as const

const protectedAccountRoutes: readonly string[] = [
  APP_ROUTES.phoneVerification,
  APP_ROUTES.profile,
  APP_ROUTES.realName,
  APP_ROUTES.wallet,
  APP_ROUTES.referrals,
  APP_ROUTES.security,
]

export function isProtectedAccountRoute(path: string): boolean {
  return protectedAccountRoutes.includes(normalizeAppRoutePath(path).split('?')[0])
}

export function normalizeAppRoutePath(path: string): string {
  return path === '/' ? APP_ROUTES.home : path
}

export function shouldBypassStartupBoundary(path: string): boolean {
  return normalizeAppRoutePath(path) === APP_ROUTES.startupError
}

export function getHouseDetailRoute(houseId: number): string {
  return `${APP_ROUTES.houseDetail}?id=${encodeURIComponent(String(houseId))}`
}

export function getHouseMatchRoute(shareKey: string): string {
  return `${APP_ROUTES.houseMatch}?key=${encodeURIComponent(shareKey)}`
}

export function getHouseMatchDetailRoute(shareKey: string, houseId: number): string {
  return `${APP_ROUTES.houseMatchDetail}?key=${encodeURIComponent(shareKey)}&id=${encodeURIComponent(String(houseId))}`
}

export function getTenantViewingDetailRoute(viewingRecordId: number): string {
  return `${APP_ROUTES.tenantViewingDetail}?id=${encodeURIComponent(String(viewingRecordId))}`
}

export function getTenantLeaseDetailRoute(leaseId: number): string {
  return `${APP_ROUTES.tenantLeaseDetail}?id=${encodeURIComponent(String(leaseId))}`
}

export function getOrganizationHouseDetailRoute(houseId: number): string {
  return `${APP_ROUTES.organizationHouseDetail}?id=${encodeURIComponent(String(houseId))}`
}

export function getOrganizationHouseFormRoute(houseId?: number): string {
  if (!houseId)
    return APP_ROUTES.organizationHouseForm
  return `${APP_ROUTES.organizationHouseForm}?id=${encodeURIComponent(String(houseId))}`
}

export function getOrganizationViewingDetailRoute(viewingRecordId: number): string {
  return `${APP_ROUTES.organizationViewingDetail}?id=${encodeURIComponent(String(viewingRecordId))}`
}

export function getOrganizationLeaseDetailRoute(leaseId: number): string {
  return `${APP_ROUTES.organizationLeaseDetail}?id=${encodeURIComponent(String(leaseId))}`
}

export function getOrganizationLeaseFormRoute(leaseId: number): string {
  return `${APP_ROUTES.organizationLeaseForm}?id=${encodeURIComponent(String(leaseId))}`
}

export function getOrganizationAllocationDetailRoute(allocationRequestId: number): string {
  return `${APP_ROUTES.organizationAllocationDetail}?id=${encodeURIComponent(String(allocationRequestId))}`
}

export function getOrganizationSigningRoute(viewingRecordId?: number): string {
  if (!viewingRecordId)
    return APP_ROUTES.organizationSigning
  return `${APP_ROUTES.organizationSigning}?viewingId=${encodeURIComponent(String(viewingRecordId))}`
}

export function getOrganizationTaskDetailRoute(target: { assignmentId: number } | { taskId: number }): string {
  if ('assignmentId' in target)
    return `${APP_ROUTES.organizationTaskDetail}?assignmentId=${encodeURIComponent(String(target.assignmentId))}`
  return `${APP_ROUTES.organizationTaskDetail}?taskId=${encodeURIComponent(String(target.taskId))}`
}

export function getOrganizationAnnouncementDetailRoute(announcementId: number): string {
  return `${APP_ROUTES.organizationAnnouncementDetail}?id=${encodeURIComponent(String(announcementId))}`
}

export function getOrganizationAdminMemberDetailRoute(memberId: number): string {
  return `${APP_ROUTES.organizationAdminMemberDetail}?id=${encodeURIComponent(String(memberId))}`
}

export function getOrganizationAdminTeamDetailRoute(teamId: number): string {
  return `${APP_ROUTES.organizationAdminTeamDetail}?id=${encodeURIComponent(String(teamId))}`
}

export function getNotificationDetailRoute(notificationId: number): string {
  return `${APP_ROUTES.messageDetail}?id=${encodeURIComponent(String(notificationId))}`
}
