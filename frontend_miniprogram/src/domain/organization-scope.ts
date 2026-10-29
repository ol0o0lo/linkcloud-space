export function buildOrganizationScope(organizationSlug: string, authRetry: 'safe' | 'never' = 'safe') {
  const normalizedSlug = organizationSlug.trim()
  if (!normalizedSlug)
    throw new Error('未选择工作空间，请先切换到经纪人身份')
  return {
    requestScope: { kind: 'organization' as const, organizationSlug: normalizedSlug },
    authRetry,
  }
}
