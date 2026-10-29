import assert from 'node:assert/strict'
import test from 'node:test'

import { formatHouseLayout, getHouseAuxiliaryLabels, normalizePublicHouseQuery } from '../src/domain/house.ts'
import { buildFavoriteHouseCardModel, buildHouseCardModel, formatHouseCardDeposit, formatHouseCardRent } from '../src/domain/house-card.ts'

test('一室零厅统一显示为单间', () => {
  assert.equal(formatHouseLayout(1, 0), '单间')
})

test('一室一厅正常显示', () => {
  assert.equal(formatHouseLayout(1, 1), '一室一厅')
})

test('缺失户型值不会显示零室零厅', () => {
  assert.equal(formatHouseLayout(null, null), '户型待完善')
})

test('公开房源查询只发送有值参数并保留 false 与 0', () => {
  assert.deepEqual(normalizePublicHouseQuery({
    keyword: '  南山  ',
    city: '',
    min_rent: null,
    bedrooms: 0,
    has_elevator_access: false,
    tags: [],
    page: 1,
    page_size: 20,
  }), {
    keyword: '南山',
    bedrooms: 0,
    has_elevator_access: false,
    page: 1,
    page_size: 20,
  })
})

test('房源卡片统一格式化标题、户型、电梯、月租和押金', () => {
  const card = buildHouseCardModel({
    id: 1,
    room_number: '1202',
    area: '68.00',
    asking_rent: '4600.00',
    deposit_amount: '9200.00',
    bedrooms: 2,
    living_rooms: 1,
    decoration__mapping: '精装修',
    has_elevator_access: true,
    images: [{ thumbnail: 'https://example.com/cover.jpg' }],
    building: {
      name: '3栋',
      estate: { display_name: '翡翠名都', district: '滨江区' },
    },
  })

  assert.equal(card.title, '翡翠名都 3栋 1202')
  assert.equal(card.heading, '翡翠名都')
  assert.equal(card.subtitle, '3栋 · 1202')
  assert.equal(card.location, '滨江区 · 精装修')
  assert.equal(card.facts, '二室一厅 · 68㎡ · 有电梯')
  assert.equal(card.rentText, '¥4,600/月')
  assert.equal(card.depositText, '押金 ¥9,200')
  assert.equal(card.coverUrl, 'https://example.com/cover.jpg')
  assert.equal(card.showStatusDot, false)
})

test('房源分层标题在缺少小区或楼栋与小区同名时不重复信息', () => {
  const house = { id: 1, room_number: '806', building: { name: '云栖公寓', estate: null } }
  const withoutEstate = buildHouseCardModel(house)
  assert.equal(withoutEstate.heading, '云栖公寓')
  assert.equal(withoutEstate.subtitle, '806')

  const sameName = buildHouseCardModel({ ...house, building: { name: '云栖公寓', estate: { name: '云栖公寓' } } })
  assert.equal(sameName.heading, '云栖公寓')
  assert.equal(sameName.subtitle, '806')
})

test('房源卡片隐藏默认招租状态并标记非默认状态', () => {
  const base = {
    id: 1,
    room_number: '806',
    bedrooms: 1,
    living_rooms: 0,
    has_elevator_access: false,
    building: { name: '云栖公寓', estate: null },
  }

  assert.equal(buildHouseCardModel({ ...base, status: 'listed', status__mapping: '招租中' }).showStatusDot, false)
  assert.equal(buildHouseCardModel({ ...base, status: 'paused', status__mapping: '暂不出租' }).showStatusDot, true)
  assert.equal(buildHouseCardModel({ ...base, status: 'paused', status__mapping: '暂不出租' }).statusLabel, '暂不出租')
})

test('停用使用独立辅助标记，不替换三态房源状态', () => {
  assert.deepEqual(getHouseAuxiliaryLabels({ is_active: true }), [])
  assert.deepEqual(getHouseAuxiliaryLabels({ is_active: false }), ['已停用'])
  const card = buildHouseCardModel({
    id: 1,
    room_number: '806',
    building: { name: '云栖公寓' },
    status: 'rented',
    status__mapping: '已出租',
    is_active: false,
  })
  assert.equal(card.statusLabel, '已出租')
  assert.equal(card.statusTone, 'muted')
  assert.deepEqual(card.auxiliaryLabels, ['已停用'])
})

test('房源卡片对缺失租金和押金使用稳定文案', () => {
  assert.equal(formatHouseCardRent(null), '面议')
  assert.equal(formatHouseCardDeposit(null), '押金待确认')
})

test('收藏房源复用目标数据生成统一卡片模型', () => {
  const card = buildFavoriteHouseCardModel({
    target_id: '12',
    available: true,
    display: null,
    target: {
      id: 12,
      room_number: '1202',
      area: '76.50',
      asking_rent: '3650.00',
      deposit_amount: '3650.00',
      bedrooms: 3,
      living_rooms: 2,
      decoration__mapping: '豪装',
      has_elevator_access: true,
      images: [{ thumbnail: 'https://example.com/favorite.jpg' }],
      building: {
        name: '1栋1',
        estate: { display_name: '云栖花园', district: '增城区' },
      },
    },
  })

  assert.equal(card.title, '云栖花园 1栋1 1202')
  assert.equal(card.facts, '三室二厅 · 76.5㎡ · 有电梯')
  assert.equal(card.rentAmountText, '3,650')
  assert.equal(card.depositAmountText, '¥3,650')
})

test('已下架收藏使用展示快照生成同款卡片并标记状态', () => {
  const card = buildFavoriteHouseCardModel({
    target_id: '18',
    available: false,
    target: null,
    display: {
      title: '2栋 · 1801',
      subtitle: '云栖花园',
      cover_url: 'https://example.com/unavailable.jpg',
      facts: [
        { label: '月租', value: '¥4200' },
        { label: '面积', value: '88㎡' },
        { label: '户型', value: '三室一厅' },
      ],
    },
  })

  assert.equal(card.title, '2栋 · 1801')
  assert.equal(card.location, '云栖花园')
  assert.equal(card.facts, '88㎡ · 三室一厅')
  assert.equal(card.rentAmountText, '4,200')
  assert.equal(card.statusLabel, '已下架')
  assert.equal(card.statusTone, 'muted')
})

test('地铁筛选房源优先显示最近站点距离', () => {
  const model = buildHouseCardModel({
    id: 1,
    room_number: '1202',
    bedrooms: 1,
    living_rooms: 0,
    has_elevator_access: true,
    distance_m: 680,
    nearest_metro_station: { name: '世界之窗', line_names: ['1号线', '2号线'] },
    building: { name: '1栋', estate: { display_name: '世界花园', district: '南山区' } },
  })

  assert.equal(model.distanceText, '距世界之窗站 680m')
})
