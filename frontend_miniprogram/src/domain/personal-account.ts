export interface ProfilePatchInput {
  nickname: string
  timezone: string
  avatarMediaId?: number | null
}

export interface ProfilePatch {
  last_name: string
  timezone: string | null
  avatar?: Array<{ media_id: number, media_type: 'image' }>
}

export type RealNameAction = 'submit' | 'retry' | null
export type AccountTone = 'default' | 'success' | 'warning' | 'danger'
export type WithdrawalAction = 'cancel'

const realNameStatusLabels: Record<string, string> = {
  unverified: '未认证',
  pending: '审核中',
  verified: '已认证',
  rejected: '未通过',
  manual_review: '人工复核中',
  revoked: '已撤销',
}

const referralStatusLabels: Record<string, string> = {
  registered: '已注册',
  pending_review: '审核中',
  review_rejected: '未通过',
  reward_issued: '奖励已发放',
}

const walletEntryTypeLabels: Record<string, string> = {
  promotion_reward: '推广奖励',
  admin_adjustment_increase: '余额增加',
  admin_adjustment_decrease: '余额扣减',
  withdraw_freeze: '提现金额冻结',
  withdraw_cancel: '撤销提现',
  withdraw_unfreeze: '提现金额退回',
  withdraw_settle: '提现到账',
  withdraw_refund: '提现失败退回',
}

const withdrawalStatusLabels: Record<string, string> = {
  pending_review: '审核中',
  cancelled: '已撤销',
  rejected: '未通过',
  approved: '待打款',
  paying: '打款中',
  paid: '已到账',
  failed: '打款失败',
}

const withdrawalPayChannelLabels: Record<string, string> = {
  wechat: '微信',
}

export function buildProfilePatch(input: ProfilePatchInput): ProfilePatch {
  const patch: ProfilePatch = {
    last_name: input.nickname.trim(),
    timezone: input.timezone.trim() || null,
  }
  if (input.avatarMediaId)
    patch.avatar = [{ media_id: input.avatarMediaId, media_type: 'image' }]
  return patch
}

export function getRealNameAction(status?: string): RealNameAction {
  if (status === 'rejected' || status === 'revoked')
    return 'retry'
  if (!status || status === 'unverified')
    return 'submit'
  return null
}

export function getRealNameTone(status?: string): AccountTone {
  if (status === 'verified')
    return 'success'
  if (status === 'rejected' || status === 'revoked')
    return 'danger'
  if (status === 'pending' || status === 'manual_review')
    return 'warning'
  return 'default'
}

export function getRealNameStatusLabel(status?: string, _mapping?: string): string {
  return status ? realNameStatusLabels[status] || '状态未知' : '未认证'
}

export function getReferralStatusLabel(status?: string, _mapping?: string): string {
  return status ? referralStatusLabels[status] || '状态未知' : '状态未知'
}

export function getWalletEntryTypeLabel(entryType?: string, _mapping?: string): string {
  return entryType ? walletEntryTypeLabels[entryType] || '其他资金变动' : '其他资金变动'
}

export function getWithdrawalStatusLabel(status?: string, _mapping?: string): string {
  return status ? withdrawalStatusLabels[status] || '状态未知' : '状态未知'
}

export function getWithdrawalPayChannelLabel(channel?: string, _mapping?: string): string {
  return channel ? withdrawalPayChannelLabels[channel] || '其他方式' : '其他方式'
}

export function formatWalletAmount(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

export function getWithdrawalActions(status: string): WithdrawalAction[] {
  return status === 'pending_review' ? ['cancel'] : []
}

export function validateWithdrawalAmount(amount: number, availableBalance: number): string {
  if (!Number.isFinite(amount) || amount <= 0)
    return '请输入大于 0 的提现金额'
  if (!Number.isInteger(amount))
    return '提现金额必须为整数'
  if (amount > availableBalance)
    return '提现金额不能超过可用余额'
  return ''
}

export function createWithdrawalRequestId(now = Date.now(), random = Math.random()): string {
  const randomPart = Math.abs(random).toString(36).replace(/[^a-z0-9]/g, '').slice(2, 12) || '0'
  return `wallet-${Math.max(0, Math.floor(now)).toString(36)}-${randomPart}`.slice(0, 64)
}
