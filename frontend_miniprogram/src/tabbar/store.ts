import type { CustomTabBarItemBadge, TabbarSlot } from './types'
import { computed, reactive } from 'vue'
import { platformStorage } from '@/platform'
import { useAppContextStore } from '@/store/app-context-v2'
import { getTabbarItems } from './config'

const tabbarBadges = reactive<Partial<Record<TabbarSlot, CustomTabBarItemBadge>>>({})

const tabbarList = computed(() => {
  return getTabbarItems(useAppContextStore().navigationMode).map(item => ({
    ...item,
    pagePath: normalizeRoutePath(item.pagePath),
    badge: tabbarBadges[item.slot],
  }))
})

export function isPageTabbar(path: string) {
  const _path = normalizeRoutePath(path)
  return _path === '/' || tabbarList.value.some(item => item.pagePath === _path)
}

export function normalizeRoutePath(path?: string) {
  if (!path) {
    return ''
  }
  const _path = path.split('?')[0]
  return _path.startsWith('/') ? _path : `/${_path}`
}

function getCurrentPagePath() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  return normalizeRoutePath(currentPage?.route)
}

/**
 * 自定义 TabBar 的轻量状态管理。
 * 只持久化当前路径，保证 H5 刷新后仍能恢复正确的选中项。
 */
const tabbarStore = reactive({
  currentPath: normalizeRoutePath(platformStorage.persistent.getItem('app-tabbar-path') || ''),
  setCurrentPath(path: string) {
    this.currentPath = normalizeRoutePath(path)
    platformStorage.persistent.setItem('app-tabbar-path', this.currentPath)
  },
  setTabbarItemBadge(slot: TabbarSlot, badge?: CustomTabBarItemBadge) {
    tabbarBadges[slot] = badge
  },
  syncCurrentPath(path: string) {
    const list = tabbarList.value
    if (list.length === 0)
      return

    const normalizedPath = normalizeRoutePath(path)
    const matchedItem = normalizedPath === '/'
      ? list[0]
      : list.find(item => item.pagePath === normalizedPath)
    if (matchedItem) {
      this.setCurrentPath(matchedItem.pagePath)
      return
    }

    if (!list.some(item => item.pagePath === this.currentPath))
      this.setCurrentPath(list[0].pagePath)
  },
  syncCurrentPathByCurrentPage() {
    const currentPath = getCurrentPagePath()
    if (currentPath)
      this.syncCurrentPath(currentPath)
  },
  syncCurrentPathByCurrentPageAsync() {
    setTimeout(() => {
      this.syncCurrentPathByCurrentPage()
    }, 0)
  },
})

export { tabbarList, tabbarStore }
