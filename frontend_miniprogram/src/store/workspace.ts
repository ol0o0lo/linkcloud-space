import type { AppMode, AppModeSelection, ResolvedAppMode } from '@/domain/app-mode'
import type { ModuleContext } from '@/domain/navigation'
import type { LandlordRelationship, MeOut, SwitchListItemOut } from '@/services/manual/workspace'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { buildAppModeOptions, getAppModePresentation, resolveAppMode, resolveNavigationMode } from '@/domain/app-mode'
import { filterVisibleModules } from '@/domain/navigation'
import { createVersionedStorage } from '@/infra/storage/versioned-storage'
import { appModules, isPublicRoute } from '@/modules/registry'
import { platformStorage } from '@/platform'
import { getCurrentUser, getOrganizationNavigationCapabilities, listAvailableOrganizations, listLandlordRelationships } from '@/services/manual/workspace'

export interface NavigationCapabilities {
  role_management: boolean
  organization_settings: boolean
  organization_settings_manage: boolean
  team_settings: boolean
  team_settings_view_ids: number[]
  team_settings_manage_ids: number[]
  subscriptions: boolean
  subscriptions_manage: boolean
  analytics: boolean
  allocation: boolean
  notification_dispatches: boolean
  [key: string]: boolean | number[]
}

interface PersistedWorkspaceSelection {
  requestedMode: AppMode | null
  requestedOrgSlug: string
  requestedLandlordContactId: number | null
}

const emptyCapabilities: NavigationCapabilities = {
  role_management: false,
  organization_settings: false,
  organization_settings_manage: false,
  team_settings: false,
  team_settings_view_ids: [],
  team_settings_manage_ids: [],
  subscriptions: false,
  subscriptions_manage: false,
  analytics: false,
  allocation: false,
  notification_dispatches: false,
}

function isAppMode(value: unknown): value is AppMode {
  return value === 'visitor' || value === 'personal' || value === 'landlord' || value === 'organization'
}

function isWorkspaceSelection(value: unknown): value is PersistedWorkspaceSelection {
  if (!value || typeof value !== 'object')
    return false
  const selection = value as Record<string, unknown>
  return (selection.requestedMode === null || isAppMode(selection.requestedMode))
    && typeof selection.requestedOrgSlug === 'string'
    && (selection.requestedLandlordContactId === null || typeof selection.requestedLandlordContactId === 'number')
}

const workspacePersistence = createVersionedStorage<PersistedWorkspaceSelection>({
  key: 'app-context',
  version: 1,
  legacyVersion: 0,
  storage: platformStorage.persistent,
  validate: isWorkspaceSelection,
  migrations: {
    0(value) {
      const legacy = value && typeof value === 'object' ? value as Record<string, unknown> : {}
      return {
        requestedMode: isAppMode(legacy.requestedMode) ? legacy.requestedMode : null,
        requestedOrgSlug: typeof legacy.requestedOrgSlug === 'string' ? legacy.requestedOrgSlug : '',
        requestedLandlordContactId: typeof legacy.requestedLandlordContactId === 'number' ? legacy.requestedLandlordContactId : null,
      }
    },
  },
})

