import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as routes from '../src/modules/routes.ts'

const testsDirectory = dirname(fileURLToPath(import.meta.url))
const sourceRoot = join(testsDirectory, '../src')
const domainPath = join(sourceRoot, 'domain/organization-admin.ts')

test('组织管理入口按工作区能力稳定裁剪', async () => {
  assert.equal(existsSync(domainPath), true, 'domain/organization-admin.ts 应存在')
  const domain = await import('../src/domain/organization-admin.ts')
  const sections = domain.getOrganizationAdminSections({
    invite_manage: true,
    member_manage: true,
    notification_dispatches: false,
    organization_settings: true,
    responsibility_manage: true,
    role_management: true,
    subscriptions: false,
    team_create: true,
    team_settings: true,
  })
  assert.deepEqual(sections.map((item: { key: string }) => item.key), ['members', 'invitations', 'teams', 'roles', 'responsibilities', 'settings'])
  assert.deepEqual(domain.getOrganizationAdminSections({ team_member_manage_ids: [4] }).map((item: { key: string }) => item.key), ['teams'])
})

test('团队动作严格按各自 capability id 判断', async () => {
  const domain = await import('../src/domain/organization-admin.ts')
  const capabilities = {
    team_update_ids: [2],
    team_delete_ids: [3],
    team_member_manage_ids: [4],
    team_role_view_ids: [5],
    team_role_manage_ids: [6],
  }
  assert.equal(domain.canManageTeam(capabilities, 2), true)
  assert.equal(domain.canManageTeam(capabilities, 3), false)
  assert.equal(domain.canManageTeam(capabilities, 3, 'delete'), true)
  assert.equal(domain.canManageTeam(capabilities, 4, 'member'), true)
  assert.equal(domain.canManageTeam(capabilities, 5, 'role_view'), true)
  assert.equal(domain.canManageTeam(capabilities, 6, 'role_manage'), true)
  assert.equal(domain.canManageTeam(capabilities, 2, 'delete'), false)
})

test('设置入口按可查看范围选择安全的初始 scope', async () => {
  const domain = await import('../src/domain/organization-admin.ts')

  assert.equal(domain.resolveOrganizationSettingsTeamId({ organization_settings: true, team_settings_view_ids: [3] }, 0), 0)
  assert.equal(domain.resolveOrganizationSettingsTeamId({ organization_settings: false, team_settings_view_ids: [3, 5] }, 0), 3)
  assert.equal(domain.resolveOrganizationSettingsTeamId({ organization_settings: false, team_settings_view_ids: [3, 5] }, 5), 5)
  assert.equal(domain.resolveOrganizationSettingsTeamId({ organization_settings: false, team_settings_view_ids: [3, 5] }, 9), 3)
  assert.equal(domain.resolveOrganizationSettingsTeamId({ organization_settings: true, team_settings_view_ids: [3, 5] }, 9), 0)
})

test('角色入口按角色管理能力选择可访问 scope', async () => {
  const domain = await import('../src/domain/organization-admin.ts')

  assert.equal(domain.resolveOrganizationRoleTeamId({ role_view: true, role_manage: false, team_role_view_ids: [3], team_role_manage_ids: [] }, 0), 0)
  assert.equal(domain.resolveOrganizationRoleTeamId({ role_view: false, role_manage: false, team_role_view_ids: [3, 5], team_role_manage_ids: [] }, 0), 3)
  assert.equal(domain.resolveOrganizationRoleTeamId({ role_view: false, role_manage: false, team_role_view_ids: [3], team_role_manage_ids: [5] }, 5), 5)
  assert.equal(domain.resolveOrganizationRoleTeamId({ role_view: false, role_manage: false, team_role_view_ids: [3], team_role_manage_ids: [5] }, 9), 3)
  assert.equal(domain.resolveOrganizationRoleTeamId({ role_view: false, role_manage: true, team_role_view_ids: [3], team_role_manage_ids: [] }, 9), 0)
})

