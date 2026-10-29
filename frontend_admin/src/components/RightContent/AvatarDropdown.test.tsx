import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  unreadCount: 1,
  chatUnreadCount: 2,
  push: vi.fn(),
  setInitialState: vi.fn(),
}));
vi.mock('@umijs/max', () => ({
  useModel: () => ({
    initialState: { currentUser: { id: 1 }, selectedOrgSlug: 'tenant-a' },
    setInitialState: mock.setInitialState,
  }),
  history: { push: mock.push, replace: vi.fn() },
}));
vi.mock('@/components/NotificationBell', () => ({
  default: ({
    children,
  }: {
    children: (state: {
      unreadCount: number;
      chatUnreadCount: number;
    }) => React.ReactElement;
  }) =>
    children({
      unreadCount: mock.unreadCount,
      chatUnreadCount: mock.chatUnreadCount,
    }),
}));
vi.mock('@/services/allauth/authSession', () => ({
  deleteBrowserV1AuthSession: vi.fn(),
}));

import { AvatarDropdown } from './AvatarDropdown';

describe('头像菜单的聊天与个人通知入口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.unreadCount = 1;
    mock.chatUnreadCount = 2;
  });
  afterEach(cleanup);

  it('从头像菜单进入聊天和个人通知，保留原有账号入口', async () => {
    render(
      <AvatarDropdown>
        <span>测试用户</span>
      </AvatarDropdown>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: '账号菜单，有未读消息' }),
    );
    expect(
      await screen.findByRole('menuitem', { name: /房东中心/ }),
    ).toBeInTheDocument();
    const chat = await screen.findByRole('menuitem', { name: /我的聊天/ });
    expect(chat.querySelector('.ant-badge-dot')).not.toBeNull();
    fireEvent.click(chat);
    expect(mock.push).toHaveBeenLastCalledWith('/space/messaging');
    fireEvent.click(
      screen.getByRole('button', { name: '账号菜单，有未读消息' }),
    );
    const notifications = await screen.findByRole('menuitem', {
      name: /个人通知/,
    });
    expect(notifications.querySelector('.ant-badge-dot')).not.toBeNull();
    fireEvent.click(notifications);
    expect(mock.push).toHaveBeenLastCalledWith(
      '/personal-business/notifications',
    );
  });

  it.each([
    { notifications: 1, chats: 0 },
    { notifications: 0, chats: 2 },
  ])('任一来源有未读时头像亮红点，全部已读后消失：%j', async (counts) => {
    mock.unreadCount = counts.notifications;
    mock.chatUnreadCount = counts.chats;
    const view = render(
      <AvatarDropdown>
        <span>测试用户</span>
      </AvatarDropdown>,
    );
    const trigger = screen.getByRole('button', {
      name: '账号菜单，有未读消息',
    });
    expect(trigger.querySelector('.ant-badge-dot')).not.toBeNull();
    mock.unreadCount = 0;
    mock.chatUnreadCount = 0;
    view.rerender(
      <AvatarDropdown>
        <span>测试用户</span>
      </AvatarDropdown>,
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: '账号菜单' })
          .querySelector('.ant-badge-dot[data-show="true"]'),
      ).toBeNull(),
    );
  });
});
