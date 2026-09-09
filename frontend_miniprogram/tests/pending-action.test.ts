import assert from 'node:assert/strict'
import test from 'node:test'

import { createPendingAction, createPendingActionRegistry, takePendingAction } from '../src/domain/pending-action.ts'
import { getHouseDetailRoute } from '../src/modules/routes.ts'

test('待收藏操作只能消费一次', () => {
  const pending = createPendingAction('favorite-house', { houseId: 42 }, getHouseDetailRoute(42), 1000)
  const first = takePendingAction(pending, 1500)
  assert.equal(first.action?.type, 'favorite-house')
  assert.equal(first.action?.payload.houseId, 42)
  assert.equal(first.next, null)
  assert.equal(takePendingAction(first.next, 1600).action, null)
})

test('超过有效期的待操作不会执行', () => {
  const pending = createPendingAction('favorite-house', { houseId: 42 }, getHouseDetailRoute(42), 1000)
  assert.equal(takePendingAction(pending, 1000 + 16 * 60 * 1000).action, null)
})

test('待执行动作通过注册表校验版本和载荷后最多执行一次', async () => {
  const executed: number[] = []
  const registry = createPendingActionRegistry({
    'favorite-house': {
      version: 1,
      validate: (payload): payload is { houseId: number } => Boolean(payload && typeof payload === 'object' && typeof (payload as { houseId?: unknown }).houseId === 'number'),
      execute: async payload => executed.push(payload.houseId),
    },
  })
  const pending = createPendingAction('favorite-house', { houseId: 42 }, getHouseDetailRoute(42), 1000)

  const result = await registry.consume(pending, 1500)
  assert.equal(result.executed, true)
  assert.equal(result.next, null)
  assert.deepEqual(executed, [42])
  assert.equal((await registry.consume(result.next, 1600)).executed, false)
})

test('未知、版本不兼容或载荷不可信的待执行动作直接丢弃', async () => {
  const registry = createPendingActionRegistry({
    known: {
      version: 2,
      validate: (payload): payload is { id: number } => Boolean(payload && typeof payload === 'object' && typeof (payload as { id?: unknown }).id === 'number'),
      execute: async () => undefined,
    },
  })

  assert.equal((await registry.consume(createPendingAction('unknown', {}, '/', 1000), 1200)).executed, false)
  assert.equal((await registry.consume(createPendingAction('known', { id: 1 }, '/', 1000, 1), 1200)).executed, false)
  assert.equal((await registry.consume(createPendingAction('known', { id: 'bad' }, '/', 1000, 2), 1200)).executed, false)
})
