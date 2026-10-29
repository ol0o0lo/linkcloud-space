import type { PagedTenantViewingRecordOut as GeneratedPagedTenantViewingRecordOut, TenantContactRequestIn as GeneratedTenantContactRequestIn, TenantContactRequestOut as GeneratedTenantContactRequestOut, TenantViewingRecordOut as GeneratedTenantViewingRecordOut, TenantViewingRecordIn } from '@/services/openapi/types'
import { tenantContactSendOptions } from '@/features/tenant-rental/contact-submission'
import { AppError } from '@/core/errors/app-error'
import type { Conversation, MessagingMessage } from '@/features/messaging/types'
import { httpGet, httpPost, httpPut } from '@/http/http'
import { useWorkspaceStore } from '@/store/workspace'
import {
  houseTenantContactUsingPost,
  houseTenantLeasesLeaseIdUsingGet,
  houseTenantLeasesUsingGet,
  houseTenantViewingRecordsUsingGet,
  houseTenantViewingRecordsUsingPost,
  houseTenantViewingRecordsViewingRecordIdCancelUsingPost,
  houseTenantViewingRecordsViewingRecordIdUsingGet,
} from '@/services/openapi/zuke'

export type { PagedTenantLeaseOut, TenantLeaseOut, TenantViewingRecordIn } from '@/services/openapi/types'

export type TenantViewingRecordOut = GeneratedTenantViewingRecordOut & {
  receptionist?: { name: string, phone: string } | null
}
export type PagedTenantViewingRecordOut = Omit<GeneratedPagedTenantViewingRecordOut, 'items'> & { items: TenantViewingRecordOut[] }

const personalRequestOptions = { requestScope: { kind: 'personal' as const } }
const personalReadRequestOptions = { ...personalRequestOptions, authRetry: 'safe' as const }
const TENANT_CONTACT_SETTING_KEY = 'internal.house.contact.v1'

export type TenantViewingScope = 'current' | 'history'
export type TenantContactChannel = 'phone' | 'wechat'

export interface TenantContactPreference {
  channels: TenantContactChannel[]
  phone: string
  wechat: string
}

export type TenantContactValues = Pick<TenantContactPreference, 'phone' | 'wechat'>
export interface TenantContactShare extends TenantContactValues {
  channels: TenantContactChannel[]
  client_message_id: string
}

function contactOptions(userId: number) {
  return tenantContactSendOptions(userId, () => useWorkspaceStore().user?.id || null)
}

export function startTenantChat(houseId: number, userId: number) {
  return httpPost<Conversation>('/api/house/tenant/chat/', { house_id: houseId }, undefined, undefined, contactOptions(userId))
}

export async function readPersonalContact(userId: number): Promise<TenantContactValues> {
  try {
    const setting = await httpGet<UserSettingOut>(`/api/settings/user/${TENANT_CONTACT_SETTING_KEY}/`, undefined, undefined, contactOptions(userId))
    const value = setting.value as Partial<TenantContactValues> | null
    return { phone: typeof value?.phone === 'string' ? value.phone : '', wechat: typeof value?.wechat === 'string' ? value.wechat : '' }
  }
  catch (error) {
    if (error instanceof AppError && error.statusCode === 404)
      return { phone: '', wechat: '' }
    throw error
  }
}

export async function updatePersonalContact(values: TenantContactValues, userId: number) {
  const setting = await httpPut<UserSettingOut>(`/api/settings/user/${TENANT_CONTACT_SETTING_KEY}/`, { value: values }, undefined, undefined, contactOptions(userId))
  return setting.value as TenantContactValues
}

export function sharePersonalContact(conversationId: number, payload: TenantContactShare, userId: number) {
  return httpPost<MessagingMessage>(`/api/house/tenant/conversations/${conversationId}/contact/`, payload, undefined, undefined, contactOptions(userId))
}

export type TenantContactRequestIn = GeneratedTenantContactRequestIn & TenantContactPreference & {
  client_message_id: string
}

export type TenantContactRequestOut = Omit<Required<GeneratedTenantContactRequestOut>, 'notification_id'> & {
  notification_id: null
}

export interface UserSettingOut {
  key: string
  value: unknown
}

export function requestTenantContactPreference() {
  return httpGet<UserSettingOut>(
    `/api/settings/user/${TENANT_CONTACT_SETTING_KEY}/`,
    undefined,
    undefined,
    personalReadRequestOptions,
  )
}

export async function createTenantContactRequest(payload: TenantContactRequestIn, userId: number): Promise<TenantContactRequestOut> {
  const result = await houseTenantContactUsingPost({
    body: payload,
    options: tenantContactSendOptions(userId, () => useWorkspaceStore().user?.id || null),
  })
  return { ...result, notification_id: null, conversation: result.conversation ?? null, message: result.message ?? null }
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
