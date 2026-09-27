import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/features/houses/components/PublicHouseLocationDropdown.vue', import.meta.url), 'utf8')
const homePageSource = readFileSync(new URL('../src/pages/index/index.vue', import.meta.url), 'utf8')
const mapPageSource = readFileSync(new URL('../src/pages-housing/map/index.vue', import.meta.url), 'utf8')
const searchPageSource = readFileSync(new URL('../src/pages-housing/search/index.vue', import.meta.url), 'utf8')
const housesPageSource = readFileSync(new URL('../src/pages/houses/index.vue', import.meta.url), 'utf8')

test('区域、地铁与通勤作为限定宽高的气泡弹窗打开', () => {
  assert.doesNotMatch(source, /AppBottomSheet/)
  assert.match(source, /location-popover-host/)
  assert.match(source, /location-popover__mask/)
  assert.match(source, /location-popover__header[\s\S]*<strong>\{\{ headerContent\.title \}\}<\/strong>/)
  assert.match(source, /max-width:\s*var\(--public-house-filter-popover-width, 680rpx\)/)
  assert.match(source, /height:\s*min\(68vh, 760rpx\)/)
  assert.match(source, /grid-template-columns:\s*19% 32% 49%/)
  assert.match(source, /location-dropdown__columns--commute[\s\S]*grid-template-columns:\s*19% 81%/)
})

test('区域模式使用行政区和板块三级联动并保留全区选项', () => {
  assert.match(source, /activeDistrict/)
  assert.match(source, /activeDistrict\?\.subdistricts/)
  assert.match(source, /grid-template-columns:\s*19% 32% 49%/)
  assert.match(source, /@click="selectDraftDistrict\(''\)"[^>]*>\s*全区/)
  assert.match(source, /@click="selectDraftSubdistrict\(''\)"/)
  assert.match(source, /draftDistrict \? `\$\{shortRegionName\(draftDistrict\)\}全区` : '全区'/)
  assert.doesNotMatch(source, /location-dropdown__region-result|全部房源|i-carbon-checkmark-filled/)
})

test('区域地铁筛选隐藏滚动条', () => {
  assert.match(source, /:show-scrollbar="false"/)
  assert.equal(source.match(/<scroll-view[^>]*\senhanced[^>]*:show-scrollbar="false"/g)?.length, 3)
  assert.match(source, /scrollbar-width:\s*none/)
  assert.match(source, /::-webkit-scrollbar/)
})

test('区域地铁筛选固定使用蓝色主题', () => {
  assert.match(source, /--location-filter-primary:\s*#1677ff/)
  assert.match(source, /--wot-checkbox-color-checked:\s*var\(--location-filter-primary\)/)
  assert.match(source, /--wot-button-primary-bg:\s*var\(--location-filter-primary\)/)
})

test('区域和地铁模式都不展示城市定位信息栏', () => {
  assert.doesNotMatch(source, /location-dropdown__citybar/)
  assert.doesNotMatch(source, /i-carbon-location-filled/)
})

test('区域地铁模式使用纯文字入口且线路使用小圆点标识', () => {
  assert.doesNotMatch(source, /<view class="i-carbon-map" \/>\s*<text>区域<\/text>/)
  assert.doesNotMatch(source, /<view class="i-carbon-train" \/>\s*<text>地铁<\/text>/)
  assert.doesNotMatch(source, /location-dropdown__option--mode\.active::before/)
  assert.match(source, /\.location-dropdown__line-color\s*\{[^}]*width:\s*13rpx[^}]*height:\s*13rpx[^}]*border-radius:\s*50%/)
})

