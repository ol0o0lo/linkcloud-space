function amountLabel(value: string | number): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : String(value)
}

export function formatCustomerBudget(minimum?: string | number | null, maximum?: string | number | null): string {
  const hasMinimum = minimum != null && minimum !== ''
  const hasMaximum = maximum != null && maximum !== ''
  if (!hasMinimum && !hasMaximum)
    return '预算不限'
  if (!hasMaximum)
    return `${amountLabel(minimum!)} 元/月起`
  if (!hasMinimum)
    return `${amountLabel(maximum!)} 元/月以内`
  return Number(minimum) === Number(maximum) ? `${amountLabel(minimum!)} 元/月` : `${amountLabel(minimum!)}–${amountLabel(maximum!)} 元/月`
}

export function formatMerchantTime(value?: string | null, now = new Date()): string {
  if (!value)
    return '暂无记录'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()))
    return '时间待确认'
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const sameDay = (other: Date) => date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth() && date.getDate() === other.getDate()
  if (sameDay(now))
    return `今天 ${time}`
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(yesterday))
    return `昨天 ${time}`
  return `${date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}年`}${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}

export function formatShareValidity(expiresAt?: string | null, status = 'active', now = Date.now()): string {
  if (status === 'revoked')
    return '已失效'
  if (status === 'expired')
    return '已过期'
  if (!expiresAt)
    return '长期有效'
  const remaining = new Date(expiresAt).getTime() - now
  if (!Number.isFinite(remaining))
    return '有效期待确认'
  if (remaining <= 0)
    return '已过期'
  return remaining < 86400000 ? `剩余 ${Math.ceil(remaining / 3600000)} 小时` : `剩余 ${Math.ceil(remaining / 86400000)} 天`
}
