<script setup lang="ts">
import type { FavoriteOut } from '@/features/favorites/service'
import { computed, ref } from 'vue'
import { buildFavoriteHouseCardModel } from '@/domain/house-card'
import { listHouseFavorites, unfavoriteHouse } from '@/features/favorites/service'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppHouseCardSkeleton from '@/components/app/AppHouseCardSkeleton.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { usePagedPage } from '@/hooks/usePagedPage'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '我的收藏', enablePullDownRefresh: true } })

const removingFavoriteIds = ref<Set<number>>(new Set())
const favoritePage = usePagedPage<FavoriteOut>({
  loader: ({ page, pageSize }) => listHouseFavorites(page, pageSize),
  pageSize: 12,
  keyOf: item => item.id,
})
const unavailableFavoriteCount = computed(() => favoritePage.items.value.filter(item => !item.available).length)

function openFavorite(item: FavoriteOut) {
  if (!item.available) {
    uni.showToast({ title: '该房源已下架', icon: 'none' })
    return
  }
  uni.navigateTo({ url: getHouseDetailRoute(Number(item.target_id)) })
}

function isRemovingFavorite(item: FavoriteOut) {
  return removingFavoriteIds.value.has(Number(item.target_id))
}

async function removeFavorite(item: FavoriteOut) {
  const houseId = Number(item.target_id)
  if (removingFavoriteIds.value.has(houseId))
    return

  removingFavoriteIds.value = new Set(removingFavoriteIds.value).add(houseId)
  try {
    await unfavoriteHouse(houseId)
    favoritePage.remove(item)
    uni.showToast({ title: '已取消收藏', icon: 'success' })
  }
  catch {
    uni.showToast({ title: '取消失败，请稍后重试', icon: 'none' })
  }
  finally {
    const next = new Set(removingFavoriteIds.value)
    next.delete(houseId)
    removingFavoriteIds.value = next
  }
}

function goFindHouse() {
  uni.navigateTo({ url: APP_ROUTES.publicHouseSearch })
}
</script>

<template>
  <AppPage variant="list" gutter="loose">
    <template #navigation>
      <AppCustomNavigation title="我的收藏" back scroll-mode="sticky" />
    </template>
    <view class="mb-3 text-xs text-content-muted">
      共 {{ favoritePage.total.value }} 套收藏房源
    </view>
    <AppPagedList
      :items="favoritePage.items.value"
      item-key="id"
      :loading="favoritePage.loading.value"
      :refreshing="favoritePage.refreshing.value"
      :loading-more="favoritePage.loadingMore.value"
      :finished="favoritePage.finished.value"
      :error="favoritePage.error.value"
      loading-text="正在加载收藏…"
      empty-text="还没有收藏房源"
      empty-description="看到喜欢的房源时点一下收藏，之后可以从这里快速找到。"
      empty-icon="no-collection"
      empty-action-text="去找房"
      finished-text="没有更多收藏了"
      @retry="favoritePage.refresh"
      @empty-action="goFindHouse"
    >
      <template #loading>
        <AppHouseCardSkeleton />
      </template>
      <template #item="{ item }">
        <HouseCard
          :card="buildFavoriteHouseCardModel(item)"
          favorite-visible
          favorited
          :favorite-loading="isRemovingFavorite(item)"
          :disabled="!item.available"
          @click="openFavorite(item)"
          @favorite="removeFavorite(item)"
        />
      </template>
    </AppPagedList>
    <AppNotice
      v-if="unavailableFavoriteCount"
      class="mt-3"
      tone="warning"
      title="下架房源说明"
      :description="`当前列表有 ${unavailableFavoriteCount} 套房源已下架，收藏记录仍会保留；你可以直接取消收藏。`"
      compact
    />
  </AppPage>
</template>
