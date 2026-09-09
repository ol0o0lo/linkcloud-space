import assert from 'node:assert/strict'
import test from 'node:test'

import { formatHouseLayout, normalizePublicHouseQuery } from '../src/domain/house.ts'

test('一室零厅统一显示为单间', () => {
  assert.equal(formatHouseLayout(1, 0), '单间')
})

test('一室一厅正常显示', () => {
  assert.equal(formatHouseLayout(1, 1), '一室一厅')
})

test('缺失户型值不会显示零室零厅', () => {
  assert.equal(formatHouseLayout(null, null), '户型待完善')
})

test('公开房源查询只发送有值参数并保留 false 与 0', () => {
  assert.deepEqual(normalizePublicHouseQuery({
    keyword: '  南山  ',
    city: '',
    min_rent: null,
    bedrooms: 0,
    has_elevator_access: false,
    tags: [],
    page: 1,
    page_size: 20,
  }), {
    keyword: '南山',
    bedrooms: 0,
    has_elevator_access: false,
    page: 1,
    page_size: 20,
  })
})
