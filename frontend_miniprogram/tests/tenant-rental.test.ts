import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { canCancelTenantViewing, formatTenantHouseAddress, formatTenantHouseTitle, getTenantLeaseStatusTone, getTenantViewingStatusTone, isTenantViewingPendingPayload, sortCurrentTenantViewings } from '../src/domain/tenant-rental.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('租客带看与租约状态沿用后端状态并映射移动端语义色', () => {
  assert.equal(getTenantViewingStatusTone('scheduled'), 'primary')
  assert.equal(getTenantViewingStatusTone('viewed'), 'success')
  assert.equal(getTenantViewingStatusTone('canceled'), 'danger')
  assert.equal(getTenantViewingStatusTone('no_show'), 'warning')
  assert.equal(getTenantViewingStatusTone('converted'), 'success')
  assert.equal(getTenantLeaseStatusTone('pending'), 'warning')
  assert.equal(getTenantLeaseStatusTone('active'), 'success')
  assert.equal(getTenantLeaseStatusTone('expired'), 'default')
  assert.equal(getTenantLeaseStatusTone('terminated'), 'danger')
  assert.equal(canCancelTenantViewing('scheduled'), true)
  assert.equal(canCancelTenantViewing('viewed'), false)
})

test('待恢复预约只接受可信房源、时间和备注载荷', () => {
  assert.equal(isTenantViewingPendingPayload({ houseId: 42, scheduledAt: '2026-09-08T06:00:00.000Z', notes: '下午方便' }), true)
  assert.equal(isTenantViewingPendingPayload({ houseId: 0, scheduledAt: '2026-09-08T06:00:00.000Z', notes: '' }), false)
  assert.equal(isTenantViewingPendingPayload({ houseId: 42, scheduledAt: '', notes: '' }), false)
  assert.equal(isTenantViewingPendingPayload({ houseId: 42, scheduledAt: '2026-09-08T06:00:00.000Z', notes: 1 }), false)
})

test('租客业务统一显示小区、楼栋和房号', () => {
  assert.equal(formatTenantHouseTitle({
    room_number: '101',
    building: { name: '1 栋', estate: { display_name: '云栖花园', name: '云栖花园一期' } },
  }), '云栖花园 1 栋 101')
  assert.equal(formatTenantHouseTitle({
    room_number: '202',
    building: { name: '独栋公寓', estate: null },
  }), '独栋公寓 202')
})

test('待看房优先展示最近的未来安排，过时但未更新的安排仍保留', () => {
  const now = Date.parse('2026-10-24T10:00:00Z')
  const items = [
    { id: 1, scheduled_at: '2026-10-23T10:00:00Z' },
    { id: 2, scheduled_at: '2026-10-26T10:00:00Z' },
    { id: 3, scheduled_at: '2026-10-24T12:00:00Z' },
    { id: 4, scheduled_at: '2026-10-22T10:00:00Z' },
  ]
  assert.deepEqual(sortCurrentTenantViewings(items, now).map(item => item.id), [3, 2, 1, 4])
  assert.deepEqual(items.map(item => item.id), [1, 2, 3, 4])
})

test('看房地址优先使用楼栋详细地址，缺失时使用小区地址', () => {
  const building = { name: '1 栋', address: '新港中路 1 号', estate: { name: '云栖花园', display_name: '云栖花园', city: '广州市', district: '海珠区', address: '新港中路' } }
  assert.equal(formatTenantHouseAddress({ room_number: '101', building }), '广州市 海珠区 新港中路 1 号')
  assert.equal(formatTenantHouseAddress({ room_number: '101', building: { ...building, address: '' } }), '广州市 海珠区 新港中路')
  assert.equal(formatTenantHouseAddress({ room_number: '101', building: { name: '独栋公寓', estate: null } }), '独栋公寓')
})

test('房源详情直接打开聊天，联系方式由聊天内主动分享', () => {
  const source = readFileSync(path.join(projectRoot, 'src/pages-housing/detail/index.vue'), 'utf8')
  const bottomSheetSource = readFileSync(path.join(projectRoot, 'src/components/app/AppBottomSheet.vue'), 'utf8')

  assert.match(source, /<AppBottomSheet[^>]*:z-index="1200"/)
  assert.match(bottomSheetSource, /<wd-popup[\s\S]*root-portal/)
  assert.match(source, /在线咨询/)
  assert.match(source, /startTenantChat/)
  assert.doesNotMatch(source, /contactVisible|contactPhone|contactWechat|保存并发送/)
})

test('房源联系方式接入真实聊天，不再显示旧提交成功确认文案', () => {
  const source = readFileSync(path.join(projectRoot, 'src/pages-housing/detail/index.vue'), 'utf8')
  const chat = readFileSync(path.join(projectRoot, 'src/pages/messages/conversation.vue'), 'utf8')
  const renderer = readFileSync(path.join(projectRoot, 'src/features/messaging/MessageContent.vue'), 'utf8')

  assert.match(source, /getConversationRoute/)
  assert.match(chat, /ContactSharingSheet/)
  assert.match(chat, /发送联系方式/)
  assert.match(chat, /<MessageContent\b/)
  assert.match(renderer, /data: message\.content/)
  assert.doesNotMatch(source, /工作人员将与你确认看房时间|提交成功/)
})

test('预约详情使用三段步骤条直接展示带看进度', () => {
  const source = readFileSync(path.join(projectRoot, 'src/pages-personal-rental/viewings/detail.vue'), 'utf8')

  assert.match(source, /<wd-steps[^>]*:active="viewingProgressActive"[^>]*align-center[^>]*dot/)
  assert.match(source, /<wd-step title="已预约"/)
  assert.match(source, /<wd-step title="待带看"/)
  assert.match(source, /<wd-step title="已完成"/)
})
