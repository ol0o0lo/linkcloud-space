<script setup lang="ts">
import type { HouseOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { HouseStatus, listOrganizationHouses } from '@/pages-org-rental/api/organization-rental'
import OrganizationHouseCard from '@/pages-org-rental/houses/components/OrganizationHouseCard.vue'
import { APP_ROUTES, getOrganizationHouseDetailRoute } from '@/modules/routes'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '组织房源', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const keyword = ref('')
const statusFilter = ref<'all' | HouseStatus>('all')
onLoad((options) => {
  const status = options?.status
  if (status === HouseStatus.vacant || status === HouseStatus.listed || status === HouseStatus.rented)
    statusFilter.value = status
})
const summaryCounts = reactive({ vacant: 0, inspection: 0 })
const hasFilters = computed(() => Boolean(keyword.value.trim() || statusFilter.value !== 'all'))
const list = usePagedPage<HouseOut>({
  pageSize: 15,
  loader: async ({ page, pageSize }) => {
    const result = await listOrganizationHouses(appContextStore.organizationSlug, page, pageSize, {
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    })
    if (page === 1) {
      const [vacant, inspection] = await Promise.all([
        listOrganizationHouses(appContextStore.organizationSlug, 1, 1, { status: HouseStatus.vacant }),
        listOrganizationHouses(appContextStore.organizationSlug, 1, 1, { inspection_due: true }),
      ])
      summaryCounts.vacant = vacant.total
      summaryCounts.inspection = inspection.total
    }
    return result
  },
})

function changeStatus(status: 'all' | HouseStatus) {
  if (statusFilter.value === status)
    return
  statusFilter.value = status
  void list.refresh()
}

function openHouse(id: number) {
  uni.navigateTo({ url: getOrganizationHouseDetailRoute(id) })
}

function createHouse() {
  uni.navigateTo({ url: APP_ROUTES.organizationHouseForm })
}

function openMap() {
  uni.navigateTo({ url: APP_ROUTES.organizationMap })
}

function handleEmptyAction() {
  if (!hasFilters.value) {
    createHouse()
    return
  }
  keyword.value = ''
  statusFilter.value = 'all'
  void list.refresh()
}
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="房源盘面" back scroll-mode="sticky">
        <template #action>
          <button class="navigation-action" @click="openMap">
            地图
          </button>
        </template>
      </AppCustomNavigation>
    </template>
    <AppListToolbar
      v-model:keyword="keyword"
      search-placeholder="搜索房号、小区或楼栋"
      action-text="新建房源"
      card
      @search="list.refresh"
      @clear="list.refresh"
      @action="createHouse"
    >
      <template #before>
        <view class="house-tabs">
          <view v-for="item in ([['all', '全部'], [HouseStatus.vacant, '空置'], [HouseStatus.listed, '招租中'], [HouseStatus.rented, '已出租']] as const)" :key="item[0]" :class="{ active: statusFilter === item[0] }" @click="changeStatus(item[0])">
            {{ item[1] }}
          </view>
        </view>
      </template>
    </AppListToolbar>
    <view class="house-summary">
      <view><text>空置</text><strong>{{ summaryCounts.vacant }} 套</strong><view class="summary-mark" /></view><view><text>资料异常</text><strong>{{ summaryCounts.inspection }} 套</strong><view class="summary-mark" /></view>
    </view>
    <view class="mt-2.5">
      <AppPagedList
        :items="list.items.value"
        :loading="list.loading.value"
        :refreshing="list.refreshing.value"
        :loading-more="list.loadingMore.value"
        :finished="list.finished.value"
        :error="list.error.value"
        loading-text="正在加载房源…"
        :empty-text="hasFilters ? '没有符合条件的房源' : '当前组织还没有房源'"
        :empty-description="hasFilters ? '试试清空搜索内容或切换到全部状态。' : '先新建第一套房源，再补充图片、租金和招租状态。'"
        empty-icon="no-result"
        :empty-action-text="hasFilters ? '清除筛选' : '新建房源'"
        finished-text="没有更多房源了"
        @retry="list.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <OrganizationHouseCard :house="item" @click="openHouse(item.id)" />
        </template>
      </AppPagedList>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.navigation-action {
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--app-color-brand);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 56rpx;
  background: transparent;
}
.navigation-action::after {
  border: 0;
}
.house-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}
.house-tabs view {
  min-width: 116rpx;
  padding: 14rpx 20rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 18rpx;
  box-sizing: border-box;
  color: var(--app-text-secondary);
  font-size: 22rpx;
  text-align: center;
  background: var(--app-bg-card);
}
.house-tabs view.active {
  border-color: var(--app-color-brand);
  color: #fff;
  background: var(--app-color-brand);
}
.house-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
  margin-top: 22rpx;
}
.house-summary > view {
  position: relative;
  display: flex;
  min-height: 128rpx;
  padding: 24rpx;
  flex-direction: column;
  gap: 8rpx;
  border-radius: 28rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.house-summary text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.house-summary strong {
  color: var(--app-text-primary);
  font-size: 32rpx;
}
.house-summary .summary-mark {
  position: absolute;
  bottom: 0;
  left: 24rpx;
  width: 56rpx;
  height: 7rpx;
  border-radius: 999rpx;
  background: var(--app-color-brand);
}
</style>
