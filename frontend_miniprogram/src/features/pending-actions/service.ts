import type { PendingAction } from '@/domain/pending-action'
import { favoritesPendingActionRegistry } from '@/features/favorites/pending-actions'
import { tenantRentalPendingActionRegistry } from '@/features/tenant-rental/pending-actions'

export interface PendingActionExecution {
  executed: boolean
  successMessage: string
}

export async function executeAppPendingAction(pending: PendingAction | null): Promise<PendingActionExecution> {
  if (pending?.type === 'favorite-house') {
    const result = await favoritesPendingActionRegistry.consume(pending)
    return { executed: result.executed, successMessage: '已收藏房源' }
  }
  if (pending?.type === 'book-viewing') {
    const result = await tenantRentalPendingActionRegistry.consume(pending)
    return { executed: result.executed, successMessage: '预约已提交' }
  }
  return { executed: false, successMessage: '' }
}
