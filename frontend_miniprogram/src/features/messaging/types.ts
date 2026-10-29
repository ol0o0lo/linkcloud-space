import type { MessagingConversationOut, MessagingMessageOut, MessagingPeerOut, MessagingPersonalOrganizationOut, MessagingReadOut, MessagingUnreadCountOut } from '../../services/openapi/types.ts'
import type { HouseCardPayload, MessageMedia } from './message-content.ts'

export type MessagingAccessKind = 'organization_member' | 'business_party'

export interface MessagingContext {
  userId: number
  accessKind: MessagingAccessKind
  organizationSlug: string
  namespace?: string
}

export interface MessagingPage<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface MessagingOrganization {
  id: number
  slug: string
  name: string
}

export type PersonalMessagingOrganization = MessagingPersonalOrganizationOut
export type MessagingPeer = MessagingPeerOut
export type Conversation = MessagingConversationOut
export type MessagingMessage = MessagingMessageOut
export type MessagingUnreadCount = MessagingUnreadCountOut
export type MessagingReadResult = MessagingReadOut

export interface PendingMessage {
  client_message_id: string
  content: string
  state: 'sending' | 'failed'
  error: string
  message_type?: 'house.listing'
  payload?: HouseCardPayload
  media?: MessageMedia[]
}

export interface MessageSendRequest {
  client_message_id: string
  content: string
  message_type?: 'house.listing'
  house_id?: number
}

export interface MessagingApi {
  getConversation: (context: MessagingContext, id: number) => Promise<Conversation>
  listMessages: (context: MessagingContext, id: number, query?: { before_seq?: number, after_seq?: number }) => Promise<MessagingPage<MessagingMessage>>
  sendMessage: (context: MessagingContext, id: number, body: MessageSendRequest) => Promise<MessagingMessage>
  markRead: (context: MessagingContext, id: number, seq: number) => Promise<MessagingReadResult>
}
