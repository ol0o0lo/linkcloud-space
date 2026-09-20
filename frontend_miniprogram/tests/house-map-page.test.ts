import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { mergeWeixinLocationManifest, WEIXIN_LOCATION_MANIFEST } from '../scripts/weixin-location-manifest.ts'

const pageSource = readFileSync(new URL('../src/pages-housing/map/index.vue', import.meta.url), 'utf8')
const h5MapSource = readFileSync(new URL('../src/components/house/HouseH5Map.vue', import.meta.url), 'utf8')
const resultSheetSource = readFileSync(new URL('../src/components/house/HouseMapResultSheet.vue', import.meta.url), 'utf8')
const manifestSource = readFileSync(new URL('../manifest.config.ts', import.meta.url), 'utf8')
const viteSource = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
const styleSource = pageSource.slice(pageSource.indexOf('<style'))
const resultSheetStyleSource = resultSheetSource.slice(resultSheetSource.indexOf('<style'))

function cssBlock(selector: string, source = styleSource): string {
  const start = source.indexOf(`${selector} {`)
  assert.notEqual(start, -1, `缺少 ${selector} 样式`)
  const end = source.indexOf('\n}', start)
  assert.notEqual(end, -1, `${selector} 样式未闭合`)
  return source.slice(start, end)
}

test('地图找房页不使用微信 WXSS 不支持的逗号参数伪类', () => {
  const unsupportedSelector = styleSource.split('\n').find(line => [':not(', ':is(', ':where('].some(pseudo => line.includes(pseudo)) && line.includes(','))
  assert.equal(unsupportedSelector, undefined)
})

test('地图找房页使用全屏地图、透明导航和悬浮操作层', () => {
  const navigationTagStart = pageSource.indexOf('<AppCustomNavigation')
  const navigationTag = pageSource.slice(navigationTagStart, pageSource.indexOf('/>', navigationTagStart))
  assert.ok(navigationTag.includes('transparent'))
  assert.ok(pageSource.includes('<view class="map-navigation">'))
  assert.ok(pageSource.includes('class="map-viewport"'))
  assert.ok(pageSource.includes('class="map-overlay-top"'))

  const navigationStyle = cssBlock('.map-navigation')
  assert.ok(navigationStyle.includes('position: absolute;'))
  assert.ok(navigationStyle.includes('inset: 0 0 auto;'))
  assert.ok(navigationStyle.includes('z-index: 90;'))

  const mapStyle = cssBlock('.house-map')
  assert.ok(mapStyle.includes('position: absolute;'))
  assert.ok(mapStyle.includes('inset: 0;'))
  assert.ok(mapStyle.includes('height: 100%;'))

  const panelStyle = cssBlock('.map-result-sheet', resultSheetStyleSource)
  assert.ok(panelStyle.includes('position: absolute;'))
  assert.ok(panelStyle.includes('bottom:'))
})

test('地图找房按视野实时请求并提供缩放定位交互', () => {
  assert.ok(pageSource.includes('getPublicHouseMap'))
  assert.ok(!pageSource.includes('page_size: 500'))
  assert.ok(pageSource.includes('@regionchange="handleMapRegionChange"'))
  assert.ok(pageSource.includes('class="map-control-button"'))
  assert.ok(pageSource.includes('function zoomIn()'))
  assert.ok(pageSource.includes('function zoomOut()'))
  assert.ok(pageSource.includes('function locateUser()'))
  assert.ok(pageSource.includes('uni.getLocation'))
  assert.ok(h5MapSource.includes(`map.on('zoomend'`))
  assert.ok(h5MapSource.includes(`map.on('moveend'`))
  assert.ok(h5MapSource.includes(`'viewport-change'`))
})

test('地图找房使用会话调度、稳定标记 ID 和 H5 差量标记', () => {
  assert.ok(pageSource.includes('createHouseMapSession'))
  assert.ok(pageSource.includes('buildHouseMapRequestKey'))
  assert.ok(pageSource.includes('createHouseMapMarkerId'))
  assert.ok(!pageSource.includes('let mapRequestId'))
  assert.ok(!pageSource.includes('markers.value[Number(event.detail.markerId) - 1]'))
  assert.ok(h5MapSource.includes('new Map<string, AmapH5Marker>()'))
  assert.ok(h5MapSource.includes('.setPosition('))
  assert.ok(h5MapSource.includes('diffHouseMapMarkerKeys'))
})

