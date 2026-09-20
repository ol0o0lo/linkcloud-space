import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  maskInvitationEmail,
  maskInvitationPhone,
  normalizeLandlordInvitation,
  normalizeOrganizationInvitation,
  resolveInvitationParams,
  shouldVerifyInvitationPhone,
} from '../src/domain/invitations.ts'
import { APP_ROUTES, getInvitationRoute } from '../src/modules/routes.ts'
import { isPublicRoute } from '../src/modules/registry.ts'

const testsDirectory = dirname(fileURLToPath(import.meta.url))
const sourceRoot = join(testsDirectory, '../src')

test('邀请入口只接受组织 key 和房东 token 两种白名单参数', () => {
  assert.deepEqual(resolveInvitationParams({ kind: 'organization', key: 'abc123' }), { kind: 'organization', credential: 'abc123' })
  assert.deepEqual(resolveInvitationParams({ kind: 'landlord', token: 'token-1' }), { kind: 'landlord', credential: 'token-1' })
  assert.equal(resolveInvitationParams({ kind: 'organization', token: 'wrong-field' }), null)
  assert.equal(resolveInvitationParams({ kind: 'unknown', key: 'abc' }), null)
  assert.equal(resolveInvitationParams({ kind: 'landlord', token: '' }), null)
})

test('邀请回跳路由始终是编码后的内部公开页面', () => {
  assert.equal(APP_ROUTES.invitation, '/pages/invitations/index')
  assert.equal(getInvitationRoute('organization', 'key with space'), '/pages/invitations/index?kind=organization&key=key%20with%20space')
  assert.equal(getInvitationRoute('landlord', 'a/b'), '/pages/invitations/index?kind=landlord&token=a%2Fb')
  assert.equal(isPublicRoute(APP_ROUTES.invitation), true)
  assert.equal(isPublicRoute(APP_ROUTES.landlordInvite), true)
})

test('组织与房东邀请归一化为同一展示模型并隐藏完整联系方式', () => {
  const organization = normalizeOrganizationInvitation({
    organization_id: 7,
    organization_slug: 'alpha',
    organization_name: '甲中介',
    sender_name: '张经理',
    invitee_email: '',
    invitee_phone: '+8613800138000',
    is_expired: false,
    is_already_member: false,
  })
  const landlord = normalizeLandlordInvitation({
    organization_name: '乙中介',
    contact_name: '李房东',
    invitee_phone_masked: '+86****8001',
    expires_at: '2026-09-16T10:00:00+08:00',
  })

  assert.equal(organization.title, '甲中介邀请你加入组织')
  assert.equal(organization.recipientLabel, '+86*******8000')
  assert.equal(organization.organizationSlug, 'alpha')
  assert.equal(landlord.title, '乙中介邀请你认领房东关系')
  assert.equal(landlord.recipientLabel, '+86****8001')
  assert.equal(landlord.contactName, '李房东')
})

test('手机号邀请在登录账号未验证手机号时进入验证流程', () => {
  assert.equal(shouldVerifyInvitationPhone({ kind: 'organization', usesPhone: true }, { phone_verified: false }), true)
  assert.equal(shouldVerifyInvitationPhone({ kind: 'landlord', usesPhone: true }, { phone_verified: false }), true)
  assert.equal(shouldVerifyInvitationPhone({ kind: 'organization', usesPhone: false }, { phone_verified: false }), false)
  assert.equal(shouldVerifyInvitationPhone({ kind: 'landlord', usesPhone: true }, { phone_verified: true }), false)
})

test('邀请联系方式脱敏函数不泄露完整值', () => {
  assert.equal(maskInvitationPhone('+8613800138000'), '+86*******8000')
  assert.equal(maskInvitationEmail('member@example.com'), 'm****r@example.com')
  assert.equal(maskInvitationEmail('a@example.com'), 'a***@example.com')
})

test('统一邀请页遵守 feature 分层，旧房东入口只做兼容跳转', () => {
  const pageSource = readFileSync(join(sourceRoot, 'pages/invitations/index.vue'), 'utf8')
  const legacySource = readFileSync(join(sourceRoot, 'pages-landlord/invite/index.vue'), 'utf8')

  assert.doesNotMatch(pageSource, /@\/services\/openapi/)
  assert.match(pageSource, /excludeLoginPath:\s*true/)
  assert.match(legacySource, /getInvitationRoute\('landlord'/)
})

test('邀请和通用异常页复用四类语义状态卡', () => {
  const invitationSource = readFileSync(join(sourceRoot, 'pages/invitations/index.vue'), 'utf8')
  const errorSources = [
    'pages/error/startup.vue',
    'pages/error/forbidden.vue',
    'pages/error/not-found.vue',
  ].map(file => readFileSync(join(sourceRoot, file), 'utf8'))

  assert.match(invitationSource, /AppStateCard/)
  assert.match(invitationSource, /tone="success"/)
  assert.match(invitationSource, /tone="warning"/)
  assert.match(invitationSource, /tone="info"/)
  assert.match(invitationSource, /tone="danger"/)
  errorSources.forEach(source => assert.match(source, /AppStateCard/))
})
