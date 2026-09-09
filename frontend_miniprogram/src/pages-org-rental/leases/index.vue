<script setup lang="ts">
import type { LeaseOut } from '@/features/organization-rental/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatOrganizationHouseTitle, formatOrganizationMoney, getOrganizationLeaseStatusTone } from '@/domain/organization-rental'
import { listOrganizationLeases } from '@/features/organization-rental/service'
import { getOrganizationLeaseDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '组织租约', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const items = ref<LeaseOut[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = 15
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')
let requestId = 0

async function loadLeases(reset = false) {
  if (!reset && loading.value)
    return
  if (!reset && finished.value)
    return
  const currentRequestId = reset ? ++requestId : requestId
  const targetPage = reset ? 1 : page.value
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  loadError.value = ''
  try {
    const result = await listOrganizationLeases(appContextStore.organizationSlug, targetPage, pageSize, { keyword: keyword.value.trim() || undefined })
    if (currentRequestId !== requestId)
      return
    items.value = reset ? result.items : [...items.value, ...result.items]
    finished.value = items.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value = targetPage + 1
  }
  catch {
    if (currentRequestId === requestId)
      loadError.value = '组织租约加载失败，请稍后重试'
  }
  finally {
    if (currentRequestId === requestId) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function openDetail(id: number) {
  uni.navigateTo({ url: getOrganizationLeaseDetailRoute(id) })
}

onShow(() => void loadLeases(true))
onPullDownRefresh(() => loadLeases(true))
onReachBottom(() => void loadLeases())
</script>

<template>
  <view class="list-page">
    <wd-search v-model="keyword" placeholder="搜索租客或房源" hide-cancel @search="loadLeases(true)" @clear="loadLeases(true)" />
    <view v-if="items.length" class="card-list">
      <view v-for="item in items" :key="item.id" class="record-card" @click="openDetail(item.id)">
        <view class="card-topline">
          <view class="record-title">
            {{ formatOrganizationHouseTitle(item.house) }}
          </view><wd-tag :type="getOrganizationLeaseStatusTone(item.status)" variant="light" size="small">
            {{ item.status__mapping }}
          </wd-tag>
        </view>
        <view class="tenant">
          {{ item.tenant.name }} · {{ item.tenant.phone }}
        </view>
        <view class="rent">
          {{ formatOrganizationMoney(item.monthly_rent) }}<text>/月</text>
        </view>
        <view class="card-footer">
          <text>{{ item.start_date }} 至 {{ item.end_date }}</text><text>查看详情</text>
        </view>
      </view>
    </view>
    <AppListState :loading="loading" :has-items="Boolean(items.length)" :finished="finished" :error-message="loadError" loading-text="正在加载租约…" empty-text="当前组织暂无租约" finished-text="没有更多租约了" @retry="loadLeases(true)" />
  </view>
</template>

<style scoped lang="scss">
.list-page {
  min-height: 100vh;
  padding: 16rpx 24rpx 56rpx;
  background: var(--app-bg-page);
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 20rpx;
}
.record-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.card-topline,
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.record-title {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 29rpx;
  font-weight: 650;
}
.tenant,
.card-footer {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.rent {
  margin-top: 20rpx;
  color: var(--app-color-price);
  font-size: 36rpx;
  font-weight: 700;
}
.rent text {
  margin-left: 4rpx;
  font-size: 22rpx;
  font-weight: 400;
}
.card-footer {
  margin-top: 18rpx;
}
.card-footer text:last-child {
  color: var(--app-color-primary);
}
</style>
