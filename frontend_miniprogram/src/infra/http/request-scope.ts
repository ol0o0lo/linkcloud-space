import { AppError } from '../../core/errors/app-error.ts'

export type RequestScope
  = | { kind: 'public' }
    | { kind: 'personal' }
    | { kind: 'landlord', landlordContactId: number }
    | { kind: 'organization', organizationSlug: string }

export interface ScopeHeaderInput {
  scope: RequestScope
  sessionToken: string
}

export function buildScopeHeaders(input: ScopeHeaderInput): Record<string, string> {
  const headers: Record<string, string> = {}
  if (input.sessionToken)
    headers['X-Session-Token'] = input.sessionToken

  if (input.scope.kind === 'public')
    return headers

  if (!input.sessionToken) {
    throw new AppError({
      kind: 'unauthenticated',
      message: '当前请求需要登录',
    })
  }

  if (input.scope.kind === 'organization') {
    if (!input.scope.organizationSlug)
      throw new AppError({ kind: 'unexpected', message: '未选择组织，请先切换到中介端' })
    headers['X-Org-Slug'] = input.scope.organizationSlug
  }

  return headers
}
