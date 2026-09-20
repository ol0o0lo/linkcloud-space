import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const projectRoot = new URL('../', import.meta.url)

function readProjectFile(path: string): string {
  return readFileSync(new URL(path, projectRoot), 'utf8')
}

const packageJson = JSON.parse(readProjectFile('package.json')) as {
  name: string
  description: string
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

test('工程元数据使用链云空间语义并固定 Wot UI 版本', () => {
  assert.equal(packageJson.name, 'linkcloud-space-miniprogram')
  assert.match(packageJson.description, /链云空间/)
  assert.equal(packageJson.dependencies['@wot-ui/ui'], '2.0.8')
})

test('脚本只暴露当前支持的 H5 与微信小程序构建路径', () => {
  const unsupportedScripts = Object.keys(packageJson.scripts).filter(name => /(?:^|:)(?:app|mp-(?!weixin)|quickapp)/.test(name))
  assert.deepEqual(unsupportedScripts, [])
  assert.equal(packageJson.scripts.verify, 'pnpm lint && pnpm type-check && pnpm test && pnpm build:h5:prod && pnpm build:mp:prod')
  assert.equal(packageJson.scripts.prepare.includes('git init'), false)
})

test('依赖清单不携带旧请求栈、模板功能和未支持平台编译器', () => {
  const unsupportedDependencies = [
    '@alova/adapter-uniapp',
    '@alova/shared',
    '@changesets/cli',
    '@dcloudio/uni-app-harmony',
    '@dcloudio/uni-app-plus',
    '@dcloudio/uni-mp-alipay',
    '@dcloudio/uni-mp-baidu',
    '@dcloudio/uni-mp-harmony',
    '@dcloudio/uni-mp-jd',
    '@dcloudio/uni-mp-kuaishou',
    '@dcloudio/uni-mp-lark',
    '@dcloudio/uni-mp-qq',
    '@dcloudio/uni-mp-toutiao',
    '@dcloudio/uni-mp-xhs',
    '@dcloudio/uni-quickapp-webview',
    'abortcontroller-polyfill',
    'alova',
    'echarts',
    'pinia-plugin-persistedstate',
    'z-paging',
  ]
  const installed = { ...packageJson.dependencies, ...packageJson.devDependencies }
  assert.deepEqual(unsupportedDependencies.filter(name => Object.hasOwn(installed, name)), [])
})

test('构建配置只声明 H5 与微信小程序能力', () => {
  const createBaseFiles = readProjectFile('scripts/create-base-files.js')
  const manifest = readProjectFile('manifest.config.ts')
  const vite = readProjectFile('vite.config.ts')
  const pages = readProjectFile('pages.config.ts')
  const tsconfig = readProjectFile('tsconfig.json')

  for (const legacyPlatform of ['\'app-plus\'', '\'quickapp\'', '\'mp-alipay\'', '\'mp-baidu\'', '\'mp-toutiao\''])
    assert.equal(manifest.includes(legacyPlatform), false)

  for (const legacyBuildFeature of ['vite-plugin-restart', 'copy-native-resources', 'prune-generated-pages', 'sync-manifest-plugins'])
    assert.equal(vite.includes(legacyBuildFeature), false)

  assert.equal(vite.includes('restrictManifestPlatforms()'), true)
  assert.equal(vite.includes('buildEnd:'), false)
  assert.equal(vite.includes('mode === \'development\' && SKIP_OPEN_DEVTOOLS !== \'true\''), true)
  assert.equal(manifest.includes('ignoreDevUnusedFiles: false'), true)
  assert.equal(pages.includes('z-paging'), false)
  assert.equal(pages.includes('navigationBarTitleText: \'链云空间\''), true)
  assert.equal(tsconfig.includes('z-paging/types'), false)
  assert.equal(tsconfig.includes('src/pages-demo'), false)
  assert.equal(createBaseFiles.includes('fs.existsSync(manifestPath)'), false)
  assert.equal(createBaseFiles.includes('fs.existsSync(pagesPath)'), false)
  assert.equal(createBaseFiles.includes('fs.writeFileSync(manifestPath'), true)
  assert.equal(createBaseFiles.includes('fs.writeFileSync(pagesPath'), true)
})

test('启动失败页直接依据运行时 Store 的恢复结果一次返回首页', () => {
  const startupPage = readProjectFile('src/pages/error/startup.vue')

  assert.match(startupPage, /useRuntimeStore/)
  assert.match(startupPage, /await runtimeStore\.bootstrap\(\)/)
  assert.match(startupPage, /runtimeStore\.startupState === 'ready'/)
})
