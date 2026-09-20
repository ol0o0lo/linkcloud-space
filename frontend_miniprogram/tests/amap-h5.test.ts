import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAmapH5MarkerContent, buildAmapH5ScriptUrl } from '../src/services/manual/amap-h5.ts'

test('高德 H5 SDK 地址包含密钥、回调并去重插件', () => {
  const url = new URL(buildAmapH5ScriptUrl('demo-key', 'ready', ['AMap.Scale', 'AMap.Scale', 'AMap.ToolBar']))

  assert.equal(url.origin, 'https://webapi.amap.com')
  assert.equal(url.searchParams.get('v'), '2.0')
  assert.equal(url.searchParams.get('key'), 'demo-key')
  assert.equal(url.searchParams.get('callback'), 'ready')
  assert.equal(url.searchParams.get('plugin'), 'AMap.Scale,AMap.ToolBar')
})

test('高德 H5 房源标记包含套数、最低租金和选中态', () => {
  const content = buildAmapH5MarkerContent({ active: true, houseCount: 12, minRent: 3288.6 })

  assert.match(content, /house-h5-map-marker--active/)
  assert.match(content, /12套/)
  assert.match(content, /¥3,289起/)
})

test('高德 H5 区域聚合标记包含区域名称和下一级数量', () => {
  const content = buildAmapH5MarkerContent({
    active: false,
    houseCount: 36,
    minRent: 2600,
    name: '黄埔',
    level: 'district',
    childCount: 5,
  })

  assert.match(content, /黄埔/)
  assert.match(content, /5个小区/)
  assert.match(content, /36套/)
})
