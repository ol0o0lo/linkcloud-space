<script setup lang="ts">
import type { LeaseOut } from '@/pages-org-rental/api/organization-rental'
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import OrganizationLeaseCard from '@/pages-org-rental/leases/components/OrganizationLeaseCard.vue'
import { listOrganizationLeases } from '@/pages-org-rental/api/organization-rental'
import { APP_ROUTES, getOrganizationHouseSigningRoute, getOrganizationLeaseDetailRoute } from '@/modules/routes'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import RentalPageHeading from '../components/RentalPageHeading.vue'
import RentalFilterTabs from '../components/RentalFilterTabs.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '工作空间租约', enablePullDownRefresh: true } })

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
  <AppPage class="rental-page" variant="list">
    <template #navigation>
      <AppCustomNavigation title="租约管理" back scroll-mode="sticky" />
    </template>
    <RentalPageHeading title="租约台账" description="跟进签约、履约与到期状态">
      <wd-button size="small" @click="createLease">
        登记签约
      </wd-button>
    </RentalPageHeading>
    <view class="rental-summary">
      <view class="rental-summary__item" role="button" @click="changeStatus('pending')">
        <strong>{{ list.loaded.value ? summaryCounts.pending : '—' }}</strong><text>待生效</text>
      </view>
      <view class="rental-summary__item rental-summary__item--active" role="button" @click="changeStatus('active')">
        <strong>{{ list.loaded.value ? summaryCounts.active : '—' }}</strong><text>履约中</text>
      </view>
    </view>
    <RentalFilterTabs :model-value="statusFilter" :options="[{ value: 'all', label: '全部' }, { value: 'pending', label: '待生效' }, { value: 'active', label: '履约中' }, { value: 'expired', label: '已到期' }]" @change="changeStatus($event as typeof statusFilter)" />
    <view class="rental-search">
      <AppListToolbar v-model:keyword="keyword" search-placeholder="搜索租客或房源" @search="list.refresh" @clear="list.refresh" />
    </view>
    <view class="rental-results">
      <strong>{{ houseId ? '当前房源的租约' : '租约记录' }}</strong><text>{{ list.loaded.value ? `共 ${list.total.value} 份` : '正在加载…' }}</text>
    </view>
    <view class="mt-2.5">
      <AppPagedList
        :items="list.items.value"
        :loading="list.loading.value"
        :refreshing="list.refreshing.value"
        :loading-more="list.loadingMore.value"
        :finished="list.finished.value"
        :error="list.error.value"
        loading-text="正在加载租约…"
        :empty-text="hasFilters ? '没有符合条件的租约' : '当前工作空间还没有租约'"
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
@use '../components/management';
</style>
