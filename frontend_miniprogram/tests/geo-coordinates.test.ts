import assert from 'node:assert/strict'
import test from 'node:test'
import { wgs84ToGcj02 } from '../src/domain/geo-coordinates.ts'

test('国内 WGS84 坐标转换为 GCJ02', () => {
  const point = wgs84ToGcj02({ longitude: 116.404, latitude: 39.915 })
  assert.ok(Math.abs(point.longitude - 116.41024449916938) < 0.000001)
  assert.ok(Math.abs(point.latitude - 39.91640428150164) < 0.000001)
})

test('境外坐标保持原值', () => {
  const point = { longitude: -73.9857, latitude: 40.7484 }
  assert.deepEqual(wgs84ToGcj02(point), point)
})
