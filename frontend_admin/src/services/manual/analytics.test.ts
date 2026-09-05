import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('@umijs/max', () => ({ request: mockRequest }));

import {
  browserAnalyticsIdentity,
  getAnalyticsSources,
  trackAnalyticsEvent,
} from './analytics';

describe('analytics client', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      event_ids: [1],
      errors: [],
    });
    localStorage.clear();
    sessionStorage.clear();
  });

  it('生成稳定的匿名标识与会话标识', () => {
    const first = browserAnalyticsIdentity();
    const second = browserAnalyticsIdentity();

    expect(first.anonymous_id).toBeTruthy();
    expect(first.session_id).toBeTruthy();
    expect(second).toEqual(first);
  });

  it('向统一采集接口补齐来源、时间和访客标识', async () => {
    await trackAnalyticsEvent({
      event_name: 'house.view',
      target_type: 'house',
      target_id: 10,
      properties: { page: 'house_detail' },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/analytics/events/',
      expect.objectContaining({
        method: 'POST',
        data: {
          events: [
            expect.objectContaining({
              event_name: 'house.view',
              target_id: 10,
              source: 'public',
              anonymous_id: expect.any(String),
              session_id: expect.any(String),
              occurred_at: expect.any(String),
            }),
          ],
        },
      }),
    );
  });

  it('从后端获取分析来源定义', async () => {
    await getAnalyticsSources();

    expect(mockRequest).toHaveBeenCalledWith('/api/analytics/sources/', {
      method: 'GET',
    });
  });
});