export const useWorkspaceStore = defineStore('app-workspace', () => {
  const restored = workspacePersistence.read()
  const user = ref<MeOut | null>(null)
  const organizations = ref<SwitchListItemOut[]>([])
  const landlordRelationships = ref<LandlordRelationship[]>([])
  const mode = ref<AppMode>('visitor')
  const organizationSlug = ref('')
  const landlordContactId = ref<number | null>(null)
  const publicRouteActive = ref(false)
  const requestedMode = ref<AppMode | null>(restored?.requestedMode || null)
  const requestedOrgSlug = ref(restored?.requestedOrgSlug || '')
  const requestedLandlordContactId = ref<number | null>(restored?.requestedLandlordContactId || null)
  const capabilities = ref<NavigationCapabilities>({ ...emptyCapabilities })

  const authenticated = computed(() => Boolean(user.value))
  const currentOrganization = computed(() => organizations.value.find(item => item.slug === organizationSlug.value) || null)
  const currentLandlordRelationship = computed(() => landlordRelationships.value.find(item => item.contact_id === landlordContactId.value) || null)
  const modeOptions = computed(() => buildAppModeOptions({
    mode: mode.value,
    organizationSlug: organizationSlug.value,
    landlordContactId: landlordContactId.value,
    organizations: organizations.value,
    landlordRelationships: landlordRelationships.value,
  }))
  const modePresentation = computed(() => getAppModePresentation({
    mode: mode.value,
    organization: currentOrganization.value,
    landlordRelationship: currentLandlordRelationship.value,
  }))
  const navigationMode = computed(() => resolveNavigationMode({
    selectedMode: mode.value,
    authenticated: authenticated.value,
    publicRoute: publicRouteActive.value,
  }))
  const moduleContext = computed<ModuleContext>(() => ({
    mode: navigationMode.value,
    authenticated: authenticated.value,
    capabilities: Object.fromEntries(Object.entries(capabilities.value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')),
  }))
  const visibleModules = computed(() => filterVisibleModules(appModules, moduleContext.value))

  watch([requestedMode, requestedOrgSlug, requestedLandlordContactId], () => {
    workspacePersistence.write({
      requestedMode: requestedMode.value,
      requestedOrgSlug: requestedOrgSlug.value,
      requestedLandlordContactId: requestedLandlordContactId.value,
    })
  })

  function resetToVisitor() {
    user.value = null
    organizations.value = []
    landlordRelationships.value = []
    mode.value = 'visitor'
    organizationSlug.value = ''
    landlordContactId.value = null
    capabilities.value = { ...emptyCapabilities }
  }

  async function loadCapabilitiesFor(resolvedMode: ResolvedAppMode): Promise<NavigationCapabilities> {
    if (resolvedMode.mode !== 'organization')
      return { ...emptyCapabilities }
    return getOrganizationNavigationCapabilities<NavigationCapabilities>(resolvedMode.organizationSlug)
  }

  function resolveRequestedMode(
    nextMode = requestedMode.value,
    nextOrgSlug = requestedOrgSlug.value,
    nextLandlordContactId = requestedLandlordContactId.value,
    currentUser: MeOut | null = user.value,
    organizationItems: SwitchListItemOut[] = organizations.value,
    landlordItems: LandlordRelationship[] = landlordRelationships.value,
  ) {
    return resolveAppMode({
      authenticated: Boolean(currentUser),
      requestedMode: nextMode,
      requestedOrgSlug: nextOrgSlug,
      requestedLandlordContactId: nextLandlordContactId,
      organizations: organizationItems,
      landlordRelationships: landlordItems,
    })
  }

  async function loadAuthenticatedSnapshot() {
    const [currentUser, organizationItems, landlordItems] = await Promise.all([
      getCurrentUser(),
      listAvailableOrganizations(),
      listLandlordRelationships(),
    ])
    const resolvedMode = resolveRequestedMode(requestedMode.value, requestedOrgSlug.value, requestedLandlordContactId.value, currentUser, organizationItems, landlordItems)
    const nextCapabilities = await loadCapabilitiesFor(resolvedMode)
    return { currentUser, organizationItems, landlordItems, resolvedMode, nextCapabilities }
  }

  function applyAuthenticatedSnapshot(snapshot: Awaited<ReturnType<typeof loadAuthenticatedSnapshot>>) {
    user.value = snapshot.currentUser
    organizations.value = snapshot.organizationItems
    landlordRelationships.value = snapshot.landlordItems
    mode.value = snapshot.resolvedMode.mode
    organizationSlug.value = snapshot.resolvedMode.organizationSlug
    landlordContactId.value = snapshot.resolvedMode.landlordContactId
    capabilities.value = snapshot.nextCapabilities
  }

  async function refreshAuthenticatedContext() {
    applyAuthenticatedSnapshot(await loadAuthenticatedSnapshot())
  }

  async function switchMode(selection: AppModeSelection) {
    const nextOrgSlug = selection.mode === 'organization' ? selection.organizationSlug : ''
    const nextLandlordContactId = selection.mode === 'landlord' ? selection.landlordContactId : null
    const resolvedMode = resolveRequestedMode(selection.mode, nextOrgSlug, nextLandlordContactId)
    if (resolvedMode.mode !== selection.mode
      || (selection.mode === 'organization' && resolvedMode.organizationSlug !== nextOrgSlug)
      || (selection.mode === 'landlord' && resolvedMode.landlordContactId !== nextLandlordContactId)) {
      throw new Error('该身份当前不可用，请重新选择身份')
    }
    const nextCapabilities = await loadCapabilitiesFor(resolvedMode)
    requestedMode.value = selection.mode
    requestedOrgSlug.value = nextOrgSlug
    requestedLandlordContactId.value = nextLandlordContactId
    mode.value = resolvedMode.mode
    organizationSlug.value = resolvedMode.organizationSlug
    landlordContactId.value = resolvedMode.landlordContactId
    capabilities.value = nextCapabilities
  }

  function requestPersonalMode() {
    requestedMode.value = 'personal'
    requestedOrgSlug.value = ''
    requestedLandlordContactId.value = null
  }

  function syncRouteContext(path: string) {
    publicRouteActive.value = isPublicRoute(path)
  }

  return {
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
    resetToVisitor,
    refreshAuthenticatedContext,
    switchMode,
    requestPersonalMode,
    syncRouteContext,
  }
})
