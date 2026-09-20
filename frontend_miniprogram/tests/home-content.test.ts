import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  getHomeBannerRoute,
  getHomeEntryDetailRoute,
  getHomeEntryListRoute,
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
    max_rent: undefined,
    bedrooms: undefined,
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
    max_rent: undefined,
    bedrooms: undefined,
    sort: 'latest',
    location_mode: undefined,
  })
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
  assert.match(detailSource, /class="topic-immersive"/)
  assert.match(detailSource, /class="topic-hero"/)
})
