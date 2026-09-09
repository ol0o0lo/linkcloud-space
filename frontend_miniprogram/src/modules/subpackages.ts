import type { ModuleStatus, SubpackageArea, SubpackageDefinition, SubpackageKey } from './catalog.ts'
import { getAllSubpackages, getBuildSubpackages } from './catalog.ts'

export type { SubpackageArea, SubpackageDefinition, SubpackageKey }
export type SubpackageStatus = ModuleStatus
export type SubpackageBuildMode = 'development' | 'production'

/**
 * 产品分包边界。
 *
 * 主包只保留启动、认证、错误页和稳定 TabBar 入口页。业务详情和流程页按业务域进入分包，
 * 不按用户模式堆进一个大包。planned 分包只声明边界，不生成空分包；development 分包只进入开发构建。
 */
export const subpackageDefinitions = getAllSubpackages()

export const productionSubpackages = getBuildSubpackages('production')

export const productionSubpackageRoots = productionSubpackages.map(item => item.root)
export const productionExcludedSubpackageRoots = subpackageDefinitions.filter(item => item.status !== 'active').map(item => item.root)

export function getSubpackageSourceRootsForBuild(mode: SubpackageBuildMode): string[] {
  return getBuildSubpackages(mode).map(item => item.sourceRoot)
}

export function getSubpackageDefinition(key: SubpackageKey): SubpackageDefinition {
  const definition = subpackageDefinitions.find(item => item.key === key)
  if (!definition)
    throw new Error(`未知分包：${key}`)
  return definition
}

export function getSubpackageRoutePrefix(key: SubpackageKey): string {
  return `/${getSubpackageDefinition(key).root}/`
}

export function getProductSubpackageRoutePrefixes(keys: readonly SubpackageKey[]): string[] {
  return keys
    .map(getSubpackageDefinition)
    .filter(item => item.status === 'active')
    .map(item => `/${item.root}/`)
}

export function buildSubpackageRoute(key: SubpackageKey, path: string): string {
  const definition = getSubpackageDefinition(key)
  if (definition.status !== 'active')
    throw new Error(`分包尚未启用：${key}`)
  return `${getSubpackageRoutePrefix(key)}${path.replace(/^\//, '')}`
}
