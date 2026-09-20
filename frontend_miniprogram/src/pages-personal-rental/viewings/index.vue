<script setup lang="ts">
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { ref } from 'vue'
import { canCancelTenantViewing, formatTenantHouseTitle, getTenantViewingStatusTone } from '@/domain/tenant-rental'
import { cancelScheduledTenantViewing, listTenantViewings } from '@/features/tenant-rental/service'
import { APP_ROUTES, getTenantViewingDetailRoute } from '@/modules/routes'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import { usePagedPage } from '@/hooks/usePagedPage'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的预约',
    enablePullDownRefresh: true,
  },
})

const cancelingId = ref<number | null>(null)
const viewingPage = usePagedPage<TenantViewingRecordOut>({
  loader: ({ page, pageSize }) => listTenantViewings(page, pageSize),
  pageSize: 12,
  keyOf: item => item.id,
})

function formatDateTime(value: string | null) {
  if (!value)
    return '--'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function openDetail(id: number) {
  uni.navigateTo({ url: getTenantViewingDetailRoute(id) })
}

function goFindHouse() {
  uni.navigateTo({ url: APP_ROUTES.publicHouseSearch })
}

async function cancelViewing(item: TenantViewingRecordOut) {
  const confirmation = await uni.showModal({ title: '取消预约', content: '取消后由中介端同步看到该状态，确定继续吗？', confirmText: '确认取消' })
  if (!confirmation.confirm)
    return
  cancelingId.value = item.id
  try {
    const updated = await cancelScheduledTenantViewing(item.id)
    viewingPage.upsert(updated)
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
      <AppCustomNavigation title="我的预约" back scroll-mode="sticky" />
    </template>
    <AppPagedList
      :items="viewingPage.items.value"
      item-key="id"
      :loading="viewingPage.loading.value"
      :refreshing="viewingPage.refreshing.value"
      :loading-more="viewingPage.loadingMore.value"
      :finished="viewingPage.finished.value"
      :error="viewingPage.error.value"
      loading-text="正在加载预约…"
      empty-text="还没有看房预约"
      empty-description="浏览房源并从详情页发起预约，中介会同步处理带看时间。"
      empty-icon="no-content"
      empty-action-text="去找房"
      finished-text="没有更多预约了"
      @retry="viewingPage.refresh"
      @empty-action="goFindHouse"
    >
      <template #item="{ item }">
        <AppRecordCard clickable @click="openDetail(item.id)">
          <template #title>
            {{ formatTenantHouseTitle(item.house) }}
          </template>
          <template #status>
            <wd-tag :type="getTenantViewingStatusTone(item.status)" variant="light" size="small">
              {{ item.status__mapping }}
            </wd-tag>
          </template>
          <template #description>
            {{ item.organization.name }}
          </template>
          <view class="app-row-between text-xs text-content-muted">
            <text>预约时间</text>
            <strong class="text-content-secondary font-medium">{{ formatDateTime(item.scheduled_at) }}</strong>
          </view>
          <view v-if="item.viewed_at" class="mt-3 app-row-between text-xs text-content-muted">
            <text>实际带看</text>
            <strong class="text-content-secondary font-medium">{{ formatDateTime(item.viewed_at) }}</strong>
          </view>
          <template #footer>
            <text class="text-xs text-app-brand">查看详情</text>
          </template>
          <template v-if="canCancelTenantViewing(item.status)" #actions>
            <wd-button
              size="mini"
              type="danger"
              variant="plain"
              :loading="cancelingId === item.id"
              @click.stop="cancelViewing(item)"
            >
              取消预约
            </wd-button>
          </template>
        </AppRecordCard>
      </template>
    </AppPagedList>
  </AppPage>
</template>
