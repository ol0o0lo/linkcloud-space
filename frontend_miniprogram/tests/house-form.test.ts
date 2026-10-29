import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyHouseForm, getHouseDraftKey, getHouseFormErrors, houseLayoutPresets, isHouseFormDraft } from '../src/pages-org-rental/domain/house-form.ts'
import { buildOrganizationHouseCreatePayload, buildOrganizationHousePatchPayload } from '../src/pages-org-rental/domain/organization-rental.ts'

test('房源可选数字区分未填、空白与明确的零，创建和清空编辑行为一致', () => {
  const form = { ...createEmptyHouseForm(), building_id: 1, room_number: '101', asking_rent: ' ', deposit_amount: 0, bedrooms: 1, living_rooms: '0' }
  for (const payload of [buildOrganizationHouseCreatePayload(form), buildOrganizationHousePatchPayload(form)]) {
    assert.equal(payload.asking_rent, null)
    assert.equal(payload.area, null)
    assert.equal(payload.floor, null)
    assert.equal(payload.bathrooms, null)
    assert.equal(payload.deposit_amount, 0)
    assert.equal(payload.living_rooms, 0)
    assert.equal(payload.bedrooms, 1)
  }
  assert.throws(() => buildOrganizationHouseCreatePayload({ ...form, asking_rent: '不是数字' }), /数字字段格式/)
})

test('房源校验定位缺失字段，允许零值和地下楼层并拒绝非法金额和数量', () => {
  assert.deepEqual(Object.keys(getHouseFormErrors(createEmptyHouseForm())), ['building_id', 'room_number'])
  const valid = { ...createEmptyHouseForm(), building_id: 1, room_number: ' 101 ', floor: -1, area: '68.5', asking_rent: 0, living_rooms: '0' }
  assert.deepEqual(getHouseFormErrors(valid), {})
  const errors = getHouseFormErrors({ ...valid, floor: '1.5', asking_rent: '-1', bedrooms: '1.5', area: '错误' })
  assert.deepEqual(Object.keys(errors).sort(), ['area', 'asking_rent', 'bedrooms', 'floor'])
  assert.match(errors.floor!, /整数/)
})

test('常用户型沿用共享展示规则，单间与一室一厅分别带入正确数量', () => {
  assert.deepEqual(houseLayoutPresets.find(item => item.label === '单间'), { label: '单间', bedrooms: 1, living_rooms: 0 })
  assert.deepEqual(houseLayoutPresets.find(item => item.label === '一室一厅'), { label: '一室一厅', bedrooms: 1, living_rooms: 1 })
})

test('下一套房源仅保留楼栋，数值、户型、房东、图片和备注重置且数组独立', () => {
  const next = createEmptyHouseForm(12)
  assert.equal(next.building_id, 12)
  assert.equal(next.room_number, '')
  assert.equal(next.asking_rent, '')
  assert.equal(next.bedrooms, '')
  assert.equal(next.landlord_id, null)
  assert.equal(next.public_description, '')
  assert.equal(next.internal_notes, '')
  assert.deepEqual(next.images, [])
  assert.notEqual(next.images, createEmptyHouseForm(12).images)
})

test('草稿键隔离用户、工作空间、新增与各编辑房源，并拒绝匿名或缺失空间', () => {
  const key = getHouseDraftKey(1, 'alpha')
  assert.ok(key)
  assert.notEqual(key, getHouseDraftKey(2, 'alpha'))
  assert.notEqual(key, getHouseDraftKey(1, 'beta'))
  assert.notEqual(key, getHouseDraftKey(1, 'alpha', 1))
  assert.notEqual(getHouseDraftKey(1, 'alpha', 1), getHouseDraftKey(1, 'alpha', 2))
  assert.equal(getHouseDraftKey(0, 'alpha'), null)
  assert.equal(getHouseDraftKey(1, ''), null)
})

test('草稿验证保留零值及媒体引用，拒绝损坏数据与额外字段', () => {
  const draft = {
    form: { ...createEmptyHouseForm(1), room_number: '101', living_rooms: 0, images: [{ media_id: 3, url: 'https://example.test/3.jpg' }] },
    buildingLabel: '演示楼栋',
    landlordLabel: '不关联房东',
    updatedAt: 1,
  }
  assert.equal(isHouseFormDraft(JSON.parse(JSON.stringify(draft))), true)
  assert.equal(isHouseFormDraft(null), false)
  assert.equal(isHouseFormDraft({ ...draft, updatedAt: '1' }), false)
  assert.equal(isHouseFormDraft({ ...draft, form: { ...draft.form, room_number: 101 } }), false)
  assert.equal(isHouseFormDraft({ ...draft, form: { ...draft.form, images: [{ media_id: '3' }] } }), false)
  assert.equal(isHouseFormDraft({ ...draft, form: { ...draft.form, extra: 'unexpected' } }), false)
})
