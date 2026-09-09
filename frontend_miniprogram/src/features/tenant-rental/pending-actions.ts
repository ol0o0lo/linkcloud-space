import { createPendingActionRegistry } from '@/domain/pending-action'
import { isTenantViewingPendingPayload } from '@/domain/tenant-rental'
import { bookTenantViewing } from './service'

export const tenantRentalPendingActionRegistry = createPendingActionRegistry({
  'book-viewing': {
    version: 1,
    validate: isTenantViewingPendingPayload,
    execute: payload => bookTenantViewing({
      house_id: payload.houseId,
      scheduled_at: payload.scheduledAt,
      notes: payload.notes,
    }),
  },
})
