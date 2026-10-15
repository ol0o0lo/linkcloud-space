<script setup lang="ts">
import type { ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import OrganizationViewingCard from '@/pages-org-rental/viewings/components/OrganizationViewingCard.vue'
import { listOrganizationViewings } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationViewingDetailRoute, getOrganizationViewingFormRoute } from '@/modules/routes'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '带看管理', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const keyword = ref('')
const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'scheduled', label: '待带看' },
  { value: 'viewed', label: '已带看' },
  { value: 'converted', label: '已成交' },
  { value: 'canceled', label: '已取消' },
  { value: 'no_show', label: '爽约' },
] as const
type ViewingFilter = typeof statusOptions[number]['value']
const statusFilter = ref<ViewingFilter>('all')
const houseId = ref<number>()
const hasFilters = computed(() => Boolean(keyword.value.trim() || statusFilter.value !== 'all'))
onLoad((options) => {
  const id = Number(options?.house_id)
  houseId.value = Number.isInteger(id) && id > 0 ? id : undefined
  const option = statusOptions.find(item => item.value === options?.status)
  if (option)
    statusFilter.value = option.value
})
const list = usePagedPage<ViewingRecordOut>({
  pageSize: 15,
  loader: ({ page, pageSize }) => listOrganizationViewings(appContextStore.organizationSlug, page, pageSize, { keyword: keyword.value.trim() || undefined, house_id: houseId.value, status: statusFilter.value === 'all' ? undefined : statusFilter.value }),
})

function changeStatus(status: ViewingFilter) {
  statusFilter.value = status
  void list.refresh()
}

function openDetail(id: number) {
  uni.navigateTo({ url: getOrganizationViewingDetailRoute(id) })
}

function createViewing() {
  uni.navigateTo({ url: getOrganizationViewingFormRoute(houseId.value) })
}

function handleEmptyAction() {
  if (!hasFilters.value) {
    createViewing()
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
      <AppCustomNavigation title="带看记录" back scroll-mode="sticky">
        <template #action>
          <button class="navigation-action" @click="createViewing">
            新增
          </button>
        </template>
      </AppCustomNavigation>
    </template>
    <view class="viewing-tabs">
      <view v-for="item in statusOptions" :key="item.value" :class="{ active: statusFilter === item.value }" @click="changeStatus(item.value)">
        {{ item.label }}
      </view>
    </view>
    <AppListToolbar
      v-model:keyword="keyword"
      search-placeholder="搜索客户、手机号或房源"
      @search="list.refresh"
      @clear="list.refresh"
    />
    <view class="day-heading">
      {{ houseId ? '当前房源 · ' : '' }}当前筛选共 {{ list.total.value }} 场
    </view>
    <view class="mt-2.5">
      <AppPagedList
        :items="list.items.value"
        :loading="list.loading.value"
        :refreshing="list.refreshing.value"
        :loading-more="list.loadingMore.value"
        :finished="list.finished.value"
        :error="list.error.value"
        loading-text="正在加载带看…"
        :empty-text="hasFilters ? '没有符合条件的带看记录' : '当前还没有带看安排'"
        :empty-description="hasFilters ? '试试清空搜索内容或切换到全部状态。' : '新增带看后，可在这里跟进预约、到访和完成状态。'"
        empty-icon="no-result"
        :empty-action-text="hasFilters ? '清除筛选' : '新增带看'"
        finished-text="没有更多带看了"
        @retry="list.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <OrganizationViewingCard :viewing="item" @click="openDetail(item.id)" />
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
.viewing-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin: 28rpx 0 20rpx;
}
.viewing-tabs view {
  min-width: 120rpx;
  padding: 14rpx 20rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 18rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
  text-align: center;
  background: var(--app-bg-card);
}
.viewing-tabs view.active {
  border-color: var(--app-color-brand);
  color: #fff;
  background: var(--app-color-brand);
}
.day-heading {
  margin: 28rpx 4rpx 12rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 700;
}
</style>
