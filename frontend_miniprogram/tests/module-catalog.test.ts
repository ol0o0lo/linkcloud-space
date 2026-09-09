import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  appModuleCatalog,
  findCatalogModuleByRoute,
  getBuildSubpackages,
  getRuntimeTabbarItems,
  getTabbarShellItems,
} from '../src/modules/catalog.ts'

test('模块目录是 TabBar、路由和分包的单一注册源', () => {
  assert.equal(appModuleCatalog.find(item => item.key === 'houses')?.mainRoute, '/pages/houses/index')
  assert.equal(findCatalogModuleByRoute('/pages-housing/detail/index')?.key, 'houses')
  assert.deepEqual(getBuildSubpackages('production').map(item => item.root), [
    'pages-housing',
    'pages-personal-rental',
    'pages-landlord',
    'pages-org-rental',
    'pages-org-work',
    'pages-org-admin',
  ])
  assert.deepEqual(getBuildSubpackages('development').map(item => item.root), [
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
  assert.deepEqual(getRuntimeTabbarItems('visitor', 'h5').map(item => item.text), ['首页', '找房', '我的'])
  assert.deepEqual(getRuntimeTabbarItems('personal', 'mp-weixin').map(item => item.text), ['首页', '找房', '我的找房', '消息', '我的'])
  assert.deepEqual(getRuntimeTabbarItems('organization', 'h5').map(item => item.text), ['工作台', '业务', '待办', '消息', '我的'])
})

test('模块目录保留未来 App 路径但当前只声明 H5 和微信支持', () => {
  const supportedPlatforms = new Set(appModuleCatalog.flatMap(item => item.platforms))
  assert.deepEqual([...supportedPlatforms].sort(), ['h5', 'mp-weixin'])
})

test('组织模式五个根 Tab 使用真实摘要和分包入口', () => {
  const sources = {
    home: readFileSync(new URL('../src/pages/index/index.vue', import.meta.url), 'utf8'),
    business: readFileSync(new URL('../src/pages/houses/index.vue', import.meta.url), 'utf8'),
    tasks: readFileSync(new URL('../src/pages/favorites/index.vue', import.meta.url), 'utf8'),
    messages: readFileSync(new URL('../src/pages/messages/index.vue', import.meta.url), 'utf8'),
    me: readFileSync(new URL('../src/pages/me/me.vue', import.meta.url), 'utf8'),
  }

  assert.equal(Object.values(sources).some(source => source.includes('归入')), false)
  assert.equal(Object.values(sources).some(source => source.includes('敬请期待')), false)
  assert.match(sources.home, /getDailyOrganizationWorkDashboard/)
  assert.match(sources.home, /APP_ROUTES\.organizationWork/)
  assert.match(sources.business, /APP_ROUTES\.organizationRental/)
  assert.match(sources.tasks, /getDailyOrganizationWorkDashboard/)
  assert.match(sources.tasks, /listOrganizationAnnouncements/)
  assert.match(sources.tasks, /APP_ROUTES\.organizationTasks/)
  assert.match(sources.tasks, /APP_ROUTES\.organizationAnnouncements/)
  assert.match(sources.messages, /listNotifications/)
  assert.match(sources.me, /getOrganizationAdminSections/)
  assert.match(sources.me, /APP_ROUTES\.organizationAdmin/)
})
