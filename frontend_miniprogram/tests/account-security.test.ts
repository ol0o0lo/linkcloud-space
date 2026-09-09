import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  buildMfaDescription,
  getAuthenticatorLabel,
  getRecoveryCodes,
  getTotpSetup,
  hasPendingReauthentication,
  normalizeAuthenticatorList,
} from '../src/domain/account-security.ts'
import { APP_ROUTES, isProtectedAccountRoute } from '../src/modules/routes.ts'

test('账号安全状态兼容 allauth app 认证器响应', () => {
  const authenticators = normalizeAuthenticatorList({
    data: [
      { type: 'totp', created_at: 1 },
      { type: 'recovery_codes', total_code_count: 10, unused_code_count: 8 },
      { type: 'webauthn', id: 7, name: '办公电脑', is_passwordless: true },
    ],
  })

  assert.equal(authenticators.length, 3)
  assert.equal(authenticators[2]?.name, '办公电脑')
  assert.equal(buildMfaDescription(authenticators), '已启用 动态验证码（TOTP）、恢复码、通行密钥（Passkey）')
  assert.equal(getAuthenticatorLabel('recovery_codes'), '恢复码')
})

test('TOTP 初始化读取 allauth 404 meta 且恢复码只读取未使用项', () => {
  assert.deepEqual(getTotpSetup({ meta: { secret: 'SECRET', totp_url: 'otpauth://totp/demo' } }), {
    secret: 'SECRET',
    totpUrl: 'otpauth://totp/demo',
  })
  assert.equal(getTotpSetup({ data: { type: 'totp' } }), null)
  assert.deepEqual(getRecoveryCodes({ data: { unused_codes: ['11111111', 22222222] } }), ['11111111', '22222222'])
})

test('敏感操作只在 allauth 明确返回待重新验证流程时暂停', () => {
  assert.equal(hasPendingReauthentication({ data: { flows: [{ id: 'reauthenticate', is_pending: true }] } }), true)
  assert.equal(hasPendingReauthentication({ data: { flows: [{ id: 'mfa_reauthenticate', is_pending: true }] } }), true)
  assert.equal(hasPendingReauthentication({ data: { flows: [{ id: 'login' }] } }), false)
})

test('账号安全页有受保护路由并通过 feature 层调用', () => {
  assert.equal(APP_ROUTES.security, '/pages/account/security')
  assert.equal(isProtectedAccountRoute(APP_ROUTES.security), true)

  const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/account/security.vue'), 'utf8')
  assert.match(pageSource, /@\/features\/account-security\/service/)
  assert.doesNotMatch(pageSource, /@\/services\/openapi/)
  assert.match(pageSource, /#ifdef H5/)
  assert.match(pageSource, /微信小程序暂不支持管理通行密钥/)

  const authClientSource = readFileSync(resolve(process.cwd(), 'src/infra/auth/client.ts'), 'utf8')
  assert.match(authClientSource, /'GET' \| 'POST' \| 'PUT' \| 'DELETE'/)
  assert.match(authClientSource, /\/api\/allauth\/app\/v1\/account\/authenticators/)

  const meSource = readFileSync(resolve(process.cwd(), 'src/pages/me/me.vue'), 'utf8')
  assert.match(meSource, /APP_ROUTES\.security/)
})