test('角色管理 scope 选项包含组织和全部可访问团队', async () => {
  const domain = await import('../src/domain/organization-admin.ts')

  assert.deepEqual(domain.getOrganizationRoleScopeOptions({
    teams: [{ id: 3, name: '运营组' }, { id: 5, name: '签约组' }],
    capabilities: { role_view: true, role_manage: false, team_role_view_ids: [3, 5], team_role_manage_ids: [] },
  }), [
    { label: '组织级角色', value: 0 },
    { label: '运营组', value: 3 },
    { label: '签约组', value: 5 },
  ])
  assert.deepEqual(domain.getOrganizationRoleScopeOptions({
    teams: [{ id: 3, name: '运营组' }, { id: 5, name: '签约组' }],
    capabilities: { role_view: false, role_manage: false, team_role_view_ids: [3], team_role_manage_ids: [5] },
  }), [
    { label: '运营组', value: 3 },
    { label: '签约组', value: 5 },
  ])
})

test('角色页使用专用角色管理导航决定 scope', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/roles/index.vue'), 'utf8')

  assert.match(source, /RoleManagementNavigationOut/)
  assert.match(source, /getOrganizationRoleManagementNavigation/)
  assert.match(source, /resolveOrganizationRoleTeamId/)
  assert.doesNotMatch(source, /\bgetOrganizationAdminNavigation\s*\(/)
})

test('角色页可在专用导航返回的全部 scope 间切换并重载数据', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/roles/index.vue'), 'utf8')

  assert.match(source, /getOrganizationRoleScopeOptions/)
  assert.match(source, /navigation\.value\.teams/)
  assert.match(source, /function switchRoleScope/)
  assert.match(source, /selectedRole\.value = null/)
  assert.match(source, /roleMembers\.value = \[\]/)
  assert.match(source, /await loadRoles\(\)/)
  assert.match(source, /<wd-picker[^>]+@confirm="switchRoleScope"/)
})

test('快速切换角色时成员弹层只接受最后一次请求结果', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/roles/index.vue'), 'utf8')

  assert.match(source, /createLatestRequestGuard/)
  assert.match(source, /const roleMembersRequestGuard = createLatestRequestGuard\(\)/)
  assert.match(source, /const requestGeneration = roleMembersRequestGuard\.begin\(\)/)
  assert.match(source, /const organizationSlugSnapshot = appContextStore\.organizationSlug/)
  assert.match(source, /const teamIdSnapshot = teamId\.value/)
  assert.match(source, /selectedRole\.value\?\.id !== role\.id/)
  assert.match(source, /!roleMembersRequestGuard\.isCurrent\(requestGeneration\)/)
  assert.match(source, /roleMembersRequestGuard\.invalidate\(\)/)
  assert.match(source, /function closeRoleMembers\(\)/)
  assert.match(source, /<wd-popup[^>]+@close="closeRoleMembers"/)
})

test('角色页离开时使成员请求失效并关闭成员弹层', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/roles/index.vue'), 'utf8')

  assert.match(source, /import \{ onHide, onLoad, onUnload \} from '@dcloudio\/uni-app'/)
  assert.match(source, /function closeRoleMembers\(\) \{[\s\S]*roleMembersRequestGuard\.invalidate\(\)[\s\S]*selectedRole\.value = null[\s\S]*roleMembers\.value = \[\][\s\S]*membersVisible\.value = false[\s\S]*\}/)
  assert.match(source, /onHide\(closeRoleMembers\)/)
  assert.match(source, /onUnload\(closeRoleMembers\)/)
})

test('团队设置不依赖需要成员查看权限的组织架构摘要', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/settings/index.vue'), 'utf8')

  assert.match(source, /listAllOrganizationAdminTeams/)
  assert.doesNotMatch(source, /\bgetOrganizationAdminNavigation\s*\(/)
})

test('团队详情按独立团队能力加载且成员候选不依赖组织成员查看权限', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/teams/detail.vue'), 'utf8')

  assert.match(source, /getOrganizationAdminNavigationCapabilities/)
  assert.match(source, /team_update_ids/)
  assert.match(source, /team_member_manage_ids/)
  assert.match(source, /listAllOrganizationTeamMemberCandidates/)
  assert.doesNotMatch(source, /\bgetOrganizationAdminNavigation\s*\(/)
  assert.doesNotMatch(source, /listAllOrganizationAdminMembers/)
})

