import type { TabBar } from '@uni-helper/vite-plugin-uni-pages'
import type { AppMode } from '../domain/app-mode'
import type { CustomTabBarItem, TabbarProfileMap, TabbarShellItem } from './types'
import { findCatalogModuleByRoute, getRuntimeTabbarItems, getTabbarShellItems } from '../modules/catalog.ts'

/**
 * 微信构建要求静态声明最多五个 TabBar 页面；具体标题与图标由模块目录按当前模式派生。
 */
export const tabbarShellItems: readonly TabbarShellItem[] = getTabbarShellItems()

function createTabbarProfile(mode: AppMode): readonly CustomTabBarItem[] {
  return getRuntimeTabbarItems(mode, 'h5')
}

export const tabbarProfiles = {
  visitor: createTabbarProfile('visitor'),
  personal: createTabbarProfile('personal'),
  landlord: createTabbarProfile('landlord'),
  organization: createTabbarProfile('organization'),
} satisfies TabbarProfileMap

export function getTabbarItems(mode: AppMode): readonly CustomTabBarItem[] {
  return tabbarProfiles[mode]
}

export function isTabbarShellRoute(path: string): boolean {
  const normalizedPath = path.replace(/^\//, '').split('?')[0]
  return tabbarShellItems.some(item => item.pagePath === normalizedPath)
}

export function isVisibleTabbarRoute(mode: AppMode, path: string): boolean {
  const normalizedPath = path.replace(/^\//, '').split('?')[0]
  return getTabbarItems(mode).some(item => item.pagePath === normalizedPath)
}

/**
 * 主包 Tab 页面即使没有出现在当前角色的 TabBar 中，仍可作为首页二级入口访问。
 * 页面是否属于当前角色继续由模块目录统一判断，避免在路由守卫中重复维护角色清单。
 */
export function isAvailableTabbarShellRoute(mode: AppMode, path: string): boolean {
  const normalizedPath = path.replace(/^\//, '').split('?')[0]
  if (!isTabbarShellRoute(normalizedPath))
    return false
  return findCatalogModuleByRoute(`/${normalizedPath}`)?.modes.includes(mode) === true
}

export const tabBar: TabBar = {
  custom: true,
  color: '#667085',
  selectedColor: '#0081ff',
  backgroundColor: '#ffffff',
  borderStyle: 'black',
  height: '50px',
  fontSize: '10px',
  iconWidth: '24px',
  spacing: '3px',
  list: tabbarShellItems.map(item => ({
    text: ({ primary: '首页', business: '业务', activity: '动态', messages: '消息', account: '我的' } as const)[item.slot],
    pagePath: item.pagePath,
  })) as unknown as TabBar['list'],
}
