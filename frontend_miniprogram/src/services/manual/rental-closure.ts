import type { PagedPageResult } from '@/hooks/usePagedPage'
import type { HouseOut, LeaseAllocationOut, LeaseOut, ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import type { RegisterSigningIn } from '@/services/openapi/types'
import type { OrganizationCustomer } from './organization-customers'
import { buildOrganizationScope } from '@/domain/organization-scope'
import { httpGet, httpPatch, httpPost } from '@/http/http'
import { houseLeasesRegisterSigningUsingPost } from '@/services/openapi/guanli'

export interface OrganizationInquiry {
  id: number
  house_id: number
  house: Pick<HouseOut, 'id' | 'room_number' | 'building' | 'is_active'>
  contact_id: number | null
  customer_name: string
  phone: string
  wechat: string
  assigned_to_id: number | null
  assigned_to_name: string
  status: 'new' | 'processing' | 'closed' | 'signed'
  status_label: string
  notes: string
  viewing_count: number
  signed_lease_id: number | null
  created_at: string
  can_manage: boolean
  can_process: boolean
  viewings?: ViewingRecordOut[]
  leases?: LeaseOut[]
}

export function createRentalRequestId() {
  return `rental-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export function listOrganizationInquiries(slug: string, page: number, pageSize: number, filters: { status?: string, keyword?: string, contact_id?: number } = {}) {
  return httpGet<PagedPageResult<OrganizationInquiry>>('/api/house/inquiries/', { ...filters, page, page_size: pageSize }, undefined, buildOrganizationScope(slug))
}

export function getOrganizationInquiry(slug: string, id: number) {
  return httpGet<OrganizationInquiry>(`/api/house/inquiries/${id}/`, undefined, undefined, buildOrganizationScope(slug))
}

export function updateOrganizationInquiry(slug: string, id: number, data: Partial<Pick<OrganizationInquiry, 'customer_name' | 'phone' | 'wechat' | 'notes' | 'status'>>) {
  return httpPatch<OrganizationInquiry>(`/api/house/inquiries/${id}/`, data, undefined, undefined, buildOrganizationScope(slug, 'never'))
}

export function assignOrganizationInquiry(slug: string, id: number, assignedToId: number) {
  return httpPost<OrganizationInquiry>(`/api/house/inquiries/${id}/assign/`, { assigned_to_id: assignedToId }, undefined, undefined, buildOrganizationScope(slug, 'never'))
}

export function bindOrganizationInquiry(slug: string, id: number, data: { name: string, phone: string }) {
  return httpPost<Pick<OrganizationCustomer, 'id' | 'name' | 'phone' | 'wechat'>>(`/api/house/inquiries/${id}/convert/`, data, undefined, undefined, buildOrganizationScope(slug, 'never'))
}

export function registerOrganizationSigning(slug: string, data: RegisterSigningIn) {
  return houseLeasesRegisterSigningUsingPost({ body: data, options: buildOrganizationScope(slug, 'never') })
}

export function listLeaseAllocationHistory(slug: string, leaseId: number) {
  return httpGet<PagedPageResult<LeaseAllocationOut>>(`/api/house/leases/${leaseId}/allocations/`, { page: 1, page_size: 100 }, undefined, buildOrganizationScope(slug))
}

export interface LeaseAllocationPreview {
  basis_amount: string
  distributable_amount: string
  distribution_method: string
  distribution_rate_bp: number | null
  team_name: string
  performance_month: string
  preview_hash: string
}

export function previewLeaseAllocation(slug: string, leaseId: number, data: { mode: 'initial' | 'correction', previous_request_id?: number }) {
  return httpPost<LeaseAllocationPreview>(`/api/house/leases/${leaseId}/allocations/preview/`, data, undefined, undefined, buildOrganizationScope(slug, 'never'))
}

export function submitLeaseAllocation(slug: string, leaseId: number, data: { mode: 'initial' | 'resubmit' | 'correction', beneficiary_user_ids?: number[], previous_request_id?: number, reason?: string, client_request_id: string, preview_hash?: string }) {
  return httpPost<LeaseAllocationOut>(`/api/house/leases/${leaseId}/allocations/`, data, undefined, undefined, buildOrganizationScope(slug, 'never'))
}

export function actOnLeaseAllocation(slug: string, leaseId: number, requestId: number, action: 'withdraw' | 'review' | 'void', data: { decision?: 'approve' | 'reject', reason?: string }) {
  return httpPost<LeaseAllocationOut['allocation_request']>(`/api/house/leases/${leaseId}/allocations/${requestId}/${action}/`, data, undefined, undefined, buildOrganizationScope(slug, 'never'))
}
