import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/services/openapi/notifications', () => ({ appsNotificationsApiListNotifications: mock.list }));
import { fetchNotificationFeed } from './notifications';

describe('通知后台补取', () => {
  beforeEach(() => vi.resetAllMocks());
  it('初次只读一页，新通知跨页时补齐至已知位置', async () => {
    const signal = new AbortController().signal;
    const newest = Array.from({ length: 50 }, (_, index) => ({ id: 120 - index }));
    mock.list.mockResolvedValueOnce({ items: newest, total: 120 });
    expect(await fetchNotificationFeed('tenant-a', signal)).toHaveLength(50);
    expect(mock.list).toHaveBeenCalledTimes(1);
    mock.list.mockResolvedValueOnce({ items: newest, total: 120 }).mockResolvedValueOnce({ items: [{ id: 70 }, { id: 69 }], total: 120 });
    expect(await fetchNotificationFeed('tenant-a', signal, 70)).toHaveLength(52);
    expect(mock.list).toHaveBeenLastCalledWith({ page: 2, page_size: 50 }, expect.objectContaining({ headers: { 'X-Org-Slug': 'tenant-a' }, signal }));
  });
});
