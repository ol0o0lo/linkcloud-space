import type { AppMode, AppModeSelection, ResolvedAppMode } from '@/domain/app-mode'
import type { ModuleContext } from '@/domain/navigation'
import type { LandlordRelationship } from '@/services/manual/landlord'
import type { AppContextOut, MeOut, SwitchListItemOut } from '@/services/openapi/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { buildAppModeOptions, getAppModePresentation, resolveAppMode, resolveNavigationMode } from '@/domain/app-mode'
import { filterVisibleModules } from '@/domain/navigation'
import { httpGet } from '@/http/http'
import { appModules, isPublicRoute } from '@/modules/registry'
import { listLandlordRelationships } from '@/services/manual/landlord'
import { organizationsSwitchListUsingGet } from '@/services/openapi/jichu'
import { appContextUsingGet } from '@/services/openapi/xitong'
import { usersMeUsingGet } from '@/services/openapi/zhanghu'
import { useSessionStore } from './session'

export type StartupState = 'idle' | 'loading' | 'ready' | 'error'

export interface NavigationCapabilities {
  role_management: boolean
  organization_settings: boolean
  team_settings: boolean
  subscriptions: boolean
  analytics: boolean
  allocation: boolean
  notification_dispatches: boolean
  [key: string]: boolean
}

const emptyCapabilities: NavigationCapabilities = {
  role_management: false,
  organization_settings: false,
  team_settings: false,
  subscriptions: false,
  analytics: false,
  allocation: false,
  notification_dispatches: false,
}

export const useAppContextStore = defineStore(
  'app-context',
  () => {
    const startupState = ref<StartupState>('idle')
    const startupError = ref('')
    const publicConfig = ref<AppContextOut | null>(null)
    const user = ref<MeOut | null>(null)
    const organizations = ref<SwitchListItemOut[]>([])
    const landlordRelationships = ref<LandlordRelationship[]>([])
    const mode = ref<AppMode>('visitor')
    const organizationSlug = ref('')
    const landlordContactId = ref<number | null>(null)
    const publicRouteActive = ref(false)
    const requestedMode = ref<AppMode | null>(null)
    const requestedOrgSlug = ref('')
    const requestedLandlordContactId = ref<number | null>(null)
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
      capabilities: capabilities.value,
    }))
    const visibleModules = computed(() => filterVisibleModules(appModules, moduleContext.value))

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
      return httpGet<NavigationCapabilities>('/api/access/navigation/', undefined, undefined, {
        requestScope: { kind: 'organization', organizationSlug: resolvedMode.organizationSlug },
      })
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
        usersMeUsingGet({ options: { requestScope: { kind: 'personal' }, hideErrorToast: true, skipAuthRedirect: true } }),
        organizationsSwitchListUsingGet({ options: { requestScope: { kind: 'personal' }, hideErrorToast: true, skipAuthRedirect: true } }),
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

    let bootstrapTask: Promise<void> | null = null

    function bootstrap() {
      if (bootstrapTask)
        return bootstrapTask
      bootstrapTask = (async () => {
        startupState.value = 'loading'
        startupError.value = ''
        try {
          publicConfig.value = await appContextUsingGet({ options: { requestScope: { kind: 'public' }, hideErrorToast: true } })
          const sessionStore = useSessionStore()
          if (!await sessionStore.validateSession()) {
            resetToVisitor()
            startupState.value = 'ready'
            return
          }
          applyAuthenticatedSnapshot(await loadAuthenticatedSnapshot())
          startupState.value = 'ready'
        }
        catch (error) {
          startupError.value = error instanceof Error ? error.message : '应用初始化失败，请检查网络后重试'
          startupState.value = 'error'
        }
        finally {
          bootstrapTask = null
        }
      })()
      return bootstrapTask
    }

    async function refreshAuthenticatedContext() {
      startupState.value = 'loading'
      startupError.value = ''
      try {
        applyAuthenticatedSnapshot(await loadAuthenticatedSnapshot())
        startupState.value = 'ready'
      }
      catch (error) {
        startupError.value = error instanceof Error ? error.message : '登录状态加载失败'
        startupState.value = 'error'
        throw error
      }
    }

    async function switchMode(selection: AppModeSelection) {
      const nextOrgSlug = selection.mode === 'organization' ? selection.organizationSlug : ''
      const nextLandlordContactId = selection.mode === 'landlord' ? selection.landlordContactId : null
      const resolvedMode = resolveRequestedMode(selection.mode, nextOrgSlug, nextLandlordContactId)
      if (resolvedMode.mode !== selection.mode
        || (selection.mode === 'organization' && resolvedMode.organizationSlug !== nextOrgSlug)
        || (selection.mode === 'landlord' && resolvedMode.landlordContactId !== nextLandlordContactId)) {
        throw new Error('目标模式不可用或上下文权限已失效')
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
      resetToVisitor,
      bootstrap,
      refreshAuthenticatedContext,
      switchMode,
      requestPersonalMode,
      syncRouteContext,
    }
  },
  {
    persist: {
      paths: ['requestedMode', 'requestedOrgSlug', 'requestedLandlordContactId'],
    },
  },
)
