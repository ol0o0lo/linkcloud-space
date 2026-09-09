<script setup lang="ts">
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { canCancelTenantViewing, formatTenantHouseTitle, getTenantViewingStatusTone } from '@/domain/tenant-rental'
import { cancelScheduledTenantViewing, getTenantViewing } from '@/features/tenant-rental/service'
import { getHouseDetailRoute, getTenantLeaseDetailRoute } from '@/modules/routes'
import AppBottomAction from '@/shared/components/AppBottomAction.vue'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'

definePage({ style: { navigationBarTitleText: '预约详情' } })

const recordId = ref(0)
const record = ref<TenantViewingRecordOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const canceling = ref(false)
const canCancel = computed(() => Boolean(record.value && canCancelTenantViewing(record.value.status)))

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
  <view class="detail-page">
    <AppLoading v-if="loading" text="正在加载预约…" />
    <AppErrorView v-else-if="loadError" title="预约加载失败" :message="loadError" @retry="loadRecord" />
    <template v-else-if="record">
      <view class="hero-card">
        <wd-tag :type="getTenantViewingStatusTone(record.status)" variant="light">
          {{ record.status__mapping }}
        </wd-tag>
        <view class="house-title">
          {{ formatTenantHouseTitle(record.house) }}
        </view>
        <view class="organization">
          {{ record.organization.name }}
        </view>
      </view>
      <wd-cell-group title="带看信息" insert>
        <wd-cell title="预约时间" :value="formatDateTime(record.scheduled_at)" />
        <wd-cell title="实际带看" :value="formatDateTime(record.viewed_at)" />
        <wd-cell title="当前进度" :value="record.status__mapping" />
      </wd-cell-group>
      <wd-cell-group title="相关内容" insert>
        <wd-cell title="房源详情" is-link @click="openHouse" />
        <wd-cell v-if="record.signed_lease_id" title="成交租约" is-link @click="openSignedLease" />
      </wd-cell-group>
      <AppBottomAction v-if="canCancel">
        <wd-button block type="danger" variant="plain" :loading="canceling" @click="cancelViewing">
          取消预约
        </wd-button>
      </AppBottomAction>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding: 24rpx 0 150rpx;
  background: var(--app-bg-page);
}
.hero-card {
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.house-title {
  margin-top: 18rpx;
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
}
.organization {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}
</style>
