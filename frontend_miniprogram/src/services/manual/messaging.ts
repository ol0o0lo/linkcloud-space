import type { MessagingApi, MessagingContext } from '@/features/messaging/types'
import { messagingRequestScope, messagingSendOptions } from '@/features/messaging/context'
import { useWorkspaceStore } from '@/store/workspace'
import { houseMessagingOrganizationsOrganizationSlugConversationsConversationIdHouseUsingPost as postHouseMessage } from '@/services/openapi/liaotian'
import {
  messagingOrganizationsOrganizationSlugConversationsConversationIdReadUsingPatch as patchRead,
  messagingOrganizationsOrganizationSlugConversationsDirectUsingPost as postDirect,
  messagingOrganizationsOrganizationSlugConversationsConversationIdMessagesUsingPost as postMessage,
  messagingOrganizationsOrganizationSlugConversationsConversationIdUsingGet as requestConversation,
  messagingOrganizationsOrganizationSlugConversationsUsingGet as requestConversations,
  messagingOrganizationsOrganizationSlugConversationsConversationIdMessagesUsingGet as requestMessages,
  messagingOrganizationsOrganizationSlugPeersUsingGet as requestPeers,
  messagingPersonalOrganizationsUsingGet as requestPersonalOrganizations,
  messagingOrganizationsOrganizationSlugUnreadCountUsingGet as requestUnreadCount,
} from '@/services/openapi/messaging'

function options(context: MessagingContext, write = false) {
  return { requestScope: messagingRequestScope(context), authRetry: write ? 'never' as const : 'safe' as const }
}

export function listPersonalMessagingOrganizations(page = 1, namespace?: string) {
  return requestPersonalOrganizations({ params: { page, page_size: 100, namespace }, options: { requestScope: { kind: 'personal' }, authRetry: 'safe' } })
}

export function listMessagingPeers(context: MessagingContext, page = 1, keyword = '') {
  return requestPeers({ params: { organization_slug: context.organizationSlug, page, page_size: 20, keyword }, options: options(context) })
}

export function createDirectConversation(context: MessagingContext, peerUserId: number) {
  return postDirect({ params: { organization_slug: context.organizationSlug }, body: { peer_user_id: peerUserId }, options: options(context, true) })
}

export function listConversations(context: MessagingContext, page = 1) {
  return requestConversations({ params: { organization_slug: context.organizationSlug, page, page_size: 20, namespace: context.namespace }, options: options(context) })
}

export function getMessagingUnreadCount(context: MessagingContext) {
  return requestUnreadCount({ params: { organization_slug: context.organizationSlug, namespace: context.namespace }, options: options(context) })
}

export const messagingApi: MessagingApi = {
  getConversation: (context, id) => requestConversation({ params: { organization_slug: context.organizationSlug, conversation_id: id }, options: options(context) }),
  listMessages: (context, id, query = {}) => requestMessages({ params: { organization_slug: context.organizationSlug, conversation_id: id, page: 1, page_size: 50, ...query }, options: options(context) }),
  sendMessage: (context, id, body) => {
    const sendOptions = messagingSendOptions(context, () => useWorkspaceStore().user?.id || null)
    if (body.message_type === 'house.listing') {
      return postHouseMessage({ params: { organization_slug: context.organizationSlug, conversation_id: id }, body: { house_id: body.house_id!, client_message_id: body.client_message_id }, options: sendOptions })
    }
    return postMessage({ params: { organization_slug: context.organizationSlug, conversation_id: id }, body: { client_message_id: body.client_message_id, content: body.content }, options: sendOptions })
  },
  markRead: (context, id, seq) => patchRead({ params: { organization_slug: context.organizationSlug, conversation_id: id }, body: { last_read_seq: seq }, options: options(context, true) }),
}
