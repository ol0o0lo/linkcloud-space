import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MessagingConversation,
  MessagingMessage,
} from '@/services/manual/messaging';

const mock = vi.hoisted(() => ({
  state: {
    selectedOrgSlug: 'tenant-a',
    currentUser: { id: 1, is_superuser: true },
  },
  location: { search: '' },
  setInitialState: vi.fn(),
  selectOrg: vi.fn(),
  loadState: vi.fn(),
  storeOrg: vi.fn(),
  storedSlug: 'tenant-a',
  orgSelectionRevision: 0,
  invalidateQueries: vi.fn(),
  list: vi.fn(),
  count: vi.fn(),
  detail: vi.fn(),
  messages: vi.fn(),
  send: vi.fn(),
  read: vi.fn(),
  peers: vi.fn(),
  direct: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useModel: () => ({
    initialState: mock.state,
    setInitialState: mock.setInitialState,
  }),
  useLocation: () => mock.location,
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mock.invalidateQueries }),
}));
vi.mock('@/services/manual/authenticatedState', () => ({
  loadAuthenticatedState: mock.loadState,
}));
vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiSelectOrg: mock.selectOrg,
}));
vi.mock('@/utils/orgSelection', () => ({
  setSelectedOrgSlug: mock.storeOrg,
  getSelectedOrgSlug: () => mock.storedSlug,
  getOrgSelectionRevision: () => mock.orgSelectionRevision,
}));
vi.mock('@/components/PageContainer', () => ({
  PageContainer: ({
    children,
    extra,
  }: {
    children: React.ReactNode;
    extra: React.ReactNode;
  }) => (
    <section>
      {extra}
      {children}
    </section>
  ),
}));
vi.mock('@/services/manual/messaging', () => ({
  listMessagingConversations: mock.list,
  getMessagingUnreadCount: mock.count,
  getMessagingConversation: mock.detail,
  listMessagingMessages: mock.messages,
  sendMessagingMessage: mock.send,
  markMessagingRead: mock.read,
  listMessagingPeers: mock.peers,
  createDirectConversation: mock.direct,
}));

import MessagingAdminPage from './index';

function conversation(slug = 'tenant-a'): MessagingConversation {
  return {
    id: 21,
    organization: { id: 1, slug, name: '测试组织' },
    namespace: 'im.direct',
    context_key: '',
    status: 'active',
    status__mapping: '正常',
    members: [
      {
        id: 10,
        user_id: 1,
        display_name: '本人',
        avatar_url: null,
        access_kind: 'organization_member',
      },
      {
        id: 11,
        user_id: 2,
        display_name: '张同事',
        avatar_url: null,
        access_kind: 'organization_member',
      },
    ],
    my_member_id: 10,
    my_last_read_seq: 0,
    unread_count: 2,
    can_send: true,
    send_block_reason: '',
    send_block_reason__mapping: '',
    last_message: {
      id: 2,
      seq: 2,
      sender_member_id: 11,
      preview: '最近预览',
      created_at: '2026-10-24T08:30:00Z',
    },
  };
}

function message(seq: number, content = `消息${seq}`): MessagingMessage {
  return {
    id: seq,
    conversation_id: 21,
    seq,
    sender_member_id: 11,
    client_message_id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    content,
    created_at: '2026-10-24T08:30:00Z',
  };
}

function page<T>(items: T[], total = items.length) {
  return { items, total, page: 1, page_size: 50 };
}
async function openConversation() {
  fireEvent.click(await screen.findByText('张同事'));
  await screen.findByText('消息2');
}

