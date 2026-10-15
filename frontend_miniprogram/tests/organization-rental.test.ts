import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildOrganizationBuildingPayload,
  buildOrganizationContactPayload,
  buildOrganizationEstatePayload,
  buildOrganizationHouseCreatePayload,
  buildOrganizationHousePatchPayload,
  buildOrganizationLeasePatchPayload,
  buildOrganizationScope,
  buildOrganizationViewingCreatePayload,
  canOpenOrganizationCapability,
  formatOrganizationHouseTitle,
  getAllocationRuleSourceLabel,
  getOrganizationAllocationActions,
  getOrganizationAllocationLeaseId,
  getOrganizationHouseLifecycleActions,
  getOrganizationLeaseStatusActions,
  getOrganizationLeaseStatusTone,
  getOrganizationViewingStatusTone,
  getVacancyBuildingMatchStatusLabel,
  getVacancyLineStatusLabel,
  getViewingActions,
  isUniActionCanceled,
} from '../src/pages-org-rental/domain/organization-rental.ts'
import {
  APP_ROUTES,
  getOrganizationAllocationDetailRoute,
  getOrganizationBuildingFormRoute,
  getOrganizationEstateFormRoute,
  getOrganizationHouseDetailRoute,
  getOrganizationHouseFormRoute,
  getOrganizationLeaseDetailRoute,
  getOrganizationLeaseFormRoute,
  getOrganizationSigningRoute,
  getOrganizationViewingDetailRoute,
  getOrganizationViewingFormRoute,
} from '../src/modules/routes.ts'

const testsDirectory = dirname(fileURLToPath(import.meta.url))
const sourceRoot = join(testsDirectory, '../src')

test('组织请求作用域显式携带 slug，且只有读取请求允许安全重放', () => {
  assert.deepEqual(buildOrganizationScope('alpha'), {
    requestScope: { kind: 'organization', organizationSlug: 'alpha' },
    authRetry: 'safe',
  })
  assert.deepEqual(buildOrganizationScope('alpha', 'never'), {
    requestScope: { kind: 'organization', organizationSlug: 'alpha' },
    authRetry: 'never',
  })
  assert.throws(() => buildOrganizationScope(''), /未选择组织/)
})

test('房表同步和收益规则来源使用清晰中文状态', () => {
  assert.equal(getVacancyBuildingMatchStatusLabel('matched'), '已匹配')
  assert.equal(getVacancyBuildingMatchStatusLabel('ambiguous'), '待选择')
  assert.equal(getVacancyBuildingMatchStatusLabel('created'), '已新建')
  assert.equal(getVacancyLineStatusLabel('valid'), '可同步')
  assert.equal(getVacancyLineStatusLabel('error'), '有错误')
  assert.equal(getAllocationRuleSourceLabel('default'), '系统默认')
  assert.equal(getAllocationRuleSourceLabel('organization'), '组织设置')
  assert.equal(getAllocationRuleSourceLabel('unknown'), '其他规则')
})

test('操作菜单取消不应误报业务失败', () => {
  assert.equal(isUniActionCanceled(new Error('showActionSheet:fail cancel')), true)
  assert.equal(isUniActionCanceled({ errMsg: 'showActionSheet:fail cancel' }), true)
  assert.equal(isUniActionCanceled({ message: 'cancel' }), true)
  assert.equal(isUniActionCanceled(new Error('network error')), false)
  assert.equal(isUniActionCanceled(null), false)
})

test('多行输入使用可见字段标题，不向 Textarea 传递不存在的 label 属性', () => {
  const pageSources = [
    readFileSync(join(sourceRoot, 'pages-org-rental/houses/form.vue'), 'utf8'),
    readFileSync(join(sourceRoot, 'pages-org-rental/contacts/index.vue'), 'utf8'),
    readFileSync(join(sourceRoot, 'pages-org-rental/leases/form.vue'), 'utf8'),
  ]
  for (const source of pageSources)
    assert.doesNotMatch(source, /<wd-textarea[^>]+\slabel=/)
  assert.match(pageSources[0], /<wd-cell title="公开描述" layout="vertical">/)
  assert.match(pageSources[0], /<wd-cell v-if="houseId" title="内部备注" layout="vertical">/)
  assert.match(pageSources[1], /<wd-cell title="备注" layout="vertical">/)
  assert.match(pageSources[2], /<wd-cell title="备注" layout="vertical">/)
})

