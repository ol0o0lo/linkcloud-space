import type { AppModeSelection } from '@/domain/app-mode'
import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useRuntimeStore } from './runtime'
import { useWorkspaceStore } from './workspace'

/**
 * 页面迁移期的只读门面。状态分别由 runtime/session/workspace Store 持有，
 * 新 feature 应直接依赖职责对应的 Store，不再向本门面增加状态。
 */
export const useAppContextStore = defineStore('app-context-facade', () => {
  const runtimeStore = useRuntimeStore()
  const workspaceStore = useWorkspaceStore()

  const startupState = computed(() => runtimeStore.startupState)
  const startupError = computed(() => runtimeStore.startupErrorMessage)
  const publicConfig = computed(() => runtimeStore.publicConfig)
  const user = computed(() => workspaceStore.user)
  const organizations = computed(() => workspaceStore.organizations)
  const landlordRelationships = computed(() => workspaceStore.landlordRelationships)
  const mode = computed(() => workspaceStore.mode)
  const organizationSlug = computed(() => workspaceStore.organizationSlug)
  const landlordContactId = computed(() => workspaceStore.landlordContactId)
  const navigationMode = computed(() => workspaceStore.navigationMode)
  const requestedMode = computed(() => workspaceStore.requestedMode)
  const requestedOrgSlug = computed(() => workspaceStore.requestedOrgSlug)
  const requestedLandlordContactId = computed(() => workspaceStore.requestedLandlordContactId)
  const capabilities = computed(() => workspaceStore.capabilities)
  const authenticated = computed(() => workspaceStore.authenticated)
  const currentOrganization = computed(() => workspaceStore.currentOrganization)
  const currentLandlordRelationship = computed(() => workspaceStore.currentLandlordRelationship)
  const modeOptions = computed(() => workspaceStore.modeOptions)
  const modePresentation = computed(() => workspaceStore.modePresentation)
  const visibleModules = computed(() => workspaceStore.visibleModules)

  function switchMode(selection: AppModeSelection) {
    return workspaceStore.switchMode(selection)
  }

  return {
    startupState,
    startupError,
    publicConfig,
    user,
    organizations,
    landlordRelationships,
    mode,
    organizationSlug,
    landlordContactId,
    navigationMode,
    requestedMode,
    requestedOrgSlug,
    requestedLandlordContactId,
    capabilities,
    authenticated,
    currentOrganization,
    currentLandlordRelationship,
    modeOptions,
    modePresentation,
    visibleModules,
    resetToVisitor: workspaceStore.resetToVisitor,
    bootstrap: runtimeStore.bootstrap,
    refreshAuthenticatedContext: runtimeStore.refreshAuthenticatedContext,
    switchMode,
    requestPersonalMode: workspaceStore.requestPersonalMode,
    syncRouteContext: workspaceStore.syncRouteContext,
  }
})
