import type { AppMode, AppModeOption, AppModeSelection } from './app-mode.ts'
import { findModuleByRoute, isPublicRoute } from '../modules/registry.ts'
import { APP_ROUTES, getLoginRoute, isProtectedAccountRoute, isProtectedMessageRoute, normalizeAppRoutePath } from '../modules/routes.ts'

export interface RouteWorkspace {
  authenticated: boolean
  mode: AppMode
  organizationSlug: string
  landlordContactId: number | null
  organizations: readonly { id: number, slug: string }[]
  modeOptions: readonly AppModeOption[]
  capabilities: Record<string, boolean | number[]>
}

export interface RouteAccessDecision {
  allowed: boolean
  redirect: string
  identityOptions?: readonly AppModeOption[]
}

export const shellRoutes: readonly string[] = [APP_ROUTES.login, APP_ROUTES.register, APP_ROUTES.startupError, APP_ROUTES.forbidden, APP_ROUTES.notFound, APP_ROUTES.switchIdentity]

export function parseNavigationTarget(url: string): { path: string, query: Record<string, string> } {
  const separator = url.indexOf('?')
  const path = normalizeAppRoutePath(separator < 0 ? url : url.slice(0, separator))
  const query: Record<string, string> = {}
  for (const entry of (separator < 0 ? '' : url.slice(separator + 1)).split('&')) {
    if (!entry)
      continue
    const index = entry.indexOf('=')
    const key = index < 0 ? entry : entry.slice(0, index)
    const value = index < 0 ? '' : entry.slice(index + 1)
    try {
      query[decodeURIComponent(key)] = decodeURIComponent(value)
    }
    catch {
      query[key] = value
    }
  }
  return { path, query }
}

export function buildNavigationTarget(path: string, query: Record<string, string>): string {
  const search = Object.entries(query).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
  return search ? `${path}?${search}` : path
}

export function decodeNavigationRedirect(value: unknown): string {
  if (typeof value !== 'string')
    return ''
  try {
    const target = value.startsWith('/') ? value : decodeURIComponent(value)
    return target.startsWith('/') && !target.startsWith('//') ? target : ''
  }
  catch {
    return ''
  }
}

function selectionMatchesWorkspace(selection: AppModeSelection, workspace: RouteWorkspace): boolean {
  return selection.mode === workspace.mode
    && (selection.mode !== 'organization' || selection.organizationSlug === workspace.organizationSlug)
    && (selection.mode !== 'landlord' || selection.landlordContactId === workspace.landlordContactId)
}

export function getRouteAccessDecision(url: string, workspace: RouteWorkspace): RouteAccessDecision {
  const { path, query } = parseNavigationTarget(url)
  if (shellRoutes.includes(path) || isPublicRoute(path))
    return { allowed: true, redirect: '' }

  if ((isProtectedAccountRoute(path) || isProtectedMessageRoute(path)) && !workspace.authenticated)
    return { allowed: false, redirect: getLoginRoute(url) }

  const module = findModuleByRoute(path)
  if (!module)
    return { allowed: false, redirect: APP_ROUTES.notFound }
  if (module.requiresAuth && !workspace.authenticated)
    return { allowed: false, redirect: getLoginRoute(url) }

  const organization = query.organization_id
    ? workspace.organizations.find(item => String(item.id) === query.organization_id)
    : undefined
  const organizationSlug = query.organization_slug || organization?.slug
  const landlordContactId = query.landlord_contact_id
  const hasOrganization = 'organization_slug' in query || 'organization_id' in query
  const hasLandlord = 'landlord_contact_id' in query
  const hasChatTenant = 'chat_tenant_slug' in query
  if (path === APP_ROUTES.conversation && (!/^\d+$/.test(query.id || '') || Number(query.id) <= 0 || (!hasChatTenant && !hasOrganization)))
    return { allowed: false, redirect: `${APP_ROUTES.forbidden}?reason=context` }
  if (hasChatTenant) {
    if (path !== APP_ROUTES.conversation || !query.chat_tenant_slug.trim() || hasOrganization || hasLandlord)
      return { allowed: false, redirect: `${APP_ROUTES.forbidden}?reason=context` }
    return { allowed: true, redirect: '' }
  }
  if ((hasOrganization && (!organizationSlug || (query.organization_id && (!organization || organization.slug !== organizationSlug))))
    || (hasLandlord && (!/^\d+$/.test(landlordContactId) || Number(landlordContactId) <= 0))
    || (hasOrganization && hasLandlord)) {
    return { allowed: false, redirect: `${APP_ROUTES.forbidden}?reason=context` }
  }

  const options = workspace.modeOptions.filter((option) => {
    if (!module.modes.includes(option.selection.mode))
      return false
    if (hasOrganization)
      return option.selection.mode === 'organization' && option.selection.organizationSlug === organizationSlug
    if (hasLandlord)
      return option.selection.mode === 'landlord' && String(option.selection.landlordContactId) === landlordContactId
    return true
  })
  const currentMatches = module.modes.includes(workspace.mode)
    && (!hasOrganization || (workspace.mode === 'organization' && workspace.organizationSlug === organizationSlug))
    && (!hasLandlord || (workspace.mode === 'landlord' && String(workspace.landlordContactId) === landlordContactId))
  if (currentMatches) {
    if (module.capability && workspace.capabilities[module.capability] !== true)
      return { allowed: false, redirect: APP_ROUTES.forbidden }
    return { allowed: true, redirect: '' }
  }
  if (!options.length) {
    const reason = hasOrganization || hasLandlord ? 'context' : 'identity'
    return { allowed: false, redirect: `${APP_ROUTES.forbidden}?reason=${reason}&mode=${module.modes[0]}` }
  }
  return {
    allowed: false,
    redirect: `${APP_ROUTES.switchIdentity}?redirect=${encodeURIComponent(url)}`,
    identityOptions: options,
  }
}

/** 将业务记录的工作上下文留在路由中，返回旧页面时也可恢复正确身份。 */
export function withRouteWorkspace(url: string, selection: AppModeSelection): string {
  const { path, query } = parseNavigationTarget(url)
  if (isPublicRoute(path) || shellRoutes.includes(path))
    return url
  if ('chat_tenant_slug' in query)
    return url
  const module = findModuleByRoute(path)
  if (!module || (!isProtectedMessageRoute(path) && module.modes.length !== 1))
    return url
  if ('organization_slug' in query || 'organization_id' in query || 'landlord_contact_id' in query)
    return url
  if (selection.mode === 'organization' && module.modes.includes('organization'))
    query.organization_slug = selection.organizationSlug
  if (selection.mode === 'landlord' && module.modes.includes('landlord'))
    query.landlord_contact_id = String(selection.landlordContactId)
  return buildNavigationTarget(path, query)
}

export function getWorkspaceSelection(workspace: RouteWorkspace): AppModeSelection | null {
  const option = workspace.modeOptions.find(item => selectionMatchesWorkspace(item.selection, workspace))
  return option?.selection || null
}
