import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPublicHouseSpatialParams,
  formatPublicHouseRadiusLabel,
  reconcileMetroSelection,
  toggleMetroStation,
} from '../src/domain/public-house-metro.ts'

test('换乘站跨线路勾选只占一个名额', () => {
  assert.deepEqual(toggleMetroStation(['世界之窗'], '世界之窗'), [])
  assert.deepEqual(toggleMetroStation(['罗湖'], '世界之窗'), ['罗湖', '世界之窗'])
  assert.deepEqual(toggleMetroStation(['罗湖', '罗湖'], '国贸'), ['罗湖', '国贸'])
})

test('最多允许五个不同站点', () => {
  assert.throws(() => toggleMetroStation(['站1', '站2', '站3', '站4', '站5'], '站6'), /最多选择 5 个站点/)
})

test('城市变化会清空旧城市站点', () => {
  assert.deepEqual(reconcileMetroSelection({ city: '深圳市', stationNames: ['罗湖'] }, '广州市'), {
    city: '广州市',
    stationNames: [],
  })
})

test('附近、地铁和普通地区生成互斥请求参数', () => {
  assert.deepEqual(buildPublicHouseSpatialParams({
    nearbyEnabled: true,
    nearbyLocation: { longitude: 114, latitude: 22.5 },
    radiusM: 1000,
    mode: 'metro',
    city: '深圳市',
    metroStationNames: ['罗湖'],
    province: '广东省',
    district: '罗湖区',
    subdistrict: '东门',
  }), { longitude: 114, latitude: 22.5, radius_m: 1000, coordinate_system: 'gcj02' })
  assert.deepEqual(buildPublicHouseSpatialParams({
    nearbyEnabled: false,
    nearbyLocation: null,
    radiusM: 1500,
    mode: 'metro',
    city: '深圳市',
    metroStationNames: ['罗湖', '国贸'],
    province: '广东省',
    district: '',
    subdistrict: '',
  }), { province: '广东省', city: '深圳市', metro_stations: ['罗湖', '国贸'], radius_m: 1500 })
  assert.deepEqual(buildPublicHouseSpatialParams({
    nearbyEnabled: false,
    nearbyLocation: null,
    radiusM: 1000,
    mode: 'region',
    city: '深圳市',
    metroStationNames: ['罗湖'],
    province: '广东省',
    district: '南山区',
    subdistrict: '科技园',
  }), { province: '广东省', city: '深圳市', district: '南山区', subdistrict: '科技园' })
})

test('半径标签使用紧凑单位', () => {
  assert.equal(formatPublicHouseRadiusLabel(500), '500m')
  assert.equal(formatPublicHouseRadiusLabel(1500), '1.5km')
})
