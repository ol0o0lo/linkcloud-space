import assert from 'node:assert/strict'
import test from 'node:test'

import { distributeWaterfallItems } from '../src/components/app/waterfall.ts'

test('瀑布流按当前最小累计权重稳定分列', () => {
  const items = [
    { id: 1, weight: 1.25 },
    { id: 2, weight: 1 },
    { id: 3, weight: 1 },
    { id: 4, weight: 1 },
  ]

  const columns = distributeWaterfallItems(items, 2, item => item.weight)

  assert.deepEqual(columns.map(column => column.items.map(entry => entry.item.id)), [[1, 4], [2, 3]])
  assert.deepEqual(columns.map(column => column.weight), [2.25, 2])
})

test('瀑布流追加数据后不会改变已有卡片的列归属', () => {
  const initial = [
    { id: 1, weight: 1.25 },
    { id: 2, weight: 1 },
    { id: 3, weight: 1 },
  ]
  const appended = [...initial, { id: 4, weight: 1.25 }, { id: 5, weight: 1 }]

  const before = distributeWaterfallItems(initial, 2, item => item.weight)
  const after = distributeWaterfallItems(appended, 2, item => item.weight)
  const columnOf = (columns: typeof after, id: number) => columns.findIndex(column => column.items.some(entry => entry.item.id === id))

  for (const item of initial)
    assert.equal(columnOf(before, item.id), columnOf(after, item.id))
})

test('瀑布流将无效权重和无效列数回退为安全值', () => {
  const columns = distributeWaterfallItems([{ id: 1 }, { id: 2 }], 0, () => Number.NaN)

  assert.equal(columns.length, 1)
  assert.equal(columns[0].weight, 2)
})
