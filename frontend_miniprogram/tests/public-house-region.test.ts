import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPublicHouseCityIndex,
  buildPublicHouseRegionParams,
  createPublicHouseManualRegionPreference,
  findLocatedPublicHouseRegion,
  formatPublicHouseRegionLabel,
  getPopularPublicHouseCities,
  isPublicHouseManualRegionPreferenceActive,
  isPublicHouseRegionSelection,
  PUBLIC_HOUSE_MANUAL_REGION_TTL_MS,
  resolvePublicHouseRegionSelection,
} from '../src/domain/public-house-region.ts'

const regions = [
  {
    province: '广东省',
    house_count: 12,
    cities: [
      {
        city: '广州市',
        house_count: 5,
        districts: [{ district: '南山区', house_count: 2 }],
      },
      {
        city: '深圳市',
        house_count: 7,
        districts: [
          { district: '南山区', house_count: 4 },
          { district: '福田区', house_count: 3 },
        ],
      },
    ],
  },
]

test('公开房源地区状态只接受全国、城市全城和完整行政区', () => {
  assert.equal(isPublicHouseRegionSelection({ province: '', city: '', district: '' }), true)
  assert.equal(isPublicHouseRegionSelection({ province: '广东省', city: '深圳市', district: '' }), true)
  assert.equal(isPublicHouseRegionSelection({ province: '广东省', city: '深圳市', district: '南山区' }), true)
  assert.equal(isPublicHouseRegionSelection({ province: '', city: '', district: '南山区' }), false)
  assert.equal(isPublicHouseRegionSelection({ province: '广东省', city: '', district: '' }), false)
})

test('公开房源地区参数按全国、全城和行政区分级生成', () => {
  assert.deepEqual(buildPublicHouseRegionParams({ province: '', city: '', district: '' }), {})
  assert.deepEqual(buildPublicHouseRegionParams({ province: '广东省', city: '深圳市', district: '' }), {
    province: '广东省',
    city: '深圳市',
    district: undefined,
  })
  assert.deepEqual(buildPublicHouseRegionParams({ province: '广东省', city: '深圳市', district: '南山区' }), {
    province: '广东省',
    city: '深圳市',
    district: '南山区',
  })
})

test('地区短标签去除常见行政后缀', () => {
  assert.equal(formatPublicHouseRegionLabel({ province: '', city: '', district: '' }), '全国')
  assert.equal(formatPublicHouseRegionLabel({ province: '广东省', city: '深圳市', district: '' }), '深圳')
  assert.equal(formatPublicHouseRegionLabel({ province: '广东省', city: '深圳市', district: '南山区' }), '南山')
})

test('缓存地区选择会按省市区完整身份校验并归一为服务端名称', () => {
  assert.deepEqual(resolvePublicHouseRegionSelection(regions, { province: '广东', city: '深圳', district: '南山' }), {
    province: '广东省',
    city: '深圳市',
    district: '南山区',
  })
  assert.equal(resolvePublicHouseRegionSelection(regions, { province: '广东省', city: '珠海市', district: '' }), null)
})

test('定位结果只匹配已开通城市且不会因同名行政区串城市', () => {
  assert.deepEqual(findLocatedPublicHouseRegion(regions, { province: '广东', city: '深圳', district: '南山' }), {
    province: '广东省',
    city: '深圳市',
    district: '',
  })
  assert.equal(findLocatedPublicHouseRegion(regions, { province: '广西壮族自治区', city: '深圳市', district: '南山区' }), null)
})

test('手动地区缓存有效期固定为七天', () => {
  const now = new Date('2026-09-18T10:00:00+08:00').getTime()
  const preference = createPublicHouseManualRegionPreference(now)

  assert.equal(preference.expiresAt, now + PUBLIC_HOUSE_MANUAL_REGION_TTL_MS)
  assert.equal(isPublicHouseManualRegionPreferenceActive(preference, preference.expiresAt - 1), true)
  assert.equal(isPublicHouseManualRegionPreferenceActive(preference, preference.expiresAt), false)
})

test('城市目录按拼音首字母分组并处理常见多音字地名', () => {
  const indexed = buildPublicHouseCityIndex([
    {
      province: '直辖市',
      house_count: 8,
      cities: [
        { city: '北京市', house_count: 3, districts: [] },
        { city: '重庆市', house_count: 5, districts: [] },
      ],
    },
    {
      province: '湖南省',
      house_count: 4,
      cities: [{ city: '长沙市', house_count: 4, districts: [] }],
    },
    {
      province: '福建省',
      house_count: 2,
      cities: [{ city: '厦门市', house_count: 2, districts: [] }],
    },
  ])

  assert.deepEqual(indexed.map(group => [group.index, group.cities.map(item => item.label)]), [
    ['B', ['北京']],
    ['C', ['重庆', '长沙']],
    ['X', ['厦门']],
  ])
})

test('热门城市按公开房源数量排序并限制展示数量', () => {
  assert.deepEqual(
    getPopularPublicHouseCities(regions, 1).map(item => item.label),
    ['深圳'],
  )
})
