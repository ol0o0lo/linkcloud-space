import { AppError } from '../core/errors/app-error.ts'

export type OrganizationAdminSectionKey = 'members' | 'invitations' | 'teams' | 'roles' | 'responsibilities' | 'settings' | 'subscription' | 'notification-dispatches'
export type TeamManagementAction = 'update' | 'delete' | 'member' | 'role_view' | 'role_manage'
export type SubscriptionPlatform = 'h5' | 'mp-weixin'
export type SubscriptionPaymentMode = 'native' | 'miniprogram'
export type TenantDispatchScope = 'organization' | 'teams' | 'users'

export interface OrganizationAdminCapabilities {
  invite_manage?: boolean
  member_manage?: boolean
  notification_dispatches?: boolean
  organization_settings?: boolean
  organization_settings_manage?: boolean
  responsibility_manage?: boolean
  role_management?: boolean
  subscriptions?: boolean
  subscriptions_manage?: boolean
  team_create?: boolean
  team_settings?: boolean
  team_settings_view_ids?: number[]
  team_settings_manage_ids?: number[]
  team_update_ids?: number[]
  team_delete_ids?: number[]
  team_member_manage_ids?: number[]
  team_role_view_ids?: number[]
  team_role_manage_ids?: number[]
}

export interface OrganizationRoleManagementCapabilities {
  role_view?: boolean
  role_manage?: boolean
  team_role_view_ids?: number[]
  team_role_manage_ids?: number[]
}

export interface OrganizationRoleManagementTeam {
  id: number
  name: string
}

export interface OrganizationRoleManagementNavigation {
  teams: OrganizationRoleManagementTeam[]
  capabilities: OrganizationRoleManagementCapabilities
}

export interface OrganizationRoleScopeOption {
  label: string
  value: number
}

export interface SubscriptionPurchaseIntentInput {
  organizationSlug: string
  planCode: string
  billingCycle: string
  paymentMode: SubscriptionPaymentMode
}

export interface SubscriptionPurchaseIntent {
  signature: string
  idempotencyKey: string
}

export interface WechatMiniprogramPaymentParams {
  timeStamp?: string
  nonceStr?: string
  package?: string
  signType?: 'MD5' | 'HMAC-SHA256' | 'RSA'
  paySign?: string
}

export interface SubscriptionPaymentCheckout {
  code_url?: string
  payment_params?: WechatMiniprogramPaymentParams
}

export interface WechatMiniprogramPaymentOptions {
  provider: 'wxpay'
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'MD5' | 'HMAC-SHA256' | 'RSA'
  paySign: string
}

export interface NativeSubscriptionPaymentRequest {
  kind: 'native'
  codeUrl: string
}

export interface MiniprogramSubscriptionPaymentRequest {
  kind: 'miniprogram'
  options: WechatMiniprogramPaymentOptions
}

export type SubscriptionOrderPaymentAvailability
  = | { compatible: true, paymentMode: SubscriptionPaymentMode, message: '' }
    | { compatible: false, paymentMode: SubscriptionPaymentMode | null, message: string }

export interface OrganizationAdminSection {
  key: OrganizationAdminSectionKey
  title: string
  description: string
  icon: string
}

interface ResponsibilitySelection {
  landlord_ids?: number[]
  building_ids?: number[]
  estate_ids?: number[]
}

const sections: Array<OrganizationAdminSection & { visible: (capabilities: OrganizationAdminCapabilities) => boolean }> = [
  { key: 'members', title: '成员管理', description: '维护成员资料与组织关系', icon: 'i-carbon-user-multiple', visible: capabilities => capabilities.member_manage === true },
  { key: 'invitations', title: '邀请管理', description: '邀请成员并跟踪处理状态', icon: 'i-carbon-email-new', visible: capabilities => capabilities.invite_manage === true },
  {
    key: 'teams',
    title: '团队管理',
    description: '维护团队与成员归属',
    icon: 'i-carbon-collaborate',
    visible: capabilities => capabilities.team_create === true
      || capabilities.team_settings === true
      || Boolean(capabilities.team_update_ids?.length)
      || Boolean(capabilities.team_delete_ids?.length)
      || Boolean(capabilities.team_member_manage_ids?.length)
      || Boolean(capabilities.team_role_view_ids?.length)
      || Boolean(capabilities.team_role_manage_ids?.length),
  },
  { key: 'roles', title: '角色与授权', description: '配置组织和团队角色', icon: 'i-carbon-user-role', visible: capabilities => capabilities.role_management === true },
  { key: 'responsibilities', title: '房源职责', description: '分配员工负责的房东、楼栋和小区', icon: 'i-carbon-task-tools', visible: capabilities => capabilities.responsibility_manage === true },
  { key: 'settings', title: '组织设置', description: '维护组织与团队业务设置', icon: 'i-carbon-settings-adjust', visible: capabilities => capabilities.organization_settings === true || capabilities.team_settings === true },
  { key: 'subscription', title: '订阅与发票', description: '查看套餐、订单与开票资料', icon: 'i-carbon-receipt', visible: capabilities => capabilities.subscriptions === true || capabilities.subscriptions_manage === true },
  { key: 'notification-dispatches', title: '通知发送', description: '向组织、团队或成员发送通知', icon: 'i-carbon-notification-new', visible: capabilities => capabilities.notification_dispatches === true },
]

