import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPhoneDisplay } from '../src/domain/phone.ts'

test('列表手机号隐藏中国区号并保留号码及原有脱敏内容', () => {
  assert.equal(formatPhoneDisplay('+8613800138000'), '13800138000')
  assert.equal(formatPhoneDisplay(' +86 13800138000 '), '13800138000')
  assert.equal(formatPhoneDisplay('+8602088888888'), '02088888888')
  assert.equal(formatPhoneDisplay('+86****8000'), '****8000')
  assert.equal(formatPhoneDisplay('13800138000'), '13800138000')
})

test('其他国家区号和不含加号的原始号码保持原样', () => {
  assert.equal(formatPhoneDisplay('+85291234567'), '+85291234567')
  assert.equal(formatPhoneDisplay('+12025550123'), '+12025550123')
  assert.equal(formatPhoneDisplay('8613800138000'), '8613800138000')
})

test('缺省手机号返回空文本，供列表保留原有兜底提示', () => {
  assert.equal(formatPhoneDisplay(), '')
  assert.equal(formatPhoneDisplay(null), '')
  assert.equal(formatPhoneDisplay('  '), '')
})
