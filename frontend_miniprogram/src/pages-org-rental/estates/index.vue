<script setup lang="ts">
import type { EstateDetailOut } from '@/features/organization-rental/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { listOrganizationEstates } from '@/features/organization-rental/service'
import AppListState from '@/shared/components/AppListState.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '小区管理', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const items = ref<EstateDetailOut[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = 15
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')
let requestId = 0

async function loadEstates(reset = false) {
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
    const result = await listOrganizationEstates(appContextStore.organizationSlug, targetPage, pageSize, { keyword: keyword.value.trim() || undefined })
    if (currentRequestId !== requestId)
      return
    items.value = reset ? result.items : [...items.value, ...result.items]
    finished.value = items.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value = targetPage + 1
  }
  catch {
    if (currentRequestId === requestId)
      loadError.value = '小区信息加载失败，请稍后重试'
  }
  finally {
    if (currentRequestId === requestId) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

onShow(() => void loadEstates(true))
onPullDownRefresh(() => loadEstates(true))
onReachBottom(() => void loadEstates())
</script>

<template>
  <view class="list-page">
    <wd-search v-model="keyword" placeholder="搜索小区名称" hide-cancel @search="loadEstates(true)" @clear="loadEstates(true)" />
    <view v-if="items.length" class="card-list">
      <view v-for="item in items" :key="item.id" class="record-card">
        <view class="card-topline">
          <view class="record-title">
            {{ item.display_name || item.name }}
          </view><wd-tag variant="light" size="small">
            {{ item.property_type__mapping }}
          </wd-tag>
        </view>
        <view class="address">
          {{ [item.city, item.district, item.address].filter(Boolean).join(' ') || '地址未登记' }}
        </view>
        <view class="metrics">
          <text>{{ item.building_count }} 栋</text><text>{{ item.counts.total }} 套</text><text class="vacant">{{ item.counts.vacant }} 套空置</text>
        </view>
      </view>
    </view>
    <AppListState :loading="loading" :has-items="Boolean(items.length)" :finished="finished" :error-message="loadError" loading-text="正在加载小区…" empty-text="当前组织暂无小区信息" finished-text="没有更多小区了" @retry="loadEstates(true)" />
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
.metrics {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.record-title {
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 650;
}
.address {
  margin-top: 12rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.metrics {
  margin-top: 24rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.vacant {
  color: var(--app-color-warm);
}
</style>
