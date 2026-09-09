<script setup lang="ts">
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { canCancelTenantViewing, formatTenantHouseTitle, getTenantViewingStatusTone } from '@/domain/tenant-rental'
import { cancelScheduledTenantViewing, listTenantViewings } from '@/features/tenant-rental/service'
import { getTenantViewingDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'

definePage({
  style: {
    navigationBarTitleText: '我的预约',
    enablePullDownRefresh: true,
  },
})

const items = ref<TenantViewingRecordOut[]>([])
const page = ref(1)
const pageSize = 12
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')
const cancelingId = ref<number | null>(null)

function formatDateTime(value: string | null) {
  if (!value)
    return '--'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function loadViewings(reset = false) {
  if (loading.value || (!reset && finished.value))
    return
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  loadError.value = ''
  try {
    const result = await listTenantViewings(page.value, pageSize)
    items.value = reset ? result.items : [...items.value, ...result.items]
    finished.value = items.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value += 1
  }
  catch {
    loadError.value = '预约记录加载失败，请稍后重试'
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openDetail(id: number) {
  uni.navigateTo({ url: getTenantViewingDetailRoute(id) })
}

async function cancelViewing(item: TenantViewingRecordOut) {
  const confirmation = await uni.showModal({ title: '取消预约', content: '取消后由中介端同步看到该状态，确定继续吗？', confirmText: '确认取消' })
  if (!confirmation.confirm)
    return
  cancelingId.value = item.id
  try {
    const updated = await cancelScheduledTenantViewing(item.id)
    items.value = items.value.map(current => current.id === updated.id ? updated : current)
    uni.showToast({ title: '预约已取消', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '取消失败，请稍后重试', icon: 'none' })
  }
  finally {
    cancelingId.value = null
  }
}

onShow(() => void loadViewings(true))
onPullDownRefresh(() => loadViewings(true))
onReachBottom(() => void loadViewings())
</script>

<template>
  <view class="tenant-page">
    <view class="page-heading">
      <view class="page-title">
        预约与带看进度
      </view>
      <view class="page-subtitle">
        预约状态与中介工作台保持实时一致
      </view>
    </view>

    <view v-if="items.length" class="record-list">
      <view v-for="item in items" :key="item.id" class="record-card" @click="openDetail(item.id)">
        <view class="card-topline">
          <view class="house-title">
            {{ formatTenantHouseTitle(item.house) }}
          </view>
          <wd-tag :type="getTenantViewingStatusTone(item.status)" variant="light" size="small">
            {{ item.status__mapping }}
          </wd-tag>
        </view>
        <view class="organization">
          {{ item.organization.name }}
        </view>
        <view class="time-row">
          <text>预约时间</text>
          <strong>{{ formatDateTime(item.scheduled_at) }}</strong>
        </view>
        <view v-if="item.viewed_at" class="time-row">
          <text>实际带看</text>
          <strong>{{ formatDateTime(item.viewed_at) }}</strong>
        </view>
        <view class="card-actions">
          <text>查看详情</text>
          <wd-button
            v-if="canCancelTenantViewing(item.status)"
            size="mini"
            type="danger"
            variant="plain"
            :loading="cancelingId === item.id"
            @click.stop="cancelViewing(item)"
          >
            取消预约
          </wd-button>
        </view>
      </view>
    </view>

    <AppListState
      :loading="loading"
      :has-items="Boolean(items.length)"
      :finished="finished"
      :error-message="loadError"
      loading-text="正在加载预约…"
      empty-text="还没有看房预约，从房源详情发起吧"
      finished-text="没有更多预约了"
      @retry="loadViewings(items.length === 0)"
    />
  </view>
</template>

<style scoped lang="scss">
.tenant-page {
  min-height: 100vh;
  padding: 28rpx 24rpx 56rpx;
  background: var(--app-bg-page);
}
.page-heading {
  margin-bottom: 24rpx;
}
.page-title {
  color: var(--app-text-primary);
  font-size: 38rpx;
  font-weight: 700;
}
.page-subtitle {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.record-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.record-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.card-topline,
.time-row,
.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.house-title {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 650;
}
.organization {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.time-row {
  margin-top: 24rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.time-row strong {
  color: var(--app-text-secondary);
  font-weight: 500;
}
.card-actions {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1px solid var(--app-divider-color);
  color: var(--app-color-primary);
  font-size: 24rpx;
}
</style>
