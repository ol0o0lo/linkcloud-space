import assert from 'node:assert/strict'
import test from 'node:test'

import { AppError } from '../src/core/errors/app-error.ts'
import { buildScopeHeaders } from '../src/infra/http/request-scope.ts'

test('公开请求可以携带会话但绝不继承组织上下文', () => {
  assert.deepEqual(buildScopeHeaders({
    scope: { kind: 'public' },
    sessionToken: 'session-1',
  }), {
    'X-Session-Token': 'session-1',
  })
})

test('个人和房东请求必须登录且不发送组织头', () => {
  assert.deepEqual(buildScopeHeaders({
    scope: { kind: 'landlord', landlordContactId: 12 },
    sessionToken: 'session-1',
  }), {
    'X-Session-Token': 'session-1',
  })

  assert.throws(
    () => buildScopeHeaders({ scope: { kind: 'personal' }, sessionToken: '' }),
    (error: unknown) => error instanceof AppError && error.kind === 'unauthenticated',
  )
})

test('组织请求必须同时具备会话和明确的组织 slug', () => {
  assert.deepEqual(buildScopeHeaders({
    scope: { kind: 'organization', organizationSlug: 'alpha' },
    sessionToken: 'session-1',
  }), {
    'X-Org-Slug': 'alpha',
    'X-Session-Token': 'session-1',
  })

  assert.throws(
    () => buildScopeHeaders({ scope: { kind: 'organization', organizationSlug: '' }, sessionToken: 'session-1' }),
    /未选择组织/,
  )
})
