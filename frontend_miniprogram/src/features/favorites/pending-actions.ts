import { createPendingActionRegistry } from '@/domain/pending-action'
import { favoriteHouse } from './service'

function isFavoriteHousePayload(payload: unknown): payload is { houseId: number } {
  return Boolean(payload && typeof payload === 'object' && typeof (payload as { houseId?: unknown }).houseId === 'number')
}

export const favoritesPendingActionRegistry = createPendingActionRegistry({
  'favorite-house': {
    version: 1,
    validate: isFavoriteHousePayload,
    execute: payload => favoriteHouse(payload.houseId),
  },
})
