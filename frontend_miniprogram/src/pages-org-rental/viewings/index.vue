<script setup lang="ts">
import type { ViewingRecordOut } from '@/features/organization-rental/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatOrganizationDateTime, formatOrganizationHouseTitle, getOrganizationViewingStatusTone } from '@/domain/organization-rental'
import { listOrganizationViewings } from '@/features/organization-rental/service'
import { getOrganizationViewingDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '带看管理', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const items = ref<ViewingRecordOut[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = 15
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')
let requestId = 0

async function loadViewings(reset = false) {
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
    const result = await listOrganizationViewings(appContextStore.organizationSlug, targetPage, pageSize, { keyword: keyword.value.trim() || undefined })
    if (currentRequestId !== requestId)
      return
    items.value = reset ? result.items : [...items.value, ...result.items]
    finished.value = items.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value = targetPage + 1
  }
  catch {
    if (currentRequestId === requestId)
      loadError.value = '带看记录加载失败，请稍后重试'
  }
  finally {
    if (currentRequestId === requestId) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function openDetail(id: number) {
  uni.navigateTo({ url: getOrganizationViewingDetailRoute(id) })
}

onShow(() => void loadViewings(true))
onPullDownRefresh(() => loadViewings(true))
onReachBottom(() => void loadViewings())
</script>

<template>
  <view class="list-page">
    <wd-search v-model="keyword" placeholder="搜索客户、手机号或房源" hide-cancel @search="loadViewings(true)" @clear="loadViewings(true)" />
    <view v-if="items.length" class="card-list">
      <view v-for="item in items" :key="item.id" class="record-card" @click="openDetail(item.id)">
        <view class="card-topline">
          <view class="record-title">
            {{ formatOrganizationHouseTitle(item.house) }}
          </view><wd-tag :type="getOrganizationViewingStatusTone(item.status)" variant="light" size="small">
            {{ item.status__mapping }}
          </wd-tag>
        </view>
        <view class="customer">
          {{ item.customer_name }} · {{ item.customer_phone }}
        </view>
        <view class="card-footer">
          <text>{{ formatOrganizationDateTime(item.scheduled_at) }}</text><text>查看详情</text>
        </view>
      </view>
    </view>
    <AppListState :loading="loading" :has-items="Boolean(items.length)" :finished="finished" :error-message="loadError" loading-text="正在加载带看…" empty-text="当前组织暂无带看记录" finished-text="没有更多带看了" @retry="loadViewings(true)" />
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
.customer {
  margin-top: 14rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.card-footer {
  margin-top: 22rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.card-footer text:last-child {
  color: var(--app-color-primary);
}
</style>
