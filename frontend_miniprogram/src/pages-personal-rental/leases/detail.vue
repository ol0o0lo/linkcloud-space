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
    <view class="detail-page">
      <AppLoading v-if="loading" text="正在加载租约…" />
      <AppErrorView v-else-if="loadError" title="租约加载失败" :message="loadError" @retry="loadLease" />
      <template v-else-if="lease">
        <view class="hero-card">
          <view class="hero-topline">
            <wd-tag :type="getTenantLeaseStatusTone(lease.status)" variant="light">
              {{ lease.status__mapping }}
            </wd-tag>
            <text>{{ lease.organization.name }}</text>
          </view>
          <view class="house-title">
            {{ formatTenantHouseTitle(lease.house) }}
          </view>
          <view class="rent">
            <strong>¥{{ lease.monthly_rent }}</strong><text>/月</text>
          </view>
        </view>
        <view class="detail-card">
          <view class="detail-card__title">
            租约信息
          </view>
          <view class="detail-row">
            <text>租期</text><strong>{{ lease.start_date }} 至 {{ lease.end_date }}</strong>
          </view>
          <view class="detail-row">
            <text>签约时间</text><strong>{{ formatDateTime(lease.sign_at) }}</strong>
          </view>
          <view class="detail-row">
            <text>押金</text><strong>{{ lease.deposit ? `¥${lease.deposit}` : '未登记' }}</strong>
          </view>
          <view class="detail-row">
            <text>付款日</text><strong>每月 {{ lease.payment_day }} 日</strong>
          </view>
          <LeaseContractFiles :files="lease.contract_files" />
        </view>
        <view class="detail-card">
          <view class="detail-card__title">
            相关内容
          </view>
          <view class="detail-row detail-row--link" @click="openHouse">
            <text>房源详情</text><strong>查看</strong>
          </view>
          <view v-if="lease.source_viewing_record_id" class="detail-row detail-row--link" @click="openSourceViewing">
            <text>来源带看</text><strong>查看</strong>
          </view>
        </view>
        <AppNotice
          class="lease-notice"
          title="租约由中介组织维护"
          description="如合同字段有误，请联系签约组织核对。租客端不会直接修改租约。"
          compact
        />
      </template>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding: 40rpx 40rpx 72rpx;
  background: var(--app-bg-page);
}
.hero-card {
  margin-bottom: 24rpx;
  padding: 32rpx;
  border: 1rpx solid #bfe5d6;
  border-radius: 36rpx;
  background: #ecf9f3;
}
.hero-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.house-title {
  margin-top: 22rpx;
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
}
.rent {
  margin-top: 28rpx;
  color: var(--app-color-price);
}
.rent strong {
  font-size: 44rpx;
}
.rent text {
  margin-left: 4rpx;
  font-size: 24rpx;
}
.detail-card {
  margin-top: 24rpx;
  padding: 28rpx 32rpx 10rpx;
  border-radius: 32rpx;
  background: var(--app-bg-card);
}
.detail-card__title {
  margin-bottom: 14rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 700;
}
.detail-row {
  display: flex;
  min-height: 86rpx;
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
.lease-notice {
  margin-top: 24rpx;
}
</style>
