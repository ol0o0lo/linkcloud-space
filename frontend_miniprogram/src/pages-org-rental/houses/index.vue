<script setup lang="ts">
import type { HouseOut } from '@/features/organization-rental/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatHouseLayout } from '@/domain/house'
import { formatOrganizationHouseTitle, formatOrganizationMoney, getOrganizationHouseStatusTone } from '@/domain/organization-rental'
import { listOrganizationHouses } from '@/features/organization-rental/service'
import { APP_ROUTES, getOrganizationHouseDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '组织房源', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const items = ref<HouseOut[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = 15
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')
let requestId = 0

async function loadHouses(reset = false) {
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
    const result = await listOrganizationHouses(appContextStore.organizationSlug, targetPage, pageSize, { keyword: keyword.value.trim() || undefined })
    if (currentRequestId !== requestId)
      return
    items.value = reset ? result.items : [...items.value, ...result.items]
    finished.value = items.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value = targetPage + 1
  }
  catch {
    if (currentRequestId === requestId)
      loadError.value = '组织房源加载失败，请稍后重试'
  }
  finally {
    if (currentRequestId === requestId) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function openHouse(id: number) {
  uni.navigateTo({ url: getOrganizationHouseDetailRoute(id) })
}

function createHouse() {
  uni.navigateTo({ url: APP_ROUTES.organizationHouseForm })
}

onShow(() => void loadHouses(true))
onPullDownRefresh(() => loadHouses(true))
onReachBottom(() => void loadHouses())
</script>

<template>
  <view class="list-page">
    <view class="toolbar-card">
      <view><strong>组织房源</strong><text>建档、维护并管理对外发布状态</text></view>
      <wd-button size="small" @click="createHouse">
        新建房源
      </wd-button>
    </view>
    <wd-search v-model="keyword" placeholder="搜索房号、小区或楼栋" hide-cancel @search="loadHouses(true)" @clear="loadHouses(true)" />
    <view v-if="items.length" class="card-list">
      <view v-for="item in items" :key="item.id" class="record-card" @click="openHouse(item.id)">
        <view class="card-topline">
          <view class="record-title">
            {{ formatOrganizationHouseTitle(item) }}
          </view>
          <wd-tag :type="getOrganizationHouseStatusTone(item.status)" variant="light" size="small">
            {{ item.status__mapping }}
          </wd-tag>
        </view>
        <view class="facts">
          {{ formatHouseLayout(item.bedrooms, item.living_rooms) }} · {{ item.area ? `${item.area}㎡` : '面积待完善' }} · {{ item.floor ?? '--' }}层
        </view>
        <view class="card-footer">
          <strong>{{ formatOrganizationMoney(item.asking_rent) }}</strong><text>查看详情</text>
        </view>
      </view>
    </view>
    <AppListState :loading="loading" :has-items="Boolean(items.length)" :finished="finished" :error-message="loadError" loading-text="正在加载房源…" empty-text="当前组织暂无房源" finished-text="没有更多房源了" @retry="loadHouses(true)" />
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
.toolbar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 14rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.toolbar-card strong,
.toolbar-card text {
  display: block;
}
.toolbar-card strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.toolbar-card text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
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
  gap: 20rpx;
}
.record-title {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 650;
}
.facts {
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.card-footer {
  margin-top: 24rpx;
  color: var(--app-color-primary);
  font-size: 23rpx;
}
.card-footer strong {
  color: var(--app-color-price);
  font-size: 34rpx;
}
</style>
