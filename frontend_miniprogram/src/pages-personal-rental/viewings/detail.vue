<script setup lang="ts">
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { canCancelTenantViewing, formatTenantHouseTitle, getTenantViewingStatusTone } from '@/domain/tenant-rental'
import { cancelScheduledTenantViewing, getTenantViewing } from '@/features/tenant-rental/service'
import { getHouseDetailRoute, getTenantLeaseDetailRoute } from '@/modules/routes'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'

definePage({ style: { navigationBarTitleText: '预约详情', navigationStyle: 'custom' } })

const recordId = ref(0)
const record = ref<TenantViewingRecordOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const canceling = ref(false)
const canCancel = computed(() => Boolean(record.value && canCancelTenantViewing(record.value.status)))
const viewingProgressActive = computed(() => {
  if (record.value?.status === 'viewed' || record.value?.status === 'converted')
    return 2
  if (record.value)
    return 1
  return 0
})
const viewingProgressMiddleStatus = computed(() => record.value?.status === 'canceled' || record.value?.status === 'no_show' ? 'error' as const : undefined)
const viewingProgressCopy = computed(() => {
  switch (record.value?.status) {
    case 'scheduled':
      return '预约已确认，请按预约时间等待工作人员带看。'
    case 'viewed':
      return '本次带看已经完成，可继续查看房源或等待后续跟进。'
    case 'converted':
      return '本次带看已经完成，并已生成对应的成交租约。'
    case 'canceled':
      return '预约已取消，带看流程已停止。'
    case 'no_show':
      return '本次预约未能按时完成带看，如仍有需要可重新预约。'
    default:
      return '预约进度会在工作人员更新后同步显示。'
  }
})

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '--'
}

async function loadRecord() {
  loading.value = true
  loadError.value = ''
  try {
    record.value = await getTenantViewing(recordId.value)
  }
  catch {
    loadError.value = '预约不存在或暂时无法加载'
  }
  finally {
    loading.value = false
  }
}

async function cancelViewing() {
  if (!record.value || !canCancel.value)
    return
  const confirmation = await uni.showModal({ title: '取消预约', content: '确定取消这次看房预约吗？', confirmText: '确认取消' })
  if (!confirmation.confirm)
    return
  canceling.value = true
  try {
    record.value = await cancelScheduledTenantViewing(record.value.id)
    uni.showToast({ title: '预约已取消', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '取消失败', icon: 'none' })
  }
  finally {
    canceling.value = false
  }
}

function openHouse() {
  if (record.value)
    uni.navigateTo({ url: getHouseDetailRoute(record.value.house_id) })
}

function openSignedLease() {
  if (record.value?.signed_lease_id)
    uni.navigateTo({ url: getTenantLeaseDetailRoute(record.value.signed_lease_id) })
}

onLoad((options) => {
  recordId.value = Number(options?.id || 0)
  if (!recordId.value) {
    loadError.value = '预约参数不正确'
    loading.value = false
    return
  }
  void loadRecord()
})
</script>

<template>
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载预约…"
    error-title="预约加载失败"
    :show-actions="canCancel"
    @retry="loadRecord"
  >
    <template #navigation>
      <AppCustomNavigation title="预约详情" back scroll-mode="sticky" />
    </template>
    <template v-if="record">
      <view class="viewing-hero app-card-plain">
        <AppStatusTag :text="record.status__mapping" :tone="getTenantViewingStatusTone(record.status)" />
        <view class="viewing-hero__title">
          {{ formatTenantHouseTitle(record.house) }}
        </view>
        <view class="viewing-hero__meta">
          {{ record.organization.name }}
        </view>
      </view>
      <view class="viewing-progress app-card-plain">
        <view class="viewing-progress__title">
          看房进度
        </view>
        <wd-steps :active="viewingProgressActive" align-center dot custom-style="margin-top: 28rpx;">
          <wd-step title="已预约" />
          <wd-step title="待带看" :status="viewingProgressMiddleStatus" />
          <wd-step title="已完成" />
        </wd-steps>
      </view>
      <view class="detail-card app-card-plain">
        <view class="detail-card__title">
          带看信息
        </view>
        <view class="detail-row">
          <text>预约时间</text><strong>{{ formatDateTime(record.scheduled_at) }}</strong>
        </view>
        <view class="detail-row">
          <text>实际带看</text><strong>{{ formatDateTime(record.viewed_at) }}</strong>
        </view>
        <view class="detail-row">
          <text>当前进度</text><strong>{{ record.status__mapping }}</strong>
        </view>
      </view>
      <view class="detail-card app-card-plain">
        <view class="detail-card__title">
          相关内容
        </view>
        <view class="detail-row detail-row--link" @click="openHouse">
          <text>房源详情</text><strong>查看</strong>
        </view>
        <view v-if="record.signed_lease_id" class="detail-row detail-row--link" @click="openSignedLease">
          <text>成交租约</text><strong>查看</strong>
        </view>
      </view>
      <AppNotice class="viewing-notice" title="当前进度" :description="viewingProgressCopy" compact />
    </template>

    <template #actions>
      <view class="w-full">
        <wd-button block type="danger" variant="plain" :loading="canceling" @click="cancelViewing">
          取消预约
        </wd-button>
      </view>
    </template>
  </AppDetailPage>
</template>

<style scoped lang="scss">
.viewing-progress {
  margin: 0 var(--app-page-gutter);
  padding: 28rpx 22rpx 24rpx;
}
.viewing-hero,
.detail-card,
.viewing-notice {
  margin: 0 var(--app-page-gutter);
}
.viewing-hero {
  padding: 32rpx;
  border: 1rpx solid #f1d49c;
  background: #fff8eb;
}
.viewing-hero__title {
  margin-top: 22rpx;
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
}
.viewing-hero__meta {
  margin-top: 12rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}

.viewing-progress__title {
  padding: 0 10rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 700;
}

.detail-card {
  padding: 28rpx 32rpx 10rpx;
}
.detail-card__title {
  margin-bottom: 14rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 700;
}
.detail-row {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  border-top: 1rpx solid var(--app-divider-color);
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.detail-row strong {
  color: var(--app-text-primary);
  font-weight: 500;
  text-align: right;
}
.detail-row--link strong {
  color: var(--app-color-brand);
}
</style>