describe('通用管理端聊天', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.state = {
      selectedOrgSlug: 'tenant-a',
      currentUser: { id: 1, is_superuser: true },
    };
    mock.location.search = '';
    mock.storedSlug = 'tenant-a';
    mock.orgSelectionRevision = 0;
    mock.storeOrg.mockImplementation((slug) => {
      if (mock.storedSlug !== slug) mock.orgSelectionRevision += 1;
      mock.storedSlug = slug;
      return slug;
    });
    mock.selectOrg.mockResolvedValue({ slug: 'tenant-b' });
    mock.loadState.mockResolvedValue({
      selectedOrgSlug: 'tenant-b',
      currentUser: mock.state.currentUser,
      organizations: [
        {
          id: 2,
          slug: 'tenant-b',
          name: '通知组织',
          is_current: true,
          is_primary: false,
        },
      ],
    });
    mock.setInitialState.mockImplementation((update) => {
      mock.state = update(mock.state);
    });
    mock.invalidateQueries.mockResolvedValue(undefined);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    mock.list.mockImplementation(async (slug: string) =>
      page([conversation(slug)]),
    );
    mock.count.mockResolvedValue({ message_count: 2, conversation_count: 1 });
    mock.detail.mockImplementation(async (slug: string) => conversation(slug));
    mock.messages.mockResolvedValue(page([message(2), message(1)]));
    mock.read.mockImplementation(
      async (_slug: string, _id: number, seq: number) => ({
        last_read_seq: seq,
        unread_count: 0,
      }),
    );
    mock.send.mockImplementation(
      async (
        _slug: string,
        _id: number,
        body: { client_message_id: string; content: string },
      ) => ({
        ...message(4, body.content),
        sender_member_id: 10,
        client_message_id: body.client_message_id,
      }),
    );
    mock.peers.mockResolvedValue(
      page([{ user_id: 2, display_name: '张同事', avatar_url: null }]),
    );
    mock.direct.mockResolvedValue(conversation());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('通过空间成员目录发起单聊，以 seq 顺序显示最近消息并同步已读', async () => {
    render(<MessagingAdminPage />);
    fireEvent.click(screen.getByRole('button', { name: /发起聊天/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(
      within(dialog).getByRole('searchbox', { name: '搜索空间成员' }),
      { target: { value: '张' } },
    );
    fireEvent.click(
      await within(dialog).findByRole('button', { name: '聊 天' }),
    );
    await screen.findByText('消息2');
    expect(mock.peers).toHaveBeenLastCalledWith(
      'tenant-a',
      { keyword: '张', page: 1, page_size: 20 },
      expect.any(AbortSignal),
    );
    expect(mock.direct).toHaveBeenCalledWith(
      'tenant-a',
      2,
      expect.any(AbortSignal),
    );
    const log = screen.getByRole('log');
    expect(
      Array.from(log.querySelectorAll('.ant-bubble-content')).map(
        (item) => item.textContent,
      ),
    ).toEqual([
      expect.stringContaining('消息1'),
      expect.stringContaining('消息2'),
    ]);
    await waitFor(() =>
      expect(mock.read).toHaveBeenCalledWith(
        'tenant-a',
        21,
        2,
        expect.any(AbortSignal),
      ),
    );
    expect(mock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['messaging-unread'],
    });
  });

  it('失败重试复用正文与 UUID，发送回执不会跳过尚未补取的较小 seq', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mock.send.mockRejectedValueOnce(new Error('response lost'));
    render(<MessagingAdminPage />);
    await openConversation();
    fireEvent.change(screen.getByRole('textbox', { name: '消息正文' }), {
      target: { value: '  你好\r\n同事  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /发送消息/ }));
    fireEvent.click(await screen.findByRole('button', { name: '重试发送' }));
    await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(2));
    expect(mock.send.mock.calls[0][2]).toEqual(mock.send.mock.calls[1][2]);
    expect(mock.send.mock.calls[0][2]).toMatchObject({
      content: '你好\n同事',
      client_message_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    await waitFor(() =>
      expect(screen.queryByText('发送中…')).not.toBeInTheDocument(),
    );
    expect(mock.read.mock.calls.every((call) => call[2] <= 2)).toBe(true);
    mock.messages.mockResolvedValueOnce(
      page([message(3, '期间收到的消息'), message(4, '你好\n同事')]),
    );
    await act(() => vi.advanceTimersByTimeAsync(30100));
    expect(mock.messages).toHaveBeenLastCalledWith(
      'tenant-a',
      21,
      { page: 1, page_size: 50, after_seq: 2 },
      expect.any(AbortSignal),
    );
    expect(screen.getByText('期间收到的消息')).toBeInTheDocument();
  });

  it('使用 Ant Design X 发送纯文字，保留换行并将 HTML 当作正文显示', async () => {
    const view = render(<MessagingAdminPage />);
    await openConversation();
    const input = screen.getByRole('textbox', { name: '消息正文' });
    const submit = screen.getByRole('button', { name: '发送消息' });
    expect(input.closest('.ant-sender')).not.toBeNull();
    expect(submit.closest('.ant-sender-footer')).not.toBeNull();
    expect(input).toHaveAttribute('maxlength', '2000');
    expect(
      screen.getByRole('log').querySelector('.ant-bubble-list'),
    ).not.toBeNull();
    expect(submit).toBeDisabled();
    expect(view.container.querySelector('input[type="file"]')).toBeNull();

    fireEvent.change(input, {
      target: { value: '  你好\n<img src=x onerror=alert(1)>  ' },
    });
    fireEvent.click(submit);
    await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(1));
    expect(mock.send.mock.calls[0][2]).toEqual({
      client_message_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      content: '你好\n<img src=x onerror=alert(1)>',
    });
    await waitFor(() =>
      expect(screen.queryByText('发送中…')).not.toBeInTheDocument(),
    );
    expect(input).toHaveValue('');
    expect(
      within(screen.getByRole('log'))
        .getByText(/<img src=x/)
        .closest('.ant-bubble'),
    ).not.toBeNull();
    expect(screen.getByRole('log').querySelector('img')).toBeNull();
  });

  it('通过 Conversations 键盘选择会话，空白聊天区使用 Welcome', async () => {
    const view = render(<MessagingAdminPage />);
    const entry = await screen.findByRole('button', { name: '张同事' });
    expect(entry.closest('.ant-conversations')).not.toBeNull();
    expect(
      screen.getByText('选择一个会话开始沟通').closest('.ant-welcome'),
    ).not.toBeNull();
    expect(
      view.container.querySelector('.ant-conversations-creation'),
    ).toHaveTextContent('发起聊天');
    fireEvent.keyDown(entry, { key: 'Enter' });
    await screen.findByText('消息2');
    expect(entry).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('log').querySelector('.ant-bubble-list-scroll-box'),
    ).not.toBeNull();
  });

  it('Enter 保留换行，中文输入确认不误发，Ctrl / Command + Enter 才发送', async () => {
    render(<MessagingAdminPage />);
    await openConversation();
    const input = screen.getByRole('textbox', { name: '消息正文' });
    fireEvent.change(input, { target: { value: '快捷键发送' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(input, {
      key: 'Enter',
      ctrlKey: true,
      isComposing: true,
    });
    expect(mock.send).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: 'Command 发送' } });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(2));
    expect(mock.send.mock.calls[1][2].content).toBe('Command 发送');
  });

  it.each([
    'organization',
    'account',
    'namespace',
  ])('切换 %s 后拒绝旧请求回填并丢弃旧发送草稿', async (kind) => {
    let finishOld:
      | ((value: ReturnType<typeof page<MessagingMessage>>) => void)
      | undefined;
    mock.messages.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    const view = render(<MessagingAdminPage />);
    fireEvent.click(await screen.findByText('张同事'));
    await waitFor(() => expect(mock.messages).toHaveBeenCalledTimes(1));
    if (kind === 'organization') mock.state.selectedOrgSlug = 'tenant-b';
    if (kind === 'account')
      mock.state.currentUser = { id: 3, is_superuser: true };
    if (kind === 'namespace') mock.location.search = '?namespace=demo.beta';
    view.rerender(<MessagingAdminPage />);
    await act(async () => {
      finishOld?.(page([message(7, '旧作用域消息')]));
    });
    expect(screen.queryByText('旧作用域消息')).not.toBeInTheDocument();
    await openConversation();
    expect(mock.messages).toHaveBeenLastCalledWith(
      kind === 'organization' ? 'tenant-b' : 'tenant-a',
      21,
      { page: 1, page_size: 50 },
      expect.any(AbortSignal),
    );
    if (kind === 'namespace')
      expect(mock.list).toHaveBeenLastCalledWith(
        'tenant-a',
        { page: 1, page_size: 20, namespace: 'demo.beta' },
        expect.any(AbortSignal),
      );
  });

  it('每 30 秒串行刷新，后台继续补取但不标记已读，返回前台立即刷新', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<MessagingAdminPage />);
    await openConversation();
    let finishSlow:
      | ((value: ReturnType<typeof page<MessagingMessage>>) => void)
      | undefined;
    mock.messages.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSlow = resolve;
        }),
    );
    await act(() => vi.advanceTimersByTimeAsync(30100));
    expect(mock.messages).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(mock.messages).toHaveBeenCalledTimes(2);
    const oldSignal = mock.messages.mock.calls[1][3] as AbortSignal;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(oldSignal.aborted).toBe(false);
    const listCount = mock.list.mock.calls.length;
    await act(async () => {
      finishSlow?.(page([message(3, '后台收到的消息')]));
    });
    expect(mock.messages).toHaveBeenCalledTimes(2);
    expect(screen.getByText('后台收到的消息')).toBeInTheDocument();
    mock.messages.mockResolvedValueOnce(page([message(4, '后台下一轮消息')]));
    await act(() => vi.advanceTimersByTimeAsync(30100));
    expect(mock.list.mock.calls.length).toBeGreaterThan(listCount);
    expect(screen.getByText('后台下一轮消息')).toBeInTheDocument();
    expect(mock.read.mock.calls.every((call) => call[2] <= 2)).toBe(true);
    mock.messages.mockResolvedValueOnce(page([message(5, '回到前台补取')]));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    await act(async () =>
      document.dispatchEvent(new Event('visibilitychange')),
    );
    expect(screen.getByText('回到前台补取')).toBeInTheDocument();
    expect(mock.messages).toHaveBeenLastCalledWith(
      'tenant-a',
      21,
      { page: 1, page_size: 50, after_seq: 4 },
      expect.any(AbortSignal),
    );
  });

  it('加载更早历史使用最小 seq，浏览历史时不推进未看到的新消息', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mock.messages.mockResolvedValueOnce(page([message(3), message(2)], 3));
    render(<MessagingAdminPage />);
    await openConversation();
    const log = screen
      .getByRole('log')
      .querySelector<HTMLDivElement>('.ant-bubble-list-scroll-box');
    if (!log) throw new Error('消息列表未创建滚动容器');
    Object.defineProperties(log, {
      scrollHeight: {
        configurable: true,
        get: () =>
          log.querySelectorAll('.ant-bubble:not(.ant-bubble-system)').length *
            100 +
          log.querySelectorAll('.ant-bubble-system').length * 40,
      },
      clientHeight: { configurable: true, value: 100 },
    });
    log.scrollTop = 0;
    fireEvent.scroll(log);
    mock.messages.mockResolvedValueOnce(page([message(1)]));
    fireEvent.click(screen.getByRole('button', { name: '加载更早消息' }));
    await screen.findByText('消息1');
    // 新增一条消息，同时移除已加载完毕的历史入口。
    expect(log.scrollTop).toBe(60);
    expect(mock.messages).toHaveBeenLastCalledWith(
      'tenant-a',
      21,
      { page: 1, page_size: 50, before_seq: 2 },
      expect.any(AbortSignal),
    );
    mock.messages.mockResolvedValueOnce(page([message(4, '尚未看到的新消息')]));
    await act(() => vi.advanceTimersByTimeAsync(30100));
    expect(mock.read.mock.calls.every((call) => call[2] <= 3)).toBe(true);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: '查看最新消息' })),
    );
    expect(mock.read).toHaveBeenLastCalledWith(
      'tenant-a',
      21,
      4,
      expect.any(AbortSignal),
    );
  });

  it('组织 owner / 超级管理员也必须通过本人参与资格校验', async () => {
    mock.location.search = '?conversation_id=21';
    mock.detail.mockRejectedValueOnce(new Error('CONVERSATION_NOT_FOUND'));
    render(<MessagingAdminPage />);
    expect(
      await screen.findByText('会话加载失败或已无访问权限，请稍后重试。'),
    ).toBeInTheDocument();
    expect(mock.messages).not.toHaveBeenCalled();
    expect(mock.send).not.toHaveBeenCalled();
    expect(mock.read).not.toHaveBeenCalled();
  });

  it('跨组织通知先验证并切换工作空间，再以目标工作空间查询该会话', async () => {
    mock.location.search = '?conversation_id=21&organization_slug=tenant-b';
    let finishSnapshot: ((result: typeof mock.state) => void) | undefined;
    mock.loadState.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSnapshot = resolve;
        }),
    );
    const view = render(<MessagingAdminPage />);
    expect(mock.detail).not.toHaveBeenCalled();
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.storeOrg).not.toHaveBeenCalled();

    await act(async () =>
      finishSnapshot?.({ ...mock.state, selectedOrgSlug: 'tenant-b' }),
    );
    await waitFor(() => expect(mock.setInitialState).toHaveBeenCalled());
    view.rerender(<MessagingAdminPage />);
    await screen.findByText('消息2');
    expect(mock.loadState).toHaveBeenCalledWith(
      undefined,
      mock.state.currentUser,
      'tenant-b',
    );
    expect(mock.selectOrg).not.toHaveBeenCalled();
    expect(mock.storeOrg).toHaveBeenCalledWith('tenant-b');
    expect(mock.state.selectedOrgSlug).toBe('tenant-b');
    expect(mock.detail).toHaveBeenCalledWith(
      'tenant-b',
      21,
      expect.any(AbortSignal),
    );
    expect(mock.list.mock.calls.every(([slug]) => slug === 'tenant-b')).toBe(
      true,
    );
    expect(
      mock.messages.mock.calls.every(([slug]) => slug === 'tenant-b'),
    ).toBe(true);
  });

  it('无目标工作空间权限时明确阻断，不使用当前工作空间查询通知会话', async () => {
    mock.location.search = '?conversation_id=21&organization_slug=tenant-b';
    mock.loadState.mockResolvedValueOnce({
      ...mock.state,
      selectedOrgSlug: undefined,
    });
    render(<MessagingAdminPage />);
    expect(
      await screen.findByText(
        '无法进入通知所属工作空间，请确认你仍是该工作空间成员后重试。',
      ),
    ).toBeInTheDocument();
    expect(mock.detail).not.toHaveBeenCalled();
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.messages).not.toHaveBeenCalled();
    expect(mock.storeOrg).not.toHaveBeenCalled();
    expect(mock.state.selectedOrgSlug).toBe('tenant-a');
    expect(mock.storedSlug).toBe('tenant-a');
  });

  it('组织刷新未确认目标时不打开会话', async () => {
    mock.location.search = '?conversation_id=21&organization_slug=tenant-b';
    mock.loadState.mockResolvedValueOnce({ selectedOrgSlug: 'tenant-a' });
    render(<MessagingAdminPage />);
    expect(
      await screen.findByText(
        '无法进入通知所属工作空间，请确认你仍是该工作空间成员后重试。',
      ),
    ).toBeInTheDocument();
    expect(mock.detail).not.toHaveBeenCalled();
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.setInitialState).not.toHaveBeenCalled();
    expect(mock.storedSlug).toBe('tenant-a');
  });

  it('组织刷新失败时保留当前 UI 与请求组织，不修改服务端 session', async () => {
    mock.location.search = '?conversation_id=21&organization_slug=tenant-b';
    mock.loadState.mockRejectedValueOnce(new Error('network'));
    render(<MessagingAdminPage />);
    await screen.findByText(
      '无法进入通知所属工作空间，请确认你仍是该工作空间成员后重试。',
    );
    expect(mock.state.selectedOrgSlug).toBe('tenant-a');
    expect(mock.storedSlug).toBe('tenant-a');
    expect(mock.storeOrg).not.toHaveBeenCalled();
    expect(mock.setInitialState).not.toHaveBeenCalled();
    expect(mock.selectOrg).not.toHaveBeenCalled();
  });

  it('组织刷新期间卸载后，迟到快照不修改 UI 或请求组织', async () => {
    mock.location.search = '?conversation_id=21&organization_slug=tenant-b';
    let finishSnapshot: ((result: typeof mock.state) => void) | undefined;
    mock.loadState.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSnapshot = resolve;
        }),
    );
    const view = render(<MessagingAdminPage />);
    view.unmount();
    await act(async () =>
      finishSnapshot?.({ ...mock.state, selectedOrgSlug: 'tenant-b' }),
    );
    expect(mock.state.selectedOrgSlug).toBe('tenant-a');
    expect(mock.storedSlug).toBe('tenant-a');
    expect(mock.storeOrg).not.toHaveBeenCalled();
    expect(mock.setInitialState).not.toHaveBeenCalled();
    expect(mock.selectOrg).not.toHaveBeenCalled();
  });

  it('交错打开不同组织通知时，旧快照不能覆盖较新的工作空间选择', async () => {
    mock.location.search = '?conversation_id=21&organization_slug=tenant-b';
    let finishOldSnapshot: ((result: typeof mock.state) => void) | undefined;
    mock.loadState.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldSnapshot = resolve;
        }),
    );
    const view = render(<MessagingAdminPage />);
    mock.location.search = '?conversation_id=21&organization_slug=tenant-c';
    mock.loadState.mockResolvedValueOnce({
      ...mock.state,
      selectedOrgSlug: 'tenant-c',
    });
    view.rerender(<MessagingAdminPage />);
    await waitFor(() => expect(mock.state.selectedOrgSlug).toBe('tenant-c'));
    view.rerender(<MessagingAdminPage />);
    await act(async () =>
      finishOldSnapshot?.({ ...mock.state, selectedOrgSlug: 'tenant-b' }),
    );
    expect(mock.state.selectedOrgSlug).toBe('tenant-c');
    expect(mock.storedSlug).toBe('tenant-c');
    expect(mock.storeOrg.mock.calls).toEqual([['tenant-c']]);
    expect(mock.selectOrg).not.toHaveBeenCalled();
  });

  it('刷新期间用户手动切换工作空间时，旧快照不覆盖新的 UI 与请求组织', async () => {
    mock.location.search = '?conversation_id=21&organization_slug=tenant-b';
    let finishSnapshot: ((result: typeof mock.state) => void) | undefined;
    mock.loadState.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSnapshot = resolve;
        }),
    );
    const view = render(<MessagingAdminPage />);
    mock.storedSlug = 'tenant-c';
    mock.state.selectedOrgSlug = 'tenant-c';
    view.rerender(<MessagingAdminPage />);
    await act(async () =>
      finishSnapshot?.({ ...mock.state, selectedOrgSlug: 'tenant-b' }),
    );
    expect(mock.state.selectedOrgSlug).toBe('tenant-c');
    expect(mock.storedSlug).toBe('tenant-c');
    expect(mock.storeOrg).not.toHaveBeenCalled();
    expect(mock.setInitialState).not.toHaveBeenCalled();
  });

  it('用户手动 A→C→A 后，迟到的 B 组织快照不能覆盖最终选择', async () => {
    mock.location.search = '?conversation_id=21&organization_slug=tenant-b';
    let finishSnapshot: ((result: typeof mock.state) => void) | undefined;
    mock.loadState.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSnapshot = resolve;
        }),
    );
    const view = render(<MessagingAdminPage />);
    for (const slug of ['tenant-c', 'tenant-a']) {
      mock.storeOrg(slug);
      mock.state = { ...mock.state, selectedOrgSlug: slug };
      view.rerender(<MessagingAdminPage />);
    }
    await act(async () =>
      finishSnapshot?.({ ...mock.state, selectedOrgSlug: 'tenant-b' }),
    );
    expect(mock.state.selectedOrgSlug).toBe('tenant-a');
    expect(mock.storedSlug).toBe('tenant-a');
    expect(mock.storeOrg.mock.calls).toEqual([['tenant-c'], ['tenant-a']]);
    expect(mock.setInitialState).not.toHaveBeenCalled();
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.detail).not.toHaveBeenCalled();
  });

  it('React StrictMode 重新挂载副作用后仍可发送消息', async () => {
    render(
      <React.StrictMode>
        <MessagingAdminPage />
      </React.StrictMode>,
    );
    await openConversation();
    fireEvent.change(screen.getByRole('textbox', { name: '消息正文' }), {
      target: { value: '重新挂载后发送' },
    });
    fireEvent.click(screen.getByRole('button', { name: /发送消息/ }));
    await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(1));
    expect(mock.send.mock.calls[0][3].aborted).toBe(false);
    await waitFor(() =>
      expect(screen.queryByText('发送中…')).not.toBeInTheDocument(),
    );
  });
});
