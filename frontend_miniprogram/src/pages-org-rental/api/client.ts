import type {
  AnalyticsOverviewUsingGetParams,
  AnalyticsTrendsUsingGetParams,
  BuildingIn,
  BuildingPatchIn,
  ContactIn,
  ContactPatchIn,
  DealSigningWithAllocationIn,
  EstateDetailOut,
  EstateIn,
  EstatePatchIn,
  HouseIn as GeneratedHouseIn,
  HousePatchIn as GeneratedHousePatchIn,
  HouseBuildingMapUsingGetParams,
  HouseBuildingsUsingGetParams,
  HouseContactsUsingGetParams,
  HouseEstateMapUsingGetParams,
  HouseEstatesUsingGetParams,
  HouseHousesUsingGetParams,
  HouseLeasesUsingGetParams,
  HouseViewingRecordsUsingGetParams,
  IHouseListingType,
  LeaseAllocationReviewIn,
  LeaseAllocationVoidIn,
  LeasePatchIn,
  OrganizationWorkspaceMembersUsingGetParams,
  VacancySyncIn,
  ViewingRecordIn,
  ViewingRecordPatchIn,
} from '@/services/openapi/types'
import { buildOrganizationScope } from '@/pages-org-rental/domain/organization-rental'
import { httpGet, httpPost } from '@/http/http'
import { chooseAndUploadMedia } from '@/infra/upload/client'
import {
  houseBuildingMapUnlocatedCountUsingGet,
  houseBuildingMapUnlocatedUsingGet,
  houseBuildingMapUsingGet,
  houseBuildingsBuildingIdUsingGet,
  houseBuildingsBuildingIdUsingPatch,
  houseBuildingsUsingGet,
  houseBuildingsUsingPost,
  houseContactsContactIdLandlordInviteUsingPost,
  houseContactsContactIdUsingPatch,
  houseContactsUsingGet,
  houseContactsUsingPost,
  houseEstateMapUsingGet,
  houseEstatesEstateIdUsingGet,
  houseEstatesEstateIdUsingPatch,
  houseEstatesUsingGet,
  houseEstatesUsingPost,
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
  houseViewingRecordsUsingPost,
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
import { organizationWorkspaceMembersUsingGet } from '@/services/openapi/zuzhijiagou'

import { HouseListingType } from '@/services/openapi/types'

export { HouseStatus } from '@/services/openapi/types'

export type HouseIn = Omit<GeneratedHouseIn, 'listing_type'> & { listing_type?: IHouseListingType | null }
export type HousePatchIn = Omit<GeneratedHousePatchIn, 'listing_type'> & { listing_type?: IHouseListingType | null }

function toGeneratedListingType(value?: IHouseListingType | null): HouseListingType | null | undefined {
  if (value === undefined)
    return undefined
  if (value === null)
    return null
  return HouseListingType[value]
}

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
  DealSigningWithAllocationIn,
  EstateDetailOut,
  EstateIn,
  EstateMapMarkerOut,
  EstateOut,
  EstatePatchIn,
  HouseOut,
  LeaseAllocationOut,
  LeaseAllocationReviewIn,
  LeaseAllocationVoidIn,
  LeaseOut,
  LeasePatchIn,
  MonthlyAccrualTotalOut,
  VacancySyncIn,
  VacancySyncOut,
  ViewingRecordIn,
  ViewingRecordOut,
  ViewingRecordPatchIn,
  WorkspaceMemberOut,
} from '@/services/openapi/types'

export type OrganizationEstateDetailOut = EstateDetailOut & {
  developer: string | null
  built_year: number | null
  subdistrict?: string
  description: string
}

export type OrganizationHouseFilters = Omit<HouseHousesUsingGetParams, 'page' | 'page_size'>
export type OrganizationEstateFilters = Omit<HouseEstatesUsingGetParams, 'page' | 'page_size'>
export type OrganizationBuildingFilters = Omit<HouseBuildingsUsingGetParams, 'page' | 'page_size'>
export type OrganizationContactFilters = Omit<HouseContactsUsingGetParams, 'page' | 'page_size'>
export type OrganizationViewingFilters = Omit<HouseViewingRecordsUsingGetParams, 'page' | 'page_size'>
export type OrganizationLeaseFilters = Omit<HouseLeasesUsingGetParams, 'page' | 'page_size'>
export type OrganizationViewingAssigneeFilters = Omit<OrganizationWorkspaceMembersUsingGetParams, 'page' | 'page_size'>

export interface HouseAIInsightFactOut {
  id: string
  label: string
  value: string
}

export interface HouseAIInsightTextOut {
  text: string
  fact_ids: string[]
}

export interface HouseAIInsightSignalOut {
  label: string
  value: string
  tone: 'positive' | 'neutral' | 'caution'
  fact_ids: string[]
}

export interface HouseAIInsightViewingQuestionOut extends HouseAIInsightTextOut {
  missing_field_keys: string[]
}

