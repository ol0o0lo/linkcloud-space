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

test('预约弹层高于页面固定操作栏且日期选择器可继续置顶', () => {
  const source = readFileSync(path.join(projectRoot, 'src/pages-housing/detail/index.vue'), 'utf8')

  assert.match(source, /<wd-popup[^>]*:z-index="1200"[^>]*root-portal/)
  assert.match(source, /<wd-datetime-picker[^>]*:z-index="1300"[^>]*root-portal/)
})
