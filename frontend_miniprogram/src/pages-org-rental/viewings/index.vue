<script setup lang="ts">
import type { ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import OrganizationViewingCard from '@/pages-org-rental/viewings/components/OrganizationViewingCard.vue'
import { listOrganizationViewings } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationViewingDetailRoute, getOrganizationViewingFormRoute } from '@/modules/routes'
import AppActionBar from '@/components/app/AppActionBar.vue'
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
const todayOnly = ref(false)
const unassignedOnly = ref(false)
const scope = ref<'mine' | 'all'>()
const hasFilters = computed(() => Boolean(keyword.value.trim() || statusFilter.value !== 'all' || todayOnly.value || unassignedOnly.value || scope.value))
onLoad((options) => {
  const id = Number(options?.house_id)
  houseId.value = Number.isInteger(id) && id > 0 ? id : undefined
  todayOnly.value = options?.today === 'true'
  unassignedOnly.value = options?.unassigned === 'true'
  scope.value = options?.scope === 'mine' || options?.scope === 'all' ? options.scope : undefined
  const option = statusOptions.find(item => item.value === options?.status)
  if (option)
    statusFilter.value = option.value
})
const list = usePagedPage<ViewingRecordOut>({
  pageSize: 15,
  loader: ({ page, pageSize }) => listOrganizationViewings(appContextStore.organizationSlug, page, pageSize, {
    keyword: keyword.value.trim() || undefined,
    house_id: houseId.value,
    status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    today: todayOnly.value || undefined,
    unassigned: unassignedOnly.value || undefined,
    scope: scope.value,
  }),
})

function changeStatus({ name }: { name: string | number }) {
  statusFilter.value = name as ViewingFilter
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
  todayOnly.value = false
  unassignedOnly.value = false
  scope.value = undefined
  void list.refresh()
}
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="带看记录" back scroll-mode="sticky" />
    </template>
    <template #header>
      <view class="viewing-filters border-b-hairline border-b-app-divider border-b-solid bg-surface-card px-app-gutter py-0">
        <wd-search
          v-model="keyword"
          variant="filled"
          placeholder="搜索客户、手机号或房源"
          placeholder-left
          hide-cancel
          @search="list.refresh"
          @clear="list.refresh"
        />
        <wd-tabs :model-value="statusFilter" :slidable-num="6" line-width="20" line-height="3" @change="changeStatus">
          <wd-tab v-for="item in statusOptions" :key="item.value" :name="item.value" :title="item.label" />
        </wd-tabs>
      </view>
    </template>
    <view class="viewing-results min-h-9.5 flex items-center justify-between gap-2">
      <view class="viewing-results__summary min-w-0 flex flex-wrap gap-1.5 text-size-xs text-content-secondary leading-4.5">
        <text>{{ houseId ? '当前房源 · ' : '' }}{{ statusOptions.find(item => item.value === statusFilter)?.label }}记录</text>
        <text v-if="list.loaded.value" class="viewing-results__count text-size-2xs text-content-muted">共 {{ list.total.value }} 场</text>
      </view>
      <button v-if="hasFilters" class="viewing-reset m-0 shrink-0 border-0 bg-transparent pb-2 pl-1.5 pr-0 pt-2 text-size-2xs text-app-brand leading-4.5" @click="handleEmptyAction">
        重置筛选
      </button>
    </view>
    <view v-if="todayOnly || unassignedOnly || scope === 'mine'" class="viewing-scope mb-2.5 flex items-center gap-1.5 rounded-app-sm bg-surface-brand-soft px-2.5 py-2 text-size-2xs text-content-secondary leading-4">
      <view class="i-carbon-filter shrink-0" />
      <text>{{ [todayOnly ? '今日安排' : '', unassignedOnly ? '未分派负责人' : '', scope === 'mine' ? '本人负责' : ''].filter(Boolean).join(' · ') }}</text>
    </view>
    <view class="viewing-list">
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
        :empty-action-text="hasFilters ? '清除筛选' : ''"
        finished-text="已显示全部带看记录"
        @retry="list.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <OrganizationViewingCard :viewing="item" @click="openDetail(item.id)" />
        </template>
      </AppPagedList>
    </view>
    <template #footer>
      <AppActionBar>
        <wd-button block @click="createViewing">
          新增带看
        </wd-button>
      </AppActionBar>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.viewing-reset::after {
  @apply border-0;
}
.viewing-filters {
  --wot-search-padding: 16rpx 0 12rpx;
  --wot-search-input-height: 80rpx;
  --wot-search-input-radius: var(--app-radius-md);
  --wot-search-input-bg: var(--app-bg-page);
  --wot-search-cover-bg: var(--app-bg-page);
  --wot-search-input-font-size: 26rpx;
  --wot-search-placeholder-font-size: 26rpx;
  --wot-search-placeholder-color: var(--app-text-muted);
  --wot-search-icon-color: var(--app-text-muted);
  --wot-search-block-margin-right: 0;
  --wot-tabs-nav-item-font-size: 26rpx;
  --wot-tabs-nav-item-line-height: 40rpx;
  --wot-tabs-nav-item-padding: 24rpx 6rpx;
  --wot-tabs-nav-color: var(--app-text-secondary);
  --wot-tabs-nav-color-active: var(--app-color-brand);
  --wot-tabs-nav-font-weight-active: 600;
  --wot-tabs-nav-line-bg: var(--app-color-brand);
  --wot-tabs-nav-line-bottom: 0;
}
.viewing-results__summary {
  align-items: baseline;
}
.viewing-list {
  --wot-loadmore-color: var(--app-text-muted);
  --wot-loadmore-font-size: 22rpx;
  --wot-divider-font-size-default: 22rpx;
  --wot-divider-color-default: var(--app-text-muted);
  --wot-divider-color-line: var(--app-divider-color);
  --wot-divider-line-height: 1rpx;
}
</style>
