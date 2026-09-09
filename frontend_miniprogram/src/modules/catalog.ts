import type { AppMode } from '../domain/app-mode.ts'
import type { AppPlatform } from '../core/config/app-config.ts'

export type ModuleStatus = 'active' | 'planned' | 'development'
export type TabbarSlot = 'primary' | 'business' | 'activity' | 'messages' | 'account'
export type SubpackageArea = 'public' | 'personal' | 'landlord' | 'organization' | 'development'
export type SubpackageKey
  = | 'housing'
    | 'personal-rental'
    | 'landlord'
    | 'organization-rental'
    | 'organization-work'
    | 'organization-admin'

export interface SubpackageDefinition {
  key: SubpackageKey
  root: string
  sourceRoot: string
  area: SubpackageArea
  status: ModuleStatus
  description: string
}

export interface ModuleTabbarPresentation {
  slot: TabbarSlot
  text: string
  icon: string
}

export interface AppModuleDefinition {
  key: string
  title: string
  status: ModuleStatus
  modes: readonly AppMode[]
  platforms: readonly AppPlatform[]
  mainRoute: string
  routePrefixes: readonly string[]
  subpackages: readonly SubpackageDefinition[]
  requiresAuth: boolean
  capability?: string
  order: number
  tabbar?: Partial<Record<AppMode, ModuleTabbarPresentation>>
}

const currentPlatforms = ['h5', 'mp-weixin'] as const

export const appModuleCatalog: readonly AppModuleDefinition[] = [
  {
    key: 'home',
    title: '首页',
    status: 'active',
    modes: ['visitor', 'personal', 'landlord', 'organization'],
    platforms: currentPlatforms,
    mainRoute: '/pages/index/index',
    routePrefixes: [],
    subpackages: [],
    requiresAuth: false,
    order: 10,
    tabbar: {
      visitor: { slot: 'primary', text: '首页', icon: 'i-carbon-home' },
      personal: { slot: 'primary', text: '首页', icon: 'i-carbon-home' },
      landlord: { slot: 'primary', text: '概览', icon: 'i-carbon-dashboard' },
      organization: { slot: 'primary', text: '工作台', icon: 'i-carbon-workspace' },
    },
  },
  {
    key: 'houses',
    title: '找房',
    status: 'active',
    modes: ['visitor', 'personal', 'landlord', 'organization'],
    platforms: currentPlatforms,
    mainRoute: '/pages/houses/index',
    routePrefixes: ['/pages/houses/'],
    subpackages: [
      {
        key: 'housing',
        root: 'pages-housing',
        sourceRoot: 'src/pages-housing',
        area: 'public',
        status: 'active',
        description: '公开房源详情、分享和小区信息',
      },
    ],
    requiresAuth: false,
    order: 20,
    tabbar: {
      visitor: { slot: 'business', text: '找房', icon: 'i-carbon-building' },
      personal: { slot: 'business', text: '找房', icon: 'i-carbon-building' },
      landlord: { slot: 'business', text: '房源', icon: 'i-carbon-building' },
      organization: { slot: 'business', text: '业务', icon: 'i-carbon-apps' },
    },
  },
  {
    key: 'favorites',
    title: '我的找房',
    status: 'active',
    modes: ['personal', 'landlord', 'organization'],
    platforms: currentPlatforms,
    mainRoute: '/pages/favorites/index',
    routePrefixes: [],
    subpackages: [
      {
        key: 'personal-rental',
        root: 'pages-personal-rental',
        sourceRoot: 'src/pages-personal-rental',
        area: 'personal',
        status: 'active',
        description: '个人预约、带看进度和本人租约',
      },
    ],
    requiresAuth: true,
    order: 30,
    tabbar: {
      personal: { slot: 'activity', text: '我的找房', icon: 'i-carbon-favorite' },
      landlord: { slot: 'activity', text: '租约', icon: 'i-carbon-document' },
      organization: { slot: 'activity', text: '待办', icon: 'i-carbon-task' },
    },
  },
  {
    key: 'landlord',
    title: '房东业务',
    status: 'active',
    modes: ['landlord'],
    platforms: currentPlatforms,
    mainRoute: '/pages-landlord/store/index',
    routePrefixes: [],
    subpackages: [
      {
        key: 'landlord',
        root: 'pages-landlord',
        sourceRoot: 'src/pages-landlord',
        area: 'landlord',
        status: 'active',
        description: '房东关系切换、名下房源、租约摘要和公开店铺',
      },
    ],
    requiresAuth: true,
    order: 40,
  },
  {
    key: 'organization-rental',
    title: '组织业务',
    status: 'active',
    modes: ['organization'],
    platforms: currentPlatforms,
    mainRoute: '/pages-org-rental/index',
    routePrefixes: [],
    subpackages: [
      {
        key: 'organization-rental',
        root: 'pages-org-rental',
        sourceRoot: 'src/pages-org-rental',
        area: 'organization',
        status: 'active',
        description: '组织房源、客户、带看和租约经营流程',
      },
    ],
    requiresAuth: true,
    order: 50,
  },
  {
    key: 'organization-work',
    title: '组织协作',
    status: 'active',
    modes: ['organization'],
    platforms: currentPlatforms,
    mainRoute: '/pages-org-work/index',
    routePrefixes: [],
    subpackages: [
      {
        key: 'organization-work',
        root: 'pages-org-work',
        sourceRoot: 'src/pages-org-work',
        area: 'organization',
        status: 'active',
        description: '组织待办、任务、公告和消息处理',
      },
    ],
    requiresAuth: true,
    order: 60,
  },
  {
    key: 'organization-admin',
    title: '组织管理',
    status: 'active',
    modes: ['organization'],
    platforms: currentPlatforms,
    mainRoute: '/pages-org-admin/index',
    routePrefixes: [],
    subpackages: [
      {
        key: 'organization-admin',
        root: 'pages-org-admin',
        sourceRoot: 'src/pages-org-admin',
        area: 'organization',
        status: 'active',
        description: '组织成员、团队、角色、设置、订阅和经营分析',
      },
    ],
    requiresAuth: true,
    order: 70,
  },
  {
    key: 'messages',
    title: '消息',
    status: 'active',
    modes: ['personal', 'landlord', 'organization'],
    platforms: currentPlatforms,
    mainRoute: '/pages/messages/index',
    routePrefixes: ['/pages/messages/'],
    subpackages: [],
    requiresAuth: true,
    order: 80,
    tabbar: {
      personal: { slot: 'messages', text: '消息', icon: 'i-carbon-notification' },
      landlord: { slot: 'messages', text: '消息', icon: 'i-carbon-notification' },
      organization: { slot: 'messages', text: '消息', icon: 'i-carbon-notification' },
    },
  },
  {
    key: 'me',
    title: '我的',
    status: 'active',
    modes: ['visitor', 'personal', 'landlord', 'organization'],
    platforms: currentPlatforms,
    mainRoute: '/pages/me/me',
    routePrefixes: ['/pages/me/', '/pages/account/'],
    subpackages: [],
    requiresAuth: false,
    order: 90,
    tabbar: {
      visitor: { slot: 'account', text: '我的', icon: 'i-carbon-user' },
      personal: { slot: 'account', text: '我的', icon: 'i-carbon-user' },
      landlord: { slot: 'account', text: '我的', icon: 'i-carbon-user' },
      organization: { slot: 'account', text: '我的', icon: 'i-carbon-user' },
    },
  },
]