test('只有已预约带看可以流转到后端支持的四个状态', () => {
  assert.deepEqual(getViewingActions('scheduled'), ['viewed', 'canceled', 'no_show', 'converted'])
  assert.deepEqual(getViewingActions('viewed'), [])
  assert.deepEqual(getViewingActions('canceled'), [])
  assert.deepEqual(getViewingActions('no_show'), [])
  assert.deepEqual(getViewingActions('converted'), [])
  assert.deepEqual(getViewingActions('unexpected'), [])
})

test('收益与分析入口严格按组织能力裁剪', () => {
  const capabilities = { allocation: true, analytics: false }
  assert.equal(canOpenOrganizationCapability(capabilities), true)
  assert.equal(canOpenOrganizationCapability(capabilities, 'allocation'), true)
  assert.equal(canOpenOrganizationCapability(capabilities, 'analytics'), false)
  assert.equal(canOpenOrganizationCapability(undefined, 'allocation'), false)
  assert.equal(canOpenOrganizationCapability({ allocation: [1] }, 'allocation'), false)
})

test('组织经营展示辅助统一房源标题和状态语义', () => {
  assert.equal(formatOrganizationHouseTitle({
    room_number: '1201',
    building: { name: '1号楼', estate: { display_name: '云栖苑', name: '云栖苑' } },
  }), '云栖苑 1号楼 1201')
  assert.equal(formatOrganizationHouseTitle({
    room_number: '8A',
    building: { name: '独栋', estate: null },
  }), '独栋 8A')
  assert.equal(getOrganizationViewingStatusTone('scheduled'), 'primary')
  assert.equal(getOrganizationViewingStatusTone('no_show'), 'warning')
  assert.equal(getOrganizationLeaseStatusTone('active'), 'success')
  assert.equal(getOrganizationLeaseStatusTone('terminated'), 'danger')
})

test('房源生命周期动作与管理端保持一致', () => {
  assert.deepEqual(getOrganizationHouseLifecycleActions('vacant'), ['publish', 'disable'])
  assert.deepEqual(getOrganizationHouseLifecycleActions('listed'), ['unpublish', 'disable'])
  assert.deepEqual(getOrganizationHouseLifecycleActions('rented'), ['disable'])
  assert.deepEqual(getOrganizationHouseLifecycleActions('renovating'), ['disable'])
  assert.deepEqual(getOrganizationHouseLifecycleActions('inactive'), [])
  assert.deepEqual(getOrganizationHouseLifecycleActions('unexpected'), [])
})

test('房源创建与编辑提交值沿用管理端的数字、标签和媒体引用归一化', () => {
  const values = {
    building_id: 12,
    landlord_id: null,
    room_number: ' 8A ',
    listing_type: 'whole' as const,
    floor: '',
    area: '68.5',
    interior_area: null,
    asking_rent: '3200',
    deposit_amount: undefined,
    bedrooms: '1',
    living_rooms: 0,
    bathrooms: '',
    kitchens: '',
    balconies: '',
    orientation: '',
    decoration: 'fine',
    has_elevator_access: true,
    images: [{ media_id: 3, url: 'derived' }, { media_id: 4, media_type: 'image' as const }],
    videos: [],
    tags: ' 近地铁，精装,近地铁 ',
    public_description: ' 采光好 ',
    internal_notes: ' 仅组织可见 ',
  }

  assert.deepEqual(buildOrganizationHouseCreatePayload(values), {
    building_id: 12,
    landlord_id: null,
    room_number: '8A',
    listing_type: 'whole',
    floor: 0,
    area: 68.5,
    interior_area: 0,
    asking_rent: 3200,
    deposit_amount: 0,
    bedrooms: 1,
    living_rooms: 0,
    bathrooms: 0,
    kitchens: 0,
    balconies: 0,
    orientation: null,
    decoration: 'fine',
    has_elevator_access: true,
    images: [{ media_id: 3, media_type: 'image' }, { media_id: 4, media_type: 'image' }],
    videos: [],
    tags: ['近地铁', '精装'],
    public_description: '采光好',
  })
  assert.deepEqual(buildOrganizationHousePatchPayload(values), {
    ...buildOrganizationHouseCreatePayload(values),
    internal_notes: '仅组织可见',
  })
})

