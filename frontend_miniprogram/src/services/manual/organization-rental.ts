import type {
  AnalyticsOverviewUsingGetParams,
  AnalyticsTrendsUsingGetParams,
  ContactIn,
  ContactPatchIn,
  DealSigningWithAllocationIn,
  HouseBuildingMapUsingGetParams,
  HouseBuildingsUsingGetParams,
  HouseContactsUsingGetParams,
  HouseEstateMapUsingGetParams,
  HouseEstatesUsingGetParams,
  HouseHousesUsingGetParams,
  HouseIn,
  HouseLeasesUsingGetParams,
  HousePatchIn,
  HouseViewingRecordsUsingGetParams,
  LeaseAllocationReviewIn,
  LeaseAllocationVoidIn,
  LeasePatchIn,
  VacancySyncIn,
  ViewingRecordPatchIn,
} from '@/services/openapi/types'
import { buildOrganizationScope } from '@/domain/organization-rental'
import { chooseAndUploadMedia } from '@/infra/upload/client'
import {
  houseBuildingMapUnlocatedCountUsingGet,
  houseBuildingMapUsingGet,
  houseBuildingsUsingGet,
  houseContactsContactIdLandlordInviteUsingPost,
  houseContactsContactIdUsingPatch,
  houseContactsUsingGet,
  houseContactsUsingPost,
  houseEstateMapUsingGet,
  houseEstatesUsingGet,
  houseHousesHouseIdUsingGet,
  houseHousesHouseIdUsingPatch,
  houseHousesUsingGet,
  houseHousesUsingPost,
  houseLeasesDealSigningUsingPost,
  houseLeasesLeaseIdAllocationOpenApiVoidUsingPost,
  houseLeasesLeaseIdAllocationReviewUsingPost,
  houseLeasesLeaseIdUsingGet,
  houseLeasesLeaseIdUsingPatch,
  houseLeasesUsingGet,
  houseVacancySyncUsingPost,
  houseViewingRecordsRecordIdUsingGet,
  houseViewingRecordsRecordIdUsingPatch,
  houseViewingRecordsUsingGet,
} from '@/services/openapi/guanli'
import {
  analyticsOverviewUsingGet,
  analyticsTrendsUsingGet,
} from '@/services/openapi/jingyingfenxi'
import {
  allocationCapabilitiesUsingGet,
  allocationMonthlyTotalsUsingGet,
  allocationRequestsAllocationRequestIdUsingGet,
  allocationRequestsUsingGet,
} from '@/services/openapi/shouyifenpei'

export { HouseStatus } from '@/services/openapi/types'

export type {
  AllocationCapabilitiesOut,
  AllocationRequestOut,
  AnalyticsOverviewOut,
  AnalyticsTrendPointOut,
  BuildingInventoryOut,
  BuildingMapMarkerOut,
  ContactIn,
  ContactOut,
  ContactPatchIn,
  DealSigningWithAllocationIn,
  EstateDetailOut,
  EstateMapMarkerOut,
  HouseIn,
  HouseOut,
  HousePatchIn,
  LeaseAllocationOut,
  LeaseAllocationReviewIn,
  LeaseAllocationVoidIn,
  LeaseOut,
  LeasePatchIn,
  MonthlyAccrualTotalOut,
  VacancySyncIn,
  VacancySyncOut,
  ViewingRecordOut,
  ViewingRecordPatchIn,
} from '@/services/openapi/types'

export type OrganizationHouseFilters = Omit<HouseHousesUsingGetParams, 'page' | 'page_size'>
export type OrganizationEstateFilters = Omit<HouseEstatesUsingGetParams, 'page' | 'page_size'>
export type OrganizationBuildingFilters = Omit<HouseBuildingsUsingGetParams, 'page' | 'page_size'>
export type OrganizationContactFilters = Omit<HouseContactsUsingGetParams, 'page' | 'page_size'>
export type OrganizationViewingFilters = Omit<HouseViewingRecordsUsingGetParams, 'page' | 'page_size'>
export type OrganizationLeaseFilters = Omit<HouseLeasesUsingGetParams, 'page' | 'page_size'>

