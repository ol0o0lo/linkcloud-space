import type {
  BuildingIn,
  BuildingPatchIn,
  ContactIn,
  ContactPatchIn,
  EstateIn,
  EstatePatchIn,
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
  OrganizationViewingAssigneeFilters,
  OrganizationViewingFilters,
  VacancySyncIn,
  ViewingRecordIn,
  ViewingRecordPatchIn,
} from './client'
import {
  applyOrganizationVacancySync,
  createOrganizationBuildingRequest,
  createOrganizationContactRequest,
  createOrganizationEstateRequest,
  createOrganizationHouseRequest,
  createOrganizationViewingRequest,
  generateOrganizationHouseAIInsightRequest,
  inviteOrganizationLandlordRequest,
  patchOrganizationBuildingRequest,
  patchOrganizationContactRequest,
  patchOrganizationEstateRequest,
  patchOrganizationHouseRequest,
  patchOrganizationLeaseRequest,
  previewOrganizationVacancySync,
  requestOrganizationAllocationCapabilities,
  requestOrganizationAllocationRequest,
  requestOrganizationAllocationRequests,
  requestOrganizationAnalyticsOverview,
  requestOrganizationAnalyticsTrends,
  requestOrganizationBuilding,
  requestOrganizationBuildingMap,
  requestOrganizationBuildings,
  requestOrganizationContacts,
  requestOrganizationEstate,
  requestOrganizationEstateMap,
  requestOrganizationEstates,
  requestOrganizationHouse,
  requestOrganizationHouseAIInsight,
  requestOrganizationHouses,
  requestOrganizationLease,
  requestOrganizationLeases,
  requestOrganizationMonthlyAccrualTotals,
  requestOrganizationUnlocatedBuildingCount,
  requestOrganizationUnlocatedBuildings,
  requestOrganizationViewing,
  requestOrganizationViewingAssignees,
  requestOrganizationViewings,
  reviewOrganizationAllocationRequest,
  updateOrganizationViewing,
  uploadOrganizationHouseImagesRequest,
  uploadOrganizationLeaseContractRequest,
  voidOrganizationAllocationRequest,
} from './client'

export { HouseStatus } from './client'

export type {
  AllocationCapabilitiesOut,
  AllocationRequestOut,
  AnalyticsOverviewOut,
  AnalyticsTrendPointOut,
  BuildingIn,
  BuildingInventoryOut,
  BuildingMapMarkerOut,
  BuildingMapUnlocatedOut,
  BuildingOut,
  BuildingPatchIn,
  ContactIn,
  ContactOut,
  ContactPatchIn,
  EstateDetailOut,
  EstateIn,
  EstateMapMarkerOut,
  EstateOut,
  EstatePatchIn,
  HouseAIInsightOut,
  HouseIn,
  HouseOut,
  HousePatchIn,
  LeaseAllocationOut,
  LeaseAllocationReviewIn,
  LeaseAllocationVoidIn,
  LeaseOut,
  LeasePatchIn,
  MonthlyAccrualTotalOut,
  OrganizationEstateDetailOut,
  VacancySyncIn,
  VacancySyncOut,
  ViewingRecordIn,
  ViewingRecordOut,
  ViewingRecordPatchIn,
  WorkspaceMemberOut,
} from './client'

export function listOrganizationHouses(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationHouseFilters = {}) {
  return requestOrganizationHouses(organizationSlug, page, pageSize, filters)
}

export function getOrganizationHouse(organizationSlug: string, houseId: number) {
  return requestOrganizationHouse(organizationSlug, houseId)
}

export function getOrganizationHouseAIInsight(organizationSlug: string, houseId: number) {
  return requestOrganizationHouseAIInsight(organizationSlug, houseId)
}

export function generateOrganizationHouseAIInsight(organizationSlug: string, houseId: number) {
  return generateOrganizationHouseAIInsightRequest(organizationSlug, houseId)
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

export function getOrganizationEstate(organizationSlug: string, estateId: number) {
  return requestOrganizationEstate(organizationSlug, estateId)
}

export function createOrganizationEstate(organizationSlug: string, payload: EstateIn) {
  return createOrganizationEstateRequest(organizationSlug, payload)
}

export function patchOrganizationEstate(organizationSlug: string, estateId: number, payload: EstatePatchIn) {
  return patchOrganizationEstateRequest(organizationSlug, estateId, payload)
}

export function listOrganizationBuildings(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationBuildingFilters = {}) {
  return requestOrganizationBuildings(organizationSlug, page, pageSize, filters)
}

export function getOrganizationBuilding(organizationSlug: string, buildingId: number) {
  return requestOrganizationBuilding(organizationSlug, buildingId)
}

export function createOrganizationBuilding(organizationSlug: string, payload: BuildingIn) {
  return createOrganizationBuildingRequest(organizationSlug, payload)
}

export function patchOrganizationBuilding(organizationSlug: string, buildingId: number, payload: BuildingPatchIn) {
  return patchOrganizationBuildingRequest(organizationSlug, buildingId, payload)
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

export function createOrganizationViewing(organizationSlug: string, payload: ViewingRecordIn) {
  return createOrganizationViewingRequest(organizationSlug, payload)
}

export function listOrganizationViewingAssignees(organizationSlug: string, page = 1, pageSize = 100, filters: OrganizationViewingAssigneeFilters = {}) {
  return requestOrganizationViewingAssignees(organizationSlug, page, pageSize, filters)
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

export function previewVacancySync(organizationSlug: string, payload: VacancySyncIn) {
  return previewOrganizationVacancySync(organizationSlug, payload)
}

export function applyVacancySync(organizationSlug: string, payload: VacancySyncIn) {
  return applyOrganizationVacancySync(organizationSlug, payload)
}

export function getAllocationCapabilities(organizationSlug: string) {
  return requestOrganizationAllocationCapabilities(organizationSlug)
}

export function listAllocationRequests(organizationSlug: string, page = 1, pageSize = 20, status?: string) {
  return requestOrganizationAllocationRequests(organizationSlug, page, pageSize, status)
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

export function uploadOrganizationLeaseContract(organizationSlug: string) {
  return uploadOrganizationLeaseContractRequest(organizationSlug)
}

export function listOrganizationUnlocatedBuildings(organizationSlug: string, page: number, pageSize: number, keyword?: string) {
  return requestOrganizationUnlocatedBuildings(organizationSlug, page, pageSize, keyword)
}
