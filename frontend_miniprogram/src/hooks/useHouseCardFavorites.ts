import { ref } from 'vue'
import { favoriteHouse, listHouseFavorites, unfavoriteHouse } from '@/features/favorites/service'
import { trackPublicHouseEvent } from '@/infra/analytics/client'
import { getHouseDetailRoute, getLoginRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { useSessionStore } from '@/store/session'

export function useHouseCardFavorites() {
  const appContextStore = useAppContextStore()
  const sessionStore = useSessionStore()
  const favoritedHouseIds = ref<Set<number>>(new Set())
  const loadingHouseIds = ref<Set<number>>(new Set())
  let refreshPromise: Promise<void> | null = null

  function isFavorited(houseId: number) {
    return favoritedHouseIds.value.has(houseId)
  }

  function isLoading(houseId: number) {
    return loadingHouseIds.value.has(houseId)
  }

  async function refreshFavorites() {
    if (!appContextStore.authenticated) {
      favoritedHouseIds.value = new Set()
      return
    }
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const result = await listHouseFavorites(1, 500)
          favoritedHouseIds.value = new Set(result.items.map(item => Number(item.target_id)).filter(Number.isFinite))
        }
        catch {
          // 收藏状态属于增强信息，加载失败时保留当前页面已有状态。
        }
        finally {
          refreshPromise = null
        }
      })()
    }
    await refreshPromise
  }

  async function toggleFavorite(houseId: number) {
    const redirect = getHouseDetailRoute(houseId)
    if (!appContextStore.authenticated) {
      sessionStore.deferFavorite(houseId, redirect)
      uni.navigateTo({ url: getLoginRoute(redirect) })
      return
    }
    if (isLoading(houseId))
      return

    loadingHouseIds.value = new Set(loadingHouseIds.value).add(houseId)
    const currentlyFavorited = isFavorited(houseId)
    try {
      if (currentlyFavorited)
        await unfavoriteHouse(houseId)
      else
        await favoriteHouse(houseId)

      const next = new Set(favoritedHouseIds.value)
      if (currentlyFavorited)
        next.delete(houseId)
      else
        next.add(houseId)
      favoritedHouseIds.value = next
      if (!currentlyFavorited)
        trackPublicHouseEvent('house.favorite', houseId)
      uni.showToast({ title: currentlyFavorited ? '已取消收藏' : '已收藏', icon: 'success' })
    }
    catch {
      uni.showToast({ title: '操作失败，请稍后重试', icon: 'none' })
    }
    finally {
      const next = new Set(loadingHouseIds.value)
      next.delete(houseId)
      loadingHouseIds.value = next
    }
  }

  return {
    isFavorited,
    isLoading,
    refreshFavorites,
    toggleFavorite,
  }
}
