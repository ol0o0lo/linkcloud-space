import assert from 'node:assert/strict'
import test from 'node:test'
import type { FavoriteOut } from '../src/features/favorites/service.ts'
import { contactCardPayload, favoriteHouseMessage, houseCardPayload, houseMessageCard } from '../src/features/messaging/message-content.ts'

test('只按显式消息类型渲染联系方式，不猜测普通文字', () => {
  const payload = { house_id: 9, phone: '+8613800138001', wechat: '' }
  assert.deepEqual(contactCardPayload({ content: '联系方式摘要', message_type: 'house.contact', payload }), payload)
  assert.equal(contactCardPayload({ content: '我想咨询房源 #9。\n手机号：+8613800138001', payload }), null)
  assert.equal(contactCardPayload({ content: '', message_type: 'unknown', payload }), null)
  assert.equal(contactCardPayload({ content: '', message_type: 'house.contact', payload: { house_id: 9, phone: 'javascript:call()' } }), null)
})

test('房源卡片复用户型和金额展示，并使用动态媒体缩略图', () => {
  const payload = houseCardPayload({ content: '', message_type: 'house.listing', payload: { house_id: 9, title: '云舍 501', bedrooms: 1, living_rooms: 0, area: '21.41', asking_rent: '2800' } })!
  const card = houseMessageCard(payload, [{ thumbnail: 'https://example.invalid/new-signature.jpg', url: 'https://example.invalid/original.jpg' }])
  assert.match(card.facts, /单间/)
  assert.match(card.facts, /21.41/)
  assert.doesNotMatch(card.facts, /待确认/)
  assert.match(card.rentText, /2,800/)
  assert.equal(card.coverUrl, 'https://example.invalid/new-signature.jpg')
  assert.doesNotMatch(houseMessageCard({ ...payload, living_rooms: 1 }).facts, /单间/)
  assert.equal(houseCardPayload({ content: '', message_type: 'house.listing', payload: { house_id: -1, title: 'invalid' } }), null)
})

test('收藏选择生成房源分享数据，失效收藏不可发送', () => {
  const favorite: FavoriteOut = {
    id: 1,
    target_type: 'house',
    target_id: '9',
    created_at: '2026-10-25T01:00:00Z',
    available: true,
    display: null,
    target: { id: 9, room_number: '501', building: { name: '云舍' }, bedrooms: 1, living_rooms: 0, asking_rent: '2800', images: [{ url: 'https://example.invalid/cover.jpg' }] },
  }
  const message = favoriteHouseMessage(favorite)!
  assert.equal(message.payload.house_id, 9)
  assert.equal(message.media[0].url, 'https://example.invalid/cover.jpg')
  assert.equal(favoriteHouseMessage({ ...favorite, available: false }), null)
  assert.equal(favoriteHouseMessage({ ...favorite, target_type: 'building' }), null)
})
