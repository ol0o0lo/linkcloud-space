<script setup lang="ts">
import type { BuildingMapMarkerOut, EstateMapMarkerOut } from '@/features/organization-rental/service'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getOrganizationUnlocatedBuildingCount, listOrganizationBuildingMap, listOrganizationEstateMap } from '@/features/organization-rental/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房源地图', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const estates = ref<EstateMapMarkerOut[]>([])
const buildings = ref<BuildingMapMarkerOut[]>([])
const unlocatedCount = ref(0)
const loading = ref(true)
const loadError = ref('')

const markers = computed(() => [
  ...estates.value.map(item => ({
    id: item.id,
    latitude: Number(item.lat),
    longitude: Number(item.lng),
    title: `${item.display_name || item.name} · ${item.counts.vacant} 套空置`,
    iconPath: '/static/tabbar/home.png',
    width: 28,
    height: 28,
  })),
  ...buildings.value.map(item => ({
    id: 1000000 + item.id,
    latitude: Number(item.lat),
    longitude: Number(item.lng),
    title: `${item.name} · ${item.counts.total} 套`,
    iconPath: '/static/tabbar/home.png',
    width: 24,
    height: 24,
  })),
].filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)))

const coordinateItems = computed(() => [
  ...estates.value.map(item => ({
    key: `estate-${item.id}`,
    name: item.display_name || item.name,
    address: item.address || '地址未登记',
    lat: item.lat,
    lng: item.lng,
    summary: `${item.building_count} 栋 · ${item.counts.total} 套 · ${item.counts.vacant} 套空置`,
  })),
  ...buildings.value.map(item => ({
    key: `building-${item.id}`,
    name: item.name,
    address: item.address || item.estate?.display_name || item.estate?.name || '地址未登记',
    lat: item.lat,
    lng: item.lng,
    summary: `${item.counts.total} 套 · ${item.counts.vacant} 套空置`,
  })),
])

const center = computed(() => markers.value[0] || { latitude: 31.2304, longitude: 121.4737 })

function copyCoordinates(lat: string, lng: string) {
  uni.setClipboardData({ data: `${lat},${lng}` })
}

async function loadMap() {
  loading.value = true
  loadError.value = ''
  try {
    const [estateItems, buildingItems, unlocated] = await Promise.all([
      loadAllEstateMarkers(),
      loadAllBuildingMarkers(),
      getOrganizationUnlocatedBuildingCount(appContextStore.organizationSlug),
    ])
    estates.value = estateItems
    buildings.value = buildingItems
    unlocatedCount.value = unlocated.count
  }
  catch {
    loadError.value = '房源地图加载失败，请稍后重试'
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function loadAllEstateMarkers() {
  const items: EstateMapMarkerOut[] = []
  let page = 1
  while (true) {
    const result = await listOrganizationEstateMap(appContextStore.organizationSlug, page, 100)
    items.push(...result.items)
    if (items.length >= result.total || result.items.length === 0)
      return items
    page += 1
  }
}

async function loadAllBuildingMarkers() {
  const items: BuildingMapMarkerOut[] = []
  let page = 1
  while (true) {
    const result = await listOrganizationBuildingMap(appContextStore.organizationSlug, page, 100)
    items.push(...result.items)
    if (items.length >= result.total || result.items.length === 0)
      return items
    page += 1
  }
}

onShow(() => void loadMap())
onPullDownRefresh(loadMap)
</script>

<template>
  <view class="map-page">
    <AppLoading v-if="loading" text="正在加载地图标点…" />
    <AppErrorView v-else-if="loadError" title="地图加载失败" :message="loadError" @retry="loadMap" />
    <template v-else>
      <!-- #ifdef MP-WEIXIN -->
      <map
        v-if="markers.length"
        class="map-view"
        :latitude="center.latitude"
        :longitude="center.longitude"
        :markers="markers"
        :scale="12"
        show-location
      />
      <wd-empty v-else icon="location" tip="当前组织还没有已定位的小区或楼栋" />
      <!-- #endif -->
      <!-- #ifdef H5 -->
      <view v-if="coordinateItems.length" class="coordinate-list">
        <view class="coordinate-intro">
          网页端暂不显示地图底图，下面展示已保存的小区和楼栋位置。
        </view>
        <view v-for="item in coordinateItems" :key="item.key" class="coordinate-card">
          <view class="coordinate-main">
            <view class="marker-name">
              {{ item.name }}
            </view>
            <view class="marker-address">
              {{ item.address }}
            </view>
            <view class="marker-count">
              {{ item.summary }}
            </view>
            <view class="coordinate-value">
              {{ item.lat }}, {{ item.lng }}
            </view>
          </view>
          <wd-button size="mini" variant="plain" @click="copyCoordinates(item.lat, item.lng)">
            复制坐标
          </wd-button>
        </view>
      </view>
      <wd-empty v-else icon="location" tip="当前组织还没有已定位的小区或楼栋" />
      <!-- #endif -->
      <view class="summary-card">
        <view><strong>{{ estates.length }}</strong><text>小区标点</text></view>
        <view><strong>{{ buildings.length }}</strong><text>楼栋标点</text></view>
        <view><strong>{{ unlocatedCount }}</strong><text>待定位楼栋</text></view>
      </view>
      <view v-if="estates.length" class="marker-list">
        <view v-for="item in estates" :key="item.id" class="marker-card">
          <view class="marker-name">
            {{ item.display_name || item.name }}
          </view>
          <view class="marker-address">
            {{ item.address || '地址未登记' }}
          </view>
          <view class="marker-count">
            {{ item.building_count }} 栋 · {{ item.counts.total }} 套 · {{ item.counts.vacant }} 套空置
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.map-page {
  min-height: 100vh;
  padding: 24rpx;
  background: var(--app-bg-page);
}
.map-view {
  width: 100%;
  height: 640rpx;
  overflow: hidden;
  border-radius: 26rpx;
}
.coordinate-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.coordinate-intro {
  padding: 20rpx 24rpx;
  border-radius: 18rpx;
  background: var(--app-bg-warm-soft);
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}
.coordinate-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: var(--app-bg-card);
}
.coordinate-main {
  min-width: 0;
  flex: 1;
}
.coordinate-value {
  margin-top: 10rpx;
  color: var(--app-color-primary);
  font-size: 22rpx;
}
.summary-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
  text-align: center;
}
.summary-card strong,
.summary-card text {
  display: block;
}
.summary-card strong {
  color: var(--app-text-primary);
  font-size: 34rpx;
}
.summary-card text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.marker-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}
.marker-card {
  padding: 24rpx;
  border-radius: 20rpx;
  background: var(--app-bg-card);
}
.marker-name {
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 650;
}
.marker-address,
.marker-count {
  margin-top: 8rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
</style>
