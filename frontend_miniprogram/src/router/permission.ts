import type { Router } from 'vue-router'
import { buildNavigationTarget, decodeNavigationRedirect, getRouteAccessDecision, getWorkspaceSelection, parseNavigationTarget, shellRoutes, withRouteWorkspace } from '@/domain/route-access'
import { APP_ROUTES, normalizeAppRoutePath } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { useWorkspaceStore } from '@/store/workspace'
import { tabbarStore } from '@/tabbar/store'

export function resolveRouteAccess(url: string) {
  return getRouteAccessDecision(url, useWorkspaceStore())
}

export function bindRouteWorkspace(url: string): string {
  const selection = getWorkspaceSelection(useWorkspaceStore())
  return selection ? withRouteWorkspace(url, selection) : url
}

export function getNavigationRedirect(options?: Record<string, unknown>): string {
  // H5 的 onLoad 会再次解码 query；读取 Router 原值，避免目标参数里的 & 被提前解码为分隔符。
  const app = getApp() as unknown as { $router?: Router }
  return decodeNavigationRedirect(app.$router?.currentRoute.value.query.redirect ?? options?.redirect)
}

export const permission = {
  install(router) {
    router.beforeEach(async (to, from, next) => {
      const path = normalizeAppRoutePath(to.path)
      const target = to.fullPath || buildNavigationTarget(path, to.query || {})
      const appContextStore = useAppContextStore()
      if (!shellRoutes.includes(path) && appContextStore.startupState !== 'ready') {
        await appContextStore.bootstrap()
        if (appContextStore.startupState === 'recoverable-error' || appContextStore.startupState === 'fatal-error') {
          next(APP_ROUTES.startupError)
          return
        }
      }
      const decision = resolveRouteAccess(target)
      if (!decision.allowed) {
        next(decision.redirect)
        return
      }
      const contextualTarget = bindRouteWorkspace(target)
      if (contextualTarget !== target) {
        next(contextualTarget)
        return
      }
      appContextStore.syncRouteContext(parseNavigationTarget(target).path)
      tabbarStore.syncCurrentPath(path)
      next()
    })
  },
}
