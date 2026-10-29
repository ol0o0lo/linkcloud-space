<script setup lang="ts">
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { computed, ref } from 'vue'
import { sortCurrentTenantViewings } from '@/domain/tenant-rental'
import { cancelScheduledTenantViewing, listCurrentTenantViewings, listHistoricalTenantViewings } from '@/features/tenant-rental/service'
import { APP_ROUTES, getTenantViewingDetailRoute } from '@/modules/routes'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import TenantViewingCard from '@/components/house/TenantViewingCard.vue'
import { usePagedPage } from '@/hooks/usePagedPage'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的看房',
    enablePullDownRefresh: true,
  },
})

const cancelingId = ref<number | null>(null)
const historyExpanded = ref(false)
const viewingPage = usePagedPage<TenantViewingRecordOut>({
  loader: async () => {
    const items = await listCurrentTenantViewings()
    return { items, total: items.length, page: 1, page_size: Math.max(items.length, 1) }
  },
  pageSize: 12,
  keyOf: item => item.id,
})
const currentViewings = computed(() => sortCurrentTenantViewings(viewingPage.items.value))
const historyPage = usePagedPage<TenantViewingRecordOut>({
  loader: ({ page, pageSize }) => listHistoricalTenantViewings(page, pageSize),
  pageSize: 12,
  enabled: () => historyExpanded.value,
  keyOf: item => item.id,
})

function toggleHistory() {
  historyExpanded.value = !historyExpanded.value
  if (historyExpanded.value && !historyPage.loaded.value)
    void historyPage.refresh()
}

function openDetail(id: number) {
  uni.navigateTo({ url: getTenantViewingDetailRoute(id) })
}

function goFindHouse() {
  uni.navigateTo({ url: APP_ROUTES.publicHouseSearch })
}

async function cancelViewing(item: TenantViewingRecordOut) {
  if (cancelingId.value !== null)
    return
  const confirmation = await uni.showModal({ title: '取消预约', content: '取消后，经纪人将看到预约已取消，确定继续吗？', confirmText: '确认取消' })
  if (!confirmation.confirm)
    return
  cancelingId.value = item.id
  try {
    const updated = await cancelScheduledTenantViewing(item.id)
    viewingPage.remove(item)
    if (historyPage.loaded.value)
      historyPage.upsert(updated)
    uni.showToast({ title: '预约已取消', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '取消失败，请稍后重试', icon: 'none' })
  }
  finally {
    cancelingId.value = null
  }
}
</script>

<template>
  <AppPage variant="list" gutter="loose">
    <template #navigation>
      <AppCustomNavigation title="我的看房" back scroll-mode="sticky" />
    </template>
    <view class="mb-3">
      <text class="text-base text-content-primary font-semibold">待看房</text>
      <view class="mt-1 text-xs text-content-muted">
        工作人员确认时间后的看房安排
      </view>
    </view>
    <AppPagedList
      :items="currentViewings"
      item-key="id"
      :loading="viewingPage.loading.value"
      :refreshing="viewingPage.refreshing.value"
      :loading-more="viewingPage.loadingMore.value"
      :finished="viewingPage.finished.value"
      :error="viewingPage.error.value"
      loading-text="正在加载待看房安排…"
      empty-text="暂无待看房安排"
      empty-description="提交联系需求后，工作人员会与你确认看房时间。"
      empty-icon="no-content"
      empty-action-text="去找房"
      finished-text="以上是全部待看房安排"
      @retry="viewingPage.refresh"
      @empty-action="goFindHouse"
    >
      <template #item="{ item }">
        <TenantViewingCard :record="item" :canceling="cancelingId === item.id" @open="openDetail(item.id)" @cancel="cancelViewing(item)" />
      </template>
    </AppPagedList>
    <view class="mt-6 pt-3">
      <wd-button variant="text" block @click="toggleHistory">
        {{ historyExpanded ? '收起历史看房' : '查看历史看房' }}
      </wd-button>
      <AppPagedList
        v-if="historyExpanded"
        class="mt-3"
        :items="historyPage.items.value"
        item-key="id"
        :loading="historyPage.loading.value"
        :refreshing="historyPage.refreshing.value"
        :loading-more="historyPage.loadingMore.value"
        :finished="historyPage.finished.value"
        :error="historyPage.error.value"
        loading-text="正在加载历史看房…"
        empty-text="暂无历史看房记录"
        empty-description="已完成、取消或未到场的看房记录会保留在这里。"
        empty-compact
        finished-text="没有更多历史看房了"
        @retry="historyPage.refresh"
      >
        <template #item="{ item }">
          <TenantViewingCard :record="item" @open="openDetail(item.id)" />
        </template>
      </AppPagedList>
    </view>
  </AppPage>
</template>
