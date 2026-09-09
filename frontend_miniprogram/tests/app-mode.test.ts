import assert from 'node:assert/strict'
import test from 'node:test'

import type { AppModeInput } from '../src/domain/app-mode.ts'
import { buildAppModeOptions, getAppModePresentation, resolveAppMode, resolveNavigationMode } from '../src/domain/app-mode.ts'

function appModeInput(overrides: Partial<AppModeInput>): AppModeInput {
  return {
    authenticated: true,
    requestedMode: null,
    requestedOrgSlug: '',
    requestedLandlordContactId: null,
    organizations: [],
    landlordRelationships: [],
    ...overrides,
  }
}

test('未登录用户始终进入游客模式', () => {
  assert.deepEqual(resolveAppMode(appModeInput({ authenticated: false, requestedMode: 'organization', requestedOrgSlug: 'alpha', organizations: [{ slug: 'alpha' }] })), {
    mode: 'visitor',
    organizationSlug: '',
    landlordContactId: null,
  })
})

test('登录用户默认进入个人模式', () => {
  assert.deepEqual(resolveAppMode(appModeInput({})), {
    mode: 'personal',
    organizationSlug: '',
    landlordContactId: null,
  })
})

test('只有仍然有效的房东关系才能恢复房东模式', () => {
  assert.deepEqual(resolveAppMode(appModeInput({ requestedMode: 'landlord', requestedLandlordContactId: 12, landlordRelationships: [{ contact_id: 12 }] })), {
    mode: 'landlord',
    organizationSlug: '',
    landlordContactId: 12,
  })
  assert.equal(resolveAppMode(appModeInput({ requestedMode: 'landlord', requestedLandlordContactId: 12 })).mode, 'personal')
})

test('只有仍然可用的组织才能恢复组织模式', () => {
  assert.deepEqual(resolveAppMode(appModeInput({ requestedMode: 'organization', requestedOrgSlug: 'alpha', organizations: [{ slug: 'alpha' }] })), {
    mode: 'organization',
    organizationSlug: 'alpha',
    landlordContactId: null,
  })
  assert.deepEqual(resolveAppMode(appModeInput({ requestedMode: 'organization', requestedOrgSlug: 'missing', organizations: [{ slug: 'alpha' }] })), {
    mode: 'personal',
    organizationSlug: '',
    landlordContactId: null,
  })
})

test('无法识别的旧模式缓存回退个人模式', () => {
  assert.equal(resolveAppMode(appModeInput({ requestedMode: 'legacy-mode' as never })).mode, 'personal')
})

test('公开页面使用游客或个人导航，但不覆盖已选择的工作模式', () => {
  assert.equal(resolveNavigationMode({ selectedMode: 'organization', authenticated: true, publicRoute: true }), 'personal')
  assert.equal(resolveNavigationMode({ selectedMode: 'landlord', authenticated: false, publicRoute: true }), 'visitor')
  assert.equal(resolveNavigationMode({ selectedMode: 'organization', authenticated: true, publicRoute: false }), 'organization')
})

test('身份切换入口只包含租客端和账号真实拥有的房东、中介上下文', () => {
  const options = buildAppModeOptions({
    mode: 'landlord',
    organizationSlug: '',
    landlordContactId: 12,
    organizations: [
      { name: '链云中介', slug: 'linkcloud', is_primary: true },
    ],
    landlordRelationships: [
      { contact_id: 12, contact_name: '张先生', organization_name: '合作门店', house_count: 3 },
    ],
  })

  assert.deepEqual(options.map(item => ({ key: item.key, title: item.title, active: item.active })), [
    { key: 'personal', title: '租客端', active: false },
    { key: 'landlord:12', title: '房东端 · 张先生', active: true },
    { key: 'organization:linkcloud', title: '中介端 · 链云中介', active: false },
  ])
  assert.equal(options[1]?.description, '合作门店 · 3 套关联房源')
  assert.equal(options[2]?.description, '主要使用的组织')
})

test('当前身份摘要明确显示业务端和对应工作上下文', () => {
  assert.deepEqual(getAppModePresentation({
    mode: 'organization',
    organization: { name: '链云中介', slug: 'linkcloud', is_primary: false },
    landlordRelationship: null,
  }), {
    title: '中介端 · 链云中介',
    description: '进入该组织',
  })

  assert.deepEqual(getAppModePresentation({
    mode: 'landlord',
    organization: null,
    landlordRelationship: { contact_id: 12, contact_name: '张先生', organization_name: '合作门店', house_count: 3 },
  }), {
    title: '房东端 · 张先生',
    description: '合作门店 · 3 套关联房源',
  })
})
