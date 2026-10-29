import { ArrowLeftOutlined, CommentOutlined } from '@ant-design/icons';
import { Conversations, Welcome } from '@ant-design/x';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useModel } from '@umijs/max';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Empty,
  Grid,
  Input,
  Modal,
  Pagination,
  Spin,
  Typography,
  theme,
} from 'antd';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ChatComposer,
  ChatMessageList,
  type ChatMessageListRef,
} from '@/components/Chat';
import { PageContainer } from '@/components/PageContainer';
import { useBackgroundPolling } from '@/hooks/useBackgroundPolling';
import { loadAuthenticatedState } from '@/services/manual/authenticatedState';
import {
  createDirectConversation,
  getMessagingUnreadCount,
  listMessagingConversations,
  listMessagingPeers,
  type MessagingConversation,
  type MessagingPage,
  type MessagingPeer,
  type MessagingUnreadCount,
} from '@/services/manual/messaging';
import {
  getOrgSelectionRevision,
  getSelectedOrgSlug,
  setSelectedOrgSlug,
} from '@/utils/orgSelection';
import {
  isCurrentRequest,
  useConversation,
  usePageVisible,
  useRequestSignal,
} from './hooks';

const PAGE_SIZE = 20;

function peerOf(conversation: MessagingConversation) {
  return conversation.members.find(
    (member) => member.id !== conversation.my_member_id,
  );
}

function conversationGroup(conversation: MessagingConversation) {
  if (!conversation.last_message) return '新会话';
  const date = dayjs(conversation.last_message.created_at);
  if (date.isSame(dayjs(), 'day')) return '今天';
  return date.isSame(dayjs().subtract(1, 'day'), 'day') ? '昨天' : '更早';
}

