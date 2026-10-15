import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAppModeOptions } from '../src/domain/app-mode.ts'
import type { RouteWorkspace } from '../src/domain/route-access.ts'
import { buildNavigationTarget, decodeNavigationRedirect, getRouteAccessDecision, parseNavigationTarget, withRouteWorkspace } from '../src/domain/route-access.ts'
import { APP_ROUTES } from '../src/modules/routes.ts'

function workspace(overrides: Partial<RouteWorkspace> = {}): RouteWorkspace {
  const organizations = [{ id: 1, slug: 'alpha', name: '甲组织', is_primary: true }, { id: 2, slug: 'beta', name: '乙组织', is_primary: false }]
  const landlordRelationships = [{ contact_id: 12, contact_name: '张先生', organization_name: '甲组织', house_count: 1 }]
  return {
    mode: 'personal',
    authenticated: true,
    organizationSlug: '',
    landlordContactId: null,
    organizations,
    capabilities: {},
    modeOptions: buildAppModeOptions({ mode: 'personal', organizationSlug: '', landlordContactId: null, organizations, landlordRelationships }),
    ...overrides,
  }
}

test('未切换身份时给出可用身份，而不是判为无权限；多组织不默认选第一个', () => {
  const decision = getRouteAccessDecision(APP_ROUTES.organizationRental, workspace())
  assert.equal(decision.allowed, false)
  assert.deepEqual(decision.identityOptions?.map(option => option.key), ['organization:alpha', 'organization:beta'])
  assert.ok(decision.redirect.startsWith(APP_ROUTES.switchIdentity))
  const single = getRouteAccessDecision(APP_ROUTES.landlordHouseDetail, workspace())
  assert.deepEqual(single.identityOptions?.map(option => option.key), ['landlord:12'])
})

test('明确的组织上下文优先于当前身份，保留完整目标参数', () => {
  const url = `${APP_ROUTES.organizationLeaseDetail}?id=8&organization_slug=beta&label=${encodeURIComponent('租约 A&B=1')}`
  const decision = getRouteAccessDecision(url, workspace({ mode: 'organization', organizationSlug: 'alpha' }))
  assert.deepEqual(decision.identityOptions?.map(option => option.key), ['organization:beta'])
  assert.equal(parseNavigationTarget(decision.redirect).query.redirect, url)
  assert.equal(getRouteAccessDecision(url, workspace({ mode: 'organization', organizationSlug: 'beta' })).allowed, true)
  assert.equal(parseNavigationTarget(url).query.label, '租约 A&B=1')
})

test('组织 ID 和房东关系均能定位身份，不可用或矛盾上下文不回退其他组织', () => {
  assert.deepEqual(getRouteAccessDecision(`${APP_ROUTES.organizationRental}?organization_id=2`, workspace()).identityOptions?.map(option => option.key), ['organization:beta'])
  assert.deepEqual(getRouteAccessDecision(`${APP_ROUTES.landlordHouseDetail}?id=7&landlord_contact_id=12`, workspace()).identityOptions?.map(option => option.key), ['landlord:12'])
  for (const query of ['organization_slug=missing', 'organization_id=999', 'organization_id=1&organization_slug=beta', 'organization_slug=alpha&landlord_contact_id=12', 'organization_slug='])
    assert.ok(getRouteAccessDecision(`${APP_ROUTES.organizationRental}?${query}`, workspace()).redirect.startsWith(`${APP_ROUTES.forbidden}?reason=context`))
  assert.ok(getRouteAccessDecision(`${APP_ROUTES.landlordHouseDetail}?landlord_contact_id=-1`, workspace()).redirect.includes('reason=context'))
})

test('没有对应身份时提示身份要求，游客登录跳转保留深页参数', () => {
  const url = `${APP_ROUTES.organizationLeaseDetail}?id=8&organization_slug=alpha`
  assert.ok(getRouteAccessDecision(APP_ROUTES.organizationRental, workspace({ modeOptions: [] })).redirect.includes('reason=identity'))
  assert.equal(parseNavigationTarget(getRouteAccessDecision(url, workspace({ authenticated: false, mode: 'visitor' })).redirect).query.redirect, url)
  assert.equal(getRouteAccessDecision(APP_ROUTES.houseDetail, workspace({ authenticated: false, mode: 'visitor' })).allowed, true)
})

test('当前组织可访问时不切换；消息详情可通过上下文恢复目标组织', () => {
  assert.deepEqual(getRouteAccessDecision(APP_ROUTES.organizationRental, workspace({ mode: 'organization', organizationSlug: 'alpha' })), { allowed: true, redirect: '' })
  const url = `${APP_ROUTES.messageDetail}?id=4&organization_slug=beta`
  assert.deepEqual(getRouteAccessDecision(url, workspace()).identityOptions?.map(option => option.key), ['organization:beta'])
})

test('业务路由绑定当前组织，已声明上下文和公共页面保持原义', () => {
  const route = `${APP_ROUTES.organizationLeaseDetail}?id=8`
  assert.equal(withRouteWorkspace(route, { mode: 'organization', organizationSlug: 'alpha' }), `${route}&organization_slug=alpha`)
  assert.equal(withRouteWorkspace(`${route}&organization_slug=beta`, { mode: 'organization', organizationSlug: 'alpha' }), `${route}&organization_slug=beta`)
  assert.equal(withRouteWorkspace(`${APP_ROUTES.houseDetail}?id=8`, { mode: 'organization', organizationSlug: 'alpha' }), `${APP_ROUTES.houseDetail}?id=8`)
  const target = parseNavigationTarget(`${route}&title=${encodeURIComponent('甲 & 乙=1')} `)
  assert.deepEqual(parseNavigationTarget(buildNavigationTarget(target.path, target.query)), target)
})

test('H5 已解码的跳转和微信编码的跳转均只解码外层，保留目标参数中的分隔符', () => {
  const url = `${APP_ROUTES.organizationLeaseDetail}?id=8&label=${encodeURIComponent('租约 A&B=1')}`
  assert.equal(decodeNavigationRedirect(url), url)
  assert.equal(decodeNavigationRedirect(encodeURIComponent(url)), url)
  assert.equal(parseNavigationTarget(decodeNavigationRedirect(url)).query.label, '租约 A&B=1')
  for (const invalid of ['https://example.com/', '//example.com/', '%invalid', undefined])
    assert.equal(decodeNavigationRedirect(invalid), '')
})
