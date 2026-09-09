import type { AppMode } from '../domain/app-mode.ts'
import type { ModuleDefinition } from '../domain/navigation.ts'
import type { SubpackageKey } from './subpackages.ts'
import { appModuleCatalog, findCatalogModuleByRoute, getCatalogModule } from './catalog.ts'
import { APP_ROUTES } from './routes.ts'
import { getProductSubpackageRoutePrefixes } from './subpackages.ts'

export interface AppModuleDefinition extends ModuleDefinition {
  mainRoutePrefixes: readonly string[]
  subpackageKeys: readonly SubpackageKey[]
}

export const appModules: readonly AppModuleDefinition[] = appModuleCatalog
  .filter(item => item.status === 'active')
  .map(item => ({
    key: item.key,
    title: item.title,
    route: item.mainRoute,
    mainRoutePrefixes: item.routePrefixes,
    subpackageKeys: item.subpackages.map(subpackage => subpackage.key),
    modes: item.modes,
    enabled: true,
    requiresAuth: item.requiresAuth,
    order: item.order,
    capability: item.capability,
  }))

const defaultRoutes: Record<AppMode, string> = {
  visitor: getCatalogModule('home').mainRoute,
  personal: getCatalogModule('home').mainRoute,
  landlord: getCatalogModule('home').mainRoute,
  organization: getCatalogModule('home').mainRoute,
}

const publicRoutePrefixes = [
  '/pages/houses/detail',
  APP_ROUTES.houseMatch,
  ...getProductSubpackageRoutePrefixes(['housing']),
]

export function getDefaultRouteForMode(mode: AppMode): string {
  return defaultRoutes[mode]
}

export function isPublicRoute(url: string): boolean {
  const path = url.split('?')[0]
  if (path === '/')
    return true
  return publicRoutePrefixes.some(prefix => path === prefix || path.startsWith(prefix))
}

export function findModuleByRoute(url: string): AppModuleDefinition | undefined {
  const module = findCatalogModuleByRoute(url)
  if (!module || module.status !== 'active')
    return undefined
  return appModules.find(item => item.key === module.key)
}
