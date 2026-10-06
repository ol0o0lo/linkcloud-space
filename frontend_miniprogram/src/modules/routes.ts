import { buildSubpackageRoute } from './subpackages.ts'
import { getCatalogModule } from './catalog.ts'

export const APP_ROUTES = {
  home: getCatalogModule('home').mainRoute,
  saasHome: buildSubpackageRoute('saas', 'index'),
  saasFeature: buildSubpackageRoute('saas', 'feature'),
  saasOnboarding: buildSubpackageRoute('saas', 'onboarding'),
  saasEnterprise: buildSubpackageRoute('saas', 'enterprise'),
  saasPaymentSuccess: buildSubpackageRoute('saas', 'payment-success'),
  houses: getCatalogModule('houses').mainRoute,
  publicHouseSearch: buildSubpackageRoute('housing', 'search/index'),
  publicHouseSearchInput: buildSubpackageRoute('housing', 'search/input'),
  houseCommute: buildSubpackageRoute('housing', 'commute/index'),
  houseCommutePlace: buildSubpackageRoute('housing', 'commute/place'),
  houseCommuteResults: buildSubpackageRoute('housing', 'commute/results'),
  publicHouseCity: buildSubpackageRoute('housing', 'city/index'),
  houseDetail: buildSubpackageRoute('housing', 'detail/index'),
  houseMap: buildSubpackageRoute('housing', 'map/index'),
  homeContentList: buildSubpackageRoute('housing', 'home-content/index'),
  homeContentDetail: buildSubpackageRoute('housing', 'home-content/detail'),
  houseMatch: '/pages/house-match/index',
  houseMatchDetail: buildSubpackageRoute('housing', 'match-detail/index'),
  favorites: getCatalogModule('favorites').mainRoute,
  personalFavorites: buildSubpackageRoute('personal-rental', 'favorites/index'),
  tenantViewings: buildSubpackageRoute('personal-rental', 'viewings/index'),
  tenantViewingDetail: buildSubpackageRoute('personal-rental', 'viewings/detail'),
  tenantLeases: buildSubpackageRoute('personal-rental', 'leases/index'),
  tenantLeaseDetail: buildSubpackageRoute('personal-rental', 'leases/detail'),
  landlordHouseDetail: buildSubpackageRoute('landlord', 'houses/detail'),
  landlordLeaseDetail: buildSubpackageRoute('landlord', 'leases/detail'),
  landlordStore: buildSubpackageRoute('landlord', 'store/index'),
  landlordInvite: buildSubpackageRoute('landlord', 'invite/index'),
  invitation: '/pages/invitations/index',
  organizationRental: buildSubpackageRoute('organization-rental', 'index'),
  organizationHouses: buildSubpackageRoute('organization-rental', 'houses/index'),
  organizationHouseDetail: buildSubpackageRoute('organization-rental', 'houses/detail'),
  organizationHouseForm: buildSubpackageRoute('organization-rental', 'houses/form'),
  organizationEstates: buildSubpackageRoute('organization-rental', 'estates/index'),
  organizationEstateForm: buildSubpackageRoute('organization-rental', 'estates/form'),
  organizationBuildings: buildSubpackageRoute('organization-rental', 'buildings/index'),
  organizationBuildingForm: buildSubpackageRoute('organization-rental', 'buildings/form'),
  organizationMap: buildSubpackageRoute('organization-rental', 'map/index'),
  organizationVacancySync: buildSubpackageRoute('organization-rental', 'vacancy-sync/index'),
  organizationContacts: buildSubpackageRoute('organization-rental', 'contacts/index'),
  organizationViewings: buildSubpackageRoute('organization-rental', 'viewings/index'),
  organizationViewingForm: buildSubpackageRoute('organization-rental', 'viewings/form'),
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
  accountSettings: '/pages/account/settings',
  phoneVerification: '/pages/account/phone',
  profile: '/pages/account/profile',
  realName: '/pages/account/real-name',
  wallet: '/pages/account/wallet',
  referrals: '/pages/account/referrals',
  accountSecurity: '/pages/account/security',
  login: '/pages/auth/login',
  pcLogin: '/pages/auth/pc-login',
  register: '/pages/auth/register',
  startupError: '/pages/error/startup',
  forbidden: '/pages/error/forbidden',
  notFound: '/pages/error/not-found',
} as const

