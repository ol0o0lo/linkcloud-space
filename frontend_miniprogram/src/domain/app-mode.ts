export type AppMode = 'visitor' | 'personal' | 'landlord' | 'organization'

export type AppModeSelection
  = | { mode: 'personal' }
    | { mode: 'landlord', landlordContactId: number }
    | { mode: 'organization', organizationSlug: string }

export interface AppModeOrganization {
  name: string
  slug: string
  is_primary: boolean
}

export interface AppModeLandlordRelationship {
  contact_id: number
  contact_name: string
  organization_name: string
  house_count: number
}

export interface AppModeOption {
  key: string
  title: string
  description: string
  selection: AppModeSelection
  active: boolean
}

export interface AppModeOptionsInput {
  mode: AppMode
  organizationSlug: string
  landlordContactId: number | null
  organizations: AppModeOrganization[]
  landlordRelationships: AppModeLandlordRelationship[]
}

export interface AppModePresentationInput {
  mode: AppMode
  organization: AppModeOrganization | null
  landlordRelationship: AppModeLandlordRelationship | null
}

export interface AppModeInput {
  authenticated: boolean
  requestedMode: AppMode | null
  requestedOrgSlug: string
  requestedLandlordContactId: number | null
  organizations: Array<{ slug: string }>
  landlordRelationships: Array<{ contact_id: number }>
}

export interface ResolvedAppMode {
  mode: AppMode
  organizationSlug: string
  landlordContactId: number | null
}

export interface NavigationModeInput {
  selectedMode: AppMode
  authenticated: boolean
  publicRoute: boolean
}

export function resolveAppMode(input: AppModeInput): ResolvedAppMode {
  if (!input.authenticated) {
    return { mode: 'visitor', organizationSlug: '', landlordContactId: null }
  }

  if (input.requestedMode === 'organization' && input.requestedOrgSlug && input.organizations.some(organization => organization.slug === input.requestedOrgSlug)) {
    return { mode: 'organization', organizationSlug: input.requestedOrgSlug, landlordContactId: null }
  }

  if (input.requestedMode === 'landlord' && input.requestedLandlordContactId && input.landlordRelationships.some(relationship => relationship.contact_id === input.requestedLandlordContactId)) {
    return { mode: 'landlord', organizationSlug: '', landlordContactId: input.requestedLandlordContactId }
  }

  return { mode: 'personal', organizationSlug: '', landlordContactId: null }
}

export function resolveNavigationMode(input: NavigationModeInput): AppMode {
  if (!input.publicRoute)
    return input.selectedMode
  return input.authenticated ? 'personal' : 'visitor'
}

export function buildAppModeOptions(input: AppModeOptionsInput): AppModeOption[] {
  return [
    {
      key: 'personal',
      title: '租客端',
      description: '我要找房、收藏与本人服务',
      selection: { mode: 'personal' },
      active: input.mode === 'personal',
    },
    ...input.landlordRelationships.map(relationship => ({
      key: `landlord:${relationship.contact_id}`,
      title: `房东端 · ${relationship.contact_name}`,
      description: `${relationship.organization_name} · ${relationship.house_count} 套关联房源`,
      selection: { mode: 'landlord' as const, landlordContactId: relationship.contact_id },
      active: input.mode === 'landlord' && input.landlordContactId === relationship.contact_id,
    })),
    ...input.organizations.map(organization => ({
      key: `organization:${organization.slug}`,
      title: `中介端 · ${organization.name}`,
      description: organization.is_primary ? '主要使用的组织' : '进入该组织',
      selection: { mode: 'organization' as const, organizationSlug: organization.slug },
      active: input.mode === 'organization' && input.organizationSlug === organization.slug,
    })),
  ]
}

export function getAppModePresentation(input: AppModePresentationInput): { title: string, description: string } {
  if (input.mode === 'landlord' && input.landlordRelationship) {
    return {
      title: `房东端 · ${input.landlordRelationship.contact_name}`,
      description: `${input.landlordRelationship.organization_name} · ${input.landlordRelationship.house_count} 套关联房源`,
    }
  }

  if (input.mode === 'organization' && input.organization) {
    return {
      title: `中介端 · ${input.organization.name}`,
      description: input.organization.is_primary ? '主要使用的组织' : '进入该组织',
    }
  }

  if (input.mode === 'visitor') {
    return {
      title: '游客浏览',
      description: '登录后可使用租客、房东或中介身份',
    }
  }

  return {
    title: '租客端',
    description: '我要找房、收藏与本人服务',
  }
}