test('小区和楼栋写入只提交移动端可维护字段并归一化空值', () => {
  assert.deepEqual(buildOrganizationEstatePayload({
    name: ' 云岸 ',
    display_name: ' 云岸花园 ',
    developer: ' ',
    built_year: '',
    property_type: 'residential',
    province: ' 广东 ',
    city: ' 深圳 ',
    district: ' 南山 ',
    subdistrict: ' 科技园 ',
    address: ' 科技园 ',
    description: ' 成熟社区 ',
  }), {
    name: '云岸',
    display_name: '云岸花园',
    developer: null,
    built_year: null,
    property_type: 'residential',
    province: '广东',
    city: '深圳',
    district: '南山',
    subdistrict: '科技园',
    address: '科技园',
    description: '成熟社区',
  })
  assert.deepEqual(buildOrganizationBuildingPayload({
    estate_id: null,
    name: ' 独立公寓 ',
    floors: '18',
    under_floors: '',
    year_built: null,
    elevator: true,
    address: ' 海滨路 20 号 ',
    tags: ' 近地铁，精装,近地铁 ',
  }), {
    estate_id: null,
    name: '独立公寓',
    floors: 18,
    under_floors: null,
    year_built: null,
    elevator: true,
    address: '海滨路 20 号',
    tags: ['近地铁', '精装'],
  })
})

test('主动带看提交清理客户资料并输出标准 ISO 时间', () => {
  assert.deepEqual(buildOrganizationViewingCreatePayload({
    house_id: 12,
    contact_id: null,
    customer_name: ' 李女士 ',
    customer_phone: ' 13900139000 ',
    scheduled_at: 1893456000000,
    assigned_to_id: null,
    notes: ' 提前联系 ',
  }), {
    house_id: 12,
    contact_id: null,
    customer_name: '李女士',
    customer_phone: '13900139000',
    scheduled_at: '2030-01-01T00:00:00.000Z',
    assigned_to_id: null,
    notes: '提前联系',
  })
})

test('联系人写入统一清理文本并保留多角色与启停状态', () => {
  assert.deepEqual(buildOrganizationContactPayload({
    name: ' 张三 ',
    phone: ' 13800138000 ',
    email: ' test@example.com ',
    roles: ['landlord', 'tenant', 'landlord'],
    notes: ' 重点客户 ',
    is_active: false,
  }), {
    name: '张三',
    phone: '13800138000',
    email: 'test@example.com',
    roles: ['landlord', 'tenant'],
    notes: '重点客户',
    is_active: false,
  })
})

test('租约编辑只提供后端允许的顺向状态动作并归一化提交值', () => {
  assert.deepEqual(getOrganizationLeaseStatusActions('pending'), ['active', 'terminated'])
  assert.deepEqual(getOrganizationLeaseStatusActions('active'), ['expired', 'terminated'])
  assert.deepEqual(getOrganizationLeaseStatusActions('expired'), [])
  assert.deepEqual(getOrganizationLeaseStatusActions('terminated'), [])
  assert.deepEqual(buildOrganizationLeasePatchPayload({
    house_id: 7,
    tenant_id: 9,
    source_viewing_record_id: null,
    sign_at: null,
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    monthly_rent: '4200',
    deposit: '',
    payment_day: '5',
    status: 'active',
    contract_files: [{ media_id: 19, url: 'derived' }],
    notes: ' 线下合同 ',
    extra: { channel: 'offline' },
  }), {
    house_id: 7,
    tenant_id: 9,
    source_viewing_record_id: null,
    sign_at: null,
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    monthly_rent: 4200,
    deposit: null,
    payment_day: 5,
    status: 'active',
    contract_files: [{ media_id: 19, media_type: 'file' }],
    notes: '线下合同',
    extra: { channel: 'offline' },
  })
})

