import { history } from '@umijs/max';
import {
  buildAdminPath,
  isAuthPagePath,
  LOGIN_PATH,
} from '@/utils/adminRouting';
import {
  messagingCreateDirectConversation,
  messagingGetConversation,
  messagingGetUnreadCount,
  messagingListConversations,
  messagingListMessages,
  messagingListPeers,
  messagingMarkRead,
  messagingSendMessage,
} from '@/services/openapi/messaging';

export type MessagingPage<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
export type MessagingPeer = API.MessagingPeerOut;
export type MessagingConversation = API.MessagingConversationOut;
export type MessagingMessage = API.MessagingMessageOut;
export type MessagingUnreadCount = API.MessagingUnreadCountOut;
export type MessagingSend = API.MessagingMessageIn;

// 每次请求绑定调用方的组织，不能随全局空间切换而改变。
function requestOptions(slug: string, signal: AbortSignal) {
  return {
    headers: { 'X-Org-Slug': slug, 'Content-Type': 'application/json' },
    signal,
    skipErrorHandler: true,
  };
}

async function recoverAuthentication<T>(
  result: Promise<T>,
  signal: AbortSignal,
) {
  try {
    return await result;
  } catch (error) {
    const failure = error as {
      info?: { code?: number };
      response?: { status?: number };
    };
    if (
      !signal.aborted &&
      document.visibilityState !== 'hidden' &&
      (failure.response?.status === 401 || failure.info?.code === 401) &&
      !isAuthPagePath(history.location.pathname)
    ) {
      const { pathname, search, hash } = history.location;
      history.push(
        `${LOGIN_PATH}?redirect=${encodeURIComponent(buildAdminPath(pathname, search, hash))}`,
      );
    }
    throw error;
  }
}

export function listMessagingPeers(
  slug: string,
  params: { keyword?: string; page: number; page_size: number },
  signal: AbortSignal,
) {
  return recoverAuthentication(
    messagingListPeers(
      { organization_slug: encodeURIComponent(slug), ...params },
      requestOptions(slug, signal),
    ),
    signal,
  );
}
export function createDirectConversation(
  slug: string,
  peerUserId: number,
  signal: AbortSignal,
) {
  return recoverAuthentication(
    messagingCreateDirectConversation(
      { organization_slug: encodeURIComponent(slug) },
      { peer_user_id: peerUserId },
      requestOptions(slug, signal),
    ),
    signal,
  );
}
export function listMessagingConversations(
  slug: string,
  params: { page: number; page_size: number; namespace?: string },
  signal: AbortSignal,
) {
  return recoverAuthentication(
    messagingListConversations(
      { organization_slug: encodeURIComponent(slug), ...params },
      requestOptions(slug, signal),
    ),
    signal,
  );
}
export function getMessagingConversation(
  slug: string,
  id: number,
  signal: AbortSignal,
) {
  return recoverAuthentication(
    messagingGetConversation(
      { organization_slug: encodeURIComponent(slug), conversation_id: id },
      requestOptions(slug, signal),
    ),
    signal,
  );
}
export function listMessagingMessages(
  slug: string,
  id: number,
  params: {
    page: number;
    page_size: number;
    before_seq?: number;
    after_seq?: number;
  },
  signal: AbortSignal,
) {
  return recoverAuthentication(
    messagingListMessages(
      {
        organization_slug: encodeURIComponent(slug),
        conversation_id: id,
        ...params,
      },
      requestOptions(slug, signal),
    ),
    signal,
  );
}
export function sendMessagingMessage(
  slug: string,
  id: number,
  data: MessagingSend,
  signal: AbortSignal,
) {
  return recoverAuthentication(
    messagingSendMessage(
      { organization_slug: encodeURIComponent(slug), conversation_id: id },
      data,
      requestOptions(slug, signal),
    ),
    signal,
  );
}
export function markMessagingRead(
  slug: string,
  id: number,
  lastReadSeq: number,
  signal: AbortSignal,
) {
  return recoverAuthentication(
    messagingMarkRead(
      { organization_slug: encodeURIComponent(slug), conversation_id: id },
      { last_read_seq: lastReadSeq },
      requestOptions(slug, signal),
    ),
    signal,
  );
}
export function getMessagingUnreadCount(
  slug: string,
  namespace: string | undefined,
  signal: AbortSignal,
) {
  return recoverAuthentication(
    messagingGetUnreadCount(
      { organization_slug: encodeURIComponent(slug), namespace },
      requestOptions(slug, signal),
    ),
    signal,
  );
}