test('三级筛选使用气泡操作区并限制五个站点', () => {
  assert.match(source, /location-popover__footer/)
  assert.doesNotMatch(source, /<template #footer>/)
  assert.match(source, /:max="5"/)
  assert.match(source, /查看房源/)
})

test('地铁模式不选择站点也可以确认查看房源', () => {
  assert.doesNotMatch(source, /请至少选择一个地铁站/)
  assert.match(source, /stationNames: draftMode\.value === 'metro' \? \[\.\.\.draftStationNames\.value\] : \[\]/)
})

test('地铁站列表不重复展示线路标题，选择数量显示在弹窗摘要中', () => {
  assert.doesNotMatch(source, /selectedCountText|location-dropdown__station-heading|可跨线路选择/)
  assert.match(source, /subtitle: `\$\{activeLine\.value\?\.name \|\| '选择线路'\} · 已选 \$\{draftStationNames\.value\.length\}\/5 站`/)
  assert.match(source, /location-dropdown__checkbox/)
  assert.match(source, /location-dropdown__station-check--active/)
  assert.match(source, /i-carbon-checkmark/)
})

test('地铁站卡片样式通过 custom-style 直接下发到 Wot Checkbox 根节点', () => {
  assert.match(source, /function stationCheckboxStyle\(stationName: string\)/)
  assert.match(source, /:custom-style="stationCheckboxStyle\(station\.name\)"/)
  assert.match(source, /--wot-checkbox-label-color:\s*#1677ff/)
})

test('区域地铁面板只读取全局城市且不提供城市修改入口', () => {
  assert.match(source, /regionStore\.selection\.city/)
  assert.match(source, /请先从页面右上角选择城市/)
  assert.doesNotMatch(source, /切换城市/)
  assert.doesNotMatch(source, /choose-city/)
})

test('房源列表从顶部筛选栏打开区域地铁与附近气泡', () => {
  assert.match(searchPageSource, /PublicHouseLocationDropdown/)
  assert.match(searchPageSource, /activeTopFilter === 'location'/)
  assert.match(searchPageSource, /activeTopFilter === 'nearby'/)
  assert.match(searchPageSource, /top-filter-popover-host/)
  assert.match(source, /position:\s*absolute[\s\S]*top:\s*100%/)
  assert.match(searchPageSource, /max-width:\s*var\(--public-house-filter-popover-width\)/)
  assert.doesNotMatch(searchPageSource, /附近范围/)
})

test('所有轻量筛选气泡使用统一宽度并标记当前打开入口', () => {
  for (const pageSource of [searchPageSource, housesPageSource]) {
    assert.match(pageSource, /--public-house-filter-popover-width:\s*680rpx/)
    assert.match(pageSource, /\.quick-filter--open > \.i-carbon-chevron-down\s*\{[^}]*transform:\s*rotate\(180deg\)/)
  }
  assert.match(searchPageSource, /\.top-filter-popover-host::before\s*\{[^}]*border-top:/)
  assert.match(housesPageSource, /\.quick-filter--open::after\s*\{[^}]*border-top:\s*8rpx solid/)
  assert.match(housesPageSource, /\.nearby-dropdown-host\s*\{[^}]*width:\s*calc\(100vw - var\(--app-page-gutter\) \* 2\)[^}]*max-width:\s*var\(--public-house-filter-popover-width\)/)
  assert.match(source, /max-width:\s*var\(--public-house-filter-popover-width, 680rpx\)/)
})

test('独立找房页顶部筛选打开时遮罩层覆盖页面内容', () => {
  assert.match(searchPageSource, /quick-filter-shell--open/)
  assert.match(searchPageSource, /\.quick-filter-shell--open\s*\{[^}]*z-index:\s*1100/)
})

test('所有房源筛选浮层打开时锁定页面并阻断遮罩滑动穿透', () => {
  for (const pageSource of [searchPageSource, housesPageSource]) {
    assert.match(pageSource, /const filterOverlayOpen = computed/)
    assert.match(pageSource, /<template>\s*<page-meta :page-style="`overflow:\$\{filterOverlayOpen \? '(?:hidden|clip)' : 'visible'\};`" \/>/)
    assert.match(pageSource, /class="top-filter-mask" @touchmove\.stop\.prevent(?: @wheel\.stop\.prevent)? @click="closeTopFilter"/)
  }
  assert.match(source, /class="location-popover__mask" @touchmove\.stop\.prevent @wheel\.stop\.prevent @click="closeWithoutApply"/)
})

test('公开找房页面导航栏统一使用全局地区入口', () => {
  for (const pageSource of [homePageSource, mapPageSource, searchPageSource])
    assert.match(pageSource, /PublicHouseRegionTrigger/)
})

test('公开找房页面首次加载会先初始化当前位置地区', () => {
  for (const pageSource of [homePageSource, mapPageSource, searchPageSource])
    assert.match(pageSource, /initializeDefaultRegion/)
})

test('独立找房页导航栏展示关键词搜索入口和右侧地区入口', () => {
  assert.match(searchPageSource, /navigationBarTitleText:\s*''/)
  assert.match(searchPageSource, /navigation-search-row[\s\S]*navigation-search-bar[\s\S]*PublicHouseRegionTrigger/)
  assert.match(searchPageSource, /class="navigation-search-bar" aria-label="搜索房源" @click="openKeywordSearch"/)
  assert.match(searchPageSource, /搜索小区、区域或房源/)
  assert.match(searchPageSource, /back transparent scroll-mode="sticky"/)
  assert.doesNotMatch(searchPageSource, /class="search-bar"/)
})

test('地铁找房路由进入后自动打开地铁筛选', () => {
  assert.match(searchPageSource, /preset\.location_mode === 'metro'/)
  assert.match(searchPageSource, /setLocationFilter\(\{ mode: 'metro', district: '', stationNames: \[\] \}\)/)
  assert.match(searchPageSource, /activeTopFilter\.value = 'location'/)
})

test('租金、户型、面积和电梯使用独立气泡且筛选条件横向滚动', () => {
  assert.match(searchPageSource, /type TopFilter = 'nearby' \| 'location' \| 'rent' \| 'bedroom' \| 'area' \| 'elevator'/)
  assert.match(searchPageSource, /activeTopFilter = ref<TopFilter \| null>/)
  assert.match(searchPageSource, /class="quick-filter-scroll" scroll-x enhanced :show-scrollbar="false"/)
  assert.match(searchPageSource, /activeTopFilter === 'rent'/)
  assert.match(searchPageSource, /activeTopFilter === 'bedroom'/)
  assert.match(searchPageSource, /activeTopFilter === 'area'/)
  assert.match(searchPageSource, /selectElevatorFilter/)
  assert.doesNotMatch(searchPageSource, /title="更多筛选"|showFilters|openFilters/)
})

test('独立筛选气泡共用蓝色主题', () => {
  assert.match(searchPageSource, /--filter-popover-primary:\s*#1677ff/)
  assert.match(searchPageSource, /--wot-radio-checked-color:\s*var\(--filter-popover-primary\)/)
  assert.match(searchPageSource, /top-filter-popover__apply/)
})
