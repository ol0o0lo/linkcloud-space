/**
 * by 菲鸽 on 2025-08-19
 * 路由拦截，通常也是登录拦截
 * 黑、白名单的配置，请看 config.ts 文件， EXCLUDE_LOGIN_PATH_LIST
 */
import { getDefaultRouteForMode } from '@/modules/registry'
import { normalizeAppRoutePath } from '@/modules/routes'
import { resolveRouteAccess } from '@/router/permission'
import { useAppContextStore } from '@/store/app-context-v2'
import { tabbarStore } from '@/tabbar/store'
import { getAllPages, getLastPage, parseUrlToObj } from '@/utils/index'
import { EXCLUDE_LOGIN_PATH_LIST, LOGIN_PAGE } from './config'

export const FG_LOG_ENABLE = false

export function judgeIsExcludePath(path: string) {
  const isDev = import.meta.env.DEV
  if (!isDev) {
    return EXCLUDE_LOGIN_PATH_LIST.includes(path)
  }
  const allExcludeLoginPages = getAllPages('excludeLoginPath') // dev 环境下，需要每次都重新获取，否则新配置就不会生效
  return EXCLUDE_LOGIN_PATH_LIST.includes(path) || (isDev && allExcludeLoginPages.some(page => page.path === path))
}

export const navigateToInterceptor = {
  // 注意，这里的url是 '/' 开头的，如 '/pages/index/index'，跟 'pages.json' 里面的 path 不同
  // 增加对相对路径的处理，BY 网友 @ideal
  invoke({ url, query }: { url: string, query?: Record<string, string> }) {
    if (url === undefined) {
      return
    }
    let { path, query: _query } = parseUrlToObj(url)

    FG_LOG_ENABLE && console.log('\n\n路由拦截器:-------------------------------------')
    FG_LOG_ENABLE && console.log('路由拦截器 1: url->', url, ', query ->', query)
    const myQuery = { ..._query, ...query }
    // /pages/route-interceptor/index?name=feige&age=30
    FG_LOG_ENABLE && console.log('路由拦截器 2: path->', path, ', _query ->', _query)
    FG_LOG_ENABLE && console.log('路由拦截器 3: myQuery ->', myQuery)

    // 处理相对路径
    if (!path.startsWith('/')) {
      const currentPath = getLastPage()?.route || ''
      const normalizedCurrentPath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`
      const baseDir = normalizedCurrentPath.substring(0, normalizedCurrentPath.lastIndexOf('/'))
      path = `${baseDir}/${path}`
    }
    path = normalizeAppRoutePath(path)

    // // 处理路由不存在的情况
    // if (path !== '/' && !getAllPages().some(page => page.path === path)) {
    //   console.warn('路由不存在:', path)
    //   return false // 明确表示阻止原路由继续执行
    // }

    // // 插件页面
    // if (url.startsWith('plugin://')) {
    //   FG_LOG_ENABLE && console.log('路由拦截器 4: plugin:// 路径 ==>', url)
    //   path = url
    // }

    const appContextStore = useAppContextStore()
    appContextStore.syncRouteContext(path)

    tabbarStore.syncCurrentPath(path)

    if (appContextStore.startupState !== 'ready')
      return true

    if (path === LOGIN_PAGE && appContextStore.authenticated) {
      const target = myQuery.redirect || getDefaultRouteForMode(appContextStore.mode)
      uni.reLaunch({ url: target })
      return false
    }

    const decision = resolveRouteAccess(path)
    if (!decision.allowed) {
      uni.navigateTo({ url: decision.redirect })
      return false
    }
    return true
  },
}

// 针对 chooseLocation 的特殊处理
export const chooseLocationInterceptor = {
  invoke(options: any) {
    // 直接放行 chooseLocation 调用
    FG_LOG_ENABLE && console.log('chooseLocation 调用，直接放行:', options)
    return true
  },
}

export const routeInterceptor = {
  install() {
    uni.addInterceptor('navigateTo', navigateToInterceptor)
    uni.addInterceptor('reLaunch', navigateToInterceptor)
    uni.addInterceptor('redirectTo', navigateToInterceptor)
    uni.addInterceptor('switchTab', navigateToInterceptor)

    // 添加 chooseLocation 的拦截器，确保直接放行
    uni.addInterceptor('chooseLocation', chooseLocationInterceptor)
  },
}
