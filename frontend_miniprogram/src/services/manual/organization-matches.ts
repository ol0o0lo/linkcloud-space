import type { HouseMatchShareCreateIn } from '@/services/openapi/types'
import { buildOrganizationScope } from '@/domain/organization-scope'
import {
  houseMatchSharesShareIdExtendUsingPost,
  houseMatchSharesShareIdRevokeUsingPost,
  houseMatchSharesUsingGet,
  houseMatchSharesUsingPost,
} from '@/services/openapi/peifangfenxiang'

export type { HouseMatchShareCreateOut, HouseMatchShareOut } from '@/services/openapi/types'

export function listOrganizationMatches(organizationSlug: string, page = 1, pageSize = 15) {
  return houseMatchSharesUsingGet({ params: { page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) })
}

export function createOrganizationMatch(organizationSlug: string, payload: Pick<HouseMatchShareCreateIn, 'title' | 'remark' | 'house_ids'>) {
  return houseMatchSharesUsingPost({ body: { ...payload, mode: 'manual' }, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function extendOrganizationMatch(organizationSlug: string, shareId: number, expiresAt: string) {
  return houseMatchSharesShareIdExtendUsingPost({ params: { share_id: shareId }, body: { expires_at: expiresAt }, options: buildOrganizationScope(organizationSlug, 'never') })
}

export function revokeOrganizationMatch(organizationSlug: string, shareId: number) {
  return houseMatchSharesShareIdRevokeUsingPost({ params: { share_id: shareId }, options: buildOrganizationScope(organizationSlug, 'never') })
}
