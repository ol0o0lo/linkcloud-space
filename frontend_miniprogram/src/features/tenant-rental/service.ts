import type { TenantViewingRecordIn } from '@/services/manual/tenant-rental'
import {
  cancelTenantViewing,
  createTenantViewing,
  requestTenantLease,
  requestTenantLeases,
  requestTenantViewing,
  requestTenantViewings,
} from '@/services/manual/tenant-rental'

export type { TenantLeaseOut, TenantViewingRecordIn, TenantViewingRecordOut } from '@/services/manual/tenant-rental'

export function listTenantViewings(page = 1, pageSize = 20) {
  return requestTenantViewings(page, pageSize)
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