test('收益审核动作严格使用后端能力和申请状态，租约标识从来源快照解析', () => {
  const pending = { status: 'pending', source_snapshot: { lease_id: 31 } }
  const approved = { status: 'approved', source_snapshot: { lease_id: '32' } }
  assert.deepEqual(getOrganizationAllocationActions(pending, { review: true, void: true }), ['approve', 'reject'])
  assert.deepEqual(getOrganizationAllocationActions(pending, { review: false, void: true }), [])
  assert.deepEqual(getOrganizationAllocationActions(approved, { review: true, void: true }), ['void'])
  assert.deepEqual(getOrganizationAllocationActions(approved, { review: true, void: false }), [])
  assert.equal(getOrganizationAllocationLeaseId(pending), 31)
  assert.equal(getOrganizationAllocationLeaseId(approved), 32)
  assert.equal(getOrganizationAllocationLeaseId({ status: 'pending', source_snapshot: {} }), null)
})

test('组织经营分包声明全部真实路由和详情路由构造器', () => {
  assert.equal(APP_ROUTES.organizationRental, '/pages-org-rental/index')
  assert.equal(APP_ROUTES.organizationHouses, '/pages-org-rental/houses/index')
  assert.equal(APP_ROUTES.organizationHouseForm, '/pages-org-rental/houses/form')
  assert.equal(APP_ROUTES.organizationEstates, '/pages-org-rental/estates/index')
  assert.equal(APP_ROUTES.organizationEstateForm, '/pages-org-rental/estates/form')
  assert.equal(APP_ROUTES.organizationBuildings, '/pages-org-rental/buildings/index')
  assert.equal(APP_ROUTES.organizationBuildingForm, '/pages-org-rental/buildings/form')
  assert.equal(APP_ROUTES.organizationMap, '/pages-org-rental/map/index')
  assert.equal(APP_ROUTES.organizationVacancySync, '/pages-org-rental/vacancy-sync/index')
  assert.equal(APP_ROUTES.organizationContacts, '/pages-org-rental/contacts/index')
  assert.equal(APP_ROUTES.organizationViewings, '/pages-org-rental/viewings/index')
  assert.equal(APP_ROUTES.organizationViewingForm, '/pages-org-rental/viewings/form')
  assert.equal(APP_ROUTES.organizationLeases, '/pages-org-rental/leases/index')
  assert.equal(APP_ROUTES.organizationLeaseForm, '/pages-org-rental/leases/form')
  assert.equal(APP_ROUTES.organizationSigning, '/pages-org-rental/signing/index')
  assert.equal(APP_ROUTES.organizationAllocation, '/pages-org-rental/allocation/index')
  assert.equal(APP_ROUTES.organizationAllocationDetail, '/pages-org-rental/allocation/detail')
  assert.equal(APP_ROUTES.organizationAnalytics, '/pages-org-rental/analytics/index')
  assert.equal(getOrganizationHouseDetailRoute(12), '/pages-org-rental/houses/detail?id=12')
  assert.equal(getOrganizationHouseFormRoute(), '/pages-org-rental/houses/form')
  assert.equal(getOrganizationHouseFormRoute(12), '/pages-org-rental/houses/form?id=12')
  assert.equal(getOrganizationEstateFormRoute(), '/pages-org-rental/estates/form')
  assert.equal(getOrganizationEstateFormRoute(8), '/pages-org-rental/estates/form?id=8')
  assert.equal(getOrganizationBuildingFormRoute(), '/pages-org-rental/buildings/form')
  assert.equal(getOrganizationBuildingFormRoute(9), '/pages-org-rental/buildings/form?id=9')
  assert.equal(getOrganizationViewingDetailRoute(13), '/pages-org-rental/viewings/detail?id=13')
  assert.equal(getOrganizationViewingFormRoute(), '/pages-org-rental/viewings/form')
  assert.equal(getOrganizationViewingFormRoute(12), '/pages-org-rental/viewings/form?houseId=12')
  assert.equal(getOrganizationLeaseDetailRoute(14), '/pages-org-rental/leases/detail?id=14')
  assert.equal(getOrganizationLeaseFormRoute(14), '/pages-org-rental/leases/form?id=14')
  assert.equal(getOrganizationAllocationDetailRoute(18), '/pages-org-rental/allocation/detail?id=18')
  assert.equal(getOrganizationSigningRoute(15), '/pages-org-rental/signing/index?viewingId=15')
})

