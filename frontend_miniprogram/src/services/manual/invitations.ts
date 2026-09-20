import type { LandlordInvitationAcceptOut, LandlordInvitationOut, PublicInviteOut, SuccessOut } from '@/services/openapi/types'
import { houseLandlordInvitesTokenAcceptUsingPost, houseLandlordInvitesTokenUsingGet } from '@/services/openapi/fangdong'
import { inviteByKeyKeyAcceptUsingPost, inviteByKeyKeyDeclineUsingPost, inviteByKeyKeyUsingGet } from '@/services/openapi/gongkaiyaoqing'

export type OrganizationInvitationOut = PublicInviteOut & {
  organization_id: number
  organization_slug: string
}

export type { LandlordInvitationAcceptOut, LandlordInvitationOut, SuccessOut }

const publicOptions = { requestScope: { kind: 'public' as const }, authRetry: 'safe' as const }
const personalReadOptions = { requestScope: { kind: 'personal' as const }, authRetry: 'safe' as const }
const personalWriteOptions = { requestScope: { kind: 'personal' as const }, authRetry: 'never' as const }

export function requestOrganizationInvitation(key: string): Promise<OrganizationInvitationOut> {
  return inviteByKeyKeyUsingGet({ params: { key }, options: publicOptions }) as Promise<OrganizationInvitationOut>
}

export function acceptOrganizationInvitation(key: string): Promise<SuccessOut> {
  return inviteByKeyKeyAcceptUsingPost({ params: { key }, options: personalWriteOptions })
}

export function declineOrganizationInvitation(key: string): Promise<SuccessOut> {
  return inviteByKeyKeyDeclineUsingPost({ params: { key }, options: personalWriteOptions })
}

export function requestLandlordInvitation(token: string): Promise<LandlordInvitationOut> {
  return houseLandlordInvitesTokenUsingGet({ params: { token }, options: publicOptions })
}

export function acceptLandlordInvitation(token: string): Promise<LandlordInvitationAcceptOut> {
  return houseLandlordInvitesTokenAcceptUsingPost({ params: { token }, options: personalWriteOptions })
}

export function requestAuthenticatedOrganizationInvitation(key: string): Promise<OrganizationInvitationOut> {
  return inviteByKeyKeyUsingGet({ params: { key }, options: personalReadOptions }) as Promise<OrganizationInvitationOut>
}
