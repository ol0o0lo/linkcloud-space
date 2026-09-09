import { findModuleByRoute, isPublicRoute } from '@/modules/registry'
import { APP_ROUTES, isProtectedAccountRoute, normalizeAppRoutePath } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { tabbarStore } from '@/tabbar/store'
import { isTabbarShellRoute, isVisibleTabbarRoute } from '@/tabbar/config'

const shellRoutes: readonly string[] = [APP_ROUTES.login, APP_ROUTES.register, APP_ROUTES.startupError, APP_ROUTES.forbidden, APP_ROUTES.notFound]

export function resolveRouteAccess(path: string) {
  path = normalizeAppRoutePath(path)
  const appContextStore = useAppContextStore()
  if (shellRoutes.includes(path) || isPublicRoute(path))
    return { allowed: true, redirect: '' }

  if (isTabbarShellRoute(path)) {
    return isVisibleTabbarRoute(appContextStore.navigationMode, path)
      ? { allowed: true, redirect: '' }
      : { allowed: false, redirect: APP_ROUTES.forbidden }
  }

  if (isProtectedAccountRoute(path) && !appContextStore.authenticated)
    return { allowed: false, redirect: `${APP_ROUTES.login}?redirect=${encodeURIComponent(path)}` }

  const module = findModuleByRoute(path)
  if (!module)
    return { allowed: false, redirect: APP_ROUTES.notFound }
  if (module.requiresAuth && !appContextStore.authenticated)
    return { allowed: false, redirect: `${APP_ROUTES.login}?redirect=${encodeURIComponent(path)}` }
  if (!appContextStore.visibleModules.some(item => item.key === module.key))
    return { allowed: false, redirect: APP_ROUTES.forbidden }
  return { allowed: true, redirect: '' }
}

export const permission = {
  install(router) {
    router.beforeEach(async (to, from, next) => {
      const path = normalizeAppRoutePath(to.path)
      const appContextStore = useAppContextStore()
      if (!shellRoutes.includes(path) && appContextStore.startupState !== 'ready') {
        await appContextStore.bootstrap()
        if (appContextStore.startupState === 'recoverable-error' || appContextStore.startupState === 'fatal-error') {
          next(APP_ROUTES.startupError)
          return
        }
      }
      appContextStore.syncRouteContext(path)
      tabbarStore.syncCurrentPath(path)
      const decision = resolveRouteAccess(path)
      if (!decision.allowed) {
        next(decision.redirect)
        return
      }
      next()
    })
  },
}
