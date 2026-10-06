import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { appModules, findModuleByRoute, getDefaultRouteForMode, isPublicRoute } from '../src/modules/registry.ts'
import {
  APP_ROUTES,
  getHouseDetailRoute,
  getLoginRoute,
  getTenantLeaseDetailRoute,
  getTenantViewingDetailRoute,
  isProtectedMessageRoute,
  normalizeAppRoutePath,
  shouldBypassStartupBoundary,
} from '../src/modules/routes.ts'
import { getTabbarItems, isAvailableTabbarShellRoute, isVisibleTabbarRoute, tabbarShellItems } from '../src/tabbar/config.ts'
import {
  buildSubpackageRoute,
  getProductSubpackageRoutePrefixes,
  getSubpackageSourceRootsForBuild,
  productionExcludedSubpackageRoots,
  productionSubpackageRoots,
  subpackageDefinitions,
} from '../src/modules/subpackages.ts'
import { filterVisibleModules } from '../src/domain/navigation.ts'

test('游客和租客通过首页进入独立找房页，不在 TabBar 展示找房', () => {
  assert.deepEqual(
    filterVisibleModules(appModules, { mode: 'visitor', authenticated: false, capabilities: {} }).map(item => item.key),
    ['home', 'houses', 'messages', 'me'],
  )
  assert.deepEqual(getTabbarItems('visitor').map(item => item.text), ['首页', '消息', '我的'])
  assert.deepEqual(getTabbarItems('personal').map(item => item.text), ['首页', '我的找房', '消息', '我的'])
})

test('个人模式补充我的找房入口', () => {
  assert.deepEqual(
    filterVisibleModules(appModules, { mode: 'personal', authenticated: true, capabilities: {} }).map(item => item.key),
    ['home', 'houses', 'favorites', 'messages', 'me'],
  )
})

test('房东模式开放首页、房源、消息和房东业务分包，租约作为二级页面保留', () => {
  assert.deepEqual(
    filterVisibleModules(appModules, { mode: 'landlord', authenticated: true, capabilities: {} }).map(item => item.key),
    ['home', 'houses', 'favorites', 'landlord', 'messages', 'me'],
  )
  assert.deepEqual(getTabbarItems('landlord').map(item => item.text), ['首页', '房源', '消息', '我的'])
})

test('中介模式开放首页、工作台、待办、消息和组织管理分包', () => {
  assert.deepEqual(
    filterVisibleModules(appModules, { mode: 'organization', authenticated: true, capabilities: {} }).map(item => item.key),
    ['home', 'houses', 'favorites', 'organization-rental', 'organization-work', 'organization-admin', 'messages', 'me'],
  )
  assert.deepEqual(getTabbarItems('organization').map(item => item.text), ['首页', '工作台', '待办', '消息', '我的'])
})

test('各模式有稳定首页且公开房源深链不继承组织模式', () => {
  assert.equal(getDefaultRouteForMode('landlord'), '/pages/index/index')
  assert.equal(getDefaultRouteForMode('organization'), '/pages/index/index')
  assert.equal(normalizeAppRoutePath('/'), APP_ROUTES.home)
  assert.equal(isPublicRoute('/'), true)
  assert.equal(isPublicRoute(getHouseDetailRoute(42)), true)
  assert.equal(isPublicRoute('/pages/houses/index'), false)
  assert.equal(isPublicRoute('/pages/favorites/index'), false)
})

test('登录入口统一构建并保留登录后的返回地址', () => {
  assert.equal(getLoginRoute(), APP_ROUTES.login)
  assert.equal(getLoginRoute(APP_ROUTES.messages), `${APP_ROUTES.login}?redirect=%2Fpages%2Fmessages%2Findex`)
  assert.equal(getLoginRoute('/pages-housing/detail/index?id=42&from=share'), `${APP_ROUTES.login}?redirect=%2Fpages-housing%2Fdetail%2Findex%3Fid%3D42%26from%3Dshare`)
})

test('未登录时消息页展示登录引导，登录后返回消息页', () => {
  const messagesSource = readFileSync(resolve(process.cwd(), 'src/pages/messages/index.vue'), 'utf8')
  const meSource = readFileSync(resolve(process.cwd(), 'src/pages/me/me.vue'), 'utf8')
  const tabbarSource = readFileSync(resolve(process.cwd(), 'src/tabbar/index.vue'), 'utf8')

  assert.match(messagesSource, /v-if="currentMode === 'visitor'"/)
  assert.match(messagesSource, /action-text="登录查看消息"/)
  assert.match(messagesSource, /getLoginRoute\(APP_ROUTES\.messages\)/)
  assert.doesNotMatch(meSource, /<AppLoginGuide/)
  assert.match(meSource, /openAccountRoute\(APP_ROUTES\.tenantViewings\)/)
  assert.match(meSource, /getLoginRoute\(url\)/)
  assert.doesNotMatch(tabbarSource, /url === APP_ROUTES\.messages && !appContextStore\.authenticated/)
  assert.match(tabbarSource, /uni\.switchTab\(\{ url \}\)/)
})

