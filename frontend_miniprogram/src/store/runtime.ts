import type { AppContextOut } from '@/services/manual/app-context'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getRuntimeAppConfig } from '@/core/config/runtime'
import { AppError } from '@/core/errors/app-error'
import { createSingleFlight } from '@/core/lifecycle/single-flight'
import { getPublicAppContext } from '@/services/manual/app-context'
import { useSessionStore } from './session'
import { useWorkspaceStore } from './workspace'

export type StartupState = 'idle' | 'loading' | 'ready' | 'recoverable-error' | 'fatal-error'

function toRuntimeError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError)
    return error
  return new AppError({
    kind: 'unexpected',
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  })
}

export const useRuntimeStore = defineStore('app-runtime', () => {
  const startupState = ref<StartupState>('idle')
  const startupError = ref<AppError | null>(null)
  const publicConfig = ref<AppContextOut | null>(null)
  const startupErrorMessage = computed(() => startupError.value?.message || '')

  const runBootstrap = createSingleFlight(async () => {
    if (startupState.value === 'ready')
      return
    startupState.value = 'loading'
    startupError.value = null

    try {
      getRuntimeAppConfig()
      publicConfig.value = await getPublicAppContext()
    }
    catch (error) {
      startupError.value = toRuntimeError(error, '应用配置加载失败')
      startupState.value = 'fatal-error'
      return
    }

    const sessionStore = useSessionStore()
    const workspaceStore = useWorkspaceStore()
    try {
      const hasValidSession = await sessionStore.validateSession()
      if (!hasValidSession && !await sessionStore.tryAutomaticWechatLogin()) {
        workspaceStore.resetToVisitor()
        startupState.value = 'ready'
        return
      }
      await workspaceStore.refreshAuthenticatedContext()
      startupState.value = 'ready'
    }
    catch (error) {
      startupError.value = toRuntimeError(error, '登录状态加载失败')
      startupState.value = 'recoverable-error'
    }
  })

  const runSessionRecovery = createSingleFlight(async () => {
    const sessionStore = useSessionStore()
    const workspaceStore = useWorkspaceStore()
    sessionStore.clearSession()
    workspaceStore.resetToVisitor()
    if (!await sessionStore.tryAutomaticWechatLogin()) {
      startupState.value = 'ready'
      return false
    }
    await refreshAuthenticatedContext()
    return true
  })

  async function refreshAuthenticatedContext() {
    startupState.value = 'loading'
    startupError.value = null
    try {
      await useWorkspaceStore().refreshAuthenticatedContext()
      startupState.value = 'ready'
    }
    catch (error) {
      startupError.value = toRuntimeError(error, '登录状态加载失败')
      startupState.value = 'recoverable-error'
      throw error
    }
  }

  return {
    startupState,
    startupError,
    startupErrorMessage,
    publicConfig,
    bootstrap: runBootstrap,
    recoverSession: runSessionRecovery,
    refreshAuthenticatedContext,
  }
})
