import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMessageDay, formatMessageTime, messageDayKey, senderInputValue, showMessageTime } from '../src/features/messaging/presentation.ts'

test('消息时间按本地自然日分组，跨午夜和跨年显示清楚', () => {
  const now = new Date(2026, 9, 25, 0, 5)
  assert.equal(formatMessageTime(new Date(2026, 9, 25, 0, 1).toISOString(), now), '00:01')
  assert.equal(formatMessageTime(new Date(2026, 9, 24, 23, 59).toISOString(), now), '昨天')
  assert.equal(formatMessageDay(new Date(2026, 9, 25).toISOString(), now), '今天')
  assert.match(formatMessageTime(new Date(2025, 0, 1).toISOString(), now), /2025/)
  assert.equal(messageDayKey('invalid'), '')
  assert.equal(formatMessageTime('invalid', now), '')
  assert.equal(showMessageTime('2026-10-25T10:01:00', '2026-10-25T10:00:00'), false)
  assert.equal(showMessageTime('2026-10-25T10:05:00', '2026-10-25T10:00:00'), true)
  assert.equal(showMessageTime('2026-10-25T00:01:00', '2026-10-24T23:59:00'), true)
})

test('输入适配使用库的真实事件结构，保留空白和换行', () => {
  assert.equal(senderInputValue({ value: '你好\n第二行 ' }), '你好\n第二行 ')
  assert.equal(senderInputValue('直接字符串'), '直接字符串')
  assert.equal(senderInputValue({ detail: 'unexpected' }), '')
})
