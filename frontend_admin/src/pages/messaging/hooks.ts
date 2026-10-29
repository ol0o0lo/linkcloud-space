import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useBackgroundPolling } from '@/hooks/useBackgroundPolling';
import {
  getMessagingConversation,
  listMessagingMessages,
  type MessagingConversation,
  type MessagingMessage,
  type MessagingSend,
  markMessagingRead,
  sendMessagingMessage,
} from '@/services/manual/messaging';

export const MESSAGE_PAGE_SIZE = 50;

function isPageVisible() {
  return document.visibilityState !== 'hidden';
}

export function usePageVisible() {
  const [visible, setVisible] = useState(isPageVisible);
  useEffect(() => {
    const update = () => setVisible(isPageVisible());
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

export function useRequestSignal() {
  const controller = useRef(new AbortController());
  useEffect(() => {
    if (controller.current.signal.aborted)
      controller.current = new AbortController();
    return () => controller.current.abort();
  }, []);
  return () => controller.current.signal;
}

export function isCurrentRequest(signal: AbortSignal) {
  return !signal.aborted;
}

function mergeMessages(
  current: MessagingMessage[],
  incoming: MessagingMessage[],
) {
  return [
    ...new Map(
      [...current, ...incoming].map((item) => [item.seq, item]),
    ).values(),
  ].sort((left, right) => left.seq - right.seq);
}

export type PendingMessage = MessagingSend & { state: 'sending' | 'failed' };

export function useConversation(
  slug: string,
  conversationId: number,
  visible: boolean,
) {
  const queryClient = useQueryClient();
  const getSignal = useRequestSignal();
  const [conversation, setConversation] = useState<MessagingConversation>();
  const [messages, setMessages] = useState<MessagingMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const [readError, setReadError] = useState('');
  const initialized = useRef(false);
  const highestFetchedSeq = useRef(0);
  const oldestFetchedSeq = useRef<number | undefined>(undefined);
  const lastReadSeq = useRef(0);
  const readTarget = useRef(0);
  const reading = useRef(false);
  const historyBusy = useRef(false);
  const sending = useRef(new Set<string>());

  const acceptMessages = (items: MessagingMessage[]) => {
    setMessages((current) => mergeMessages(current, items));
    const confirmedIds = new Set(
      items
        .filter((item) => item.sender_member_id === conversation?.my_member_id)
        .map((item) => item.client_message_id),
    );
    setPending((current) =>
      current.filter((item) => !confirmedIds.has(item.client_message_id)),
    );
  };

  useBackgroundPolling(
    async (pollSignal) => {
      try {
        const detail = await getMessagingConversation(
          slug,
          conversationId,
          pollSignal,
        );
        if (!isCurrentRequest(pollSignal)) return;
        lastReadSeq.current = Math.max(
          lastReadSeq.current,
          detail.my_last_read_seq,
        );
        setConversation({ ...detail, my_last_read_seq: lastReadSeq.current });
        if (!initialized.current) {
          const recent = await listMessagingMessages(
            slug,
            conversationId,
            { page: 1, page_size: MESSAGE_PAGE_SIZE },
            pollSignal,
          );
          if (!isCurrentRequest(pollSignal)) return;
          acceptMessages(recent.items);
          highestFetchedSeq.current = Math.max(
            0,
            ...recent.items.map((item) => item.seq),
          );
          oldestFetchedSeq.current = recent.items.length
            ? Math.min(...recent.items.map((item) => item.seq))
            : undefined;
          setHasHistory(recent.total > recent.items.length);
          initialized.current = true;
        } else {
          let batchSize: number;
          do {
            const result = await listMessagingMessages(
              slug,
              conversationId,
              {
                page: 1,
                page_size: MESSAGE_PAGE_SIZE,
                after_seq: highestFetchedSeq.current,
              },
              pollSignal,
            );
            if (!isCurrentRequest(pollSignal)) return;
            const previousSeq = highestFetchedSeq.current;
            acceptMessages(result.items);
            highestFetchedSeq.current = Math.max(
              previousSeq,
              ...result.items.map((item) => item.seq),
            );
            if (!oldestFetchedSeq.current && result.items.length)
              oldestFetchedSeq.current = Math.min(
                ...result.items.map((item) => item.seq),
              );
            batchSize =
              highestFetchedSeq.current > previousSeq ? result.items.length : 0;
          } while (batchSize === MESSAGE_PAGE_SIZE);
        }
        setError('');
      } catch (caught) {
        if (isCurrentRequest(pollSignal))
          setError('会话加载失败或已无访问权限，请稍后重试。');
        throw caught;
      } finally {
        if (isCurrentRequest(pollSignal)) setLoading(false);
      }
    },
    true,
    `${slug}:${conversationId}`,
  );

  const loadHistory = async (beforeMerge?: () => void) => {
    const signal = getSignal();
    if (
      historyBusy.current ||
      !oldestFetchedSeq.current ||
      !hasHistory ||
      !isCurrentRequest(signal)
    )
      return;
    historyBusy.current = true;
    setHistoryLoading(true);
    try {
      const result = await listMessagingMessages(
        slug,
        conversationId,
        {
          page: 1,
          page_size: MESSAGE_PAGE_SIZE,
          before_seq: oldestFetchedSeq.current,
        },
        signal,
      );
      if (!isCurrentRequest(signal)) return;
      beforeMerge?.();
      acceptMessages(result.items);
      if (result.items.length)
        oldestFetchedSeq.current = Math.min(
          ...result.items.map((item) => item.seq),
        );
      setHasHistory(result.total > result.items.length);
      setHistoryError('');
      return true;
    } catch {
      if (isCurrentRequest(signal))
        setHistoryError('更早消息加载失败，请重试。');
      return false;
    } finally {
      historyBusy.current = false;
      if (!signal.aborted) setHistoryLoading(false);
    }
  };

  const send = async (item: MessagingSend) => {
    const signal = getSignal();
    if (
      !isCurrentRequest(signal) ||
      sending.current.has(item.client_message_id)
    )
      return;
    sending.current.add(item.client_message_id);
    setPending((current) => [
      ...current.filter(
        (entry) => entry.client_message_id !== item.client_message_id,
      ),
      { ...item, state: 'sending' },
    ]);
    try {
      const saved = await sendMessagingMessage(
        slug,
        conversationId,
        { client_message_id: item.client_message_id, content: item.content },
        signal,
      );
      if (!isCurrentRequest(signal)) return;
      acceptMessages([saved]);
      // 发送响应不推进增量位置，期间收到的较小 seq 仍由下一次轮询补齐。
    } catch {
      if (isCurrentRequest(signal))
        setPending((current) =>
          current.map((entry) =>
            entry.client_message_id === item.client_message_id
              ? { ...entry, state: 'failed' }
              : entry,
          ),
        );
    } finally {
      sending.current.delete(item.client_message_id);
    }
  };

  const markRead = async (seq: number) => {
    const signal = getSignal();
    if (!visible || !isPageVisible()) return;
    readTarget.current = Math.max(
      readTarget.current,
      Math.min(seq, highestFetchedSeq.current),
    );
    if (reading.current || !isCurrentRequest(signal)) return;
    reading.current = true;
    try {
      while (
        readTarget.current > lastReadSeq.current &&
        isCurrentRequest(signal) &&
        isPageVisible()
      ) {
        const target = readTarget.current;
        const result = await markMessagingRead(
          slug,
          conversationId,
          target,
          signal,
        );
        if (!isCurrentRequest(signal)) return;
        lastReadSeq.current = Math.max(
          lastReadSeq.current,
          result.last_read_seq,
        );
        void queryClient.invalidateQueries({ queryKey: ['messaging-unread'] });
        setConversation((current) =>
          current
            ? {
                ...current,
                my_last_read_seq: lastReadSeq.current,
                unread_count: result.unread_count,
              }
            : current,
        );
      }
      setReadError('');
    } catch {
      if (isCurrentRequest(signal))
        setReadError('阅读位置同步失败，稍后会自动重试。');
    } finally {
      reading.current = false;
    }
  };

  return {
    conversation,
    messages,
    pending,
    loading,
    error,
    historyError,
    historyLoading,
    hasHistory,
    readError,
    loadHistory,
    send,
    markRead,
  };
}
