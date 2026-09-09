import assert from 'node:assert/strict'
import test from 'node:test'

import { prependRequestUrlPrefix } from '../src/domain/request-url.ts'

test('请求前缀只拼接一次', () => {
  assert.equal(prependRequestUrlPrefix('/api/allauth/app/v1/auth/session', '/fg-api'), '/fg-api/api/allauth/app/v1/auth/session')
  assert.equal(prependRequestUrlPrefix('/fg-api/api/allauth/app/v1/auth/session', '/fg-api'), '/fg-api/api/allauth/app/v1/auth/session')
})

test('非 H5 基础地址和绝对地址保持稳定', () => {
  assert.equal(prependRequestUrlPrefix('/api/public/houses/', 'https://example.com/'), 'https://example.com/api/public/houses/')
  assert.equal(prependRequestUrlPrefix('https://other.example.com/api/', 'https://example.com'), 'https://other.example.com/api/')
})
