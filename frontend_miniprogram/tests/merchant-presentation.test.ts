import assert from 'node:assert/strict'
import test from 'node:test'
import { formatCustomerBudget, formatMerchantTime, formatShareValidity } from '../src/domain/merchant-presentation.ts'

test('客户预算兼容不限、单边、零预算及小数，不将缺省值显示为金额', () => {
  assert.equal(formatCustomerBudget(null, ''), '预算不限')
  assert.equal(formatCustomerBudget('2000.00', '3500.00'), '2,000–3,500 元/月')
  assert.equal(formatCustomerBudget('0.00', null), '0 元/月起')
  assert.equal(formatCustomerBudget(null, '3500.50'), '3,500.5 元/月以内')
  assert.equal(formatCustomerBudget('2000', '2000.00'), '2,000 元/月')
})

test('业务时间以本地日历区分今天昨天，跨年时保留年份且不显示秒', () => {
  const now = new Date(2026, 0, 1, 9, 30)
  assert.equal(formatMerchantTime(new Date(2026, 0, 1, 8, 5, 10).toISOString(), now), '今天 08:05')
  assert.equal(formatMerchantTime(new Date(2025, 11, 31, 18, 0).toISOString(), now), '昨天 18:00')
  assert.equal(formatMerchantTime(new Date(2025, 11, 30, 18, 0).toISOString(), now), '2025年12月30日 18:00')
  assert.equal(formatMerchantTime('invalid', now), '时间待确认')
})

test('分享有效期正确处理失效、过期、长期和不足一天', () => {
  const now = Date.UTC(2026, 9, 24, 8)
  assert.equal(formatShareValidity(null, 'revoked', now), '已失效')
  assert.equal(formatShareValidity(null, 'active', now), '长期有效')
  assert.equal(formatShareValidity(new Date(now).toISOString(), 'active', now), '已过期')
  assert.equal(formatShareValidity(new Date(now + 3600001).toISOString(), 'active', now), '剩余 2 小时')
  assert.equal(formatShareValidity(new Date(now + 86400000).toISOString(), 'active', now), '剩余 1 天')
})
