import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  getHomeBannerRoute,
  getHomeEntryDetailRoute,
  getHomeEntryListRoute,
  getPublicHouseMapRoute,
  getPublicHouseSearchRoute,
  HOME_QUICK_SEARCHES,
  HOME_RANKING_SEARCHES,
  parsePublicHouseSearchPreset,
} from '../src/domain/home-content.ts'
import { findCatalogModuleByRoute } from '../src/modules/catalog.ts'
import { APP_ROUTES } from '../src/modules/routes.ts'

test('首页运营内容路由全部落在公开 housing 分包', () => {
  assert.equal(APP_ROUTES.publicHouseSearch, '/pages-housing/search/index')
  assert.equal(APP_ROUTES.homeContentList, '/pages-housing/home-content/index')
  assert.equal(APP_ROUTES.homeContentDetail, '/pages-housing/home-content/detail')
  assert.equal(findCatalogModuleByRoute(APP_ROUTES.publicHouseSearch)?.key, 'houses')
  assert.equal(findCatalogModuleByRoute(APP_ROUTES.homeContentDetail)?.key, 'houses')
})

test('首页专题、列表和公共找房参数使用稳定编码', () => {
  assert.equal(getHomeEntryListRoute('guide'), '/pages-housing/home-content/index?kind=guide')
  assert.equal(getHomeEntryDetailRoute('毕业 好房'), '/pages-housing/home-content/detail?slug=%E6%AF%95%E4%B8%9A%20%E5%A5%BD%E6%88%BF')
  assert.equal(getPublicHouseSearchRoute({ keyword: '近地铁', max_rent: '3000', sort: 'rent_asc' }), '/pages-housing/search/index?keyword=%E8%BF%91%E5%9C%B0%E9%93%81&max_rent=3000&sort=rent_asc')
  assert.equal(getPublicHouseSearchRoute({ location_mode: 'metro' }), '/pages-housing/search/index?location_mode=metro')
})

test('首页地铁入口使用结构化筛选而不是关键词', () => {
  assert.deepEqual(HOME_QUICK_SEARCHES['地铁找房'], { location_mode: 'metro' })
  assert.deepEqual(HOME_RANKING_SEARCHES['地铁线路'], { location_mode: 'metro' })
  assert.deepEqual(parsePublicHouseSearchPreset({ location_mode: 'metro' }), {
    keyword: undefined,
    listing_type: undefined,
    max_rent: undefined,
    bedrooms: undefined,
    bedrooms_min: undefined,
    nearby: undefined,
    longitude: undefined,
    latitude: undefined,
    radius_m: undefined,
    place_name: undefined,
    place_city: undefined,
    sort: 'latest',
    location_mode: 'metro',
  })
})

test('Banner 动作只进入专题详情、公共找房或地图找房', () => {
  const base = {
    id: 1,
    eyebrow: '',
    title: '标题',
    description: '说明',
    button_text: '查看',
    image: [],
    tone: 'blue' as const,
  }

  assert.equal(getHomeBannerRoute({ ...base, action_type: 'entry', entry_slug: 'graduation-rental' }), '/pages-housing/home-content/detail?slug=graduation-rental')
  assert.equal(getHomeBannerRoute({ ...base, action_type: 'house_list', entry_slug: null }), '/pages-housing/search/index')
  assert.equal(getHomeBannerRoute({ ...base, action_type: 'house_map', entry_slug: null }), '/pages-housing/map/index')
  assert.equal(getHomeBannerRoute({ ...base, action_type: 'entry', entry_slug: null }), null)
})

test('公共找房参数忽略非法户型和排序', () => {
  assert.deepEqual(parsePublicHouseSearchPreset({ keyword: '整租', bedrooms: '-1', sort: 'unknown' }), {
    keyword: '整租',
    listing_type: undefined,
    max_rent: undefined,
    bedrooms: undefined,
    bedrooms_min: undefined,
    nearby: undefined,
    longitude: undefined,
    latitude: undefined,
    radius_m: undefined,
    place_name: undefined,
    place_city: undefined,
    sort: 'latest',
    location_mode: undefined,
  })
})