test('组织管理危险载荷和支付环境保持租户边界', async () => {
  const domain = await import('../src/domain/organization-admin.ts')
  assert.deepEqual(domain.organizationAdminRequestOptions(' demo '), {
    requestScope: { kind: 'organization', organizationSlug: 'demo' },
    authRetry: 'safe',
  })
  assert.deepEqual(domain.organizationAdminRequestOptions('demo', 'never'), {
    requestScope: { kind: 'organization', organizationSlug: 'demo' },
    authRetry: 'never',
  })
  assert.throws(() => domain.organizationAdminRequestOptions(''), /未选择组织/)
  assert.equal(domain.resolveSubscriptionPaymentMode('h5'), 'native')
  assert.equal(domain.resolveSubscriptionPaymentMode('mp-weixin'), 'miniprogram')
  assert.deepEqual(domain.buildTenantDispatchScope('organization', 12, []), { scope: 'organization', scope_ids: [12] })
  assert.deepEqual(domain.buildTenantDispatchScope('teams', 12, [3, 5]), { scope: 'teams', scope_ids: [3, 5] })
  assert.throws(() => domain.buildTenantDispatchScope('platform', 12, []), /有效的接收对象/)
  assert.equal(domain.isEmptyResponsibilitySelection({ landlord_ids: [], building_ids: [], estate_ids: [] }), true)
})

test('订阅订单幂等键使用固定短格式并满足后端长度限制', async () => {
  const domain = await import('../src/domain/organization-admin.ts')
  const key = domain.createSubscriptionIdempotencyKey(() => 1_725_600_000_000, () => 0.123456789)

  assert.equal(key.length <= 64, true)
  assert.match(key, /^sub-[a-z0-9]+-[a-z0-9]+$/)
  assert.equal(key.includes('organization-slug'), false)
  assert.equal(key.includes('plan-code'), false)
})

test('订阅购买意图相同则复用幂等键，套餐、周期或支付模式变化则换键', async () => {
  const domain = await import('../src/domain/organization-admin.ts')
  const keys = ['sub-first', 'sub-organization', 'sub-plan', 'sub-cycle', 'sub-mode']
  const keyFactory = () => keys.shift() || 'sub-fallback'
  const first = domain.getSubscriptionPurchaseIntent(null, { organizationSlug: 'organization-a', planCode: 'professional', billingCycle: 'monthly', paymentMode: 'native' }, keyFactory)

  assert.equal(domain.getSubscriptionPurchaseIntent(first, { organizationSlug: 'organization-a', planCode: 'professional', billingCycle: 'monthly', paymentMode: 'native' }, keyFactory), first)
  assert.equal(domain.getSubscriptionPurchaseIntent(first, { organizationSlug: 'organization-b', planCode: 'professional', billingCycle: 'monthly', paymentMode: 'native' }, keyFactory).idempotencyKey, 'sub-organization')
  assert.equal(domain.getSubscriptionPurchaseIntent(first, { organizationSlug: 'organization-a', planCode: 'enterprise', billingCycle: 'monthly', paymentMode: 'native' }, keyFactory).idempotencyKey, 'sub-plan')
  assert.equal(domain.getSubscriptionPurchaseIntent(first, { organizationSlug: 'organization-a', planCode: 'professional', billingCycle: 'yearly', paymentMode: 'native' }, keyFactory).idempotencyKey, 'sub-cycle')
  assert.equal(domain.getSubscriptionPurchaseIntent(first, { organizationSlug: 'organization-a', planCode: 'professional', billingCycle: 'monthly', paymentMode: 'miniprogram' }, keyFactory).idempotencyKey, 'sub-mode')
})

test('订阅下单仅在未知结果时保留购买意图', async () => {
  const { AppError } = await import('../src/core/errors/app-error.ts')
  const domain = await import('../src/domain/organization-admin.ts')
  const intent = domain.getSubscriptionPurchaseIntent(null, { organizationSlug: 'organization-a', planCode: 'professional', billingCycle: 'monthly', paymentMode: 'native' }, () => 'sub-attempt')

  assert.equal(domain.resolveSubscriptionPurchaseIntentAfterOrderAttempt(intent), null)
  assert.equal(domain.resolveSubscriptionPurchaseIntentAfterOrderAttempt(intent, new AppError({ kind: 'business', message: '套餐不可购买' })), null)
  assert.equal(domain.resolveSubscriptionPurchaseIntentAfterOrderAttempt(intent, new AppError({ kind: 'validation', message: '参数错误' })), null)
  assert.equal(domain.resolveSubscriptionPurchaseIntentAfterOrderAttempt(intent, new AppError({ kind: 'network', message: '网络中断', retryable: true })), intent)
  assert.equal(domain.resolveSubscriptionPurchaseIntentAfterOrderAttempt(intent, new AppError({ kind: 'timeout', message: '请求超时', retryable: true })), intent)
  assert.equal(domain.resolveSubscriptionPurchaseIntentAfterOrderAttempt(intent, new AppError({ kind: 'unexpected', message: '服务暂不可用', statusCode: 503, retryable: true })), intent)
})

