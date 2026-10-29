import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMerchantHouseFilters, canSelectMatchHouse, getMatchExtensionDate } from '../src/pages-org-rental/domain/organization-matches.ts'

test('商家筛房保留零值并校验无效租金区间与卧室数', () => {
  assert.deepEqual(buildMerchantHouseFilters({ minRent: '0', maxRent: '3000', bedrooms: '0', district: ' 南山区 ' }), {
    min_rent: 0,
    max_rent: 3000,
    bedrooms: 0,
    district: '南山区',
  })
  assert.throws(() => buildMerchantHouseFilters({ minRent: '4000', maxRent: '3000', bedrooms: '', district: '' }), /最低租金不能高于最高租金/)
  assert.throws(() => buildMerchantHouseFilters({ minRent: 'NaN', maxRent: '', bedrooms: '', district: '' }), /不小于 0/)
  assert.throws(() => buildMerchantHouseFilters({ minRent: '', maxRent: '', bedrooms: '1.5', district: '' }), /整数/)
})

test('公开配房只允许招租房源，延期从当前和原到期时间的较晚时间开始', () => {
  assert.equal(canSelectMatchHouse({ status: 'listed' }), true)
  for (const status of ['paused', 'rented'])
    assert.equal(canSelectMatchHouse({ status }), false)
  assert.equal(canSelectMatchHouse({ status: 'listed', is_active: false }), false)
  assert.equal(canSelectMatchHouse({ status: 'listed', is_active: true }), true)
  const now = Date.parse('2026-10-24T00:00:00Z')
  assert.equal(getMatchExtensionDate('2026-10-30T00:00:00Z', 7, now), '2026-11-06T00:00:00.000Z')
  assert.equal(getMatchExtensionDate('2026-10-01T00:00:00Z', 7, now), '2026-10-31T00:00:00.000Z')
})
