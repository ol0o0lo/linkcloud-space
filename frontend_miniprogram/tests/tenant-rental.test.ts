import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { canCancelTenantViewing, formatTenantHouseTitle, getTenantLeaseStatusTone, getTenantViewingStatusTone, isTenantViewingPendingPayload } from '../src/domain/tenant-rental.ts'

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

test('房源详情使用当前页预约联系弹层并优先一键发送', () => {
  const source = readFileSync(path.join(projectRoot, 'src/pages-housing/detail/index.vue'), 'utf8')
  const bottomSheetSource = readFileSync(path.join(projectRoot, 'src/components/app/AppBottomSheet.vue'), 'utf8')

  assert.match(source, /<AppBottomSheet[^>]*:z-index="1200"/)
  assert.match(bottomSheetSource, /<wd-popup[\s\S]*root-portal/)
  assert.match(source, /一键发送给中介/)
  assert.match(source, /修改联系方式/)
  assert.match(source, /<wd-checkbox-group/)
  assert.match(source, /<wd-input[^>]*type="tel"/)
  assert.doesNotMatch(source, /wd-datetime-picker/)
})

test('中介在消息详情中可以查看租客发送的手机号和微信号', () => {
  const source = readFileSync(path.join(projectRoot, 'src/pages/messages/detail.vue'), 'utf8')

  assert.match(source, /notification\.category === 'house\.contact'/)
  assert.match(source, /手机号/)
  assert.match(source, /微信号/)
})

test('预约详情使用三段步骤条直接展示带看进度', () => {
  const source = readFileSync(path.join(projectRoot, 'src/pages-personal-rental/viewings/detail.vue'), 'utf8')

  assert.match(source, /<wd-steps[^>]*:active="viewingProgressActive"[^>]*align-center[^>]*dot/)
  assert.match(source, /<wd-step title="已预约"/)
  assert.match(source, /<wd-step title="待带看"/)
  assert.match(source, /<wd-step title="已完成"/)
})
