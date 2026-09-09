import { AppError } from '@/core/errors/app-error'
import {
  houseLandlordContactsContactIdHousesUsingGet,
  houseLandlordContactsContactIdLeasesUsingGet,
  houseLandlordInvitesTokenAcceptUsingPost,
  houseLandlordInvitesTokenUsingGet,
} from '@/services/openapi/fangdong'
import { publicLandlordsPublicKeyHousesUsingGet, publicLandlordsPublicKeyUsingGet } from '@/services/openapi/fangdonggongkaidianpu'

export type {
  LandlordHouseOut,
  LandlordInvitationAcceptOut,
  LandlordInvitationOut,
  LeaseOut,
  PublicHouseListOut,
  PublicLandlordProfileOut,
} from '@/services/openapi/types'

function landlordOptions(contactId: number) {
  return { requestScope: { kind: 'landlord' as const, landlordContactId: contactId }, authRetry: 'safe' as const }
}

const personalOptions = { requestScope: { kind: 'personal' as const } }
const publicOptions = { requestScope: { kind: 'public' as const }, authRetry: 'safe' as const }

export function requestLandlordHouses(contactId: number, page: number, pageSize: number) {
  return houseLandlordContactsContactIdHousesUsingGet({
    params: { contact_id: contactId, page, page_size: pageSize },
    options: landlordOptions(contactId),
  })
}

export async function requestLandlordHouse(contactId: number, houseId: number) {
  const result = await requestLandlordHouses(contactId, 1, 500)
  const house = result.items.find(item => item.id === houseId)
  if (!house)
    throw new AppError({ kind: 'not-found', message: '未找到当前房东关系下的房源' })
  return house
}

export function requestLandlordLeases(contactId: number, page: number, pageSize: number) {
  return houseLandlordContactsContactIdLeasesUsingGet({
    params: { contact_id: contactId, page, page_size: pageSize },
    options: landlordOptions(contactId),
  })
}

export async function requestLandlordLease(contactId: number, leaseId: number) {
  const result = await requestLandlordLeases(contactId, 1, 500)
  const lease = result.items.find(item => item.id === leaseId)
  if (!lease)
    throw new AppError({ kind: 'not-found', message: '未找到当前房东关系下的租约' })
  return lease
}

export function requestLandlordInvitation(token: string) {
  return houseLandlordInvitesTokenUsingGet({ params: { token }, options: publicOptions })
}

export function acceptLandlordInvitation(token: string) {
  return houseLandlordInvitesTokenAcceptUsingPost({ params: { token }, options: personalOptions })
}

export function requestPublicLandlordStore(publicKey: string) {
  return publicLandlordsPublicKeyUsingGet({ params: { public_key: publicKey }, options: publicOptions })
}

export function requestPublicLandlordHouses(publicKey: string, page: number, pageSize: number) {
  return publicLandlordsPublicKeyHousesUsingGet({
    params: { public_key: publicKey, page, page_size: pageSize },
    options: publicOptions,
  })
}
