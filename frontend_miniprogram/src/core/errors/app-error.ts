export type AppErrorKind
  = | 'network'
    | 'timeout'
    | 'cancelled'
    | 'unauthenticated'
    | 'forbidden'
    | 'not-found'
    | 'validation'
    | 'conflict'
    | 'business'
    | 'unexpected'

export interface AppErrorOptions {
  kind: AppErrorKind
  message: string
  statusCode?: number
  businessCode?: string | number
  fieldErrors?: Record<string, string[]>
  retryable?: boolean
  cause?: unknown
}

export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly statusCode?: number
  readonly businessCode?: string | number
  readonly fieldErrors: Record<string, string[]>
  readonly retryable: boolean
  override readonly cause?: unknown

  constructor(options: AppErrorOptions) {
    super(options.message)
    this.name = 'AppError'
    this.kind = options.kind
    this.statusCode = options.statusCode
    this.businessCode = options.businessCode
    this.fieldErrors = options.fieldErrors || {}
    this.retryable = options.retryable ?? false
    this.cause = options.cause
  }
}

export interface NormalizeAppErrorInput {
  statusCode?: number
  data?: unknown
  cause?: unknown
  timedOut?: boolean
  cancelled?: boolean
  fallbackMessage?: string
}

interface ValidationIssue {
  loc?: unknown
  msg?: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function getFieldErrors(data: Record<string, unknown> | null): Record<string, string[]> {
  if (!data || !Array.isArray(data.detail))
    return {}

  return data.detail.reduce<Record<string, string[]>>((result, issueValue) => {
    const issue = issueValue as ValidationIssue
    if (!Array.isArray(issue.loc) || typeof issue.msg !== 'string')
      return result
    const field = [...issue.loc].reverse().find(item => typeof item === 'string' && item !== 'body' && item !== 'query')
    if (typeof field !== 'string')
      return result
    result[field] ||= []
    result[field].push(issue.msg)
    return result
  }, {})
}

function getMessage(data: Record<string, unknown> | null, fieldErrors: Record<string, string[]>, fallback: string): string {
  if (data) {
    for (const key of ['msg', 'message', 'detail']) {
      const value = data[key]
      if (typeof value === 'string' && value.trim())
        return value
    }
  }
  return Object.values(fieldErrors)[0]?.[0] || fallback
}

function getErrorKind(input: NormalizeAppErrorInput, fieldErrors: Record<string, string[]>): AppErrorKind {
  if (input.cancelled)
    return 'cancelled'
  if (input.timedOut)
    return 'timeout'
  if (!input.statusCode)
    return 'network'
  if (input.statusCode === 401 || input.statusCode === 410)
    return 'unauthenticated'
  if (input.statusCode === 403)
    return 'forbidden'
  if (input.statusCode === 404)
    return 'not-found'
  if (input.statusCode === 409)
    return 'conflict'
  if (input.statusCode === 400 || input.statusCode === 422 || Object.keys(fieldErrors).length)
    return 'validation'
  if (input.statusCode >= 500)
    return 'unexpected'
  return 'business'
}

export function normalizeAppError(input: NormalizeAppErrorInput | AppError): AppError {
  if (input instanceof AppError)
    return input

  const data = asRecord(input.data)
  const fieldErrors = getFieldErrors(data)
  const kind = getErrorKind(input, fieldErrors)
  const fallbackMessage = input.fallbackMessage
    || (kind === 'network' ? '网络连接失败，请稍后重试' : kind === 'timeout' ? '请求超时，请稍后重试' : kind === 'cancelled' ? '请求已取消' : '请求失败')

  return new AppError({
    kind,
    message: getMessage(data, fieldErrors, fallbackMessage),
    statusCode: input.statusCode,
    businessCode: typeof data?.code === 'string' || typeof data?.code === 'number' ? data.code : undefined,
    fieldErrors,
    retryable: kind === 'network' || kind === 'timeout' || (kind === 'unexpected' && Boolean(input.statusCode && input.statusCode >= 500)),
    cause: input.cause,
  })
}
