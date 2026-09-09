<script setup lang="ts">
import type { TenantLeaseOut } from '@/features/tenant-rental/service'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatTenantHouseTitle, getTenantLeaseStatusTone } from '@/domain/tenant-rental'
import { getTenantLease } from '@/features/tenant-rental/service'
import { getHouseDetailRoute, getTenantViewingDetailRoute } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'

definePage({ style: { navigationBarTitleText: '租约详情' } })

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
      <wd-cell-group title="租约信息" insert>
        <wd-cell title="租期" :value="`${lease.start_date} 至 ${lease.end_date}`" />
        <wd-cell title="签约时间" :value="formatDateTime(lease.sign_at)" />
        <wd-cell title="押金" :value="lease.deposit ? `¥${lease.deposit}` : '未登记'" />
        <wd-cell title="付款日" :value="`每月 ${lease.payment_day} 日`" />
        <wd-cell title="合同文件" :value="lease.contract_files.length ? `${lease.contract_files.length} 份` : '未上传'" />
      </wd-cell-group>
      <wd-cell-group title="相关内容" insert>
        <wd-cell title="房源详情" is-link @click="openHouse" />
        <wd-cell v-if="lease.source_viewing_record_id" title="来源带看" is-link @click="openSourceViewing" />
      </wd-cell-group>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding: 24rpx 0 56rpx;
  background: var(--app-bg-page);
}
.hero-card {
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
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
</style>