function PeerPicker({
  slug,
  visible,
  onSelect,
  onClose,
}: {
  slug: string;
  visible: boolean;
  onSelect: (conversation: MessagingConversation) => void;
  onClose: () => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [peers, setPeers] = useState<MessagingPage<MessagingPeer>>();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<number>();
  const [error, setError] = useState('');
  const getSignal = useRequestSignal();

  useEffect(() => {
    if (!visible) setCreating(undefined);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setLoading(true);
    setPeers(undefined);
    const timer = setTimeout(async () => {
      try {
        const result = await listMessagingPeers(
          slug,
          { keyword: keyword.trim() || undefined, page, page_size: PAGE_SIZE },
          controller.signal,
        );
        if (!isCurrentRequest(controller.signal)) return;
        setPeers(result);
        setError('');
      } catch {
        if (isCurrentRequest(controller.signal))
          setError('空间成员加载失败，请重新搜索。');
      } finally {
        if (isCurrentRequest(controller.signal)) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [keyword, page, slug, visible]);

  const create = async (peer: MessagingPeer) => {
    const signal = getSignal();
    if (creating || !visible) return;
    setCreating(peer.user_id);
    try {
      const conversation = await createDirectConversation(
        slug,
        peer.user_id,
        signal,
      );
      if (isCurrentRequest(signal)) onSelect(conversation);
    } catch {
      if (isCurrentRequest(signal)) setError('发起聊天失败，请稍后重试。');
    } finally {
      if (!signal.aborted) setCreating(undefined);
    }
  };

  return (
    <Modal
      title="发起聊天"
      open
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4">
        <Input.Search
          aria-label="搜索空间成员"
          placeholder="搜索成员姓名"
          allowClear
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
        />
        {error && <Alert type="error" showIcon title={error} />}
        {loading ? (
          <div className="flex justify-center p-6">
            <Spin />
          </div>
        ) : !peers?.items.length ? (
          error ? null : (
            <Empty description="暂无可发起聊天的成员" />
          )
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {peers.items.map((peer) => (
              <li key={peer.user_id} className="flex items-center gap-3">
                <Avatar src={peer.avatar_url || undefined}>
                  {peer.display_name.slice(0, 1)}
                </Avatar>
                <span className="min-w-0 flex-1 break-words">
                  {peer.display_name}
                </span>
                <Button
                  loading={creating === peer.user_id}
                  disabled={Boolean(creating && creating !== peer.user_id)}
                  onClick={() => void create(peer)}
                >
                  聊天
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={peers?.total || 0}
          showSizeChanger={false}
          hideOnSinglePage
          onChange={setPage}
        />
      </div>
    </Modal>
  );
}

function ConversationPanel({
  slug,
  id,
  visible,
  onBack,
  narrow,
}: {
  slug: string;
  id: number;
  visible: boolean;
  onBack: () => void;
  narrow: boolean;
}) {
  const chat = useConversation(slug, id, visible);
  const { token } = theme.useToken();
  const [content, setContent] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const bindMessageList = useCallback((list: ChatMessageListRef | null) => {
    // Bubble.List 在内部滚动容器挂载后才补齐 ref，等容器就绪再同步滚动和已读。
    if (list?.scrollBoxNativeElement) setViewport(list.scrollBoxNativeElement);
  }, []);
  const historyAnchor = useRef<{ height: number; top: number } | undefined>(
    undefined,
  );
  const peer = chat.conversation ? peerOf(chat.conversation) : undefined;
  const latest = chat.messages.at(-1)?.seq || 0;

  useLayoutEffect(() => {
    const element = viewport;
    if (!element) return;
    if (historyAnchor.current) {
      // 等历史入口与消息一起更新完，再恢复位置，避免入口消失带来的跳动。
      if (chat.historyLoading) return;
      element.scrollTop =
        historyAnchor.current.top +
        element.scrollHeight -
        historyAnchor.current.height;
      historyAnchor.current = undefined;
    } else if (atBottom) {
      element.scrollTop = element.scrollHeight;
      if (visible) void chat.markRead(latest);
    }
  }, [
    chat.messages,
    chat.pending,
    chat.historyLoading,
    atBottom,
    visible,
    viewport,
  ]);

  const send = () => {
    const normalized = content.replace(/\r\n?/g, '\n').trim();
    if (
      !normalized ||
      normalized.length > 2000 ||
      !chat.conversation?.can_send ||
      chat.error ||
      !visible
    )
      return;
    void chat.send({
      client_message_id: crypto.randomUUID(),
      content: normalized,
    });
    setContent('');
  };

  const loadHistory = async () => {
    setAtBottom(false);
    await chat.loadHistory(() => {
      const element = viewport;
      if (element)
        historyAnchor.current = {
          height: element.scrollHeight,
          top: element.scrollTop,
        };
    });
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4">
        {narrow && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            aria-label="返回会话列表"
            onClick={onBack}
          />
        )}
        <Typography.Text className="truncate" strong>
          {peer?.display_name || '聊天详情'}
        </Typography.Text>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {chat.error && (
          <Alert
            type="error"
            className="mx-4 mb-3"
            showIcon
            title={chat.error}
            description="系统会自动重试。"
          />
        )}
        {chat.readError && (
          <Alert
            className="mx-4 mb-3"
            type="warning"
            showIcon
            title={chat.readError}
          />
        )}
        {chat.loading ? (
          <div className="flex justify-center p-8">
            <Spin />
          </div>
        ) : (
          <>
            <div
              aria-label="聊天消息"
              role="log"
              aria-live="polite"
              className="min-h-0 flex-1 px-2"
            >
              <ChatMessageList
                ref={bindMessageList}
                className="mx-auto h-full max-w-[940px]"
                classNames={{ scroll: 'h-full overscroll-contain' }}
                role={{
                  user: {
                    placement: 'end',
                    variant: 'filled',
                    shape: 'default',
                  },
                  peer: {
                    placement: 'start',
                    variant: 'filled',
                    shape: 'default',
                  },
                  system: { variant: 'borderless' },
                }}
                onScroll={(event) => {
                  const element = event.currentTarget;
                  const bottom =
                    element.scrollHeight -
                      element.scrollTop -
                      element.clientHeight <
                    40;
                  setAtBottom(bottom);
                  if (bottom && visible) void chat.markRead(latest);
                }}
                items={[
                  ...(chat.hasHistory
                    ? [
                        {
                          key: 'history',
                          role: 'system',
                          content: (
                            <Button
                              loading={chat.historyLoading}
                              onClick={() => void loadHistory()}
                            >
                              加载更早消息
                            </Button>
                          ),
                        },
                      ]
                    : []),
                  ...(chat.historyError
                    ? [
                        {
                          key: 'history-error',
                          role: 'system',
                          content: (
                            <Alert type="error" title={chat.historyError} />
                          ),
                        },
                      ]
                    : []),
                  ...(!chat.messages.length &&
                  !chat.pending.length &&
                  !chat.error
                    ? [
                        {
                          key: 'welcome',
                          role: 'system',
                          content: (
                            <Welcome
                              variant="borderless"
                              icon={<CommentOutlined />}
                              title="开始聊天"
                              description="还没有消息，发送第一条消息吧"
                            />
                          ),
                        },
                      ]
                    : []),
                  ...chat.messages.map((item) => {
                    const mine =
                      item.sender_member_id === chat.conversation?.my_member_id;
                    const sender = chat.conversation?.members.find(
                      (member) => member.id === item.sender_member_id,
                    );
                    return {
                      key: item.id,
                      role: mine ? 'user' : 'peer',
                      content: item.content,
                      header: (
                        <Typography.Text type="secondary" className="text-xs!">
                          {mine ? '我' : sender?.display_name || '原参与人'} ·{' '}
                          {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                        </Typography.Text>
                      ),
                    };
                  }),
                  ...chat.pending.map((item) => ({
                    key: item.client_message_id,
                    role: 'user',
                    content: item.content,
                    footer:
                      item.state === 'sending' ? (
                        <Typography.Text type="secondary">
                          发送中…
                        </Typography.Text>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Typography.Text type="danger">
                            发送失败
                          </Typography.Text>
                          <Button
                            size="small"
                            disabled={
                              !chat.conversation?.can_send ||
                              Boolean(chat.error)
                            }
                            onClick={() => void chat.send(item)}
                          >
                            重试发送
                          </Button>
                        </div>
                      ),
                  })),
                ]}
              />
            </div>
            {!atBottom && (
              <Button
                className="mx-auto my-2"
                onClick={() => {
                  setAtBottom(true);
                }}
              >
                查看最新消息
              </Button>
            )}
            {chat.conversation && !chat.conversation.can_send && (
              <Alert
                className="mx-4 mb-3"
                type="info"
                showIcon
                title={
                  chat.conversation.send_block_reason__mapping ||
                  '当前会话暂时无法发送消息'
                }
              />
            )}
            <div className="shrink-0 p-2">
              <ChatComposer
                className="w-full"
                styles={{
                  content: { padding: token.padding },
                  footer: {
                    paddingInline: token.padding,
                    paddingBlockEnd: token.paddingSM,
                  },
                }}
                placeholder="输入消息，Ctrl / Command + Enter 发送"
                value={content}
                maxLength={2000}
                autoSize={{ minRows: 3, maxRows: 6 }}
                disabled={!chat.conversation?.can_send || Boolean(chat.error)}
                sendDisabled={!visible}
                onChange={setContent}
                onSubmit={send}
                onKeyDown={(event) => {
                  // 普通 Enter 保留换行，Ctrl / Command 由输入组件处理。
                  if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey)
                    return false;
                  return undefined;
                }}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function MessagingWorkspace({
  slug,
  namespace,
  initialConversationId,
}: {
  slug: string;
  namespace?: string;
  initialConversationId?: number;
}) {
  const visible = usePageVisible();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const narrow = !screens.md;
  const [page, setPage] = useState(1);
  const [conversations, setConversations] =
    useState<MessagingPage<MessagingConversation>>();
  const [unread, setUnread] = useState<MessagingUnreadCount>();
  const [selected, setSelected] = useState(initialConversationId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useBackgroundPolling(
    async (signal) => {
      try {
        const [list, count] = await Promise.all([
          listMessagingConversations(
            slug,
            { page, page_size: PAGE_SIZE, namespace },
            signal,
          ),
          getMessagingUnreadCount(slug, namespace, signal),
        ]);
        if (!isCurrentRequest(signal)) return;
        setConversations(list);
        setUnread(count);
        setError('');
      } catch (caught) {
        if (isCurrentRequest(signal))
          setError('聊天列表加载失败，请重新加载。');
        throw caught;
      } finally {
        if (isCurrentRequest(signal)) setLoading(false);
      }
    },
    true,
    `${slug}:${namespace || ''}:${page}:${revision}`,
  );

  return (
    <PageContainer title="我的聊天">
      <div className="flex h-[calc(100dvh-140px)] min-h-96 overflow-hidden rounded-[var(--ant-border-radius-lg)] bg-[var(--ant-color-bg-container)]">
        {(!narrow || !selected) && (
          <aside className="flex w-full shrink-0 flex-col bg-[var(--ant-color-bg-layout)] px-3 md:w-[280px]">
            <div className="my-6 flex items-center gap-2 px-3">
              <CommentOutlined className="text-lg text-[var(--ant-color-primary)]" />
              <Typography.Text strong className="text-base!">
                会话列表
              </Typography.Text>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {error && (
                <Alert
                  className="mx-3"
                  type="error"
                  title={error}
                  action={
                    <Button onClick={() => setRevision((value) => value + 1)}>
                      重新加载
                    </Button>
                  }
                />
              )}
              <Conversations
                aria-label="会话列表"
                className="min-h-0 flex-1 p-0!"
                groupable
                styles={{
                  creation: {
                    minHeight: token.controlHeightLG,
                    marginBottom: token.marginSM,
                  },
                  item: {
                    height: 'auto',
                    minHeight: token.controlHeightLG + token.paddingSM,
                    paddingBlock: token.paddingXS,
                    paddingInline: token.paddingSM,
                  },
                }}
                activeKey={selected ? String(selected) : undefined}
                onActiveChange={(key) => setSelected(Number(key))}
                creation={{
                  label: '发起聊天',
                  onClick: () => setPickerOpen(true),
                }}
                items={
                  conversations?.items.map((item) => {
                    const peer = peerOf(item);
                    const label = peer?.display_name || '原参与人';
                    return {
                      key: String(item.id),
                      group: conversationGroup(item),
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': label,
                      'aria-pressed': selected === item.id,
                      onKeyDown: (
                        event: React.KeyboardEvent<HTMLLIElement>,
                      ) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelected(item.id);
                        }
                      },
                      label: (
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">
                              {label}
                            </span>
                            <Badge
                              count={item.unread_count}
                              overflowCount={99}
                              size="small"
                            />
                          </span>
                          <Typography.Text
                            type="secondary"
                            className="truncate text-xs!"
                          >
                            {item.last_message?.preview || '暂无消息'}
                          </Typography.Text>
                        </span>
                      ),
                    };
                  }) || []
                }
              />
              {loading ? (
                <div className="flex justify-center p-6">
                  <Spin />
                </div>
              ) : !conversations?.items.length && !error ? (
                <Welcome
                  className="mx-3 mb-4"
                  variant="borderless"
                  title="暂无聊天"
                  description="发起与空间成员的对话"
                />
              ) : null}
              <Pagination
                className="px-2 pb-3"
                current={page}
                pageSize={PAGE_SIZE}
                total={conversations?.total || 0}
                showSizeChanger={false}
                hideOnSinglePage
                simple
                onChange={(value) => {
                  setLoading(true);
                  setPage(value);
                }}
              />
            </div>
            <div className="flex h-11 shrink-0 items-center border-t border-[var(--ant-color-border-secondary)] px-2">
              <Typography.Text type="secondary" className="text-xs!">
                {unread?.message_count || 0} 条未读
              </Typography.Text>
            </div>
          </aside>
        )}
        {selected ? (
          <ConversationPanel
            key={selected}
            slug={slug}
            id={selected}
            visible={visible}
            narrow={narrow}
            onBack={() => setSelected(undefined)}
          />
        ) : (
          !narrow && (
            <div className="flex min-w-0 flex-1 items-center justify-center p-6">
              <Welcome
                variant="borderless"
                icon={<CommentOutlined />}
                title="我的聊天"
                description="选择一个会话开始沟通"
              />
            </div>
          )
        )}
      </div>
      {pickerOpen && (
        <PeerPicker
          slug={slug}
          visible={visible}
          onClose={() => setPickerOpen(false)}
          onSelect={(item) => {
            setSelected(item.id);
            setPage(1);
            setRevision((value) => value + 1);
            setPickerOpen(false);
          }}
        />
      )}
    </PageContainer>
  );
}

function MessagingOrganizationSwitch({ slug }: { slug: string }) {
  const { initialState, setInitialState } = useModel('@@initialState');
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const currentUser = initialState?.currentUser;
  const latestState = useRef(initialState);
  latestState.current = initialState;

  useEffect(() => {
    let active = true;
    const previousSlug = getSelectedOrgSlug();
    const previousRevision = getOrgSelectionRevision();
    const previousStateSlug = initialState?.selectedOrgSlug;
    const switchOrganization = async () => {
      setError('');
      try {
        const snapshot = await loadAuthenticatedState(
          undefined,
          currentUser,
          slug,
        );
        if (!active) return;
        if (!snapshot || snapshot.selectedOrgSlug !== slug)
          throw new Error('目标工作空间不可访问');
        if (
          getOrgSelectionRevision() !== previousRevision ||
          getSelectedOrgSlug() !== previousSlug ||
          latestState.current?.selectedOrgSlug !== previousStateSlug ||
          latestState.current?.currentUser?.id !== currentUser?.id
        )
          throw new Error('工作空间或账号已变更');
        setSelectedOrgSlug(slug);
        setInitialState((state) => ({ ...state, ...snapshot }));
        void queryClient.invalidateQueries();
      } catch {
        if (active)
          setError('无法进入通知所属工作空间，请确认你仍是该工作空间成员后重试。');
      }
    };
    void switchOrganization();
    return () => {
      active = false;
    };
  }, [slug, currentUser?.id, attempt]);

  return (
    <PageContainer title="我的聊天">
      {error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={
            <Button onClick={() => setAttempt((value) => value + 1)}>
              重试
            </Button>
          }
        />
      ) : (
        <Spin description="正在进入通知所属工作空间" />
      )}
    </PageContainer>
  );
}

export default function MessagingAdminPage() {
  const { initialState } = useModel('@@initialState');
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const namespace = params.get('namespace')?.trim() || undefined;
  const targetSlug = params.get('organization_slug')?.trim() || undefined;
  const rawId = Number(params.get('conversation_id'));
  const initialConversationId =
    Number.isSafeInteger(rawId) && rawId > 0 ? rawId : undefined;
  const slug = initialState?.selectedOrgSlug;
  const userId = initialState?.currentUser?.id;
  if (targetSlug && targetSlug !== slug && userId)
    return (
      <MessagingOrganizationSwitch
        key={`${userId}:${targetSlug}`}
        slug={targetSlug}
      />
    );
  if (!slug || !userId)
    return (
      <PageContainer title="我的聊天">
        <Alert
          type="info"
          showIcon
          title="请登录并在右上角选择工作空间后查看聊天。"
        />
      </PageContainer>
    );
  return (
    <MessagingWorkspace
      key={`${userId}:organization_member:${slug}:${namespace || ''}:${initialConversationId || ''}`}
      slug={slug}
      namespace={namespace}
      initialConversationId={initialConversationId}
    />
  );
}