test('订阅页复用购买意图并在订单创建后改走继续支付入口', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/subscription/index.vue'), 'utf8')

  assert.match(source, /let purchaseIntent: SubscriptionPurchaseIntent \| null = null/)
  assert.match(source, /getSubscriptionPurchaseIntent\(purchaseIntent/)
  assert.match(source, /idempotency_key: intent\.idempotencyKey/)
  assert.match(source, /resolveSubscriptionPurchaseIntentAfterOrderAttempt\(intent, error\)/)
  assert.match(source, /purchaseIntent = resolveSubscriptionPurchaseIntentAfterOrderAttempt\(intent\)[\s\S]*await requestPayment\(order\)/)
  assert.match(source, /订单已创建，请在支付记录中继续支付/)
})

test('微信小程序支付从真实 checkout payment_params 生成顶层请求参数', async () => {
  const domain = await import('../src/domain/organization-admin.ts')
  const paymentRequest = domain.resolveSubscriptionPaymentRequest({
    payment_params: {
      timeStamp: '1725600000',
      nonceStr: 'nonce-from-wechat',
      package: 'prepay_id=wx-prepay-id',
      signType: 'RSA',
      paySign: 'signed-by-backend',
    },
  }, 'miniprogram')

  assert.deepEqual(paymentRequest, {
    kind: 'miniprogram',
    options: {
      provider: 'wxpay',
      timeStamp: '1725600000',
      nonceStr: 'nonce-from-wechat',
      package: 'prepay_id=wx-prepay-id',
      signType: 'RSA',
      paySign: 'signed-by-backend',
    },
  })
  assert.equal('payment_params' in paymentRequest.options, false)
})

test('H5 Native 支付继续读取 checkout code_url', async () => {
  const domain = await import('../src/domain/organization-admin.ts')

  assert.deepEqual(domain.resolveSubscriptionPaymentRequest({ code_url: 'weixin://wxpay/bizpayurl?pr=real' }, 'native'), {
    kind: 'native',
    codeUrl: 'weixin://wxpay/bizpayurl?pr=real',
  })
})

test('历史订单按固有支付模式判断当前端能否继续支付', async () => {
  const domain = await import('../src/domain/organization-admin.ts')

  assert.deepEqual(domain.resolveSubscriptionOrderPaymentAvailability('native', 'native'), { compatible: true, paymentMode: 'native', message: '' })
  assert.deepEqual(domain.resolveSubscriptionOrderPaymentAvailability('miniprogram', 'miniprogram'), { compatible: true, paymentMode: 'miniprogram', message: '' })
  assert.deepEqual(domain.resolveSubscriptionOrderPaymentAvailability('native', 'miniprogram'), { compatible: false, paymentMode: 'native', message: '请在网页端继续支付' })
  assert.deepEqual(domain.resolveSubscriptionOrderPaymentAvailability('miniprogram', 'native'), { compatible: false, paymentMode: 'miniprogram', message: '请在微信小程序端继续支付' })
})

test('通知发送、订单和开票状态不直接展示英文枚举', async () => {
  const domain = await import('../src/domain/organization-admin.ts')

  assert.equal(domain.getNotificationDispatchStatusLabel('pending'), '等待发送')
  assert.equal(domain.getNotificationDispatchStatusLabel('sent'), '发送完成')
  assert.equal(domain.getNotificationDispatchScopeLabel('organization'), '整个组织')
  assert.equal(domain.getNotificationDispatchScopeLabel('users'), '指定成员')
  assert.equal(domain.getSubscriptionOrderStatusLabel('pending_payment'), '待支付')
  assert.equal(domain.getSubscriptionOrderStatusLabel('payment_failed'), '支付失败')
  assert.equal(domain.getInvoiceStatusLabel('pending'), '待开票')
  assert.equal(domain.getInvoiceStatusLabel('issued'), '已开票')
  assert.equal(domain.getInvoiceStatusLabel('unknown'), '状态未知')
})

