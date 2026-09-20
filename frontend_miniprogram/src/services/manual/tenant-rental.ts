import type { PagedTenantViewingRecordOut, TenantViewingRecordIn } from '@/services/openapi/types'
import { httpGet, httpPost } from '@/http/http'
import {
  houseTenantLeasesLeaseIdUsingGet,
  houseTenantLeasesUsingGet,
  houseTenantViewingRecordsUsingGet,
  houseTenantViewingRecordsUsingPost,
  houseTenantViewingRecordsViewingRecordIdCancelUsingPost,
  houseTenantViewingRecordsViewingRecordIdUsingGet,
} from '@/services/openapi/zuke'

export type { PagedTenantLeaseOut, PagedTenantViewingRecordOut, TenantLeaseOut, TenantViewingRecordIn, TenantViewingRecordOut } from '@/services/openapi/types'

const personalRequestOptions = { requestScope: { kind: 'personal' as const } }
const personalReadRequestOptions = { ...personalRequestOptions, authRetry: 'safe' as const }

export type TenantViewingScope = 'current' | 'history'
export type TenantContactChannel = 'phone' | 'wechat'

export interface TenantContactPreference {
  channels: TenantContactChannel[]
  phone: string
  wechat: string
}

export interface TenantContactRequestIn extends TenantContactPreference {
  house_id: number
}

export interface TenantContactRequestOut {
  notification_id: number
}

export interface UserSettingOut {
  key: string
  value: unknown
}

const TENANT_CONTACT_SETTING_KEY = 'internal.house.contact.v1'

export function requestTenantContactPreference() {
  return httpGet<UserSettingOut>(
    `/api/settings/user/${TENANT_CONTACT_SETTING_KEY}/`,
    undefined,
    undefined,
    personalReadRequestOptions,
  )
}

export function createTenantContactRequest(payload: TenantContactRequestIn) {
  return httpPost<TenantContactRequestOut>(
    '/api/house/tenant/contact/',
    payload,
    undefined,
    undefined,
    personalRequestOptions,
  )
}

export function requestTenantViewings(page: number, pageSize: number, scope?: TenantViewingScope) {
  if (scope) {
    return httpGet<PagedTenantViewingRecordOut>(
      '/api/house/tenant/viewing-records/',
      { page, page_size: pageSize, scope },
      undefined,
      personalReadRequestOptions,
    )
  }
  return houseTenantViewingRecordsUsingGet({
    params: { page, page_size: pageSize },
    options: personalReadRequestOptions,
  })
}

export function requestTenantViewing(viewingRecordId: number) {
  return houseTenantViewingRecordsViewingRecordIdUsingGet({
    params: { viewing_record_id: viewingRecordId },
    options: personalReadRequestOptions,
  })
}

export function createTenantViewing(payload: TenantViewingRecordIn) {
  return houseTenantViewingRecordsUsingPost({ body: payload, options: personalRequestOptions })
}

export function cancelTenantViewing(viewingRecordId: number) {
  return houseTenantViewingRecordsViewingRecordIdCancelUsingPost({
    params: { viewing_record_id: viewingRecordId },
    options: personalRequestOptions,
  })
}

export function requestTenantLeases(page: number, pageSize: number) {
  return houseTenantLeasesUsingGet({
    params: { page, page_size: pageSize },
    options: personalReadRequestOptions,
  })
}

export function requestTenantLease(leaseId: number) {
  return houseTenantLeasesLeaseIdUsingGet({
    params: { lease_id: leaseId },
    options: personalReadRequestOptions,
  })
}
