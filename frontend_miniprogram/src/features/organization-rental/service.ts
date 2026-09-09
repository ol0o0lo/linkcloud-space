import type {
  ContactIn,
  ContactPatchIn,
  DealSigningWithAllocationIn,
  HouseIn,
  HousePatchIn,
  LeaseAllocationReviewIn,
  LeaseAllocationVoidIn,
  LeasePatchIn,
  OrganizationBuildingFilters,
  OrganizationContactFilters,
  OrganizationEstateFilters,
  OrganizationHouseFilters,
  OrganizationLeaseFilters,
  OrganizationViewingFilters,
  VacancySyncIn,
  ViewingRecordPatchIn,
} from '@/services/manual/organization-rental'
import {
  applyOrganizationVacancySync,
  createOrganizationContactRequest,
  createOrganizationHouseRequest,
  inviteOrganizationLandlordRequest,
  patchOrganizationContactRequest,
  patchOrganizationHouseRequest,
  patchOrganizationLeaseRequest,
  previewOrganizationVacancySync,
  requestOrganizationAllocationCapabilities,
  requestOrganizationAllocationRequest,
  requestOrganizationAllocationRequests,
  requestOrganizationAnalyticsOverview,
  requestOrganizationAnalyticsTrends,
  requestOrganizationBuildingMap,
  requestOrganizationBuildings,
  requestOrganizationContacts,
  requestOrganizationEstateMap,
  requestOrganizationEstates,
  requestOrganizationHouse,
  requestOrganizationHouses,
  requestOrganizationLease,
  requestOrganizationLeases,
  requestOrganizationMonthlyAccrualTotals,
  requestOrganizationUnlocatedBuildingCount,
  requestOrganizationViewing,
  requestOrganizationViewings,
  reviewOrganizationAllocationRequest,
  submitOrganizationDealSigning,
  updateOrganizationViewing,
  uploadOrganizationHouseImagesRequest,
  voidOrganizationAllocationRequest,
} from '@/services/manual/organization-rental'

export { HouseStatus } from '@/services/manual/organization-rental'

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
} from '@/services/manual/organization-rental'

export function listOrganizationHouses(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationHouseFilters = {}) {
  return requestOrganizationHouses(organizationSlug, page, pageSize, filters)
}

export function getOrganizationHouse(organizationSlug: string, houseId: number) {
  return requestOrganizationHouse(organizationSlug, houseId)
}

export function createOrganizationHouse(organizationSlug: string, payload: HouseIn) {
  return createOrganizationHouseRequest(organizationSlug, payload)
}

export function patchOrganizationHouse(organizationSlug: string, houseId: number, payload: HousePatchIn) {
  return patchOrganizationHouseRequest(organizationSlug, houseId, payload)
}

export function uploadOrganizationHouseImages(organizationSlug: string, maxCount = 9) {
  return uploadOrganizationHouseImagesRequest(organizationSlug, maxCount)
}

export function listOrganizationEstates(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationEstateFilters = {}) {
  return requestOrganizationEstates(organizationSlug, page, pageSize, filters)
}

export function listOrganizationBuildings(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationBuildingFilters = {}) {
  return requestOrganizationBuildings(organizationSlug, page, pageSize, filters)
}

export function listOrganizationEstateMap(organizationSlug: string, page = 1, pageSize = 100) {
  return requestOrganizationEstateMap(organizationSlug, page, pageSize)
}

export function listOrganizationBuildingMap(organizationSlug: string, page = 1, pageSize = 100) {
  return requestOrganizationBuildingMap(organizationSlug, page, pageSize)
}

export function getOrganizationUnlocatedBuildingCount(organizationSlug: string) {
  return requestOrganizationUnlocatedBuildingCount(organizationSlug)
}

export function listOrganizationContacts(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationContactFilters = {}) {
  return requestOrganizationContacts(organizationSlug, page, pageSize, filters)
}

export function createOrganizationContact(organizationSlug: string, payload: ContactIn) {
  return createOrganizationContactRequest(organizationSlug, payload)
}

export function patchOrganizationContact(organizationSlug: string, contactId: number, payload: ContactPatchIn) {
  return patchOrganizationContactRequest(organizationSlug, contactId, payload)
}

export function inviteOrganizationLandlord(organizationSlug: string, contactId: number, deliveryMethod: 'sms' | 'manual') {
  return inviteOrganizationLandlordRequest(organizationSlug, contactId, deliveryMethod)
}

export function listOrganizationViewings(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationViewingFilters = {}) {
  return requestOrganizationViewings(organizationSlug, page, pageSize, filters)
}

export function getOrganizationViewing(organizationSlug: string, recordId: number) {
  return requestOrganizationViewing(organizationSlug, recordId)
}

export function patchOrganizationViewing(organizationSlug: string, recordId: number, payload: ViewingRecordPatchIn) {
  return updateOrganizationViewing(organizationSlug, recordId, payload)
}

export function listOrganizationLeases(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationLeaseFilters = {}) {
  return requestOrganizationLeases(organizationSlug, page, pageSize, filters)
}

export function getOrganizationLease(organizationSlug: string, leaseId: number) {
  return requestOrganizationLease(organizationSlug, leaseId)
}

export function patchOrganizationLease(organizationSlug: string, leaseId: number, payload: LeasePatchIn) {
  return patchOrganizationLeaseRequest(organizationSlug, leaseId, payload)
}

export function registerOrganizationDeal(organizationSlug: string, payload: DealSigningWithAllocationIn) {
  return submitOrganizationDealSigning(organizationSlug, payload)
}

export function previewVacancySync(organizationSlug: string, payload: VacancySyncIn) {
  return previewOrganizationVacancySync(organizationSlug, payload)
}

export function applyVacancySync(organizationSlug: string, payload: VacancySyncIn) {
  return applyOrganizationVacancySync(organizationSlug, payload)
}

export function getAllocationCapabilities(organizationSlug: string) {
  return requestOrganizationAllocationCapabilities(organizationSlug)
}

export function listAllocationRequests(organizationSlug: string, page = 1, pageSize = 20) {
  return requestOrganizationAllocationRequests(organizationSlug, page, pageSize)
}

export function getAllocationRequest(organizationSlug: string, allocationRequestId: number) {
  return requestOrganizationAllocationRequest(organizationSlug, allocationRequestId)
}

export function reviewOrganizationAllocation(organizationSlug: string, leaseId: number, payload: LeaseAllocationReviewIn) {
  return reviewOrganizationAllocationRequest(organizationSlug, leaseId, payload)
}

export function voidOrganizationAllocation(organizationSlug: string, leaseId: number, payload: LeaseAllocationVoidIn) {
  return voidOrganizationAllocationRequest(organizationSlug, leaseId, payload)
}

export function listMonthlyAccrualTotals(organizationSlug: string, page = 1, pageSize = 20, effectiveMonth?: string) {
  return requestOrganizationMonthlyAccrualTotals(organizationSlug, page, pageSize, effectiveMonth)
}

export function getOrganizationAnalyticsOverview(organizationSlug: string, startDate?: string, endDate?: string) {
  return requestOrganizationAnalyticsOverview(organizationSlug, { start_date: startDate, end_date: endDate })
}

export function getOrganizationAnalyticsTrends(organizationSlug: string, startDate?: string, endDate?: string) {
  return requestOrganizationAnalyticsTrends(organizationSlug, { start_date: startDate, end_date: endDate })
}
