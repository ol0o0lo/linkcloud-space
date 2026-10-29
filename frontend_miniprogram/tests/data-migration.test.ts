import assert from 'node:assert/strict'
import test from 'node:test'
import { migrationIsRunning, migrationMediaLabel, migrationMediaPercentage, migrationOverrideValue } from '../src/domain/data-migration.ts'

test('迁移进度区分业务完成和媒体完成，并在后台运行时继续查询', () => {
  assert.equal(migrationIsRunning('completed', 'processing'), true)
  assert.equal(migrationIsRunning('completed', 'pending'), true)
  assert.equal(migrationIsRunning('awaiting_confirmation', 'pending'), false)
  assert.equal(migrationIsRunning('completed', 'completed'), false)
  assert.equal(migrationMediaPercentage({ total: 5, succeeded: 3 }, 'failed'), 60)
  assert.equal(migrationMediaPercentage({ total: 0, succeeded: 0 }, 'pending'), 0)
  assert.equal(migrationMediaLabel('processing'), '媒体迁移中')
})

test('预检补全保持旧房号文本，转换目标数值字段并拒绝非法数字', () => {
  assert.equal(migrationOverrideValue('room_number', '001'), '001')
  assert.equal(migrationOverrideValue('floors', '12'), 12)
  assert.equal(migrationOverrideValue('asking_rent', '1800.50'), '1800.50')
  assert.equal(migrationOverrideValue('name', 'null'), 'null')
  assert.equal(migrationOverrideValue('landlord_id', 'null'), null)
  assert.throws(() => migrationOverrideValue('floors', '不确定'), /有效数字/)
})
