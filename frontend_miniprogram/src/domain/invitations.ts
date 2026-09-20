export type InvitationKind = 'organization' | 'landlord'

export interface InvitationParams {
  kind: InvitationKind
  credential: string
}

export interface InvitationUser {
  phone_verified?: boolean
}

export interface InvitationVerificationInput {
  kind: InvitationKind
  usesPhone: boolean
}

export interface OrganizationInvitationInput {
  organization_id: number
  organization_slug: string
  organization_name: string
  sender_name: string
  invitee_email?: string
  invitee_phone?: string
  is_expired: boolean
  is_already_member: boolean
}

export interface LandlordInvitationInput {
  organization_name: string
  contact_name: string
  invitee_phone_masked: string
  expires_at: string
}

export interface InvitationViewModel {
  kind: InvitationKind
  title: string
  organizationName: string
  organizationId: number | null
  organizationSlug: string
  senderName: string
  contactName: string
  recipientLabel: string
  usesPhone: boolean
  expiresAt: string
  expired: boolean
  alreadyMember: boolean
}

function stringOption(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function resolveInvitationParams(options: Record<string, unknown> | undefined): InvitationParams | null {
  const kind = stringOption(options?.kind)
  if (kind === 'organization') {
    const credential = stringOption(options?.key)
    return credential ? { kind, credential } : null
  }
  if (kind === 'landlord') {
    const credential = stringOption(options?.token)
    return credential ? { kind, credential } : null
  }
  return null
}

export function maskInvitationPhone(phone: string): string {
  const normalized = phone.trim()
  if (normalized.length <= 7)
    return normalized ? `${normalized.slice(0, 2)}***${normalized.slice(-2)}` : ''
  return `${normalized.slice(0, 3)}${'*'.repeat(normalized.length - 7)}${normalized.slice(-4)}`
}

export function maskInvitationEmail(email: string): string {
  const normalized = email.trim()
  const separator = normalized.lastIndexOf('@')
  if (separator <= 0)
    return normalized
  const local = normalized.slice(0, separator)
  const domain = normalized.slice(separator)
  if (local.length === 1)
    return `${local}***${domain}`
  return `${local[0]}${'*'.repeat(Math.max(3, local.length - 2))}${local.at(-1)}${domain}`
}

export function normalizeOrganizationInvitation(input: OrganizationInvitationInput): InvitationViewModel {
  const phone = input.invitee_phone?.trim() || ''
  const email = input.invitee_email?.trim() || ''
  return {
    kind: 'organization',
    title: `${input.organization_name}邀请你加入组织`,
    organizationName: input.organization_name,
    organizationId: input.organization_id,
    organizationSlug: input.organization_slug,
    senderName: input.sender_name,
    contactName: '',
    recipientLabel: phone ? maskInvitationPhone(phone) : maskInvitationEmail(email),
    usesPhone: Boolean(phone),
    expiresAt: '',
    expired: input.is_expired,
    alreadyMember: input.is_already_member,
  }
}

export function normalizeLandlordInvitation(input: LandlordInvitationInput): InvitationViewModel {
  return {
    kind: 'landlord',
    title: `${input.organization_name}邀请你认领房东关系`,
    organizationName: input.organization_name,
    organizationId: null,
    organizationSlug: '',
    senderName: '',
    contactName: input.contact_name,
    recipientLabel: input.invitee_phone_masked,
    usesPhone: true,
    expiresAt: input.expires_at,
    expired: new Date(input.expires_at).getTime() <= Date.now(),
    alreadyMember: false,
  }
}

export function shouldVerifyInvitationPhone(invitation: InvitationVerificationInput, user: InvitationUser | null | undefined): boolean {
  return invitation.usesPhone && user?.phone_verified !== true
}
