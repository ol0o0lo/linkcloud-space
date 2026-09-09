import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAllauthErrorMessage,
  getAllauthSessionToken,
  getAllauthUser,
  getPendingMfaTypes,
  isInvalidAllauthSessionStatus,
} from '../src/domain/auth.ts'

test('allauth 登录响应从 meta 中读取会话 token', () => {
  assert.equal(getAllauthSessionToken({ meta: { session_token: 'session-1' } }), 'session-1')
  assert.equal(getAllauthSessionToken({ data: {} }), '')
})

test('allauth 会话响应从 data 中读取当前用户', () => {
  const user = { id: 1, email: 'user@example.com' }
  assert.deepEqual(getAllauthUser({ data: { user } }), user)
  assert.equal(getAllauthUser({ data: { user: null } }), null)
})

test('allauth 错误优先显示字段级提示并兼容 detail', () => {
  assert.equal(getAllauthErrorMessage({ errors: [{ message: '邮箱或密码错误' }] }), '邮箱或密码错误')
  assert.equal(getAllauthErrorMessage({ detail: '会话已过期' }), '会话已过期')
  assert.equal(getAllauthErrorMessage({}), '请求失败，请稍后重试')
})

test('allauth 缺失或已失效会话都按可恢复的未登录状态处理', () => {
  assert.equal(isInvalidAllauthSessionStatus(401), true)
  assert.equal(isInvalidAllauthSessionStatus(410), true)
  assert.equal(isInvalidAllauthSessionStatus(500), false)
})

test('登录响应识别待完成的 TOTP、恢复码和 WebAuthn 二次验证', () => {
  assert.deepEqual(getPendingMfaTypes({
    data: {
      flows: [
        { id: 'login' },
        { id: 'mfa_authenticate', is_pending: true, types: ['totp', 'recovery_codes', 'webauthn'] },
      ],
    },
  }), ['totp', 'recovery_codes', 'webauthn'])
  assert.deepEqual(getPendingMfaTypes({ data: { flows: [{ id: 'mfa_authenticate', types: ['totp'] }] } }), [])
})
