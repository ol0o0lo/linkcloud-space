<script setup lang="ts">
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { canCancelTenantViewing } from '@/domain/tenant-rental'
import { cancelScheduledTenantViewing, getTenantViewing } from '@/features/tenant-rental/service'
import { getHouseDetailRoute, getTenantLeaseDetailRoute } from '@/modules/routes'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import TenantViewingCard from '@/components/house/TenantViewingCard.vue'

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
    @retry="loadRecord"
  >
    <template #navigation>
      <AppCustomNavigation title="预约详情" back scroll-mode="sticky" />
    </template>
    <template v-if="record">
      <TenantViewingCard :record="record" :clickable="false" :canceling="canceling" @cancel="cancelViewing" />
      <view class="viewing-progress mx-app-gutter my-0 app-card-plain px-3 pb-3 pt-3.5">
        <view class="viewing-progress__title px-1.5 py-0 text-size-sm text-content-primary font-bold">
          看房进度
        </view>
        <wd-steps :active="viewingProgressActive" align-center dot custom-class="mt-3.5">
          <wd-step title="已预约" />
          <wd-step title="待带看" :status="viewingProgressMiddleStatus" />
          <wd-step title="已完成" />
        </wd-steps>
      </view>
      <view class="detail-card app-card-plain px-4 pb-1.5 pt-3.5">
        <view class="detail-card__title mb-2 text-size-sm text-content-primary font-bold">
          相关内容
        </view>
        <view class="detail-row detail-row--link min-h-10.5 flex items-center justify-between gap-3 border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary" @click="openHouse">
          <text>房源详情</text><strong>查看</strong>
        </view>
        <view v-if="record.signed_lease_id" class="detail-row detail-row--link min-h-10.5 flex items-center justify-between gap-3 border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary" @click="openSignedLease">
          <text>成交租约</text><strong>查看</strong>
        </view>
      </view>
      <AppNotice class="viewing-notice" title="当前进度" :description="viewingProgressCopy" compact />
    </template>
  </AppDetailPage>
</template>

<style scoped>
.viewing-hero,
.detail-card,
.viewing-notice {
  @apply my-0 mx-app-gutter;
}
.viewing-hero {
  @apply p-4;
  border: 1rpx solid #f1d49c;
  background: #fff8eb;
}
.viewing-hero__title {
  @apply mt-3 text-content-primary text-size-lg font-bold;
}
.viewing-hero__meta {
  @apply mt-1.5 text-content-muted text-size-xs;
}
.detail-row strong {
  @apply text-content-primary font-medium text-right;
}
.detail-row--link strong {
  @apply text-app-brand;
}
</style>
