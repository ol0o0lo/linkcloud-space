import { httpGet } from '@/http/http'
import { organizationsSwitchListUsingGet } from '@/services/openapi/jichu'
import { usersMeUsingGet } from '@/services/openapi/zhanghu'

export type { MeOut, SwitchListItemOut } from '@/services/openapi/types'

export interface LandlordRelationship {
  contact_id: number
  organization_id: number
  organization_name: string
  organization_slug: string
  contact_name: string
  house_count: number
  public_house_count: number
  public_key: string
  public_url: string
}

export function getCurrentUser() {
  return usersMeUsingGet({ options: { requestScope: { kind: 'personal' } } })
}

export function listAvailableOrganizations() {
  return organizationsSwitchListUsingGet({ options: { requestScope: { kind: 'personal' } } })
}

export function listLandlordRelationships(): Promise<LandlordRelationship[]> {
  return httpGet<LandlordRelationship[]>('/api/house/landlord/relationships/', undefined, undefined, {
    requestScope: { kind: 'personal' },
    hideErrorToast: true,
    skipAuthRedirect: true,
  })
}

export function getOrganizationNavigationCapabilities<TCapabilities>(organizationSlug: string): Promise<TCapabilities> {
  return httpGet<TCapabilities>('/api/access/navigation/', undefined, undefined, {
    requestScope: { kind: 'organization', organizationSlug },
  })
}
