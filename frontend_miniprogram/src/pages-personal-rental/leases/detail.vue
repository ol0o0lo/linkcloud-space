<script setup lang="ts">
import LeaseContractFiles from '@/components/house/LeaseContractFiles.vue'
import type { TenantLeaseOut } from '@/features/tenant-rental/service'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatTenantHouseTitle, getTenantLeaseStatusTone } from '@/domain/tenant-rental'
import { getTenantLease } from '@/features/tenant-rental/service'
import { getHouseDetailRoute, getTenantViewingDetailRoute } from '@/modules/routes'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'

definePage({ style: { navigationBarTitleText: '租约详情', navigationStyle: 'custom' } })

const leaseId = ref(0)
const lease = ref<TenantLeaseOut | null>(null)
const loading = ref(true)
const loadError = ref('')

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未登记'
}

async function loadLease() {
  loading.value = true
  loadError.value = ''
  try {
    lease.value = await getTenantLease(leaseId.value)
  }
  catch {
    loadError.value = '租约不存在或暂时无法加载'
  }
  finally {
    loading.value = false
  }
}

function openHouse() {
  if (lease.value)
    uni.navigateTo({ url: getHouseDetailRoute(lease.value.house_id) })
}

function openSourceViewing() {
  if (lease.value?.source_viewing_record_id)
    uni.navigateTo({ url: getTenantViewingDetailRoute(lease.value.source_viewing_record_id) })
}

onLoad((options) => {
  leaseId.value = Number(options?.id || 0)
  if (!leaseId.value) {
    loadError.value = '租约参数不正确'
    loading.value = false
    return
  }
  void loadLease()
})
</script>

<template>
  <AppPage variant="detail" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="租约详情" back scroll-mode="sticky" />
    </template>
    <view class="detail-page min-h-screen bg-surface-page px-5 pb-9 pt-5">
      <AppLoading v-if="loading" text="正在加载租约…" />
      <AppErrorView v-else-if="loadError" title="租约加载失败" :message="loadError" @retry="loadLease" />
      <template v-else-if="lease">
        <view class="hero-card mb-3 rounded-4.5 p-4">
          <view class="hero-topline flex items-center justify-between text-size-xs text-content-muted">
            <wd-tag :type="getTenantLeaseStatusTone(lease.status)" variant="light">
              {{ lease.status__mapping }}
            </wd-tag>
            <text>{{ lease.organization.name }}</text>
          </view>
          <view class="house-title mt-3 text-size-lg text-content-primary font-bold">
            {{ formatTenantHouseTitle(lease.house) }}
          </view>
          <view class="rent mt-3.5 text-app-price">
            <strong>¥{{ lease.monthly_rent }}</strong><text>/月</text>
          </view>
        </view>
        <view class="detail-card mt-3 rounded-4 bg-surface-card px-4 pb-1.5 pt-3.5">
          <view class="detail-card__title mb-2 text-size-sm text-content-primary font-bold">
            租约信息
          </view>
          <view class="detail-row min-h-11 flex items-center justify-between gap-3 border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary">
            <text>租期</text><strong>{{ lease.start_date }} 至 {{ lease.end_date }}</strong>
          </view>
          <view class="detail-row min-h-11 flex items-center justify-between gap-3 border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary">
            <text>签约时间</text><strong>{{ formatDateTime(lease.sign_at) }}</strong>
          </view>
          <view class="detail-row min-h-11 flex items-center justify-between gap-3 border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary">
            <text>押金</text><strong>{{ lease.deposit ? `¥${lease.deposit}` : '未登记' }}</strong>
          </view>
          <view class="detail-row min-h-11 flex items-center justify-between gap-3 border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary">
            <text>付款日</text><strong>每月 {{ lease.payment_day }} 日</strong>
          </view>
          <LeaseContractFiles :files="lease.contract_files" />
        </view>
        <view class="detail-card mt-3 rounded-4 bg-surface-card px-4 pb-1.5 pt-3.5">
          <view class="detail-card__title mb-2 text-size-sm text-content-primary font-bold">
            相关内容
          </view>
          <view class="detail-row detail-row--link min-h-11 flex items-center justify-between gap-3 border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary" @click="openHouse">
            <text>房源详情</text><strong>查看</strong>
          </view>
          <view v-if="lease.source_viewing_record_id" class="detail-row detail-row--link min-h-11 flex items-center justify-between gap-3 border-t-hairline border-t-app-divider border-t-solid text-size-xs text-content-secondary" @click="openSourceViewing">
            <text>来源带看</text><strong>查看</strong>
          </view>
        </view>
        <AppNotice
          class="lease-notice"
          title="租约由经纪团队维护"
          description="如租约信息有误，请联系签约经纪团队核对。"
          compact
        />
      </template>
    </view>
  </AppPage>
</template>

<style scoped>
.hero-card {
  border: 1rpx solid #bfe5d6;
  background: #ecf9f3;
}
.rent strong {
  @apply text-size-xl;
}
.rent text {
  @apply ml-0.5 text-size-xs;
}
.detail-row strong {
  @apply text-content-primary font-medium text-right;
}
.detail-row--link strong {
  @apply text-app-brand;
}
.lease-notice {
  @apply mt-3;
}
</style>
