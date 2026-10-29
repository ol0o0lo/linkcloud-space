import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ request: vi.fn(), push: vi.fn() }));
vi.mock('@umijs/max', () => ({
  request: mock.request,
  history: {
    push: mock.push,
    location: {
      pathname: '/space/messaging',
      search: '?conversation_id=21',
      hash: '',
    },
  },
}));

import { listMessagingMessages, sendMessagingMessage } from './messaging';

describe('聊天传输适配', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    mock.request.mockResolvedValue({});
  });

  it('使用生成客户端，固定路径组织、请求头、取消信号与正文', async () => {
    const signal = new AbortController().signal;
    const body = {
      client_message_id: 'e37a655d-b64b-443a-b555-4993e1dfd5f8',
      content: '你好',
    };
    await sendMessagingMessage('tenant-a', 21, body, signal);
    expect(mock.request).toHaveBeenCalledWith(
      '/api/messaging/organizations/tenant-a/conversations/21/messages/',
      expect.objectContaining({
        method: 'POST',
        data: body,
        signal,
        headers: {
          'X-Org-Slug': 'tenant-a',
          'Content-Type': 'application/json',
        },
      }),
    );
    await listMessagingMessages(
      'tenant-a',
      21,
      { page: 1, page_size: 50, after_seq: 7 },
      signal,
    );
    expect(mock.request).toHaveBeenLastCalledWith(
      '/api/messaging/organizations/tenant-a/conversations/21/messages/',
      expect.objectContaining({
        params: { page: 1, page_size: 50, after_seq: 7 },
        signal,
      }),
    );
  });

  it('登录失效恢复管理端登录，已经取消的旧作用域不能触发跳转', async () => {
    const failure = { response: { status: 401 } };
    mock.request.mockRejectedValue(failure);
    const controller = new AbortController();
    await expect(
      listMessagingMessages(
        'tenant-a',
        21,
        { page: 1, page_size: 50 },
        controller.signal,
      ),
    ).rejects.toBe(failure);
    expect(mock.push).toHaveBeenCalledWith(
      '/user/login?redirect=%2Fspace%2Fmessaging%3Fconversation_id%3D21',
    );
    mock.push.mockClear();
    controller.abort();
    await expect(
      listMessagingMessages(
        'tenant-a',
        21,
        { page: 1, page_size: 50 },
        controller.signal,
      ),
    ).rejects.toBe(failure);
    expect(mock.push).not.toHaveBeenCalled();
  });
});
