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
const statusFilter = ref<'all' | 'scheduled' | 'viewed'>('all')
const houseId = ref<number>()
const hasFilters = computed(() => Boolean(keyword.value.trim() || statusFilter.value !== 'all'))
const weekDays = computed(() => {
  const today = new Date()
  const mondayOffset = (today.getDay() + 6) % 7
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - mondayOffset + index)
    return { label: `周${['一', '二', '三', '四', '五'][index]}`, day: date.getDate(), active: date.toDateString() === today.toDateString() }
  })
})
const todayLabel = computed(() => new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }))
onLoad((options) => {
  const id = Number(options?.house_id)
  houseId.value = Number.isInteger(id) && id > 0 ? id : undefined
  if (options?.status === 'scheduled' || options?.status === 'viewed')
    statusFilter.value = options.status
})
const list = usePagedPage<ViewingRecordOut>({
  pageSize: 15,
  loader: ({ page, pageSize }) => listOrganizationViewings(appContextStore.organizationSlug, page, pageSize, { keyword: keyword.value.trim() || undefined, house_id: houseId.value, status: statusFilter.value === 'all' ? undefined : statusFilter.value }),
})

function changeStatus(status: 'all' | 'scheduled' | 'viewed') {
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
      <AppCustomNavigation title="带看排期" back scroll-mode="sticky">
        <template #action>
          <button class="navigation-action" @click="createViewing">
            新增
          </button>
        </template>
      </AppCustomNavigation>
    </template>
    <view class="week-card">
      <view class="week-card__top">
        <strong>本周排期</strong><text>共 {{ list.total.value }} 场</text>
      </view>
      <view class="week-row">
        <view v-for="day in weekDays" :key="day.label" :class="{ active: day.active }">
          <text>{{ day.label }}</text><strong>{{ day.day }}</strong>
        </view>
      </view>
    </view>
    <view class="viewing-tabs">
      <view v-for="item in ([['all', '全部'], ['scheduled', '待带看'], ['viewed', '已完成']] as const)" :key="item[0]" :class="{ active: statusFilter === item[0] }" @click="changeStatus(item[0])">
        {{ item[1] }}
      </view>
    </view>
    <AppListToolbar
      v-model:keyword="keyword"
      search-placeholder="搜索客户、手机号或房源"
      @search="list.refresh"
      @clear="list.refresh"
    />
    <view class="day-heading">
      今天 · {{ todayLabel }} · 共 {{ list.total.value }} 场
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
.week-card {
  margin-top: 44rpx;
  padding: 30rpx 32rpx;
  border-radius: 32rpx;
  background: var(--app-bg-card);
}
.week-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.week-card__top strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.week-card__top text {
  color: var(--app-color-brand);
  font-size: 23rpx;
}
.week-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10rpx;
  margin-top: 26rpx;
}
.week-row > view {
  display: flex;
  height: 92rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border-radius: 22rpx;
  color: var(--app-text-secondary);
  background: var(--app-bg-subtle);
}
.week-row > view.active {
  color: var(--app-color-brand);
  background: var(--app-bg-brand-soft);
}
.week-row text {
  font-size: 20rpx;
}
.week-row strong {
  font-size: 23rpx;
}
.viewing-tabs {
  display: flex;
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
