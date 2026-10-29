import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { rollup } from 'rollup'
import { ensureWeixinLocationManifest } from '../scripts/weixin-location-manifest.ts'

test('微信定位清单补写等待异步产物写出完成', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'linkcloud-manifest-order-'))
  const previousPlatform = process.env.UNI_PLATFORM
  process.env.UNI_PLATFORM = 'mp-weixin'
  try {
    const manifest = ensureWeixinLocationManifest()
    assert.equal(typeof manifest.configResolved, 'function')
    Reflect.apply(manifest.configResolved as (...args: unknown[]) => void, undefined, [{ root: output, build: { outDir: output } }])
    const bundle = await rollup({
      input: 'virtual-entry',
      plugins: [{
        name: 'async-weixin-output',
        resolveId: () => 'virtual-entry',
        load: () => 'export default 1',
        async closeBundle() {
          await new Promise(resolve => setTimeout(resolve, 15))
          await writeFile(path.join(output, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
        },
      }, manifest],
    })
    await bundle.close()
    const result = JSON.parse(await readFile(path.join(output, 'app.json'), 'utf8'))
    assert.deepEqual(result.requiredPrivateInfos, ['getLocation', 'chooseLocation'])
    assert.ok(result.permission['scope.userLocation'])
  }
  finally {
    if (previousPlatform === undefined)
      delete process.env.UNI_PLATFORM
    else
      process.env.UNI_PLATFORM = previousPlatform
  }
})
