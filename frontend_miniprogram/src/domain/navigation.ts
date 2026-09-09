import type { AppMode } from './app-mode.ts'

export interface ModuleDefinition {
  key: string
  title: string
  route: string
  modes: readonly AppMode[]
  enabled: boolean
  requiresAuth: boolean
  order: number
  capability?: string
}

export interface ModuleContext {
  mode: AppMode
  authenticated: boolean
  capabilities: Record<string, boolean>
}

export function filterVisibleModules<T extends ModuleDefinition>(modules: readonly T[], context: ModuleContext): T[] {
  return modules
    .filter((item) => {
      if (!item.enabled || !item.modes.includes(context.mode))
        return false
      if (item.requiresAuth && !context.authenticated)
        return false
      if (item.capability && !context.capabilities[item.capability])
        return false
      return true
    })
    .sort((left, right) => left.order - right.order)
}
