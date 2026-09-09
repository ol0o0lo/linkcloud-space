import type { TenantViewingRecordIn } from '@/services/openapi/types'
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

export function requestTenantViewings(page: number, pageSize: number) {
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
