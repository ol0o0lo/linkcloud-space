import assert from 'node:assert/strict'
import test from 'node:test'

import { getLandlordHouseStatusTone } from '../src/domain/landlord.ts'

test('房东房源状态沿用后端枚举并映射移动端语义色', () => {
  assert.equal(getLandlordHouseStatusTone('listed'), 'success')
  assert.equal(getLandlordHouseStatusTone('vacant'), 'warning')
  assert.equal(getLandlordHouseStatusTone('rented'), 'primary')
  assert.equal(getLandlordHouseStatusTone('renovating'), 'warning')
  assert.equal(getLandlordHouseStatusTone('inactive'), 'default')
})