export function requestOrganizationHouses(organizationSlug: string, page: number, pageSize: number, filters: OrganizationHouseFilters = {}) {
  return houseHousesUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationHouse(organizationSlug: string, houseId: number) {
  return houseHousesHouseIdUsingGet({ params: { house_id: houseId }, options: buildOrganizationScope(organizationSlug) })
}

export function createOrganizationHouseRequest(organizationSlug: string, payload: HouseIn) {
  return houseHousesUsingPost({ body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function patchOrganizationHouseRequest(organizationSlug: string, houseId: number, payload: HousePatchIn) {
  return houseHousesHouseIdUsingPatch({ params: { house_id: houseId }, body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export async function uploadOrganizationHouseImagesRequest(organizationSlug: string, maxCount = 9) {
  return chooseAndUploadMedia({
    scope: { kind: 'organization', organizationSlug },
    resourceType: 'house_image',
    mediaScope: 'org',
    maxCount,
  })
}

export function requestOrganizationEstates(organizationSlug: string, page: number, pageSize: number, filters: OrganizationEstateFilters = {}) {
  return houseEstatesUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationBuildings(organizationSlug: string, page: number, pageSize: number, filters: OrganizationBuildingFilters = {}) {
  return houseBuildingsUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationEstateMap(organizationSlug: string, page: number, pageSize: number, filters: Omit<HouseEstateMapUsingGetParams, 'page' | 'page_size'> = {}) {
  return houseEstateMapUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationBuildingMap(organizationSlug: string, page: number, pageSize: number, filters: Omit<HouseBuildingMapUsingGetParams, 'page' | 'page_size'> = {}) {
  return houseBuildingMapUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationUnlocatedBuildingCount(organizationSlug: string) {
  return houseBuildingMapUnlocatedCountUsingGet({ options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationContacts(organizationSlug: string, page: number, pageSize: number, filters: OrganizationContactFilters = {}) {
  return houseContactsUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function createOrganizationContactRequest(organizationSlug: string, payload: ContactIn) {
  return houseContactsUsingPost({ body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function patchOrganizationContactRequest(organizationSlug: string, contactId: number, payload: ContactPatchIn) {
  return houseContactsContactIdUsingPatch({ params: { contact_id: contactId }, body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function inviteOrganizationLandlordRequest(organizationSlug: string, contactId: number, deliveryMethod: 'sms' | 'manual') {
  return houseContactsContactIdLandlordInviteUsingPost({
    params: { contact_id: contactId, delivery_method: deliveryMethod },
    options: buildOrganizationScope(organizationSlug, 'never'),
  })
}

export function requestOrganizationViewings(organizationSlug: string, page: number, pageSize: number, filters: OrganizationViewingFilters = {}) {
  return houseViewingRecordsUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationViewing(organizationSlug: string, recordId: number) {
  return houseViewingRecordsRecordIdUsingGet({ params: { record_id: recordId }, options: buildOrganizationScope(organizationSlug) })
}

export function updateOrganizationViewing(organizationSlug: string, recordId: number, payload: ViewingRecordPatchIn) {
  return houseViewingRecordsRecordIdUsingPatch({ params: { record_id: recordId }, body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function requestOrganizationLeases(organizationSlug: string, page: number, pageSize: number, filters: OrganizationLeaseFilters = {}) {
  return houseLeasesUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationLease(organizationSlug: string, leaseId: number) {
  return houseLeasesLeaseIdUsingGet({ params: { lease_id: leaseId }, options: buildOrganizationScope(organizationSlug) })
}

export function patchOrganizationLeaseRequest(organizationSlug: string, leaseId: number, payload: LeasePatchIn) {
  return houseLeasesLeaseIdUsingPatch({ params: { lease_id: leaseId }, body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function submitOrganizationDealSigning(organizationSlug: string, payload: DealSigningWithAllocationIn) {
  return houseLeasesDealSigningUsingPost({ body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function previewOrganizationVacancySync(organizationSlug: string, payload: VacancySyncIn) {
  return houseVacancySyncUsingPost({ body: { ...payload, mode: 'preview' }, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function applyOrganizationVacancySync(organizationSlug: string, payload: VacancySyncIn) {
  return houseVacancySyncUsingPost({ body: { ...payload, mode: 'apply' }, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function requestOrganizationAllocationCapabilities(organizationSlug: string) {
  return allocationCapabilitiesUsingGet({ options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationAllocationRequests(organizationSlug: string, page: number, pageSize: number) {
  return allocationRequestsUsingGet({ params: { page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationAllocationRequest(organizationSlug: string, allocationRequestId: number) {
  return allocationRequestsAllocationRequestIdUsingGet({ params: { allocation_request_id: allocationRequestId }, options: buildOrganizationScope(organizationSlug) })
}

export function reviewOrganizationAllocationRequest(organizationSlug: string, leaseId: number, payload: LeaseAllocationReviewIn) {
  return houseLeasesLeaseIdAllocationReviewUsingPost({ params: { lease_id: leaseId }, body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function voidOrganizationAllocationRequest(organizationSlug: string, leaseId: number, payload: LeaseAllocationVoidIn) {
  return houseLeasesLeaseIdAllocationOpenApiVoidUsingPost({ params: { lease_id: leaseId }, body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function requestOrganizationMonthlyAccrualTotals(organizationSlug: string, page: number, pageSize: number, effectiveMonth?: string) {
  return allocationMonthlyTotalsUsingGet({ params: { page, page_size: pageSize, effective_month: effectiveMonth || undefined }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationAnalyticsOverview(organizationSlug: string, params: AnalyticsOverviewUsingGetParams = {}) {
  return analyticsOverviewUsingGet({ params, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationAnalyticsTrends(organizationSlug: string, params: AnalyticsTrendsUsingGetParams = {}) {
  return analyticsTrendsUsingGet({ params, options: buildOrganizationScope(organizationSlug) })
}