const notificationDispatchStatusLabels: Record<string, string> = {
  pending: '等待发送',
  sending: '发送中',
  sent: '发送完成',
  failed: '发送失败',
}

const notificationDispatchScopeLabels: Record<string, string> = {
  organization: '整个组织',
  teams: '指定团队',
  users: '指定成员',
  platform: '整个平台',
}

const subscriptionOrderStatusLabels: Record<string, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  closed: '已关闭',
  payment_failed: '支付失败',
}

const invoiceStatusLabels: Record<string, string> = {
  pending: '待开票',
  processing: '处理中',
  issued: '已开票',
  rejected: '已拒绝',
  cancelled: '已取消',
}

const teamCapabilityKeys: Record<TeamManagementAction, keyof OrganizationAdminCapabilities> = {
  update: 'team_update_ids',
  delete: 'team_delete_ids',
  member: 'team_member_manage_ids',
  role_view: 'team_role_view_ids',
  role_manage: 'team_role_manage_ids',
}

export function getOrganizationAdminSections(capabilities: OrganizationAdminCapabilities = {}): OrganizationAdminSection[] {
  return sections.filter(section => section.visible(capabilities)).map(({ visible: _visible, ...section }) => section)
}

export function canManageTeam(capabilities: OrganizationAdminCapabilities | undefined, teamId: number, action: TeamManagementAction = 'update'): boolean {
  const ids = capabilities?.[teamCapabilityKeys[action]]
  return Array.isArray(ids) && ids.includes(teamId)
}

export function resolveOrganizationSettingsTeamId(capabilities: OrganizationAdminCapabilities | undefined, requestedTeamId = 0): number {
  const visibleTeamIds = capabilities?.team_settings_view_ids || []
  if (requestedTeamId > 0 && visibleTeamIds.includes(requestedTeamId))
    return requestedTeamId
  if (capabilities?.organization_settings === true)
    return 0
  return visibleTeamIds[0] || 0
}

export function resolveOrganizationRoleTeamId(capabilities: OrganizationRoleManagementCapabilities | undefined, requestedTeamId = 0): number {
  const accessibleTeamIds = Array.from(new Set([...(capabilities?.team_role_view_ids || []), ...(capabilities?.team_role_manage_ids || [])]))
  if (requestedTeamId > 0 && accessibleTeamIds.includes(requestedTeamId))
    return requestedTeamId
  if (capabilities?.role_view === true || capabilities?.role_manage === true)
    return 0
  return accessibleTeamIds[0] || 0
}

export function getOrganizationRoleScopeOptions(navigation: OrganizationRoleManagementNavigation | undefined): OrganizationRoleScopeOption[] {
  if (!navigation)
    return []
  const options: OrganizationRoleScopeOption[] = []
  if (navigation.capabilities.role_view === true || navigation.capabilities.role_manage === true)
    options.push({ label: '组织级角色', value: 0 })
  options.push(...navigation.teams.map(team => ({ label: team.name, value: team.id })))
  return options
}

export function organizationAdminRequestOptions(organizationSlug: string, authRetry: 'safe' | 'never' = 'safe') {
  const normalizedSlug = organizationSlug.trim()
  if (!normalizedSlug)
    throw new Error('未选择组织，请先切换到中介端')
  return {
    requestScope: { kind: 'organization' as const, organizationSlug: normalizedSlug },
    authRetry,
  }
}

export function resolveSubscriptionPaymentMode(platform: SubscriptionPlatform): SubscriptionPaymentMode {
  return platform === 'mp-weixin' ? 'miniprogram' : 'native'
}

