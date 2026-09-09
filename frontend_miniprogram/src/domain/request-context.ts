export type RequestScope = 'public' | 'personal' | 'landlord' | 'organization'

export interface RequestHeaderContext {
  sessionToken: string
  organizationSlug: string
  requestScope?: RequestScope
}

export function buildRequestHeaders(context: RequestHeaderContext): Record<string, string> {
  const headers: Record<string, string> = {}
  if (context.sessionToken)
    headers['X-Session-Token'] = context.sessionToken
  if (context.requestScope === 'organization' && context.organizationSlug)
    headers['X-Org-Slug'] = context.organizationSlug
  return headers
}
