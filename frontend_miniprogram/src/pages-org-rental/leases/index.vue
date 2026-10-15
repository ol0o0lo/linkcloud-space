<script setup lang="ts">
import type { LeaseOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import OrganizationLeaseCard from '@/pages-org-rental/leases/components/OrganizationLeaseCard.vue'
import { listOrganizationLeases } from '@/pages-org-rental/api/organization-rental'
import { APP_ROUTES, getOrganizationHouseSigningRoute, getOrganizationLeaseDetailRoute, getOrganizationTasksRoute } from '@/modules/routes'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '组织租约', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const keyword = ref('')
const statusFilter = ref<'all' | 'pending' | 'active' | 'expired'>('all')
const hasFilters = computed(() => Boolean(keyword.value.trim() || statusFilter.value !== 'all'))
const summaryCounts = reactive({ pending: 0, active: 0 })
const houseId = ref<number>()
onLoad((options) => {
  const id = Number(options?.house_id)
  houseId.value = Number.isInteger(id) && id > 0 ? id : undefined
  if (options?.status === 'pending' || options?.status === 'active' || options?.status === 'expired')
    statusFilter.value = options.status
})
const list = usePagedPage<LeaseOut>({
  pageSize: 15,
  loader: async ({ page, pageSize }) => {
    const result = await listOrganizationLeases(appContextStore.organizationSlug, page, pageSize, { keyword: keyword.value.trim() || undefined, house_id: houseId.value, status: statusFilter.value === 'all' ? undefined : statusFilter.value })
    if (page === 1) {
      const [pending, active] = await Promise.all([
        listOrganizationLeases(appContextStore.organizationSlug, 1, 1, { status: 'pending' }),
        listOrganizationLeases(appContextStore.organizationSlug, 1, 1, { status: 'active' }),
      ])
      summaryCounts.pending = pending.total
      summaryCounts.active = active.total
    }
    return result
  },
})

function changeStatus(status: 'all' | 'pending' | 'active' | 'expired') {
  statusFilter.value = status
  void list.refresh()
}

function openTasks(scope: 'mine' | 'team') {
  uni.navigateTo({ url: getOrganizationTasksRoute(scope) })
}

function createLease() {
  uni.navigateTo({ url: houseId.value ? getOrganizationHouseSigningRoute(houseId.value) : APP_ROUTES.organizationSigning })
}

function openDetail(id: number) {
  uni.navigateTo({ url: getOrganizationLeaseDetailRoute(id) })
}

function handleEmptyAction() {
  if (!hasFilters.value) {
    createLease()
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
      <AppCustomNavigation title="租约管理" back scroll-mode="sticky">
        <template #action>
          <button class="navigation-action" @click="createLease">
            新建
          </button>
        </template>
      </AppCustomNavigation>
    </template>
    <view class="module-tabs">
      <view class="active">
        租约
      </view><view @click="openTasks('mine')">
        我的任务
      </view><view @click="openTasks('team')">
        团队任务
      </view>
    </view>
    <view class="lease-summary">
      <view><text>待生效</text><strong>{{ summaryCounts.pending }} 份</strong><view /></view><view><text>履约中</text><strong>{{ summaryCounts.active }} 份</strong><view /></view>
    </view>
    <view class="status-tabs">
      <view v-for="item in ([['all', '全部'], ['pending', '待生效'], ['active', '履约中'], ['expired', '已到期']] as const)" :key="item[0]" :class="{ active: statusFilter === item[0] }" @click="changeStatus(item[0])">
        {{ item[1] }}
      </view>
    </view>
    <AppListToolbar
      v-model:keyword="keyword"
      search-placeholder="搜索租客或房源"
      @search="list.refresh"
      @clear="list.refresh"
    />
    <view class="mt-2.5">
      <AppPagedList
        :items="list.items.value"
        :loading="list.loading.value"
        :refreshing="list.refreshing.value"
        :loading-more="list.loadingMore.value"
        :finished="list.finished.value"
        :error="list.error.value"
        loading-text="正在加载租约…"
        :empty-text="hasFilters ? '没有符合条件的租约' : '当前组织还没有租约'"
        :empty-description="hasFilters ? '试试清空搜索内容或切换到全部状态。' : '完成登记签约后，可在这里跟进租约状态和履约信息。'"
        empty-icon="no-result"
        :empty-action-text="hasFilters ? '清除筛选' : '登记签约'"
        finished-text="没有更多租约了"
        @retry="list.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <OrganizationLeaseCard :lease="item" @click="openDetail(item.id)" />
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
.module-tabs,
.status-tabs {
  display: flex;
  gap: 14rpx;
}
.module-tabs {
  margin-top: 84rpx;
}
.module-tabs view,
.status-tabs view {
  min-width: 124rpx;
  padding: 14rpx 20rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 18rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
  text-align: center;
  background: var(--app-bg-card);
}
.module-tabs view.active,
.status-tabs view.active {
  border-color: var(--app-color-brand);
  color: #fff;
  background: var(--app-color-brand);
}
.lease-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
  margin-top: 30rpx;
}
.lease-summary > view {
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
.lease-summary text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.lease-summary strong {
  color: var(--app-text-primary);
  font-size: 32rpx;
}
.lease-summary > view > view {
  position: absolute;
  bottom: 0;
  left: 24rpx;
  width: 56rpx;
  height: 7rpx;
  border-radius: 999rpx;
  background: var(--app-color-brand);
}
.status-tabs {
  margin: 28rpx 0 20rpx;
}
</style>
