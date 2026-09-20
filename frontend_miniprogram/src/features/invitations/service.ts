export type {
  LandlordInvitationAcceptOut,
  LandlordInvitationOut,
  OrganizationInvitationOut,
  SuccessOut,
} from '@/services/manual/invitations'

export {
  acceptLandlordInvitation,
  acceptOrganizationInvitation,
  declineOrganizationInvitation,
  requestLandlordInvitation as getLandlordInvitation,
  requestOrganizationInvitation as getOrganizationInvitation,
} from '@/services/manual/invitations'
