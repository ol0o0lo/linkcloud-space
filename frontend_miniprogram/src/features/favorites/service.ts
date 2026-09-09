import { createHouseFavorite, deleteHouseFavorite, requestHouseFavorite, requestHouseFavorites } from '@/services/manual/favorites'

export type { FavoriteOut } from '@/services/manual/favorites'

export function listHouseFavorites(page = 1, pageSize = 20) {
  return requestHouseFavorites(page, pageSize)
}

export function getHouseFavorite(houseId: number) {
  return requestHouseFavorite(houseId)
}

export function favoriteHouse(houseId: number) {
  return createHouseFavorite(houseId)
}

export function unfavoriteHouse(houseId: number) {
  return deleteHouseFavorite(houseId)
}
