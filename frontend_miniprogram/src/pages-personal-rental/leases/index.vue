<script setup lang="ts">
import type { TenantLeaseOut } from '@/features/tenant-rental/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatTenantHouseTitle, getTenantLeaseStatusTone } from '@/domain/tenant-rental'
import { listTenantLeases } from '@/features/tenant-rental/service'
import { getTenantLeaseDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'

definePage({
  style: {
    navigationBarTitleText: '我的租约',
    enablePullDownRefresh: true,
  },
})

const items = ref<TenantLeaseOut[]>([])
const page = ref(1)
const pageSize = 12
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')

async function loadLeases(reset = false) {
  if (loading.value || (!reset && finished.value))
    return
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  loadError.value = ''
  try {
    const result = await listTenantLeases(page.value, pageSize)
    items.value = reset ? result.items : [...items.value, ...result.items]
    finished.value = items.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value += 1
  }
  catch {
    loadError.value = '租约加载失败，请稍后重试'
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openLease(id: number) {
  uni.navigateTo({ url: getTenantLeaseDetailRoute(id) })
}

onShow(() => void loadLeases(true))
onPullDownRefresh(() => loadLeases(true))
onReachBottom(() => void loadLeases())
</script>

<template>
  <view class="tenant-page">
    <view class="page-heading">
      <view class="page-title">
        我的租约
      </view>
      <view class="page-subtitle">
        这里只展示与你账号绑定租客联系人关联的租约
      </view>
    </view>
    <view v-if="items.length" class="lease-list">
      <view v-for="item in items" :key="item.id" class="lease-card" @click="openLease(item.id)">
        <view class="card-topline">
          <view class="house-title">
            {{ formatTenantHouseTitle(item.house) }}
          </view>
          <wd-tag :type="getTenantLeaseStatusTone(item.status)" variant="light" size="small">
            {{ item.status__mapping }}
          </wd-tag>
        </view>
        <view class="organization">
          {{ item.organization.name }}
        </view>
        <view class="rent">
          <strong>¥{{ item.monthly_rent }}</strong><text>/月</text>
        </view>
        <view class="term">
          {{ item.start_date }} 至 {{ item.end_date }}
        </view>
      </view>
    </view>
    <AppListState
      :loading="loading"
      :has-items="Boolean(items.length)"
      :finished="finished"
      :error-message="loadError"
      loading-text="正在加载租约…"
      empty-text="暂时没有与你关联的租约"
      finished-text="没有更多租约了"
      @retry="loadLeases(items.length === 0)"
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
.lease-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.lease-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.card-topline {
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
.organization,
.term {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.rent {
  margin-top: 28rpx;
  color: var(--app-color-price);
}
.rent strong {
  font-size: 38rpx;
}
.rent text {
  margin-left: 4rpx;
  font-size: 23rpx;
}
</style>
