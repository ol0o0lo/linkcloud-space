import type { TenantContactRequestIn, TenantViewingRecordIn, TenantViewingScope } from '@/services/manual/tenant-rental'
import {
  cancelTenantViewing,
  createTenantContactRequest,
  createTenantViewing,
  requestTenantContactPreference,
  requestTenantLease,
  requestTenantLeases,
  requestTenantViewing,
  requestTenantViewings,
} from '@/services/manual/tenant-rental'
import { collectAllPages } from '@/utils/pagination/collectAllPages'

export type { TenantContactChannel, TenantContactPreference, TenantContactRequestIn, TenantContactRequestOut, TenantLeaseOut, TenantViewingRecordIn, TenantViewingRecordOut } from '@/services/manual/tenant-rental'
export { startTenantChat } from '@/services/manual/tenant-rental'

export function getTenantContactPreference() {
  return requestTenantContactPreference()
}

export function sendTenantContact(payload: TenantContactRequestIn, userId: number) {
  return createTenantContactRequest(payload, userId)
}

export function listTenantViewings(page = 1, pageSize = 20, scope?: TenantViewingScope) {
  return requestTenantViewings(page, pageSize, scope)
}

export function listCurrentTenantViewings() {
  return collectAllPages(
    ({ page, pageSize }) => requestTenantViewings(page, pageSize, 'current'),
    { pageSize: 500, getKey: item => item.id },
  )
}

export function listHistoricalTenantViewings(page = 1, pageSize = 20) {
  return requestTenantViewings(page, pageSize, 'history')
}

export function getTenantViewing(viewingRecordId: number) {
  return requestTenantViewing(viewingRecordId)
}

export function bookTenantViewing(payload: TenantViewingRecordIn) {
  return createTenantViewing(payload)
}

export function cancelScheduledTenantViewing(viewingRecordId: number) {
  return cancelTenantViewing(viewingRecordId)
}

export function listTenantLeases(page = 1, pageSize = 20) {
  return requestTenantLeases(page, pageSize)
}

export function getTenantLease(leaseId: number) {
  return requestTenantLease(leaseId)
}