test('构建清单固定五个主包槽位，运行时只展示已启用模块', () => {
  assert.equal(tabbarShellItems.length, 5)
  assert.deepEqual(getTabbarItems('personal').map(item => item.text), ['首页', '我的找房', '消息', '我的'])
  assert.deepEqual(getTabbarItems('landlord').map(item => item.text), ['首页', '房源', '消息', '我的'])
  assert.deepEqual(getTabbarItems('organization').map(item => item.text), ['首页', '工作台', '待办', '消息', '我的'])
  const shellPaths = new Set(tabbarShellItems.map(item => item.pagePath))
  assert.ok((['personal', 'landlord', 'organization'] as const).every(mode => getTabbarItems(mode).every(item => shellPaths.has(item.pagePath))))
})

test('公开找房使用独立页面，业务壳页只在房东和组织模式显示', () => {
  assert.equal(APP_ROUTES.publicHouseSearch, '/pages-housing/search/index')
  assert.equal(isVisibleTabbarRoute('visitor', APP_ROUTES.houses), false)
  assert.equal(isVisibleTabbarRoute('personal', APP_ROUTES.houses), false)
  assert.equal(isVisibleTabbarRoute('landlord', APP_ROUTES.houses), true)
  assert.equal(isVisibleTabbarRoute('organization', APP_ROUTES.houses), true)

  const businessSource = readFileSync(resolve(process.cwd(), 'src/pages/houses/index.vue'), 'utf8')
  const favoritesSource = readFileSync(resolve(process.cwd(), 'src/pages/favorites/index.vue'), 'utf8')
  const viewingsSource = readFileSync(resolve(process.cwd(), 'src/pages-personal-rental/viewings/index.vue'), 'utf8')
  const publicDetailSource = readFileSync(resolve(process.cwd(), 'src/pages-housing/detail/index.vue'), 'utf8')

  assert.match(businessSource, /getPublicHouseSearchRoute/)
  assert.match(businessSource, /uni\.redirectTo\(/)
  assert.match(favoritesSource, /uni\.navigateTo\(\{ url: APP_ROUTES\.publicHouseSearch \}\)/)
  assert.match(viewingsSource, /uni\.navigateTo\(\{ url: APP_ROUTES\.publicHouseSearch \}\)/)
  assert.match(publicDetailSource, /:fallback-url="APP_ROUTES\.publicHouseSearch"/)
  assert.doesNotMatch(favoritesSource, /uni\.switchTab\(\{ url: APP_ROUTES\.houses \}\)/)
  assert.doesNotMatch(viewingsSource, /uni\.switchTab\(\{ url: APP_ROUTES\.houses \}\)/)
})

test('我的找房只在个人模式显示，其他模式仍可按权限作为二级入口访问', () => {
  assert.equal(isVisibleTabbarRoute('personal', APP_ROUTES.favorites), true)
  assert.equal(isAvailableTabbarShellRoute('personal', APP_ROUTES.favorites), true)
  assert.equal(isVisibleTabbarRoute('landlord', APP_ROUTES.favorites), false)
  assert.equal(isAvailableTabbarShellRoute('landlord', APP_ROUTES.favorites), true)
  assert.equal(isAvailableTabbarShellRoute('visitor', APP_ROUTES.favorites), false)
})

test('生产和开发构建都只加载项目已启用分包', () => {
  assert.equal(APP_ROUTES.houseDetail, '/pages-housing/detail/index')
  assert.equal(APP_ROUTES.houseMap, '/pages-housing/map/index')
  assert.equal(getHouseDetailRoute(42), '/pages-housing/detail/index?id=42')
  assert.equal(APP_ROUTES.tenantViewings, '/pages-personal-rental/viewings/index')
  assert.equal(APP_ROUTES.tenantLeases, '/pages-personal-rental/leases/index')
  assert.equal(APP_ROUTES.phoneVerification, '/pages/account/phone')
  assert.equal(APP_ROUTES.landlordHouseDetail, '/pages-landlord/houses/detail')
  assert.equal(APP_ROUTES.landlordLeaseDetail, '/pages-landlord/leases/detail')
  assert.equal(APP_ROUTES.landlordStore, '/pages-landlord/store/index')
  assert.equal(APP_ROUTES.landlordInvite, '/pages-landlord/invite/index')
  assert.equal(APP_ROUTES.organizationRental, '/pages-org-rental/index')
  assert.equal(APP_ROUTES.organizationWork, '/pages-org-work/index')
  assert.equal(APP_ROUTES.organizationAdmin, '/pages-org-admin/index')
  assert.equal(getTenantViewingDetailRoute(7), '/pages-personal-rental/viewings/detail?id=7')
  assert.equal(getTenantLeaseDetailRoute(8), '/pages-personal-rental/leases/detail?id=8')
  assert.deepEqual(productionSubpackageRoots, ['pages-saas', 'pages-housing', 'pages-personal-rental', 'pages-landlord', 'pages-org-rental', 'pages-org-work', 'pages-org-admin'])
  assert.deepEqual(getSubpackageSourceRootsForBuild('production'), ['src/pages-saas', 'src/pages-housing', 'src/pages-personal-rental', 'src/pages-landlord', 'src/pages-org-rental', 'src/pages-org-work', 'src/pages-org-admin'])
  assert.deepEqual(getSubpackageSourceRootsForBuild('development'), ['src/pages-saas', 'src/pages-housing', 'src/pages-personal-rental', 'src/pages-landlord', 'src/pages-org-rental', 'src/pages-org-work', 'src/pages-org-admin'])
  assert.equal(productionExcludedSubpackageRoots.includes('pages-demo'), false)
})

test('分包按业务域拆分，不再按整个用户模式形成单一大包', () => {
  assert.deepEqual(
    subpackageDefinitions.filter(item => item.area === 'organization').map(item => item.key),
    ['organization-rental', 'organization-work', 'organization-admin'],
  )
})

test('只有已启用分包参与路由归属和路由构建', () => {
  assert.equal(findModuleByRoute('/pages-housing/detail/index')?.key, 'houses')
  assert.equal(findModuleByRoute('/pages-personal-rental/viewings/index')?.key, 'favorites')
  assert.equal(findModuleByRoute('/pages-landlord/houses/detail')?.key, 'landlord')
  assert.equal(findModuleByRoute('/pages-org-rental/houses/index')?.key, 'organization-rental')
  assert.deepEqual(getProductSubpackageRoutePrefixes(['housing', 'personal-rental']), ['/pages-housing/', '/pages-personal-rental/'])
  assert.equal(buildSubpackageRoute('organization-rental', 'houses/index'), '/pages-org-rental/houses/index')
})

test('消息列表允许访客访问，消息详情与偏好页仍需登录', () => {
  assert.equal(findModuleByRoute(APP_ROUTES.messageDetail)?.key, 'messages')
  assert.equal(findModuleByRoute(APP_ROUTES.notificationPreferences)?.key, 'messages')
  assert.equal(isProtectedMessageRoute(APP_ROUTES.messages), false)
  assert.equal(isProtectedMessageRoute(APP_ROUTES.messageDetail), true)
  assert.equal(isProtectedMessageRoute(APP_ROUTES.notificationPreferences), false)
})

test('账号手机验证页归属我的模块', () => {
  assert.equal(findModuleByRoute(APP_ROUTES.phoneVerification)?.key, 'me')
})

test('H5 路由守卫等待启动上下文就绪后再判断受保护深页', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/router/permission.ts'), 'utf8')
  const bootstrapIndex = source.indexOf('await appContextStore.bootstrap()')
  const accessDecisionIndex = source.indexOf('const decision = resolveRouteAccess(path)', bootstrapIndex)

  assert.ok(bootstrapIndex >= 0)
  assert.ok(accessDecisionIndex > bootstrapIndex)
})

test('启动失败路由绕过全局启动边界以避免两次重试', () => {
  assert.equal(shouldBypassStartupBoundary(APP_ROUTES.startupError), true)
  assert.equal(shouldBypassStartupBoundary(APP_ROUTES.home), false)

  const source = readFileSync(resolve(process.cwd(), 'src/app/AppStartupBoundary.vue'), 'utf8')
  assert.match(source, /shouldBypassStartupBoundary\(currRoute\(\)\.path\)/)
  assert.match(source, /bypassStartupBoundary \|\| runtimeStore\.startupState === 'ready'/)
})

test('路由元数据尚未初始化时，启动边界仍可安全读取当前路由', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/utils/index.ts'), 'utf8')

  assert.match(source, /lastPage\.\$page\?\.fullPath/)
  assert.match(source, /lastPage\.route/)
})
