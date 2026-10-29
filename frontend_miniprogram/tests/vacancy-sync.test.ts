import type { VacancySyncBlock } from '../src/pages-org-rental/domain/vacancy-sync.ts'
import assert from 'node:assert/strict'
import test from 'node:test'
import { formatVacancyFieldValue, getVacancyChangeGroups, getVacancyVisibleLines, isVacancyBlockVisible } from '../src/pages-org-rental/domain/vacancy-sync.ts'

const block: VacancySyncBlock = {
  block_index: 0,
  address: '测试路1号',
  building_match: { status: 'matched', building_id: 1, name: '测试楼栋', address: '测试路1号', candidates: [] },
  lines: [
    { line_number: 2, raw: '101单间1200', room_number: '101', status: 'valid', error_code: null, message: null, floor: 1, asking_rent: '1200', bedrooms: 1, living_rooms: 0, tags: [] },
    { line_number: 3, raw: '102单间1300', room_number: '102', status: 'ignored', error_code: null, message: null, floor: 1, asking_rent: '1300', bedrooms: 1, living_rooms: 0, tags: [] },
  ],
  changes: {
    create_houses: [],
    update_houses: [],
    mark_paused: [],
    mark_rented: [{ house_id: 3, room_number: '103', before_status: 'listed', after_status: 'rented', changed_fields: ['status'], field_changes: [] }],
    preserve_ignored: [],
    inactive_conflicts: [],
  },
  errors: [],
  warnings: [],
}

test('错误筛选保留已忽略且没有错误码的行，允许恢复重复房号', () => {
  assert.deepEqual(getVacancyVisibleLines(block, 'errors').map(line => line.line_number), [3])
  assert.equal(isVacancyBlockVisible(block, 'errors'), true)
})

test('只存在清单外已租变更的楼栋仍出现在变更筛选中', () => {
  assert.equal(isVacancyBlockVisible(block, 'changes'), true)
  assert.deepEqual(getVacancyVisibleLines(block, 'changes'), [])
  assert.deepEqual(getVacancyChangeGroups(block).map(group => group.key), ['mark_rented'])
})

test('变更值展示区分未填写、零租金和楼层', () => {
  assert.equal(formatVacancyFieldValue('asking_rent', '0'), '¥0.00/月')
  assert.equal(formatVacancyFieldValue('floor', null), '未填写')
  assert.equal(formatVacancyFieldValue('floor', '2'), '2楼')
})