test('订阅页按订单固有模式解析历史支付并阻止跨端盲目继续', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/subscription/index.vue'), 'utf8')

  assert.match(source, /payment_mode\?: string/)
  assert.match(source, /function orderPaymentAvailability\(order: SaaSOrderOut\)/)
  assert.match(source, /resolveSubscriptionOrderPaymentAvailability\(payment\.payment_mode, paymentMode\.value\)/)
  assert.match(source, /const availability = orderPaymentAvailability\(order\)/)
  assert.match(source, /resolveSubscriptionPaymentRequest\(checkout, availability\.paymentMode\)/)
  assert.doesNotMatch(source, /resolveSubscriptionPaymentRequest\(checkout, paymentMode\.value\)/)
  assert.match(source, /payment_mode:\s*paymentMode\.value/)
  assert.match(source, /v-if="orderPaymentAvailability\(order\)\.compatible"[\s\S]*@click="continuePayment\(order\)"/)
  assert.match(source, /\{\{ orderPaymentAvailability\(order\)\.message \}\}/)
  assert.match(source, /@click="refreshPayment\(order\)"/)
  assert.match(source, /@click="cancelOrder\(order\)"/)
})

test('组织管理分包路由完整且唯一', () => {
  const expectedRoutes = {
    organizationAdmin: '/pages-org-admin/index',
    organizationAdminMembers: '/pages-org-admin/members/index',
    organizationAdminMemberDetail: '/pages-org-admin/members/detail',
    organizationAdminInvitations: '/pages-org-admin/invitations/index',
    organizationAdminTeams: '/pages-org-admin/teams/index',
    organizationAdminTeamDetail: '/pages-org-admin/teams/detail',
    organizationAdminRoles: '/pages-org-admin/roles/index',
    organizationAdminResponsibilities: '/pages-org-admin/responsibilities/index',
    organizationAdminSettings: '/pages-org-admin/settings/index',
    organizationAdminSubscription: '/pages-org-admin/subscription/index',
    organizationAdminNotificationDispatches: '/pages-org-admin/notification-dispatches/index',
  }
  for (const [key, value] of Object.entries(expectedRoutes))
    assert.equal((routes.APP_ROUTES as Record<string, string>)[key], value)

  const pagesSource = readFileSync(join(sourceRoot, 'pages.json'), 'utf8')
  const roots = [...pagesSource.matchAll(/"root"\s*:\s*"([^"]+)"/g)].map(match => match[1])
  assert.equal(roots.filter(root => root === 'pages-org-admin').length, 1)
  for (const page of ['index', 'members/index', 'members/detail', 'invitations/index', 'teams/index', 'teams/detail', 'roles/index', 'responsibilities/index', 'settings/index', 'subscription/index', 'notification-dispatches/index'])
    assert.match(pagesSource, new RegExp(`"path"\\s*:\\s*"${page}"`))
})

