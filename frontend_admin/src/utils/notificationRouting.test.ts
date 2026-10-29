import { describe, expect, it } from 'vitest';
import { getNotificationPath, getNotificationUrl } from './notificationRouting';

function notification(data: API.NotificationOut['data']): API.NotificationOut {
  return {
    id: 8,
    category: 'messaging.message',
    title: '新消息',
    body: '你好',
    is_read: false,
    created_at: '2026-10-24T08:00:00Z',
    url: '/pages/messages/conversation?conversation_id=21',
    data,
  };
}

describe('通知管理端链接', () => {
  it('聊天链接保留通知所属工作空间并进入管理端聊天', () => {
    expect(
      getNotificationUrl(
        notification({ conversation_id: 21, organization_slug: 'tenant-b' }),
      ),
    ).toBe(
      '/dashboard/space/messaging?conversation_id=21&organization_slug=tenant-b',
    );
  });

  it.each([
    { conversation_id: 21 },
    { conversation_id: 0, organization_slug: 'tenant-b' },
    { conversation_id: 21, organization_slug: ' ' },
  ])('聊天信息不完整时不回退至小程序或当前工作空间：%j', (data) => {
    expect(getNotificationUrl(notification(data))).toBeUndefined();
  });

  it('保留历史房源咨询通知链接', () => {
    const item = {
      ...notification({}),
      category: 'house.contact',
      url: '/dashboard/rental/customers?notification_id=8',
    };
    expect(getNotificationUrl(item)).toBe(item.url);
  });

  it('任务通知使用管理端路由，危险链接回退到通知详情', () => {
    const item = {
      ...notification({}),
      category: 'team.task.assigned',
      url: '/dashboard/rental/workbench/tasks?assignment_id=7',
    };
    expect(getNotificationPath(item)).toBe(
      '/rental/workbench/tasks?assignment_id=7',
    );
    expect(getNotificationPath({ ...item, url: 'javascript:alert(1)' })).toBe(
      '/personal-business/notifications?notification_id=8',
    );
  });
});