const slotOrder: Record<TabbarSlot, number> = {
  primary: 10,
  business: 20,
  activity: 30,
  messages: 40,
  account: 50,
}

export function getAllSubpackages(): SubpackageDefinition[] {
  return appModuleCatalog.flatMap(item => [...item.subpackages])
}

export function getCatalogModule(key: string): AppModuleDefinition {
  const module = appModuleCatalog.find(item => item.key === key)
  if (!module)
    throw new Error(`未知模块：${key}`)
  return module
}

export function getBuildSubpackages(buildMode: 'development' | 'production'): SubpackageDefinition[] {
  return getAllSubpackages().filter(item => item.status === 'active' || (buildMode === 'development' && item.status === 'development'))
}

export function getTabbarShellItems(): Array<{ slot: TabbarSlot, pagePath: string }> {
  const shellSlots: TabbarSlot[] = ['primary', 'business', 'activity', 'messages', 'account']
  return shellSlots.map((slot) => {
    const owner = appModuleCatalog.find(module => Object.values(module.tabbar || {}).some(item => item?.slot === slot))
    if (!owner)
      throw new Error(`TabBar 槽位缺少模块定义：${slot}`)
    return { slot, pagePath: owner.mainRoute.replace(/^\//, '') }
  })
}

export function getRuntimeTabbarItems(mode: AppMode, platform: AppPlatform): Array<ModuleTabbarPresentation & { pagePath: string }> {
  return appModuleCatalog
    .filter(item => item.status === 'active' && item.modes.includes(mode) && item.platforms.includes(platform) && item.tabbar?.[mode])
    .map((item) => {
      const tabbar = item.tabbar?.[mode] as ModuleTabbarPresentation
      return { ...tabbar, pagePath: item.mainRoute.replace(/^\//, '') }
    })
    .sort((left, right) => slotOrder[left.slot] - slotOrder[right.slot])
}

export function findCatalogModuleByRoute(url: string): AppModuleDefinition | undefined {
  const path = url.split('?')[0]
  return appModuleCatalog.find((item) => {
    if (item.mainRoute === path || item.routePrefixes.some(prefix => path.startsWith(prefix)))
      return true
    return item.subpackages.some(subpackage => subpackage.status === 'active' && path.startsWith(`/${subpackage.root}/`))
  })
}
