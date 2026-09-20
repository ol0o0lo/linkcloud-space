import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  appModuleCatalog,
  findCatalogModuleByRoute,
  getBuildSubpackages,
  getRuntimeTabbarItems,
  getTabbarShellItems,
} from '../src/modules/catalog.ts'

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url))

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? collectFiles(path) : [path]
  })
}

test('公共基础能力按职责归位且不保留兜底目录', () => {
  const sharedRoot = join(sourceRoot, 'shared')
  const navigationRoot = join(sourceRoot, 'navigation')
  const globalNavigationUtils = join(sourceRoot, 'utils/navigation.ts')
  const componentNavigationUtils = join(sourceRoot, 'components/utils/navigation.ts')
  const sharedFiles = existsSync(sharedRoot) ? collectFiles(sharedRoot) : []
  const legacyImports = collectFiles(sourceRoot).filter((path) => {
    if (!/\.(?:[cm]?[jt]sx?|scss|vue)$/.test(path))
      return false
    return /@\/shared\/|(?:\.\.\/)+shared\//.test(readFileSync(path, 'utf8'))
  })

  assert.deepEqual(sharedFiles, [], 'src/shared 不得继续承载源码')
  assert.deepEqual(legacyImports, [], '源码不得继续导入 shared')
  assert.equal(existsSync(navigationRoot), false, '不得保留顶层 navigation 目录')
  assert.equal(existsSync(globalNavigationUtils), false, '组件表现层工具不得放在全局 utils')
  assert.equal(existsSync(componentNavigationUtils), true, '导航表现层纯函数应放在 components/utils')
})

test('模块目录是 TabBar、路由和分包的单一注册源', () => {
  assert.equal(appModuleCatalog.find(item => item.key === 'houses')?.mainRoute, '/pages/houses/index')
  assert.equal(findCatalogModuleByRoute('/pages-housing/detail/index')?.key, 'houses')
  assert.deepEqual(getBuildSubpackages('production').map(item => item.root), [
    'pages-saas',
    'pages-housing',
    'pages-personal-rental',
    'pages-landlord',
    'pages-org-rental',
    'pages-org-work',
    'pages-org-admin',
  ])
  assert.deepEqual(getBuildSubpackages('development').map(item => item.root), [
    'pages-saas',
    'pages-housing',
    'pages-personal-rental',
    'pages-landlord',
    'pages-org-rental',
    'pages-org-work',
    'pages-org-admin',
  ])
  assert.equal(getTabbarShellItems().length, 5)
})

test('运行时 TabBar 只展示当前模式下已启用的模块', () => {
  assert.deepEqual(getRuntimeTabbarItems('visitor', 'h5').map(item => item.text), ['首页', '消息', '我的'])
  assert.deepEqual(getRuntimeTabbarItems('personal', 'mp-weixin').map(item => item.text), ['首页', '我的找房', '消息', '我的'])
  assert.deepEqual(getRuntimeTabbarItems('landlord', 'mp-weixin').map(item => item.text), ['首页', '房源', '消息', '我的'])
  assert.deepEqual(getRuntimeTabbarItems('organization', 'h5').map(item => item.text), ['首页', '工作台', '待办', '消息', '我的'])
})

test('角色 TabBar 使用已确认的 Carbon Iconify 图标', () => {
  assert.deepEqual(getRuntimeTabbarItems('visitor', 'mp-weixin').map(item => item.icon), [
    'i-carbon-home',
    'i-carbon-notification',
    'i-carbon-user',
  ])
  assert.deepEqual(getRuntimeTabbarItems('personal', 'mp-weixin').map(item => item.icon), [
    'i-carbon-home',
    'i-carbon-favorite',
    'i-carbon-notification',
    'i-carbon-user',
  ])
  assert.deepEqual(getRuntimeTabbarItems('landlord', 'mp-weixin').map(item => item.icon), [
    'i-carbon-home',
    'i-carbon-building',
    'i-carbon-notification',
    'i-carbon-user',
  ])
  assert.deepEqual(getRuntimeTabbarItems('organization', 'mp-weixin').map(item => item.icon), [
    'i-carbon-home',
    'i-carbon-workspace',
    'i-carbon-task',
    'i-carbon-notification',
    'i-carbon-user',
  ])
})