export interface HouseAIInsightContentOut {
  schema_version: number
  conclusion: HouseAIInsightTextOut
  signals: HouseAIInsightSignalOut[]
  appeal_points: HouseAIInsightTextOut[]
  viewing_questions: HouseAIInsightViewingQuestionOut[]
  missing_fields: Array<{ key: string, label: string }>
  facts: HouseAIInsightFactOut[]
}

export interface HouseAIInsightOut {
  state: 'not_generated' | 'fresh' | 'expired'
  insight: HouseAIInsightContentOut | null
  generated_at: string | null
  expires_at: string | null
  source_changed: boolean
}

export function requestOrganizationHouses(organizationSlug: string, page: number, pageSize: number, filters: OrganizationHouseFilters = {}) {
  return houseHousesUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationHouse(organizationSlug: string, houseId: number) {
  return houseHousesHouseIdUsingGet({ params: { house_id: houseId }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationHouseAIInsight(organizationSlug: string, houseId: number) {
  return httpGet<HouseAIInsightOut>(`/api/house/houses/${houseId}/ai-insight/`, undefined, undefined, buildOrganizationScope(organizationSlug))
}

export function generateOrganizationHouseAIInsightRequest(organizationSlug: string, houseId: number) {
  return httpPost<HouseAIInsightOut>(`/api/house/houses/${houseId}/ai-insight/generate/`, {}, undefined, undefined, buildOrganizationScope(organizationSlug, 'never'))
}

export function createOrganizationHouseRequest(organizationSlug: string, payload: HouseIn) {
  const body = { ...payload, listing_type: toGeneratedListingType(payload.listing_type) }
  return houseHousesUsingPost({ body, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function patchOrganizationHouseRequest(organizationSlug: string, houseId: number, payload: HousePatchIn) {
  const body = { ...payload, listing_type: toGeneratedListingType(payload.listing_type) }
  return houseHousesHouseIdUsingPatch({ params: { house_id: houseId }, body, options: buildOrganizationScope(organizationSlug, 'never') })
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

export function requestOrganizationEstate(organizationSlug: string, estateId: number): Promise<OrganizationEstateDetailOut> {
  return houseEstatesEstateIdUsingGet({ params: { estate_id: estateId }, options: buildOrganizationScope(organizationSlug) }) as Promise<OrganizationEstateDetailOut>
}

export function createOrganizationEstateRequest(organizationSlug: string, payload: EstateIn) {
  return houseEstatesUsingPost({ body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function patchOrganizationEstateRequest(organizationSlug: string, estateId: number, payload: EstatePatchIn) {
  return houseEstatesEstateIdUsingPatch({ params: { estate_id: estateId }, body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function requestOrganizationBuildings(organizationSlug: string, page: number, pageSize: number, filters: OrganizationBuildingFilters = {}) {
  return houseBuildingsUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationBuilding(organizationSlug: string, buildingId: number) {
  return houseBuildingsBuildingIdUsingGet({ params: { building_id: buildingId }, options: buildOrganizationScope(organizationSlug) })
}

export function createOrganizationBuildingRequest(organizationSlug: string, payload: BuildingIn) {
  return houseBuildingsUsingPost({ body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function patchOrganizationBuildingRequest(organizationSlug: string, buildingId: number, payload: BuildingPatchIn) {
  return houseBuildingsBuildingIdUsingPatch({ params: { building_id: buildingId }, body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function requestOrganizationEstateMap(
  organizationSlug: string,
  page: number,
  pageSize: number,
  filters: Omit<HouseEstateMapUsingGetParams, 'page' | 'page_size' | 'coordinate_system'> = {},
) {
  return houseEstateMapUsingGet({ params: { coordinate_system: 'gcj02', ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function requestOrganizationBuildingMap(
  organizationSlug: string,
  page: number,
  pageSize: number,
  filters: Omit<HouseBuildingMapUsingGetParams, 'page' | 'page_size' | 'coordinate_system'> = {},
) {
  return houseBuildingMapUsingGet({ params: { coordinate_system: 'gcj02', ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
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

export function createOrganizationViewingRequest(organizationSlug: string, payload: ViewingRecordIn) {
  return houseViewingRecordsUsingPost({ body: payload, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function requestOrganizationViewingAssignees(organizationSlug: string, page: number, pageSize: number, filters: OrganizationViewingAssigneeFilters = {}) {
  return organizationWorkspaceMembersUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
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

export function uploadOrganizationLeaseContractRequest(organizationSlug: string) {
  return chooseAndUploadMedia({ kind: 'file', scope: { kind: 'organization', organizationSlug }, resourceType: 'lease_contract', mediaScope: 'org', maxCount: 1, extensions: ['pdf', 'doc', 'docx'] })
}

export function requestOrganizationUnlocatedBuildings(organizationSlug: string, page: number, pageSize: number, keyword?: string) {
  return houseBuildingMapUnlocatedUsingGet({ params: { page, page_size: pageSize, keyword }, options: buildOrganizationScope(organizationSlug) })
}
