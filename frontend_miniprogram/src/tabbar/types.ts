import type { AppMode } from '@/domain/app-mode'
import type { TabbarSlot } from '@/modules/catalog'

export type { TabbarSlot }

export type CustomTabBarItemBadge = number | 'dot'

export interface TabbarShellItem {
  slot: TabbarSlot
  pagePath: string
}

export interface CustomTabBarItem {
  slot: TabbarSlot
  text: string
  pagePath: string
  icon: string
  badge?: CustomTabBarItemBadge
}

export type TabbarProfileMap = Record<AppMode, readonly CustomTabBarItem[]>