test('自定义 TabBar 通过主题变量保持接近微信原生的尺寸与颜色', () => {
  const tabbarSource = readFileSync(new URL('../src/tabbar/index.vue', import.meta.url), 'utf8')
  const tokenSource = readFileSync(new URL('../src/style/theme/tokens.scss', import.meta.url), 'utf8')

  assert.match(tabbarSource, /--wot-tabbar-height: var\(--app-tabbar-height\)/)
  assert.match(tabbarSource, /--wot-tabbar-item-title-font-size: var\(--app-tabbar-title-size\)/)
  assert.match(tabbarSource, /#icon="\{ active \}"/)
  assert.match(tabbarSource, /'app-role-tabbar__icon--active': active/)
  assert.match(tabbarSource, /color: var\(--app-tabbar-inactive-color\);/)
  assert.match(tabbarSource, /color: var\(--app-color-brand\);/)
  assert.match(tabbarSource, /class="app-role-tabbar__icon"/)
  assert.match(tokenSource, /--app-tabbar-height: 100rpx;/)
  assert.match(tokenSource, /--app-tabbar-icon-size: 48rpx;/)
  assert.match(tokenSource, /--app-tabbar-title-size: 20rpx;/)
})

test('AppPage 为多端固定 TabBar 统一预留可滚动的底部空间', () => {
  const appPageSource = readFileSync(new URL('../src/components/app/AppPage.vue', import.meta.url), 'utf8')
  const tabbarSource = readFileSync(new URL('../src/tabbar/index.vue', import.meta.url), 'utf8')

  assert.match(appPageSource, /v-if="tabbar" class="app-page__tabbar-spacer"/)
  assert.match(appPageSource, /height:\s*calc\(var\(--app-tabbar-height\) \+ env\(safe-area-inset-bottom\)\)/)
  assert.doesNotMatch(appPageSource, /#ifn?def/)
  assert.doesNotMatch(tabbarSource, /\bplaceholder\b/)
})

test('模块目录保留未来 App 路径但当前只声明 H5 和微信支持', () => {
  const supportedPlatforms = new Set(appModuleCatalog.flatMap(item => item.platforms))
  assert.deepEqual([...supportedPlatforms].sort(), ['h5', 'mp-weixin'])
})

test('首页承接公开找房入口，组织模式根 Tab 使用真实摘要和分包入口', () => {
  const sources = {
    home: readFileSync(new URL('../src/pages/index/index.vue', import.meta.url), 'utf8'),
    business: readFileSync(new URL('../src/pages/houses/index.vue', import.meta.url), 'utf8'),
    tasks: readFileSync(new URL('../src/pages/favorites/index.vue', import.meta.url), 'utf8'),
    messages: readFileSync(new URL('../src/pages/messages/index.vue', import.meta.url), 'utf8'),
    me: readFileSync(new URL('../src/pages/me/me.vue', import.meta.url), 'utf8'),
  }

  assert.equal(Object.values(sources).some(source => source.includes('归入')), false)
  assert.equal(Object.values(sources).some(source => source.includes('敬请期待')), false)
  assert.match(sources.home, /listPublicHouses/)
  assert.match(sources.home, /AppCustomNavigation title=""[\s\S]*home-navigation__finder/)
  assert.doesNotMatch(sources.home, /AppCustomNavigation title="链云空间"/)
  assert.doesNotMatch(sources.home, /navigationMode|getDailyOrganizationWorkDashboard|listLandlordHouses|currentMode/)
  assert.match(sources.business, /APP_ROUTES\.organizationRental/)
  assert.match(sources.tasks, /getDailyOrganizationWorkDashboard/)
  assert.match(sources.tasks, /listOrganizationAnnouncements/)
  assert.match(sources.tasks, /APP_ROUTES\.organizationTasks/)
  assert.match(sources.tasks, /APP_ROUTES\.organizationAnnouncements/)
  assert.match(sources.messages, /listNotifications/)
  assert.match(sources.me, /getOrganizationAdminSections/)
  assert.match(sources.me, /APP_ROUTES\.organizationAdmin/)
})
