import assert from 'node:assert/strict'
import test from 'node:test'

import { buildRequestHeaders } from '../src/domain/request-context.ts'

test('登录请求携带移动端会话 Token', () => {
  assert.deepEqual(buildRequestHeaders({ sessionToken: 'session-1', requestScope: 'personal', organizationSlug: '' }), {
    'X-Session-Token': 'session-1',
  })
})

test('组织业务请求携带当前组织 slug', () => {
  assert.deepEqual(buildRequestHeaders({ sessionToken: 'session-1', requestScope: 'organization', organizationSlug: 'alpha' }), {
    'X-Org-Slug': 'alpha',
    'X-Session-Token': 'session-1',
  })
})

test('公开和个人请求永远不携带组织上下文', () => {
  assert.deepEqual(buildRequestHeaders({ sessionToken: 'session-1', requestScope: 'public', organizationSlug: 'alpha' }), {
    'X-Session-Token': 'session-1',
  })
  assert.deepEqual(buildRequestHeaders({ sessionToken: 'session-1', requestScope: 'personal', organizationSlug: 'alpha' }), {
    'X-Session-Token': 'session-1',
  })
  assert.deepEqual(buildRequestHeaders({ sessionToken: 'session-1', requestScope: 'landlord', organizationSlug: 'alpha' }), {
    'X-Session-Token': 'session-1',
  })
})

test('缺省范围按个人请求处理', () => {
  assert.deepEqual(buildRequestHeaders({ sessionToken: 'session-1', organizationSlug: 'alpha' }), {
    'X-Session-Token': 'session-1',
  })
})