test('组织管理页面齐全、无占位并遵守 page 到 feature 到 manual 边界', () => {
  const pagePaths = [
    'pages-org-admin/index.vue',
    'pages-org-admin/members/index.vue',
    'pages-org-admin/members/detail.vue',
    'pages-org-admin/invitations/index.vue',
    'pages-org-admin/teams/index.vue',
    'pages-org-admin/teams/detail.vue',
    'pages-org-admin/roles/index.vue',
    'pages-org-admin/responsibilities/index.vue',
    'pages-org-admin/settings/index.vue',
    'pages-org-admin/subscription/index.vue',
    'pages-org-admin/notification-dispatches/index.vue',
  ]
  for (const relativePath of pagePaths) {
    const path = join(sourceRoot, relativePath)
    assert.equal(existsSync(path), true, `${relativePath} 应存在`)
    const source = readFileSync(path, 'utf8')
    assert.equal(source.includes('@/services/openapi'), false, `${relativePath} 不得直接导入 OpenAPI`)
    assert.equal(/敬请期待|归入分包|占位/.test(source), false, `${relativePath} 不得包含占位文案`)
    assert.equal(source.includes('@/features/organization-admin/service'), true, `${relativePath} 应通过 feature service 读取数据`)
    assert.equal(/management_context\s*:\s*['"]platform['"]|scope\s*:\s*['"]platform['"]/.test(source), false, `${relativePath} 禁止平台作用域`)
  }

  const featureSource = readFileSync(join(sourceRoot, 'features/organization-admin/service.ts'), 'utf8')
  const manualSource = readFileSync(join(sourceRoot, 'services/manual/organization-admin.ts'), 'utf8')
  assert.equal(featureSource.includes('@/services/openapi'), false)
  assert.equal(featureSource.includes('@/services/manual/organization-admin'), true)
  assert.equal(manualSource.includes('organizationAdminRequestOptions'), true)
  assert.match(manualSource, /organizationAdminRequestOptions\(organizationSlug, 'never'\)/)
  assert.equal(manualSource.includes('pingtaiguanli'), false)
  assert.equal(/management_context\s*:\s*['"]platform['"]|scope\s*:\s*['"]platform['"]/.test(manualSource), false)
  assert.match(manualSource, /management_context:\s*'tenant'/)
})

test('关键安全交互和分页模式由页面显式实现', () => {
  const members = readFileSync(join(sourceRoot, 'pages-org-admin/members/index.vue'), 'utf8')
  const invitations = readFileSync(join(sourceRoot, 'pages-org-admin/invitations/index.vue'), 'utf8')
  const teams = readFileSync(join(sourceRoot, 'pages-org-admin/teams/index.vue'), 'utf8')
  const responsibilities = readFileSync(join(sourceRoot, 'pages-org-admin/responsibilities/index.vue'), 'utf8')
  const subscriptions = readFileSync(join(sourceRoot, 'pages-org-admin/subscription/index.vue'), 'utf8')
  const dispatches = readFileSync(join(sourceRoot, 'pages-org-admin/notification-dispatches/index.vue'), 'utf8')

  for (const source of [members, invitations, teams, responsibilities, dispatches]) {
    assert.match(source, /usePagedQuery/)
    assert.match(source, /onPullDownRefresh/)
    assert.match(source, /onReachBottom/)
  }
  assert.doesNotMatch(members, /is_owner\s*:/)
  assert.doesNotMatch(invitations, /is_owner\s*:\s*true/)
  for (const source of [members, invitations, teams, responsibilities, dispatches]) {
    assert.match(source, /submitting|creating|deleting|saving/)
    assert.match(source, /showModal/)
  }
  assert.match(subscriptions, /resolveSubscriptionPaymentMode/)
  assert.match(subscriptions, /requestPayment/)
  assert.match(subscriptions, /idempotency/)
  assert.match(subscriptions, /subscriptions_manage/)
  assert.match(dispatches, /management_context:\s*'tenant'/)
  assert.doesNotMatch(dispatches, /auto|platform/)
})

test('工作区导航能力显式包含订阅管理', () => {
  const workspaceSource = readFileSync(join(sourceRoot, 'store/workspace.ts'), 'utf8')
  assert.match(workspaceSource, /subscriptions_manage:\s*boolean/)
  assert.match(workspaceSource, /subscriptions_manage:\s*false/)
})

test('团队角色成员请求显式携带可选 team_id', () => {
  const manualSource = readFileSync(join(sourceRoot, 'services/manual/organization-admin.ts'), 'utf8')
  const rolesSource = readFileSync(join(sourceRoot, 'pages-org-admin/roles/index.vue'), 'utf8')

  assert.match(manualSource, /requestRoleMembers\([\s\S]*teamId\?: number[\s\S]*team_id: teamId/)
  assert.match(manualSource, /updateRoleMembers\([\s\S]*teamId\?: number[\s\S]*team_id: teamId/)
  assert.match(rolesSource, /listAllOrganizationRoleMembers\([\s\S]*isTeamScope\.value \? teamId\.value : undefined/)
  assert.match(rolesSource, /patchOrganizationRoleMembers\([\s\S]*isTeamScope\.value \? teamId\.value : undefined/)
})

test('订阅页完整维护开票资料并从真实可开票订单申请', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/subscription/index.vue'), 'utf8')

  assert.match(source, /InvoiceRequestOut/)
  assert.match(source, /ref<'personal' \| 'company'>\('company'\)/)
  for (const field of ['registeredAddress', 'registeredPhone', 'bankName', 'bankAccount']) {
    assert.match(source, new RegExp(`const ${field} = ref\\(''\\)`))
    assert.match(source, new RegExp(`${field}\\.value = nextInvoiceProfile\\.`))
  }
  for (const field of ['registered_address', 'registered_phone', 'bank_name', 'bank_account'])
    assert.match(source, new RegExp(`${field}:`))

  assert.match(source, /invoiceableOrders/)
  assert.match(source, /order\.status === 'paid'/)
  assert.match(source, /order\.refund_status === 'none'/)
  assert.match(source, /!order\.invoice/)
  assert.match(source, /order_id: selectedInvoiceOrder\.value\.id/)
  assert.doesNotMatch(source, /输入已支付订单 ID|Number\(invoiceOrderId\.value\)/)
  assert.match(source, /invoiceRequests/)
  assert.match(source, /invoiceRequest\.status/)
  assert.match(source, /invoiceRequest\.file_url/)
})

test('通知目标与团队设置切换只允许最后请求落地', () => {
  const dispatches = readFileSync(join(sourceRoot, 'pages-org-admin/notification-dispatches/index.vue'), 'utf8')
  const settings = readFileSync(join(sourceRoot, 'pages-org-admin/settings/index.vue'), 'utf8')

  for (const source of [dispatches, settings]) {
    assert.match(source, /createLatestRequestGuard/)
    assert.match(source, /requestGuard\.begin\(\)/)
    assert.match(source, /requestGuard\.isCurrent\(/)
  }
  assert.match(dispatches, /const scopeSnapshot = scope\.value/)
  assert.match(dispatches, /if \(!requestGuard\.isCurrent\(requestGeneration\) \|\| scope\.value !== scopeSnapshot\)/)
  assert.match(settings, /const teamIdSnapshot = teamId\.value/)
  assert.match(settings, /if \(!requestGuard\.isCurrent\(requestGeneration\) \|\| teamId\.value !== teamIdSnapshot\)/)
})

test('团队角色与设置严格区分查看和管理权限', () => {
  const teamDetail = readFileSync(join(sourceRoot, 'pages-org-admin/teams/detail.vue'), 'utf8')
  const settings = readFileSync(join(sourceRoot, 'pages-org-admin/settings/index.vue'), 'utf8')
  const workspace = readFileSync(join(sourceRoot, 'store/workspace.ts'), 'utf8')

  assert.match(teamDetail, /canViewRoles/)
  assert.match(teamDetail, /team_role_view_ids/)
  assert.match(teamDetail, /v-if="canViewRoles" class="link-card"/)
  assert.match(settings, /organization_settings_manage/)
  assert.match(settings, /team_settings_view_ids/)
  assert.match(settings, /team_settings_manage_ids/)
  assert.match(settings, /v-if="setting\.is_customized && canManage"/)
  assert.match(workspace, /organization_settings_manage:\s*boolean/)
  assert.match(workspace, /team_settings_view_ids:\s*number\[\]/)
  assert.match(workspace, /team_settings_manage_ids:\s*number\[\]/)
})

test('组织管理候选项和订阅数据不再被固定首屏截断', () => {
  const manualSource = readFileSync(join(sourceRoot, 'services/manual/organization-admin.ts'), 'utf8')
  assert.match(manualSource, /collectAllPages/)

  const pagePaths = [
    'pages-org-admin/teams/detail.vue',
    'pages-org-admin/roles/index.vue',
    'pages-org-admin/responsibilities/index.vue',
    'pages-org-admin/subscription/index.vue',
    'pages-org-admin/notification-dispatches/index.vue',
  ]
  for (const relativePath of pagePaths) {
    const source = readFileSync(join(sourceRoot, relativePath), 'utf8')
    assert.doesNotMatch(source, /\b1,\s*(?:20|100)\b/, `${relativePath} 不得只读取固定首屏`)
  }
  for (const functionName of [
    'requestAllOrganizationTeams',
    'requestAllOrganizationMembers',
    'requestAllRoleMembers',
    'requestAllResponsibilityLandlords',
    'requestAllResponsibilityBuildings',
    'requestAllResponsibilityEstates',
    'requestAllSubscriptionOrders',
    'requestAllInvoiceRequests',
    'requestAllNotificationDispatchTargets',
  ])
    assert.match(manualSource, new RegExp(`function ${functionName}`))
})

test('订阅查看与管理请求分离且支付参数、金额周期符合双端契约', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/subscription/index.vue'), 'utf8')

  assert.match(source, /canManageSubscription\.value \? getOrganizationInvoiceProfile/)
  assert.match(source, /resolveSubscriptionPaymentRequest\(checkout, availability\.paymentMode\)/)
  assert.match(source, /requestWechatMiniprogramPayment\(paymentRequest\.options\)/)
  assert.doesNotMatch(source, /orderInfo:\s*\{/)
  assert.match(source, /function formatMoney\(amountInCents: number\)/)
  assert.match(source, /amountInCents \/ 100/)
  assert.match(source, /purchasePlan\(plan: PlanOut, price: PlanPrice\)/)
  assert.match(source, /billing_cycle:\s*price\.billing_cycle/)
  assert.match(source, /formatBillingCycle\(price\.billing_cycle\)/)
})

test('角色、绑定和邀请均通过真实选项选择而非手输内部 ID', () => {
  const roles = readFileSync(join(sourceRoot, 'pages-org-admin/roles/index.vue'), 'utf8')
  const invitations = readFileSync(join(sourceRoot, 'pages-org-admin/invitations/index.vue'), 'utf8')

  assert.match(roles, /wd-checkbox-group/)
  assert.match(roles, /permission\.key/)
  assert.match(roles, /bindingMemberOptions/)
  assert.match(roles, /bindingRoleOptions/)
  assert.doesNotMatch(roles, /成员用户 ID|角色 ID/)
  assert.match(invitations, /MemberSearchOut/)
  assert.match(invitations, /searchOrganizationAdminMemberCandidates/)
  assert.match(invitations, /invitee:\s*selectedInvitee\.value\.pk/)
  assert.match(invitations, /roleOptions/)
  assert.doesNotMatch(invitations, /预设角色 ID/)
  assert.doesNotMatch(invitations, /is_owner\s*:/)
})

test('设置页按 schema 元数据渲染真实控件和专项业务编辑器', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/settings/index.vue'), 'utf8')

  for (const widget of ['switch', 'input_number', 'select', 'location_picker'])
    assert.match(source, new RegExp(`widget === '${widget}'`))
  assert.match(source, /editingSetting\.value\.ui/)
  assert.match(source, /uni\.chooseLocation/)
  assert.match(source, /property_rental\.publish_rules/)
  assert.match(source, /property_rental\.lease_allocation_rule/)
  assert.match(source, /publishRuleRows/)
  assert.match(source, /leaseAllocationMethod/)
  assert.match(source, /wd-switch/)
  assert.match(source, /wd-picker/)
  assert.match(source, /wd-input-number/)
})

test('设置页按 options_source 加载全分页真实楼栋选项', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/settings/index.vue'), 'utf8')
  const manualSource = readFileSync(join(sourceRoot, 'services/manual/organization-admin.ts'), 'utf8')

  assert.match(source, /options_source === 'house\.buildings'/)
  assert.match(source, /listAllOrganizationBuildings/)
  assert.match(source, /value:\s*building\.id/)
  assert.match(source, /return editingSelectValue\.value\[0\]/)
  assert.match(manualSource, /function requestAllOrganizationBuildings/)
})

test('通知发送提供详情、发送分页和进行中轮询', () => {
  const detailPath = join(sourceRoot, 'pages-org-admin/notification-dispatches/detail.vue')
  assert.equal(existsSync(detailPath), true)
  const detail = readFileSync(detailPath, 'utf8')
  const index = readFileSync(join(sourceRoot, 'pages-org-admin/notification-dispatches/index.vue'), 'utf8')
  const routesSource = readFileSync(join(sourceRoot, 'modules/routes.ts'), 'utf8')

  assert.match(routesSource, /organizationAdminNotificationDispatchDetail/)
  assert.match(index, /organizationAdminNotificationDispatchDetail/)
  assert.match(detail, /getOrganizationNotificationDispatch/)
  assert.match(detail, /listOrganizationNotificationDispatchDeliveries/)
  assert.match(detail, /usePagedQuery<NotificationOut>/)
  assert.match(detail, /\['pending', 'sending'\]\.includes/)
  assert.match(detail, /setTimeout/)
  assert.match(detail, /onReachBottom/)
  assert.match(detail, /onPullDownRefresh/)
})

test('组织管理首页允许工作区导航失败后按独立能力降级展示', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/index.vue'), 'utf8')

  assert.match(source, /Promise\.allSettled/)
  assert.match(source, /capabilityResult\.status === 'fulfilled'/)
  assert.match(source, /workspaceResult\.status === 'fulfilled'/)
  assert.match(source, /sections\.value\.length/)
  assert.doesNotMatch(source, /v-else-if="navigation"/)
})