test('微信地图仅在有有效坐标时通过上下文适配视野', () => {
  assert.ok(!pageSource.includes(':include-points="'))
  assert.ok(pageSource.includes('const points = resolveMapIncludePoints'))
  assert.ok(pageSource.includes('if (!points?.length)'))
  assert.ok(pageSource.includes('context.includePoints({'))
})

test('程序化地图移动不会覆盖显式全城请求', () => {
  const scheduleStart = pageSource.indexOf('function scheduleViewportLoad')
  const scheduleEnd = pageSource.indexOf('\n}', scheduleStart)
  const scheduleSource = pageSource.slice(scheduleStart, scheduleEnd)
  assert.ok(scheduleSource.indexOf('Date.now() < ignoredViewportUntil') < scheduleSource.indexOf('currentViewport.value = viewport'))
  assert.ok(scheduleSource.indexOf('ignoredViewportEvents > 0') < scheduleSource.indexOf('currentViewport.value = viewport'))
  assert.ok(pageSource.includes('function ignoreNextViewportChange()'))
  assert.ok(pageSource.includes('ignoreNextViewportChange()\n  currentViewport.value = null'))
})

test('清除附近筛选和查看全城都会强制恢复完整城市结果', () => {
  const resetStart = pageSource.indexOf('function resetSearch()')
  const resetEnd = pageSource.indexOf('\n}', resetStart)
  const resetSource = pageSource.slice(resetStart, resetEnd)
  assert.ok(resetSource.includes('spatialFilter.reset()'))
  assert.ok(resetSource.includes('loadMapMarkers(null, true)'))
  assert.ok(pageSource.includes('@click="hasActiveFilters ? viewFullCity() : resetMapView()"'))
})

test('楼栋选中后使用可关闭、可重试的独立房源结果层', () => {
  assert.ok(pageSource.includes('import HouseMapResultSheet from \'@/components/house/HouseMapResultSheet.vue\''))
  assert.ok(pageSource.includes('<HouseMapResultSheet'))
  assert.ok(resultSheetSource.includes('emit(\'close\')'))
  assert.ok(resultSheetSource.includes('emit(\'retry\')'))
  assert.ok(resultSheetSource.includes('class="map-result-sheet"'))
  assert.ok(resultSheetSource.includes('<HouseCard'))
})

test('地图普通点击不会立即覆盖同一手势的标记选择', () => {
  assert.ok(pageSource.includes('@tap="handleMapTap"'))
  assert.ok(pageSource.includes('lastMarkerTapAt = Date.now()'))
  assert.ok(pageSource.includes('shouldClearHouseMapSelection(lastMarkerTapAt)'))
})

test('点击聚合标记时显式加载下一地图层级', () => {
  const selectStart = pageSource.indexOf('function selectMarkerByKey')
  const selectEnd = pageSource.indexOf('\n}\n\nasync function loadSelectedHouses', selectStart)
  const selectSource = pageSource.slice(selectStart, selectEnd)
  assert.ok(selectSource.includes('if (marker.level !== \'building\')'))
  assert.ok(selectSource.includes('currentViewport.value = null'))
  assert.ok(selectSource.includes('mapScale.value = marker.target_zoom'))
  assert.ok(selectSource.includes('loadMapMarkers(null)'))
})

test('微信小程序声明地图定位权限和隐私接口', () => {
  assert.deepEqual(WEIXIN_LOCATION_MANIFEST.permission, {
    'scope.userLocation': {
      desc: '用于地图找房定位当前位置，并展示附近可租房源',
    },
  })
  assert.deepEqual(WEIXIN_LOCATION_MANIFEST.requiredPrivateInfos, ['getLocation', 'chooseLocation'])
  assert.ok(manifestSource.includes('...WEIXIN_LOCATION_MANIFEST'))
  assert.ok(viteSource.includes('ensureWeixinLocationManifest()'))
})

test('微信小程序构建权限补丁保留已有配置并去重隐私接口', () => {
  const merged = mergeWeixinLocationManifest({
    pages: ['pages/index/index'],
    permission: {
      'scope.writePhotosAlbum': { desc: '保存房源图片' },
    },
    requiredPrivateInfos: ['chooseLocation', 'scanCode'],
  })

  assert.deepEqual(merged.permission, {
    'scope.writePhotosAlbum': { desc: '保存房源图片' },
    'scope.userLocation': {
      desc: '用于地图找房定位当前位置，并展示附近可租房源',
    },
  })
  assert.deepEqual(merged.requiredPrivateInfos, ['chooseLocation', 'scanCode', 'getLocation'])
  assert.deepEqual(merged.pages, ['pages/index/index'])
})
