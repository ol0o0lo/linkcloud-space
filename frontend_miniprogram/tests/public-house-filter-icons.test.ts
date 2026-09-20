import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const homePageSource = readFileSync(new URL('../src/pages/index/index.vue', import.meta.url), 'utf8')
const housesPageSource = readFileSync(new URL('../src/pages/houses/index.vue', import.meta.url), 'utf8')
const searchPageSource = readFileSync(new URL('../src/pages-housing/search/index.vue', import.meta.url), 'utf8')

function sourceSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)

  assert.notEqual(startIndex, -1, `未找到片段起点：${start}`)
  assert.notEqual(endIndex, -1, `未找到片段终点：${end}`)
  return source.slice(startIndex, endIndex)
}

function assertIcons(source: string, icons: string[]) {
  for (const icon of icons)
    assert.match(source, new RegExp(`class="${icon}"`))
}

test('公开找房筛选胶囊统一使用语义图标且禁止横向收缩', () => {
  const searchFilters = sourceSection(searchPageSource, '<view class="quick-filter-row">', '</scroll-view>')
  const housesFilters = sourceSection(housesPageSource, '<view class="quick-filter-row">', '</scroll-view>')

  assertIcons(searchFilters, [
    'i-carbon-location-current',
    'i-carbon-map',
    'i-carbon-currency-yen',
    'i-carbon-hotel',
    'i-carbon-ruler',
    'i-carbon-building',
  ])
  assertIcons(housesFilters, [
    'i-carbon-location-current',
    'i-carbon-map',
    'i-carbon-currency-yen',
    'i-carbon-hotel',
    'i-carbon-filter',
  ])

  for (const source of [searchPageSource, housesPageSource])
    assert.match(source, /\.quick-filter\s*\{[^}]*flex:\s*0 0 auto;/)
})

test('首页推荐筛选胶囊使用同一语义图标并禁止横向收缩', () => {
  const recommendationFilters = sourceSection(homePageSource, '<view class="recommendation-filters__row">', '</scroll-view>')

  assertIcons(recommendationFilters, [
    'i-carbon-favorite',
    'i-carbon-location-current',
    'i-carbon-recently-viewed',
    'i-carbon-currency-yen',
    'i-carbon-filter',
  ])
  assert.match(homePageSource, /\.recommendation-filter\s*\{[^}]*flex:\s*0 0 auto;/)
})

test('房源筛选面板标题沿用与筛选胶囊相同的语义图标', () => {
  const housesSheet = sourceSection(housesPageSource, '<AppBottomSheet v-model:visible="showFilters"', '</AppBottomSheet>')
  const homeSheet = sourceSection(homePageSource, '<AppBottomSheet v-model:visible="showRecommendationFilters"', '</AppBottomSheet>')
  const searchPopover = sourceSection(searchPageSource, '<view v-if="activeTopFilter && activeTopFilter !== \'location\'"', '<PublicHouseLocationDropdown')

  for (const source of [housesSheet, homeSheet]) {
    assertIcons(source, [
      'i-carbon-currency-yen',
      'i-carbon-ruler',
      'i-carbon-hotel',
      'i-carbon-building',
    ])
  }
  assertIcons(searchPopover, [
    'i-carbon-location-current',
    'i-carbon-currency-yen',
    'i-carbon-hotel',
    'i-carbon-ruler',
  ])
})
