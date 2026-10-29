import type { PagedPageResult } from '@/hooks/usePagedPage'
import { buildOrganizationScope } from '@/domain/organization-scope'
import { httpGet, httpPatch, httpPost } from '@/http/http'

export const customerStages = [
  { value: 'new', label: '新客户' },
  { value: 'contacted', label: '已联系' },
  { value: 'viewing', label: '已预约' },
  { value: 'negotiating', label: '洽谈中' },
  { value: 'won', label: '已成交' },
  { value: 'lost', label: '暂不考虑' },
] as const

export type CustomerStage = typeof customerStages[number]['value']

export interface OrganizationCustomer {
  id: number
  name: string
  phone: string
  email: string
  notes: string
  is_active: boolean
  stage: CustomerStage
  stage_label: string
  assigned_to_id: number | null
  assigned_to_name: string
  source: string
  wechat: string
  min_rent: string | null
  max_rent: string | null
  preferred_region: string
  bedrooms: number | null
  move_in_date: string | null
}

export interface OrganizationCustomerInput {
  name: string
  phone: string
  email?: string
  notes?: string
  is_active?: boolean
  stage?: CustomerStage
  assigned_to_id?: number | null
  source?: string
  wechat?: string
  min_rent?: string | null
  max_rent?: string | null
  preferred_region?: string
  bedrooms?: number | null
  move_in_date?: string | null
}

export interface OrganizationCustomerFilters {
  keyword?: string
  stage?: CustomerStage
  scope?: 'mine' | 'all'
}

export interface OrganizationCustomerWorkbench {
  new_customers: number
  new_inquiries: number
  today_viewings: number
  unassigned_viewings: number
  pending_allocations: number
  items: Array<{ inquiry_id: number, house_id: number, customer_name: string, phone: string, status: string }>
}

export function getOrganizationCustomerCapabilities(organizationSlug: string) {
  return httpGet<{ can_manage: boolean }>('/api/house/customer-capabilities/', undefined, undefined, buildOrganizationScope(organizationSlug))
}

export function listOrganizationCustomers(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationCustomerFilters = {}) {
  return httpGet<PagedPageResult<OrganizationCustomer>>('/api/house/customers/', { ...filters, page, page_size: pageSize }, undefined, buildOrganizationScope(organizationSlug))
}

export function getOrganizationCustomer(organizationSlug: string, customerId: number) {
  return httpGet<OrganizationCustomer>(`/api/house/customers/${customerId}/`, undefined, undefined, buildOrganizationScope(organizationSlug))
}

export function createOrganizationCustomer(organizationSlug: string, payload: OrganizationCustomerInput) {
  return httpPost<OrganizationCustomer>('/api/house/customers/', payload, undefined, undefined, buildOrganizationScope(organizationSlug, 'never'))
}

export function patchOrganizationCustomer(organizationSlug: string, customerId: number, payload: Partial<OrganizationCustomerInput>) {
  return httpPatch<OrganizationCustomer>(`/api/house/customers/${customerId}/`, payload, undefined, undefined, buildOrganizationScope(organizationSlug, 'never'))
}

export function convertOrganizationInquiry(organizationSlug: string, notificationId: number, payload: { name: string, phone: string }) {
  return httpPost<Pick<OrganizationCustomer, 'id' | 'name' | 'phone' | 'wechat'>>(`/api/house/customer-inquiries/${notificationId}/convert/`, payload, undefined, undefined, buildOrganizationScope(organizationSlug, 'never'))
}

export function getOrganizationCustomerWorkbench(organizationSlug: string) {
  return httpGet<OrganizationCustomerWorkbench>('/api/house/customer-workbench/', undefined, undefined, buildOrganizationScope(organizationSlug))
}
