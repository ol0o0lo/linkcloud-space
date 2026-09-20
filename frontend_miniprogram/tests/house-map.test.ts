import assert from 'node:assert/strict'
import test from 'node:test'

import * as houseMapDomain from '../src/domain/house-map.ts'
import {
  buildHouseMapClusters,
  buildHouseMapRequestKey,
  createHouseMapMarkerId,
  createHouseMapResultCache,
  diffHouseMapMarkerKeys,
  resolveMapIncludePoints,
} from '../src/domain/house-map.ts'

function house(input: {
  id: number
  buildingId: number
  lat?: string | null
  lng?: string | null
  estateId?: number
  rent?: string | null
}) {
  return {
    id: input.id,
    asking_rent: input.rent ?? null,
    building: {
      id: input.buildingId,
      name: `${input.buildingId}栋`,
      address: `地址${input.buildingId}`,
      location: input.lat != null && input.lng != null
        ? { latitude: input.lat, longitude: input.lng }
        : null,
      estate: input.estateId
        ? { id: input.estateId, name: '云栖小区', display_name: '云栖小区', district: '南山', address: '云栖路' }
        : null,
    },
  }
}

test('地图房源按小区聚合并计算最低租金与平均坐标', () => {
  const clusters = buildHouseMapClusters([
    house({ id: 1, buildingId: 10, estateId: 1, lat: '22.540000', lng: '114.050000', rent: '3200' }),
    house({ id: 2, buildingId: 10, estateId: 1, lat: '22.540000', lng: '114.050000', rent: '2800' }),
    house({ id: 3, buildingId: 11, estateId: 1, lat: '22.560000', lng: '114.070000', rent: null }),
  ])

  assert.equal(clusters.length, 1)
  assert.equal(clusters[0].key, 'estate:1')
  assert.equal(clusters[0].houseCount, 3)
  assert.equal(clusters[0].minRent, 2800)
  assert.equal(clusters[0].latitude, 22.55)
  assert.equal(clusters[0].longitude, 114.06)
})

test('无小区房源按楼栋聚合，无有效坐标的房源不进入地图', () => {
  const clusters = buildHouseMapClusters([
    house({ id: 1, buildingId: 10, lat: '22.540000', lng: '114.050000', rent: '3000' }),
    house({ id: 2, buildingId: 10, lat: '22.540000', lng: '114.050000', rent: '3100' }),
    house({ id: 3, buildingId: 11, lat: null, lng: null, rent: '2600' }),
  ])

  assert.equal(clusters.length, 1)
  assert.equal(clusters[0].key, 'building:10')
  assert.equal(clusters[0].houseCount, 2)
  assert.deepEqual(clusters[0].houses.map(item => item.id), [1, 2])
})

test('微信地图无可用适配点时不传空 include-points', () => {
  assert.equal(resolveMapIncludePoints([], false), undefined)
  assert.equal(resolveMapIncludePoints([
    { location: { latitude: 'invalid', longitude: '114.05' } },
  ], false), undefined)
  assert.equal(resolveMapIncludePoints([
    { location: { latitude: '22.54', longitude: '114.05' } },
  ], true), undefined)
  assert.deepEqual(resolveMapIncludePoints([
    { location: { latitude: '22.54', longitude: '114.05' } },
  ], false), [
    { latitude: 22.54, longitude: 114.05 },
  ])
})

test('地图标记 ID 不随结果排序变化', () => {
  const first = createHouseMapMarkerId('building:42')

  assert.equal(first, createHouseMapMarkerId('building:42'))
  assert.ok(Number.isSafeInteger(first))
  assert.ok(first > 0)
  assert.notEqual(first, createHouseMapMarkerId('building:43'))
})

test('地图请求键忽略视野的微小浮动并保留筛选差异', () => {
  const base = buildHouseMapRequestKey({
    zoom: 14,
    west: 113.9345671,
    south: 22.5401231,
    east: 113.9945671,
    north: 22.6001231,
    keyword: ' 云栖 ',
    city: '广州市',
    coordinate_system: 'gcj02',
  })
  const jittered = buildHouseMapRequestKey({
    zoom: 14.01,
    west: 113.9345674,
    south: 22.5401234,
    east: 113.9945674,
    north: 22.6001234,
    keyword: '云栖',
    city: '广州市',
    coordinate_system: 'gcj02',
  })

  assert.equal(base, jittered)
  assert.notEqual(base, buildHouseMapRequestKey({
    zoom: 14,
    west: 113.9345671,
    south: 22.5401231,
    east: 113.9945671,
    north: 22.6001231,
    keyword: '天河',
    city: '广州市',
    coordinate_system: 'gcj02',
  }))
})

test('地图结果缓存按最近访问淘汰并隔离写入数据', () => {
  const cache = createHouseMapResultCache<{ items: number[] }>(2)
  const first = { items: [1] }
  cache.set('first', first)
  cache.set('second', { items: [2] })
  first.items.push(99)

  assert.deepEqual(cache.get('first'), { items: [1] })
  cache.set('third', { items: [3] })
  assert.equal(cache.get('second'), undefined)
  assert.deepEqual(cache.get('first'), { items: [1] })
  assert.deepEqual(cache.get('third'), { items: [3] })
})

test('H5 地图标记按业务 key 计算差量变更', () => {
  assert.deepEqual(diffHouseMapMarkerKeys(
    ['district:天河', 'district:越秀'],
    ['district:天河', 'district:海珠'],
  ), {
    added: ['district:海珠'],
    removed: ['district:越秀'],
    retained: ['district:天河'],
  })
})

test('地图标记点击后同一手势触发的地图点击不会清空选择', () => {
  const shouldClearHouseMapSelection = (houseMapDomain as Record<string, unknown>).shouldClearHouseMapSelection
  assert.equal(typeof shouldClearHouseMapSelection, 'function')

  const shouldClear = shouldClearHouseMapSelection as (lastMarkerTapAt: number, now: number) => boolean
  assert.equal(shouldClear(1_000, 1_050), false)
  assert.equal(shouldClear(1_000, 1_500), true)
})
