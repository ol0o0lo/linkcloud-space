<script setup lang="ts">
import HouseH5Map from '@/components/house/HouseH5Map.vue'
import { useRuntimeStore } from '@/store/runtime'
import { APP_ROUTES, getOrganizationBuildingFormRoute, getOrganizationEstateFormRoute } from '@/modules/routes'

import type { BuildingMapMarkerOut, EstateMapMarkerOut } from '@/pages-org-rental/api/organization-rental'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getOrganizationUnlocatedBuildingCount, listOrganizationBuildingMap, listOrganizationEstateMap } from '@/pages-org-rental/api/organization-rental'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '房源地图', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const runtime = useRuntimeStore()
const estates = ref<EstateMapMarkerOut[]>([])
const buildings = ref<BuildingMapMarkerOut[]>([])
const unlocatedCount = ref(0)
const loading = ref(true)
const loadError = ref('')

const markers = computed(() => [
  ...estates.value.map(item => ({
    id: item.id,
    latitude: Number(item.location.latitude),
    longitude: Number(item.location.longitude),
    title: `${item.display_name || item.name} · ${item.counts.vacant} 套空置`,
    iconPath: '/static/tabbar/home.png',
    width: 28,
    height: 28,
  })),
  ...buildings.value.map(item => ({
    id: 1000000 + item.id,
    latitude: Number(item.location.latitude),
    longitude: Number(item.location.longitude),
    title: `${item.name} · ${item.counts.total} 套`,
    iconPath: '/static/tabbar/home.png',
    width: 24,
    height: 24,
  })),
].filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)))

const center = computed(() => markers.value[0] || { latitude: 31.2304, longitude: 121.4737 })

const h5Markers = computed(() => [
  ...estates.value.map(item => ({ key: `estate-${item.id}`, city: '', district: '', estate_id: item.id, building_id: null, level: 'estate' as const, name: item.display_name || item.name, address: item.address || '', location: { ...item.location, coordinate_system: 'gcj02' as const }, house_count: item.counts.total, child_count: item.building_count, min_rent: null, target_zoom: 16 })),
  ...buildings.value.map(item => ({ key: `building-${item.id}`, city: '', district: '', estate_id: item.estate?.id || null, building_id: item.id, level: 'building' as const, name: item.name, address: item.address || '', location: { ...item.location, coordinate_system: 'gcj02' as const }, house_count: item.counts.total, child_count: 0, min_rent: null, target_zoom: 17 })),
])
function openMarker(key: string) {
  const [kind, id] = key.split('-')
  uni.navigateTo({ url: kind === 'estate' ? getOrganizationEstateFormRoute(Number(id)) : getOrganizationBuildingFormRoute(Number(id)) })
}
function markerTap(event: { detail: { markerId: number } }) {
  const id = event.detail.markerId
  openMarker(id >= 1000000 ? `building-${id - 1000000}` : `estate-${id}`)
}
function openBuildings() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationBuildings}?unlocated=1` })
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
    <AppCustomNavigation title="房源地图" back scroll-mode="sticky" />
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
        @markertap="markerTap"
      />
      <AppEmpty
        v-else
        title="还没有可显示的位置"
        description="先为小区或楼栋补充坐标，地图才能展示房源分布。"
        icon="no-content"
        action-text="维护楼栋位置"
        @action="openBuildings"
      />
      <!-- #endif -->
      <!-- #ifdef H5 -->
      <HouseH5Map
        v-if="h5Markers.length"
        class="map-view"
        :markers="h5Markers"
        :api-key="runtime.publicConfig?.amapJsapiKey || ''"
        :security-js-code="runtime.publicConfig?.amapSecurityJsCode || ''"
        :center="center"
        :zoom="12"
        selected-key=""
        @select="openMarker"
      />
      <AppEmpty v-else title="还没有可显示的位置" description="先为小区或楼栋补充坐标。" action-text="维护楼栋位置" @action="openBuildings" />
      <!-- #endif -->
      <wd-button v-if="unlocatedCount" class="mt-3" block variant="plain" @click="openBuildings">
        维护 {{ unlocatedCount }} 栋待定位楼栋
      </wd-button>
      <view class="summary-card">
        <view><strong>{{ estates.length }}</strong><text>小区标点</text></view>
        <view><strong>{{ buildings.length }}</strong><text>楼栋标点</text></view>
        <view><strong>{{ unlocatedCount }}</strong><text>待定位楼栋</text></view>
      </view>
      <view v-if="estates.length" class="marker-list">
        <view v-for="item in estates" :key="item.id" class="marker-card app-touchable" @click="openMarker(`estate-${item.id}`)">
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
  padding: 0 24rpx 56rpx;
  background: var(--app-bg-page);
}
.map-page :deep(.app-custom-navigation) {
  margin: 0 -24rpx 24rpx;
}
.map-view {
  width: 100%;
  height: 640rpx;
  overflow: hidden;
  border-radius: 26rpx;
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
