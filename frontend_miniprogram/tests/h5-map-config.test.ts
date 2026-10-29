import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { syncH5MapConfig } from '../src/platform/h5/map-config.ts'

// 直接用当前 uni-app SDK 的配置读取逻辑，验证字段能被真实地图入口识别。
const sdkSource = readFileSync(new URL('../node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js', import.meta.url), 'utf8')
const getMapInfoSource = sdkSource.match(/function getMapInfo\(\) \{[\s\S]*?\n\}/)?.[0]
assert.ok(getMapInfoSource, 'uni-app 地图配置接口变更，需要检查运行时配置适配')

function readSdkMapInfo(config: object): { type: string, key: string, securityJsCode?: string } {
  return runInNewContext(`(${getMapInfoSource})()`, { __uniConfig: config })
}

test('后端高德配置能被 uni.openLocation 和 H5 map 识别', (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, '__uniConfig')
  const uniConfig = { router: { base: '/h5/' }, aMapKey: '' }
  Object.defineProperty(globalThis, '__uniConfig', { configurable: true, value: uniConfig })
  t.after(() => original ? Object.defineProperty(globalThis, '__uniConfig', original) : Reflect.deleteProperty(globalThis, '__uniConfig'))

  assert.equal(readSdkMapInfo(uniConfig).key, '')
  syncH5MapConfig({ amapJsapiKey: 'runtime-map-key', amapSecurityJsCode: 'runtime-security-code' })

  const actual = readSdkMapInfo(uniConfig)
  assert.equal(actual.type, 'AMap')
  assert.equal(actual.key, 'runtime-map-key')
  assert.equal(actual.securityJsCode, 'runtime-security-code')
  assert.equal(uniConfig.router.base, '/h5/')
})

test('运行时未提供地图 Key 时保留已有构建配置', (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, '__uniConfig')
  const uniConfig = { aMapKey: 'build-map-key', aMapSecurityJsCode: 'build-security-code' }
  Object.defineProperty(globalThis, '__uniConfig', { configurable: true, value: uniConfig })
  t.after(() => original ? Object.defineProperty(globalThis, '__uniConfig', original) : Reflect.deleteProperty(globalThis, '__uniConfig'))

  syncH5MapConfig({})

  const actual = readSdkMapInfo(uniConfig)
  assert.equal(actual.key, 'build-map-key')
  assert.equal(actual.securityJsCode, 'build-security-code')
})