const protectedAccountRoutes: readonly string[] = [
  APP_ROUTES.accountSettings,
  APP_ROUTES.phoneVerification,
  APP_ROUTES.profile,
  APP_ROUTES.realName,
  APP_ROUTES.wallet,
  APP_ROUTES.referrals,
  APP_ROUTES.accountSecurity,
  APP_ROUTES.notificationPreferences,
]

const protectedMessageRoutes: readonly string[] = [
  APP_ROUTES.messageDetail,
]

export function isProtectedAccountRoute(path: string): boolean {
  return protectedAccountRoutes.includes(normalizeAppRoutePath(path).split('?')[0])
}

export function isProtectedMessageRoute(path: string): boolean {
  return protectedMessageRoutes.includes(normalizeAppRoutePath(path).split('?')[0])
}

export function normalizeAppRoutePath(path: string): string {
  return path === '/' ? APP_ROUTES.home : path
}

export function getLoginRoute(redirect = ''): string {
  const target = redirect.trim()
  return target ? `${APP_ROUTES.login}?redirect=${encodeURIComponent(target)}` : APP_ROUTES.login
}

export function shouldBypassStartupBoundary(path: string): boolean {
  return normalizeAppRoutePath(path) === APP_ROUTES.startupError
}

export function getHouseDetailRoute(houseId: number, commuteRouteId?: number): string {
  const route = `${APP_ROUTES.houseDetail}?id=${encodeURIComponent(String(houseId))}`
  return commuteRouteId ? `${route}&commute_route_id=${encodeURIComponent(String(commuteRouteId))}` : route
}

export function getHouseMatchRoute(shareKey: string): string {
  return `${APP_ROUTES.houseMatch}?key=${encodeURIComponent(shareKey)}`
}

export function getHouseMatchDetailRoute(shareKey: string, houseId: number): string {
  return `${APP_ROUTES.houseMatchDetail}?key=${encodeURIComponent(shareKey)}&id=${encodeURIComponent(String(houseId))}`
}

export function getInvitationRoute(kind: 'organization' | 'landlord', credential: string): string {
  const queryKey = kind === 'organization' ? 'key' : 'token'
  return `${APP_ROUTES.invitation}?kind=${kind}&${queryKey}=${encodeURIComponent(credential)}`
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

export function getOrganizationEstateFormRoute(estateId?: number): string {
  if (!estateId)
    return APP_ROUTES.organizationEstateForm
  return `${APP_ROUTES.organizationEstateForm}?id=${encodeURIComponent(String(estateId))}`
}

export function getOrganizationBuildingFormRoute(buildingId?: number): string {
  if (!buildingId)
    return APP_ROUTES.organizationBuildingForm
  return `${APP_ROUTES.organizationBuildingForm}?id=${encodeURIComponent(String(buildingId))}`
}

export function getOrganizationViewingDetailRoute(viewingRecordId: number): string {
  return `${APP_ROUTES.organizationViewingDetail}?id=${encodeURIComponent(String(viewingRecordId))}`
}

export function getOrganizationViewingFormRoute(houseId?: number): string {
  if (!houseId)
    return APP_ROUTES.organizationViewingForm
  return `${APP_ROUTES.organizationViewingForm}?houseId=${encodeURIComponent(String(houseId))}`
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

export function getOrganizationHouseSigningRoute(houseId: number): string {
  return `${APP_ROUTES.organizationSigning}?houseId=${encodeURIComponent(String(houseId))}`
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