export function resolveSubscriptionOrderPaymentAvailability(orderPaymentMode: string | undefined, runtimePaymentMode: SubscriptionPaymentMode): SubscriptionOrderPaymentAvailability {
  const paymentMode = orderPaymentMode === 'native' || orderPaymentMode === 'miniprogram' ? orderPaymentMode : null
  if (!paymentMode)
    return { compatible: false, paymentMode: null, message: '订单支付方式无法识别' }
  if (paymentMode === runtimePaymentMode)
    return { compatible: true, paymentMode, message: '' }
  return {
    compatible: false,
    paymentMode,
    message: paymentMode === 'native' ? '请在网页端继续支付' : '请在微信小程序端继续支付',
  }
}

export function resolveSubscriptionPaymentRequest(checkout: SubscriptionPaymentCheckout, mode: 'native'): NativeSubscriptionPaymentRequest
export function resolveSubscriptionPaymentRequest(checkout: SubscriptionPaymentCheckout, mode: 'miniprogram'): MiniprogramSubscriptionPaymentRequest
export function resolveSubscriptionPaymentRequest(checkout: SubscriptionPaymentCheckout, mode: SubscriptionPaymentMode): NativeSubscriptionPaymentRequest | MiniprogramSubscriptionPaymentRequest
export function resolveSubscriptionPaymentRequest(checkout: SubscriptionPaymentCheckout, mode: SubscriptionPaymentMode): NativeSubscriptionPaymentRequest | MiniprogramSubscriptionPaymentRequest {
  if (mode === 'native') {
    if (!checkout.code_url)
      throw new Error('扫码支付链接缺失')
    return { kind: 'native', codeUrl: checkout.code_url }
  }

  const paymentParams = checkout.payment_params
  if (!paymentParams?.timeStamp || !paymentParams.nonceStr || !paymentParams.package || !paymentParams.paySign)
    throw new Error('小程序支付参数不完整')
  return {
    kind: 'miniprogram',
    options: {
      provider: 'wxpay',
      timeStamp: paymentParams.timeStamp,
      nonceStr: paymentParams.nonceStr,
      package: paymentParams.package,
      signType: paymentParams.signType || 'RSA',
      paySign: paymentParams.paySign,
    },
  }
}

export function createSubscriptionIdempotencyKey(now: () => number = Date.now, random: () => number = Math.random): string {
  const timestamp = now().toString(36)
  const nonce = random().toString(36).slice(2, 18).padEnd(16, '0')
  return `sub-${timestamp}-${nonce}`
}

export function getSubscriptionPurchaseIntent(
  current: SubscriptionPurchaseIntent | null,
  input: SubscriptionPurchaseIntentInput,
  createKey: () => string = createSubscriptionIdempotencyKey,
): SubscriptionPurchaseIntent {
  const signature = JSON.stringify([input.organizationSlug, input.planCode, input.billingCycle, input.paymentMode])
  if (current?.signature === signature)
    return current
  return { signature, idempotencyKey: createKey() }
}

export function resolveSubscriptionPurchaseIntentAfterOrderAttempt(intent: SubscriptionPurchaseIntent, error?: unknown): SubscriptionPurchaseIntent | null {
  return error instanceof AppError && error.retryable ? intent : null
}

export function buildTenantDispatchScope(scope: TenantDispatchScope, organizationId: number, scopeIds: number[]): { scope: TenantDispatchScope, scope_ids: number[] } {
  if (scope !== 'organization' && scope !== 'teams' && scope !== 'users')
    throw new Error('请选择有效的接收对象')
  if (scope === 'organization')
    return { scope, scope_ids: [organizationId] }
  return { scope, scope_ids: Array.from(new Set(scopeIds.filter(id => Number.isInteger(id) && id > 0))) }
}

export function getNotificationDispatchStatusLabel(status?: string, _mapping?: string): string {
  return status ? notificationDispatchStatusLabels[status] || '状态未知' : '状态未知'
}

export function getNotificationDispatchScopeLabel(scope?: string, _mapping?: string): string {
  return scope ? notificationDispatchScopeLabels[scope] || '其他接收对象' : '其他接收对象'
}

export function getSubscriptionOrderStatusLabel(status?: string): string {
  return status ? subscriptionOrderStatusLabels[status] || '状态未知' : '状态未知'
}

export function getInvoiceStatusLabel(status?: string): string {
  return status ? invoiceStatusLabels[status] || '状态未知' : '状态未知'
}

export function isEmptyResponsibilitySelection(payload: ResponsibilitySelection): boolean {
  return !payload.landlord_ids?.length && !payload.building_ids?.length && !payload.estate_ids?.length
}

export function formatOrganizationAdminUser(user: { first_name?: string, last_name?: string, username: string }): string {
  return `${user.first_name || ''}${user.last_name || ''}`.trim() || user.username
}