test('首页分类、三室以上及附近参数进入结构化搜索', () => {
  assert.deepEqual(HOME_QUICK_SEARCHES['品质整租'], { listing_type: 'whole' })
  assert.equal(getPublicHouseSearchRoute({ listing_type: 'shared', bedrooms_min: 3, nearby: 1 }), '/pages-housing/search/index?listing_type=shared&bedrooms_min=3&nearby=1')
  assert.deepEqual(parsePublicHouseSearchPreset({ listing_type: 'shared', bedrooms_min: '3', nearby: '1', keyword: '%E6%9C%9B%E6%B5%B7' }), {
    keyword: '望海',
    listing_type: 'shared',
    max_rent: undefined,
    bedrooms: undefined,
    bedrooms_min: 3,
    nearby: 1,
    longitude: undefined,
    latitude: undefined,
    radius_m: undefined,
    place_name: undefined,
    place_city: undefined,
    sort: 'latest',
    location_mode: undefined,
  })
})

test('地点找房将地点坐标与名称传到结果页，房源关键词保持为空', () => {
  const route = getPublicHouseSearchRoute({
    nearby: 1,
    longitude: 113.33,
    latitude: 23.14,
    radius_m: 1000,
    place_name: '万达广场',
    place_city: '广州市',
    listing_type: 'whole',
  })
  const options = Object.fromEntries(new URL(route, 'http://localhost').searchParams)
  const preset = parsePublicHouseSearchPreset(options)
  assert.equal(preset.keyword, undefined)
  assert.equal(preset.place_name, '万达广场')
  assert.equal(preset.place_city, '广州市')
  assert.equal(preset.longitude, 113.33)
  assert.equal(preset.latitude, 23.14)
  assert.equal(preset.radius_m, 1000)
  assert.equal(preset.listing_type, 'whole')
})

test('附近找房在列表和地图之间保留同一位置及户型条件', () => {
  const preset = {
    nearby: 1 as const,
    longitude: 113.33,
    latitude: 23.14,
    radius_m: 1000 as const,
    place_name: '广州市 · 天河区',
    place_city: '广州市',
    listing_type: 'shared' as const,
    bedrooms_min: 3,
  }
  for (const route of [getPublicHouseSearchRoute(preset), getPublicHouseMapRoute(preset)]) {
    const parsed = parsePublicHouseSearchPreset(Object.fromEntries(new URL(route, 'http://localhost').searchParams))
    assert.equal(parsed.keyword, undefined)
    for (const key of Object.keys(preset) as (keyof typeof preset)[])
      assert.equal(parsed[key], preset[key])
  }
})

test('首页不读取身份模式且运营区不再保留硬编码内容', () => {
  const homeSource = readFileSync(new URL('../src/pages/index/index.vue', import.meta.url), 'utf8')
  const discoverySource = readFileSync(new URL('../src/features/home/components/HomeDiscoverySections.vue', import.meta.url), 'utf8')
  const detailSource = readFileSync(new URL('../src/pages-housing/home-content/detail.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(homeSource, /navigationMode|currentMode/)
  assert.match(homeSource, /getHomeContent/)
  assert.match(homeSource, /getPublicHouseSearchRoute/)
  assert.doesNotMatch(discoverySource, /const heroBanners|const topics =|const guides =/)
  assert.match(detailSource, /<rich-text[\s\S]*:nodes="entry\.body_html"/)
  assert.match(detailSource, /if \(entry\.value\.kind === 'topic'\)[\s\S]*housePage\.refresh/)
  assert.doesNotMatch(detailSource, /<AppPage[^>]*\sai-background(?:\s|>)/)
  assert.match(detailSource, /<AppCustomNavigation[\s\S]*back[\s\S]*immersive/)
  assert.doesNotMatch(detailSource, /scrolled-background=/)
  assert.match(detailSource, /class="topic-immersive(?:\s[^"]*)?"/)
  assert.match(detailSource, /class="topic-hero(?:\s[^"]*)?"/)
})