test('组织经营页面齐全、无占位文案，并遵守 page 到分包 API 再到内部 client 的边界', () => {
  const pagePaths = [
    'pages-org-rental/index.vue',
    'pages-org-rental/houses/index.vue',
    'pages-org-rental/houses/detail.vue',
    'pages-org-rental/houses/form.vue',
    'pages-org-rental/estates/index.vue',
    'pages-org-rental/estates/form.vue',
    'pages-org-rental/buildings/index.vue',
    'pages-org-rental/buildings/form.vue',
    'pages-org-rental/map/index.vue',
    'pages-org-rental/vacancy-sync/index.vue',
    'pages-org-rental/contacts/index.vue',
    'pages-org-rental/viewings/index.vue',
    'pages-org-rental/viewings/form.vue',
    'pages-org-rental/viewings/detail.vue',
    'pages-org-rental/leases/index.vue',
    'pages-org-rental/leases/detail.vue',
    'pages-org-rental/leases/form.vue',
    'pages-org-rental/signing/index.vue',
    'pages-org-rental/allocation/index.vue',
    'pages-org-rental/allocation/detail.vue',
    'pages-org-rental/analytics/index.vue',
  ]
  const apiPath = join(sourceRoot, 'pages-org-rental/api/organization-rental.ts')
  const clientPath = join(sourceRoot, 'pages-org-rental/api/client.ts')

  for (const relativePath of pagePaths) {
    const path = join(sourceRoot, relativePath)
    assert.equal(existsSync(path), true, `${relativePath} 应存在`)
    const source = readFileSync(path, 'utf8')
    assert.equal(source.includes('@/services/openapi'), false, `${relativePath} 不得直接导入 OpenAPI`)
    assert.equal(/uni\.(?:request|uploadFile|login)\s*\(/.test(source), false, `${relativePath} 不得直接调用底层网络`)
    assert.equal(/敬请期待|归入分包|占位/.test(source), false, `${relativePath} 不得包含占位文案`)
  }

  assert.equal(existsSync(apiPath), true)
  assert.equal(existsSync(clientPath), true)
  const apiSource = readFileSync(apiPath, 'utf8')
  const clientSource = readFileSync(clientPath, 'utf8')
  assert.equal(apiSource.includes('@/services/openapi'), false)
  assert.equal(apiSource.includes('./client'), true)
  assert.equal(clientSource.includes('@/services/openapi/guanli'), true)
  assert.equal(clientSource.includes('@/services/openapi/shouyifenpei'), true)
  assert.equal(clientSource.includes('@/services/openapi/jingyingfenxi'), true)
  assert.equal(clientSource.includes('pingtaiguanli'), false)
  assert.equal(clientSource.includes('buildOrganizationScope'), true)
})

test('小区、楼栋和主动带看页面形成新增编辑闭环且不暴露删除能力', () => {
  const apiSource = readFileSync(join(sourceRoot, 'pages-org-rental/api/organization-rental.ts'), 'utf8')
  const clientSource = readFileSync(join(sourceRoot, 'pages-org-rental/api/client.ts'), 'utf8')
  const estateListSource = readFileSync(join(sourceRoot, 'pages-org-rental/estates/index.vue'), 'utf8')
  const buildingListSource = readFileSync(join(sourceRoot, 'pages-org-rental/buildings/index.vue'), 'utf8')
  const viewingListSource = readFileSync(join(sourceRoot, 'pages-org-rental/viewings/index.vue'), 'utf8')
  const houseDetailSource = readFileSync(join(sourceRoot, 'pages-org-rental/houses/detail.vue'), 'utf8')
  const estateFormSource = readFileSync(join(sourceRoot, 'pages-org-rental/estates/form.vue'), 'utf8')
  const buildingFormSource = readFileSync(join(sourceRoot, 'pages-org-rental/buildings/form.vue'), 'utf8')
  const viewingFormSource = readFileSync(join(sourceRoot, 'pages-org-rental/viewings/form.vue'), 'utf8')

  for (const functionName of [
    'getOrganizationEstate',
    'createOrganizationEstate',
    'patchOrganizationEstate',
    'getOrganizationBuilding',
    'createOrganizationBuilding',
    'patchOrganizationBuilding',
    'createOrganizationViewing',
  ])
    assert.match(apiSource, new RegExp(`function ${functionName}`), functionName)

  assert.match(clientSource, /houseEstatesEstateIdUsingGet/)
  assert.match(clientSource, /houseEstatesUsingPost/)
  assert.match(clientSource, /houseEstatesEstateIdUsingPatch/)
  assert.match(clientSource, /houseBuildingsBuildingIdUsingGet/)
  assert.match(clientSource, /houseBuildingsUsingPost/)
  assert.match(clientSource, /houseBuildingsBuildingIdUsingPatch/)
  assert.match(clientSource, /houseViewingRecordsUsingPost/)
  assert.match(estateListSource, /getOrganizationEstateFormRoute/)
  assert.match(buildingListSource, /getOrganizationBuildingFormRoute/)
  assert.match(viewingListSource, /getOrganizationViewingFormRoute/)
  assert.match(houseDetailSource, /getOrganizationViewingFormRoute\(house\.value\.id\)/)
  assert.match(estateFormSource, /buildOrganizationEstatePayload/)
  assert.match(buildingFormSource, /buildOrganizationBuildingPayload/)
  assert.match(viewingFormSource, /buildOrganizationViewingCreatePayload/)
  assert.doesNotMatch(`${estateFormSource}\n${buildingFormSource}\n${viewingFormSource}`, /remove|delete|删除/i)
  assert.doesNotMatch(`${estateFormSource}\n${buildingFormSource}`, /\b(?:images|lat|lng)\b/)
})

test('组织经营写入页面只经分包 API 调用真实 CRUD、生命周期和审核接口', () => {
  const apiSource = readFileSync(join(sourceRoot, 'pages-org-rental/api/organization-rental.ts'), 'utf8')
  const clientSource = readFileSync(join(sourceRoot, 'pages-org-rental/api/client.ts'), 'utf8')
  const houseFormSource = readFileSync(join(sourceRoot, 'pages-org-rental/houses/form.vue'), 'utf8')
  const contactSource = readFileSync(join(sourceRoot, 'pages-org-rental/contacts/index.vue'), 'utf8')
  const leaseFormSource = readFileSync(join(sourceRoot, 'pages-org-rental/leases/form.vue'), 'utf8')
  const allocationDetailSource = readFileSync(join(sourceRoot, 'pages-org-rental/allocation/detail.vue'), 'utf8')

  for (const functionName of [
    'createOrganizationHouse',
    'patchOrganizationHouse',
    'uploadOrganizationHouseImages',
    'createOrganizationContact',
    'patchOrganizationContact',
    'patchOrganizationLease',
    'getAllocationRequest',
    'reviewOrganizationAllocation',
    'voidOrganizationAllocation',
  ]) {
    assert.match(apiSource, new RegExp(`function ${functionName}`), functionName)
  }
  assert.match(clientSource, /houseHousesUsingPost/)
  assert.match(clientSource, /houseHousesHouseIdUsingPatch/)
  assert.match(clientSource, /houseContactsUsingPost/)
  assert.match(clientSource, /houseContactsContactIdUsingPatch/)
  assert.match(clientSource, /houseLeasesLeaseIdUsingPatch/)
  assert.match(clientSource, /allocationRequestsAllocationRequestIdUsingGet/)
  assert.match(clientSource, /houseLeasesLeaseIdAllocationReviewUsingPost/)
  assert.match(clientSource, /houseLeasesLeaseIdAllocationOpenApiVoidUsingPost/)
  assert.match(houseFormSource, /buildOrganizationHouseCreatePayload/)
  assert.match(houseFormSource, /buildOrganizationHousePatchPayload/)
  assert.match(contactSource, /buildOrganizationContactPayload/)
  assert.match(leaseFormSource, /buildOrganizationLeasePatchPayload/)
  assert.match(allocationDetailSource, /getOrganizationAllocationActions/)
})

test('签约表单和带看详情使用真实收益提交能力，不把导航能力当作提交权限', () => {
  const signingSource = readFileSync(join(sourceRoot, 'pages-org-rental/signing/index.vue'), 'utf8')
  const viewingDetailSource = readFileSync(join(sourceRoot, 'pages-org-rental/viewings/detail.vue'), 'utf8')

  assert.match(signingSource, /getAllocationCapabilities/)
  assert.match(signingSource, /allocationCapabilities\.value\?\.submit/)
  assert.match(signingSource, /loadSigningContext/)
  assert.match(viewingDetailSource, /getAllocationCapabilities/)
  assert.match(viewingDetailSource, /canSubmitSigning/)
  assert.doesNotMatch(viewingDetailSource, /appContextStore\.capabilities\.allocation/)
})

test('房表同步支持歧义楼栋覆盖、错误行忽略和预览失效保护', () => {
  const pageSource = readFileSync(join(sourceRoot, 'pages-org-rental/vacancy-sync/index.vue'), 'utf8')
  const apiSource = readFileSync(join(sourceRoot, 'pages-org-rental/api/organization-rental.ts'), 'utf8')

  assert.match(pageSource, /result\.blocks/)
  assert.match(pageSource, /building_match\.candidates/)
  assert.match(pageSource, /building_overrides/)
  assert.match(pageSource, /ignored_lines/)
  assert.match(pageSource, /previewStale/)
  assert.match(pageSource, /invalidatePreview/)
  assert.match(apiSource, /payload: VacancySyncIn/)
})

test('pages.json 中每个分包 root 只声明一次', () => {
  const pagesSource = readFileSync(join(sourceRoot, 'pages.json'), 'utf8')
  const roots = [...pagesSource.matchAll(/"root"\s*:\s*"([^"]+)"/g)].map(match => match[1])
  assert.equal(roots.length, new Set(roots).size)
  assert.equal(roots.filter(root => root === 'pages-org-rental').length, 1)
})

test('分页列表刷新失败后重试仍按第一页替换，避免旧数据重复追加', () => {
  const retryLoaders: Record<string, string> = {
    'pages-org-rental/houses/index.vue': 'list.refresh',
    'pages-org-rental/estates/index.vue': 'list.refresh',
    'pages-org-rental/buildings/index.vue': 'list.refresh',
    'pages-org-rental/contacts/index.vue': 'contactPage.refresh',
    'pages-org-rental/viewings/index.vue': 'list.refresh',
    'pages-org-rental/leases/index.vue': 'list.refresh',
  }

  for (const [relativePath, loader] of Object.entries(retryLoaders)) {
    const source = readFileSync(join(sourceRoot, relativePath), 'utf8')
    const retryExpression = loader.replace('.', '\\.')
    assert.match(source, new RegExp(`@retry="${retryExpression}"`), relativePath)
  }

  const allocationSource = readFileSync(join(sourceRoot, 'pages-org-rental/allocation/index.vue'), 'utf8')
  assert.match(allocationSource, /@retry="totalPage\.refresh"/)
  assert.match(allocationSource, /@retry="requestPage\.refresh"/)
})

test('房表预览失效比较覆盖完整输入且忽略数组顺序', async () => {
  const domain = await import('../src/pages-org-rental/domain/organization-rental.ts')
  const previewInput = {
    raw_text: '一号楼\n101单间1200',
    building_overrides: [
      { block_index: 1, building_id: 22 },
      { block_index: 0, building_id: 11 },
    ],
    ignored_lines: [8, 3],
  }

  assert.equal(domain.isVacancySyncPreviewStale(previewInput, {
    raw_text: previewInput.raw_text,
    building_overrides: [...previewInput.building_overrides].reverse(),
    ignored_lines: [...previewInput.ignored_lines].reverse(),
  }), false)
  assert.equal(domain.isVacancySyncPreviewStale(previewInput, {
    raw_text: previewInput.raw_text,
    building_overrides: [],
    ignored_lines: previewInput.ignored_lines,
  }), true)
  assert.equal(domain.isVacancySyncPreviewStale(previewInput, {
    raw_text: previewInput.raw_text,
    building_overrides: previewInput.building_overrides,
    ignored_lines: [],
  }), true)
  assert.equal(domain.isVacancySyncPreviewStale(previewInput, {
    ...previewInput,
    raw_text: `${previewInput.raw_text}\n102单间1300`,
  }), true)
})

test('房表输入使用 v-model 更新事件立即清理旧覆盖项与忽略行', () => {
  const pageSource = readFileSync(join(sourceRoot, 'pages-org-rental/vacancy-sync/index.vue'), 'utf8')
  assert.match(pageSource, /@update:model-value="updateRawText"/)
  assert.match(pageSource, /rawText\.value = value/)
  assert.match(pageSource, /invalidatePreview\(\)/)
  assert.doesNotMatch(pageSource, /wd-textarea[^>]+@change=/)
})

test('地图按平台渲染，小程序使用原生地图而 H5 使用高德地图', () => {
  const pageSource = readFileSync(join(sourceRoot, 'pages-org-rental/map/index.vue'), 'utf8')
  assert.match(pageSource, /#ifdef MP-WEIXIN[\s\S]*<map/)
  assert.match(pageSource, /#ifdef H5[\s\S]*<HouseH5Map/)
  assert.match(pageSource, /unlocated=1/)
})

test('默认业务日期按本地年月日生成，不使用 UTC 字符串切片', async () => {
  const domain = await import('../src/pages-org-rental/domain/organization-rental.ts')
  assert.equal(domain.formatOrganizationLocalDate(new Date(2026, 8, 6, 0, 5)), '2026-09-06')
  assert.equal(domain.formatOrganizationLocalDate(new Date(2026, 0, 2, 23, 59)), '2026-01-02')

  const domainSource = readFileSync(join(sourceRoot, 'pages-org-rental/domain/organization-rental.ts'), 'utf8')
  const helperSource = domainSource.slice(domainSource.indexOf('function formatOrganizationLocalDate'), domainSource.indexOf('function formatOrganizationLocalDate') + 500)
  assert.doesNotMatch(helperSource, /toISOString/)
  for (const relativePath of ['pages-org-rental/signing/index.vue', 'pages-org-rental/analytics/index.vue']) {
    const source = readFileSync(join(sourceRoot, relativePath), 'utf8')
    assert.match(source, /formatOrganizationLocalDate/)
    assert.doesNotMatch(source, /toISOString\(\)\.slice\(0, 10\)/)
  }
})

test('可搜索分页列表允许新 reset 抢占旧请求且只应用最后一次结果', () => {
  const componentizedListPages = [
    'pages-org-rental/houses/index.vue',
    'pages-org-rental/estates/index.vue',
    'pages-org-rental/buildings/index.vue',
    'pages-org-rental/contacts/index.vue',
    'pages-org-rental/viewings/index.vue',
    'pages-org-rental/leases/index.vue',
  ]
  for (const relativePath of componentizedListPages) {
    const source = readFileSync(join(sourceRoot, relativePath), 'utf8')
    assert.match(source, /usePagedPage/, relativePath)
    assert.match(source, /AppPagedList/, relativePath)
  }

  const pagedPageSource = readFileSync(join(sourceRoot, 'hooks/usePagedPage.ts'), 'utf8')
  assert.match(pagedPageSource, /let generation = 0/)
  assert.match(pagedPageSource, /const currentGeneration = \+\+generation/)
  assert.match(pagedPageSource, /if \(currentGeneration !== generation\)/)
  assert.match(pagedPageSource, /if \(currentGeneration === generation\)/)
})

test('带看状态更新使用全局提交锁阻止并发动作', () => {
  const pageSource = readFileSync(join(sourceRoot, 'pages-org-rental/viewings/detail.vue'), 'utf8')
  assert.match(pageSource, /if \(updatingAction\.value \|\|/)
  assert.match(pageSource, /:disabled="updatingAction !== null"/)
})

test('登记签约入口使用当前 Carbon 图标集中存在的图标', () => {
  const source = readFileSync(join(sourceRoot, 'features/organization-workbench/OrganizationWorkbench.vue'), 'utf8')

  assert.match(source, /i-carbon-document-signed/)
  assert.doesNotMatch(source, /i-carbon-signature/)
})

test('坐标维护保留旧值，明确清除才提交 null，未操作时不写 location', () => {
  const building = { estate_id: null, name: 'A栋', floors: 3, elevator: false, address: '测试地址' }
  const estate = { name: '测试小区', display_name: '测试小区', property_type: 'residential', province: '广东', city: '广州', district: '天河' }
  const location = { longitude: 113.3, latitude: 23.1, coordinate_system: 'gcj02' as const }
  assert.equal(Object.hasOwn(buildOrganizationBuildingPayload(building), 'location'), false)
  assert.deepEqual(buildOrganizationBuildingPayload({ ...building, location }).location, location)
  assert.equal(buildOrganizationBuildingPayload({ ...building, location: null }).location, null)
  assert.equal(Object.hasOwn(buildOrganizationEstatePayload(estate), 'location'), false)
  assert.deepEqual(buildOrganizationEstatePayload({ ...estate, location }).location, location)
  assert.equal(buildOrganizationEstatePayload({ ...estate, location: null }).location, null)
})
